import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "laporan-harian-test-")), "test.db");

const { db, runMigrations } = await import("../src/db");
const { login } = await import("../src/auth");
const { handleCreateProject, handleAddMember } = await import("../src/routes/projects");
const { handleCreateTask } = await import("../src/routes/tasks");
const { handleListRiwayat, handleGetRiwayatDetail } = await import("../src/routes/riwayat");

const TENAGA_EMAIL = "tenaga.riwayat@example.test";
const PASSWORD = "kata-sandi-aman";

// Bulan khusus buat file test ini — isolasi query di handler sudah per user_id, jadi tanggal
// boleh tumpang tindih dengan file test lain (db dibagi lintas file dalam satu proses bun test).
const BULAN = "2026-04";

let tenagaId: number;
let tenagaToken: string;
let projectAId: number;
let projectBId: number;
let taskAId: number;

function req(method: string, path: string, token?: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Cookie: `session=${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

beforeAll(async () => {
  runMigrations();
  const hash = await Bun.password.hash(PASSWORD);

  const tenagaResult = db
    .query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)")
    .run("Tenaga Riwayat", TENAGA_EMAIL, hash);
  tenagaId = Number(tenagaResult.lastInsertRowid);
  db.query("INSERT INTO user_roles (user_id, role) VALUES (?, 'tenaga_ahli')").run(tenagaId);

  db.query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)").run(
    "Admin Riwayat",
    "admin.riwayat@example.test",
    hash,
  );
  db.query("INSERT INTO user_roles (user_id, role) SELECT id, 'admin' FROM users WHERE email = ?").run(
    "admin.riwayat@example.test",
  );
  const adminToken = (await login("admin.riwayat@example.test", PASSWORD))!.token;

  const projectARes = await handleCreateProject(
    req("POST", "/api/projects", adminToken, { nama: "Project Riwayat A", isActive: true }),
  );
  projectAId = ((await projectARes.json()) as { project: { id: number } }).project.id;

  const projectBRes = await handleCreateProject(
    req("POST", "/api/projects", adminToken, { nama: "Project Riwayat B", isActive: true }),
  );
  projectBId = ((await projectBRes.json()) as { project: { id: number } }).project.id;

  await handleAddMember(
    req("POST", `/api/projects/${projectAId}/members`, adminToken, { userId: tenagaId }),
    projectAId,
  );
  await handleAddMember(
    req("POST", `/api/projects/${projectBId}/members`, adminToken, { userId: tenagaId }),
    projectBId,
  );

  tenagaToken = (await login(TENAGA_EMAIL, PASSWORD))!.token;

  const taskARes = await handleCreateTask(
    req("POST", "/api/tasks", tenagaToken, { projectId: projectAId, deskripsi: "Task Riwayat A" }),
  );
  taskAId = ((await taskARes.json()) as { task: { id: number } }).task.id;
});

describe("GET /api/history", () => {
  test("ditolak tanpa login", async () => {
    const res = handleListRiwayat(req("GET", `/api/history?bulan=${BULAN}`));
    expect(res.status).toBe(401);
  });

  test("ditolak (400) format bulan salah", async () => {
    const res = handleListRiwayat(req("GET", "/api/history?bulan=2026-4", tenagaToken));
    expect(res.status).toBe(400);
  });

  test("kosong kalau belum ada log/izin di bulan itu", async () => {
    const res = handleListRiwayat(req("GET", "/api/history?bulan=2026-01", tenagaToken));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { hari: unknown[] };
    expect(body.hari).toEqual([]);
  });

  test("tanggal dengan realisasi + rencana muncul dengan count benar", async () => {
    db.query("INSERT INTO task_logs (task_id, user_id, tanggal, jenis, catatan) VALUES (?, ?, ?, 'realisasi', 'Beres')").run(
      taskAId,
      tenagaId,
      `${BULAN}-05`,
    );
    db.query("INSERT INTO task_logs (task_id, user_id, tanggal, jenis) VALUES (?, ?, ?, 'rencana')").run(
      taskAId,
      tenagaId,
      `${BULAN}-06`,
    );

    const res = handleListRiwayat(req("GET", `/api/history?bulan=${BULAN}`, tenagaToken));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { hari: { tanggal: string; realisasiCount: number; rencanaCount: number }[] };
    const tgl05 = body.hari.find((h) => h.tanggal === `${BULAN}-05`);
    expect(tgl05?.realisasiCount).toBe(1);
    expect(tgl05?.rencanaCount).toBe(0);
    const tgl06 = body.hari.find((h) => h.tanggal === `${BULAN}-06`);
    expect(tgl06?.rencanaCount).toBe(1);
  });

  test("tanggal cuma izin (tanpa log) tetap muncul", async () => {
    db.query("INSERT INTO leaves (user_id, tanggal, jenis) VALUES (?, ?, 'sakit')").run(tenagaId, `${BULAN}-10`);

    const res = handleListRiwayat(req("GET", `/api/history?bulan=${BULAN}`, tenagaToken));
    const body = (await res.json()) as { hari: { tanggal: string; izin: { jenis: string } | null }[] };
    const tgl10 = body.hari.find((h) => h.tanggal === `${BULAN}-10`);
    expect(tgl10).toBeDefined();
    expect(tgl10?.izin?.jenis).toBe("sakit");
  });

  test("filter projectId cuma tampilkan tanggal berlog di project itu, tapi tanggal izin tetap muncul", async () => {
    const res = handleListRiwayat(
      req("GET", `/api/history?bulan=${BULAN}&projectId=${projectBId}`, tenagaToken),
    );
    const body = (await res.json()) as { hari: { tanggal: string }[] };
    // Tanggal 05/06 punya log di project A, bukan B -> tidak muncul saat difilter ke B.
    expect(body.hari.some((h) => h.tanggal === `${BULAN}-05`)).toBe(false);
    expect(body.hari.some((h) => h.tanggal === `${BULAN}-06`)).toBe(false);
    // Tanggal izin tetap muncul walau difilter ke project B.
    expect(body.hari.some((h) => h.tanggal === `${BULAN}-10`)).toBe(true);
  });

  test("data user lain tidak ikut kebawa (isolasi per user)", async () => {
    const lainResult = db
      .query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)")
      .run("User Lain Riwayat", "lain.riwayat@example.test", "x");
    const lainId = Number(lainResult.lastInsertRowid);
    db.query("INSERT INTO task_logs (task_id, user_id, tanggal, jenis, catatan) VALUES (?, ?, ?, 'realisasi', 'Punya orang lain')").run(
      taskAId,
      lainId,
      `${BULAN}-20`,
    );

    const res = handleListRiwayat(req("GET", `/api/history?bulan=${BULAN}`, tenagaToken));
    const body = (await res.json()) as { hari: { tanggal: string }[] };
    expect(body.hari.some((h) => h.tanggal === `${BULAN}-20`)).toBe(false);
  });
});

describe("GET /api/history/:tanggal", () => {
  test("ditolak tanpa login", async () => {
    const res = handleGetRiwayatDetail(req("GET", `/api/history/${BULAN}-05`), `${BULAN}-05`);
    expect(res.status).toBe(401);
  });

  test("ditolak (400) format tanggal salah", async () => {
    const res = handleGetRiwayatDetail(req("GET", "/api/history/2026-4-5", tenagaToken), "2026-4-5");
    expect(res.status).toBe(400);
  });

  test("tanggal tanpa log maupun izin -> items kosong, izin null (200, bukan 404)", async () => {
    const res = handleGetRiwayatDetail(req("GET", `/api/history/${BULAN}-15`, tenagaToken), `${BULAN}-15`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; izin: unknown };
    expect(body.items).toEqual([]);
    expect(body.izin).toBeNull();
  });

  test("item realisasi bawa kendala+attachment yang benar, item rencana kosong keduanya", async () => {
    const realisasiLogId = db
      .query("SELECT id FROM task_logs WHERE task_id = ? AND user_id = ? AND tanggal = ? AND jenis = 'realisasi'")
      .get(taskAId, tenagaId, `${BULAN}-05`) as { id: number };
    db.query("INSERT INTO kendala (task_log_id, deskripsi, status) VALUES (?, ?, 'open')").run(
      realisasiLogId.id,
      "Nunggu review",
    );
    db.query(
      "INSERT INTO attachments (attachable_type, attachable_id, file_path, file_type, nama_asli, ukuran_bytes, uploaded_by) VALUES ('task_log', ?, 'attachments/x.jpg', 'image/jpeg', 'bukti.jpg', 100, ?)",
    ).run(realisasiLogId.id, tenagaId);

    const res = handleGetRiwayatDetail(req("GET", `/api/history/${BULAN}-05`, tenagaToken), `${BULAN}-05`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { jenis: string; kendala: unknown[]; attachments: unknown[] }[];
    };
    const realisasiItem = body.items.find((i) => i.jenis === "realisasi")!;
    expect(realisasiItem.kendala).toHaveLength(1);
    expect(realisasiItem.attachments).toHaveLength(1);

    const rencanaRes = handleGetRiwayatDetail(req("GET", `/api/history/${BULAN}-06`, tenagaToken), `${BULAN}-06`);
    const rencanaBody = (await rencanaRes.json()) as {
      items: { jenis: string; kendala: unknown[]; attachments: unknown[] }[];
    };
    const rencanaItem = rencanaBody.items.find((i) => i.jenis === "rencana")!;
    expect(rencanaItem.kendala).toHaveLength(0);
    expect(rencanaItem.attachments).toHaveLength(0);
  });

  test("izin tampil di detail", async () => {
    const res = handleGetRiwayatDetail(req("GET", `/api/history/${BULAN}-10`, tenagaToken), `${BULAN}-10`);
    const body = (await res.json()) as { izin: { jenis: string } | null };
    expect(body.izin?.jenis).toBe("sakit");
  });

  test("bolehEdit true untuk tanggal dalam bulan berjalan, false untuk tanggal lama", async () => {
    const resBaru = handleGetRiwayatDetail(
      req("GET", `/api/history/${BULAN}-05`, tenagaToken),
      `${BULAN}-05`,
      `${BULAN}-05`, // hariIniOverride = tanggal itu sendiri -> pasti dalam bulan berjalan
    );
    const bodyBaru = (await resBaru.json()) as { bolehEdit: boolean };
    expect(bodyBaru.bolehEdit).toBe(true);

    const resLama = handleGetRiwayatDetail(
      req("GET", `/api/history/${BULAN}-05`, tenagaToken),
      `${BULAN}-05`,
      "2026-08-01", // hariIniOverride jauh setelah tanggal laporan -> di luar bulan berjalan
    );
    const bodyLama = (await resLama.json()) as { bolehEdit: boolean };
    expect(bodyLama.bolehEdit).toBe(false);
  });
});

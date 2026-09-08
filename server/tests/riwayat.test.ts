import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "laporan-harian-test-")), "test.db");

const { db, runMigrations } = await import("../src/db");
const { login } = await import("../src/auth");
const { handleCreateProject, handleAddMember } = await import("../src/routes/projects");
const { handleCreateTask } = await import("../src/routes/tasks");
const { handleGetActivityHeatmap, handleGetRiwayatDetail } = await import("../src/routes/riwayat");

const TENAGA_EMAIL = "tenaga.riwayat@example.test";
const PASSWORD = "kata-sandi-aman";

// Bulan khusus buat file test ini — isolasi query di handler sudah per user_id, jadi tanggal
// boleh tumpang tindih dengan file test lain (db dibagi lintas file dalam satu proses bun test).
const BULAN = "2026-04";
// hariIniOverride tetap buat heatmap: rentang 12 bulan dihitung mundur dari tanggal ini
// (2025-05-01 s.d. 2026-04-30), supaya test tidak bergantung tanggal sungguhan server.
const HARI_INI_HEATMAP = "2026-04-30";

let tenagaId: number;
let tenagaToken: string;
let projectAId: number;
let projectBId: number;
let taskAId: number;
let taskBId: number;

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

  const taskBRes = await handleCreateTask(
    req("POST", "/api/tasks", tenagaToken, { projectId: projectBId, deskripsi: "Task Riwayat B" }),
  );
  taskBId = ((await taskBRes.json()) as { task: { id: number } }).task.id;
});

describe("GET /api/activity-heatmap", () => {
  test("ditolak tanpa login", () => {
    const res = handleGetActivityHeatmap(req("GET", "/api/activity-heatmap"));
    expect(res.status).toBe(401);
  });

  test("kosong kalau belum ada realisasi sama sekali", async () => {
    const res = handleGetActivityHeatmap(
      req("GET", "/api/activity-heatmap", tenagaToken),
      "2020-01-15",
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { hari: unknown[] };
    expect(body.hari).toEqual([]);
  });

  test("hitungan realisasi per tanggal benar, termasuk >1 log di tanggal sama; rencana tidak ikut kehitung", async () => {
    // Seed dipakai bareng describe detail di bawah: satu realisasi di tanggal 05 (taskAId), satu
    // rencana di tanggal 06 -- sengaja cuma satu baris di tanggal 05 supaya query .get() di test
    // detail tetap unik. Kasus ">1 log tanggal sama" dites terpisah di tanggal 03.
    db.query(
      "INSERT INTO task_logs (task_id, user_id, tanggal, jenis, catatan) VALUES (?, ?, ?, 'realisasi', 'Beres')",
    ).run(taskAId, tenagaId, `${BULAN}-05`);
    db.query("INSERT INTO task_logs (task_id, user_id, tanggal, jenis) VALUES (?, ?, ?, 'rencana')").run(
      taskAId,
      tenagaId,
      `${BULAN}-06`,
    );
    db.query(
      "INSERT INTO task_logs (task_id, user_id, tanggal, jenis, catatan) VALUES (?, ?, ?, 'realisasi', 'Dua kali 1')",
    ).run(taskAId, tenagaId, `${BULAN}-03`);
    db.query(
      "INSERT INTO task_logs (task_id, user_id, tanggal, jenis, catatan, is_extra) VALUES (?, ?, ?, 'realisasi', 'Dua kali 2', 1)",
    ).run(taskAId, tenagaId, `${BULAN}-03`);

    const res = handleGetActivityHeatmap(
      req("GET", "/api/activity-heatmap", tenagaToken),
      HARI_INI_HEATMAP,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { hari: { tanggal: string; realisasiCount: number }[] };
    const tgl03 = body.hari.find((h) => h.tanggal === `${BULAN}-03`);
    expect(tgl03?.realisasiCount).toBe(2);
    const tgl05 = body.hari.find((h) => h.tanggal === `${BULAN}-05`);
    expect(tgl05?.realisasiCount).toBe(1);
    expect(body.hari.some((h) => h.tanggal === `${BULAN}-06`)).toBe(false);
  });

  test("filter projectId cuma hitung realisasi task project itu", async () => {
    db.query(
      "INSERT INTO task_logs (task_id, user_id, tanggal, jenis, catatan) VALUES (?, ?, ?, 'realisasi', 'Punya project B')",
    ).run(taskBId, tenagaId, `${BULAN}-07`);

    const resA = handleGetActivityHeatmap(
      req("GET", `/api/activity-heatmap?projectId=${projectAId}`, tenagaToken),
      HARI_INI_HEATMAP,
    );
    const bodyA = (await resA.json()) as { hari: { tanggal: string }[] };
    expect(bodyA.hari.some((h) => h.tanggal === `${BULAN}-05`)).toBe(true);
    expect(bodyA.hari.some((h) => h.tanggal === `${BULAN}-07`)).toBe(false);

    const resB = handleGetActivityHeatmap(
      req("GET", `/api/activity-heatmap?projectId=${projectBId}`, tenagaToken),
      HARI_INI_HEATMAP,
    );
    const bodyB = (await resB.json()) as { hari: { tanggal: string }[] };
    expect(bodyB.hari.some((h) => h.tanggal === `${BULAN}-07`)).toBe(true);
    expect(bodyB.hari.some((h) => h.tanggal === `${BULAN}-05`)).toBe(false);
  });

  test("tanggal di luar rentang 12 bulan tidak ikut kehitung", async () => {
    db.query(
      "INSERT INTO task_logs (task_id, user_id, tanggal, jenis, catatan) VALUES (?, ?, '2024-01-10', 'realisasi', 'Terlalu lama')",
    ).run(taskAId, tenagaId);

    const res = handleGetActivityHeatmap(
      req("GET", "/api/activity-heatmap", tenagaToken),
      HARI_INI_HEATMAP,
    );
    const body = (await res.json()) as { dari: string; hari: { tanggal: string }[] };
    expect(body.dari).toBe("2025-05-01");
    expect(body.hari.some((h) => h.tanggal === "2024-01-10")).toBe(false);
  });

  test("data user lain tidak ikut kebawa (isolasi per user)", async () => {
    const lainResult = db
      .query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)")
      .run("User Lain Riwayat", "lain.riwayat@example.test", "x");
    const lainId = Number(lainResult.lastInsertRowid);
    db.query(
      "INSERT INTO task_logs (task_id, user_id, tanggal, jenis, catatan) VALUES (?, ?, ?, 'realisasi', 'Punya orang lain')",
    ).run(taskAId, lainId, `${BULAN}-20`);

    const res = handleGetActivityHeatmap(
      req("GET", "/api/activity-heatmap", tenagaToken),
      HARI_INI_HEATMAP,
    );
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
    db.query("INSERT INTO leaves (user_id, tanggal, jenis) VALUES (?, ?, 'sakit')").run(tenagaId, `${BULAN}-10`);

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

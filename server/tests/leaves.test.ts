import { beforeAll, describe, expect, test } from "bun:test";

const { runMigrations } = await import("../src/db");
const { db } = await import("./raw-db");
const { login } = await import("../src/auth");
const { handleCreateProject, handleAddMember } = await import("../src/routes/projects");
const { handleCreateTask } = await import("../src/routes/tasks");
const { handleSaveDailyInput } = await import("../src/routes/task-logs");
const { handleSaveLeave, handleCancelLeave } = await import("../src/routes/leaves");

const TENAGA_EMAIL = "tenaga.leaves@example.test";
const PASSWORD = "kata-sandi-aman";

// Awal Desember 2026, tidak beririsan dengan tanggal libur yang di-insert file test lain
// (db dibagi lintas file dalam satu proses "bun test" — lihat catatan di task-logs.test.ts).
const HARI_1 = "2026-12-07"; // Senin

let tenagaId: number;
let tenagaToken: string;
let projectId: number;
let taskId: number;

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
  await runMigrations();
  const hash = await Bun.password.hash(PASSWORD);

  const tenagaResult = await db
    .query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)")
    .run("Tenaga Leaves", TENAGA_EMAIL, hash);
  tenagaId = Number(tenagaResult.lastInsertRowid);
  await db.query("INSERT INTO user_roles (user_id, role) VALUES (?, 'tenaga_ahli')").run(tenagaId);

  await db.query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)").run(
    "Admin Leaves",
    "admin.leaves@example.test",
    hash,
  );
  await db.query("INSERT INTO user_roles (user_id, role) SELECT id, 'admin' FROM users WHERE email = ?").run(
    "admin.leaves@example.test",
  );
  const adminToken = (await login("admin.leaves@example.test", PASSWORD))!.token;

  const projectRes = await handleCreateProject(
    req("POST", "/api/projects", adminToken, { nama: "Project Leaves", isActive: true }),
  );
  const projectBody = (await projectRes.json()) as { project: { id: number } };
  projectId = projectBody.project.id;
  await handleAddMember(req("POST", `/api/projects/${projectId}/members`, adminToken, { userId: tenagaId }), projectId);

  tenagaToken = (await login(TENAGA_EMAIL, PASSWORD))!.token;

  const taskRes = await handleCreateTask(req("POST", "/api/tasks", tenagaToken, { projectId, deskripsi: "Task Leaves" }));
  taskId = ((await taskRes.json()) as { task: { id: number } }).task.id;
});

describe("Simpan izin", () => {
  test("tanggal di luar bulan berjalan ditolak (400)", async () => {
    const res = await handleSaveLeave(
      req("POST", "/api/leaves", tenagaToken, { tanggal: "2026-11-30", jenis: "izin" }),
      HARI_1,
    );
    expect(res.status).toBe(400);
  });

  test("berhasil simpan izin baru", async () => {
    const res = await handleSaveLeave(
      req("POST", "/api/leaves", tenagaToken, { tanggal: HARI_1, jenis: "sakit", alasan: "Demam" }),
      HARI_1,
    );
    expect(res.status).toBe(200);

    const row = await db
      .query("SELECT jenis, alasan, potong_cuti_tahunan FROM leaves WHERE user_id = ? AND tanggal = ?")
      .get(tenagaId, HARI_1) as { jenis: string; alasan: string; potong_cuti_tahunan: number | null };
    expect(row.jenis).toBe("sakit");
    expect(row.alasan).toBe("Demam");
    expect(row.potong_cuti_tahunan).toBeNull();
  });

  test("simpan ulang tanggal yang sama meng-update, bukan menggandakan baris", async () => {
    const res = await handleSaveLeave(
      req("POST", "/api/leaves", tenagaToken, { tanggal: HARI_1, jenis: "cuti", alasan: "Jadi cuti" }),
      HARI_1,
    );
    expect(res.status).toBe(200);

    const rows = await db.query("SELECT jenis, alasan FROM leaves WHERE user_id = ? AND tanggal = ?").all(tenagaId, HARI_1);
    expect(rows).toHaveLength(1);
    expect((rows[0] as { jenis: string }).jenis).toBe("cuti");
  });

  test("tolak (409) kalau tanggal itu sudah punya realisasi tersimpan", async () => {
    const tanggalRealisasi = "2026-12-10"; // Kamis
    const tanggalLaporan = "2026-12-11"; // Jumat, previousWorkday = tanggalRealisasi

    const saveRes = await handleSaveDailyInput(
      req("POST", "/api/task-logs", tenagaToken, {
        tanggal: tanggalLaporan,
        items: [{ taskId, jenis: "realisasi", catatan: "Sudah kerja", isExtra: true }],
      }),
      tanggalLaporan,
    );
    expect(saveRes.status).toBe(200);

    const izinRes = await handleSaveLeave(
      req("POST", "/api/leaves", tenagaToken, { tanggal: tanggalRealisasi, jenis: "izin" }),
      tanggalLaporan,
    );
    expect(izinRes.status).toBe(409);
  });
});

describe("Rencana lama otomatis terhapus saat izin disimpan", () => {
  const HARI_RENCANA = "2026-12-09"; // Rabu, belum dipakai test lain di file ini

  test("rencana tersimpan di tanggal itu hilang setelah izin disimpan", async () => {
    await handleSaveDailyInput(
      req("POST", "/api/task-logs", tenagaToken, {
        tanggal: HARI_RENCANA,
        items: [{ taskId, jenis: "rencana" }],
      }),
      HARI_RENCANA,
    );
    const before = await db
      .query("SELECT id FROM task_logs WHERE user_id = ? AND tanggal = ? AND jenis = 'rencana'")
      .get(tenagaId, HARI_RENCANA);
    expect(before).not.toBeNull();

    const res = await handleSaveLeave(
      req("POST", "/api/leaves", tenagaToken, { tanggal: HARI_RENCANA, jenis: "izin" }),
      HARI_RENCANA,
    );
    expect(res.status).toBe(200);

    const after = await db
      .query("SELECT id FROM task_logs WHERE user_id = ? AND tanggal = ? AND jenis = 'rencana'")
      .get(tenagaId, HARI_RENCANA);
    expect(after).toBeNull();
  });
});

describe("Batalkan izin", () => {
  test("menghapus baris leaves", async () => {
    const res = await handleCancelLeave(req("DELETE", `/api/leaves/${HARI_1}`, tenagaToken), HARI_1);
    expect(res.status).toBe(200);

    const row = await db.query("SELECT id FROM leaves WHERE user_id = ? AND tanggal = ?").get(tenagaId, HARI_1);
    expect(row).toBeNull();
  });

  test("batalkan izin yang tidak ada tetap 200 (idempoten)", async () => {
    const res = await handleCancelLeave(req("DELETE", `/api/leaves/${HARI_1}`, tenagaToken), HARI_1);
    expect(res.status).toBe(200);
  });
});

describe("Otorisasi", () => {
  test("POST tanpa login ditolak", async () => {
    const res = await handleSaveLeave(req("POST", "/api/leaves", undefined, { tanggal: HARI_1, jenis: "izin" }));
    expect(res.status).toBe(401);
  });

  test("DELETE tanpa login ditolak", async () => {
    const res = await handleCancelLeave(req("DELETE", `/api/leaves/${HARI_1}`), HARI_1);
    expect(res.status).toBe(401);
  });
});

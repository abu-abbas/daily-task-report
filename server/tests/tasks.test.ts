import { beforeAll, describe, expect, test } from "bun:test";

const { runMigrations } = await import("../src/db");
const { db } = await import("./raw-db");
const { login } = await import("../src/auth");
const { handleCreateProject, handleAddMember } = await import("../src/routes/projects");
const { handleListTasks, handleCreateTask, handleCloseTask } = await import("../src/routes/tasks");

const TENAGA_EMAIL = "tenaga.tasks@example.test";
const LUAR_EMAIL = "luar.tasks@example.test";
const PASSWORD = "kata-sandi-aman";

let tenagaId: number;
let tenagaToken: string;
let luarToken: string;
let projectId: number;

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
    .run("Tenaga Tasks", TENAGA_EMAIL, hash);
  tenagaId = Number(tenagaResult.lastInsertRowid);
  await db.query("INSERT INTO user_roles (user_id, role) VALUES (?, 'tenaga_ahli')").run(tenagaId);

  await db.query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)").run(
    "Luar Tasks",
    LUAR_EMAIL,
    hash,
  );
  await db.query("INSERT INTO user_roles (user_id, role) SELECT id, 'tenaga_ahli' FROM users WHERE email = ?").run(
    LUAR_EMAIL,
  );

  // Admin sementara cuma untuk membuat project — dibuat lewat query langsung supaya tidak
  // ikut jadi anggota (fokus test ini ke tasks, bukan otorisasi admin).
  const adminHash = await Bun.password.hash(PASSWORD);
  await db.query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)").run(
    "Admin Tasks",
    "admin.tasks@example.test",
    adminHash,
  );
  await db.query("INSERT INTO user_roles (user_id, role) SELECT id, 'admin' FROM users WHERE email = ?").run(
    "admin.tasks@example.test",
  );
  const adminToken = (await login("admin.tasks@example.test", PASSWORD))!.token;

  const projectRes = await handleCreateProject(
    req("POST", "/api/projects", adminToken, { nama: "Project Tasks", isActive: true }),
  );
  const projectBody = (await projectRes.json()) as { project: { id: number } };
  projectId = projectBody.project.id;
  await handleAddMember(req("POST", `/api/projects/${projectId}/members`, adminToken, { userId: tenagaId }), projectId);

  tenagaToken = (await login(TENAGA_EMAIL, PASSWORD))!.token;
  luarToken = (await login(LUAR_EMAIL, PASSWORD))!.token;
});

describe("GET /api/tasks", () => {
  test("ditolak tanpa login", async () => {
    const res = await handleListTasks(req("GET", `/api/tasks?projectId=${projectId}`));
    expect(res.status).toBe(401);
  });

  test("ditolak tanpa projectId", async () => {
    const res = await handleListTasks(req("GET", "/api/tasks", tenagaToken));
    expect(res.status).toBe(400);
  });

  test("ditolak untuk yang bukan anggota aktif project", async () => {
    const res = await handleListTasks(req("GET", `/api/tasks?projectId=${projectId}`, luarToken));
    expect(res.status).toBe(403);
  });

  test("anggota aktif bisa lihat daftar (kosong di awal)", async () => {
    const res = await handleListTasks(req("GET", `/api/tasks?projectId=${projectId}`, tenagaToken));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/tasks", () => {
  test("ditolak untuk yang bukan anggota aktif project", async () => {
    const res = await handleCreateTask(
      req("POST", "/api/tasks", luarToken, { projectId, deskripsi: "Percobaan" }),
    );
    expect(res.status).toBe(403);
  });

  test("anggota aktif berhasil membuat task open", async () => {
    const res = await handleCreateTask(
      req("POST", "/api/tasks", tenagaToken, { projectId, deskripsi: "Setup CI", tag: "infra" }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { task: { deskripsi: string; status: string } };
    expect(body.task.deskripsi).toBe("Setup CI");
    expect(body.task.status).toBe("open");
  });

  test("task baru muncul di daftar", async () => {
    const res = await handleListTasks(req("GET", `/api/tasks?projectId=${projectId}`, tenagaToken));
    return res.json().then((body: { tasks: { deskripsi: string }[] }) => {
      expect(body.tasks.some((t) => t.deskripsi === "Setup CI")).toBe(true);
    });
  });
});

// ADR-0012/Q-04 (revisi): siapa pun anggota aktif boleh menutup, rencana belum direalisasi
// dikonversi jadi realisasi (bukan dihapus), tidak ada reopen.
describe("POST /api/tasks/:id/tutup", () => {
  let taskId: number;

  beforeAll(async () => {
    const res = await handleCreateTask(
      req("POST", "/api/tasks", tenagaToken, { projectId, deskripsi: "Task Ditutup" }),
    );
    taskId = ((await res.json()) as { task: { id: number } }).task.id;

    // Rencana belum direalisasi — harus dikonversi jadi realisasi saat task ditutup.
    await db.query("INSERT INTO task_logs (task_id, user_id, tanggal, jenis) VALUES (?, ?, '2026-09-10', 'rencana')").run(
      taskId,
      tenagaId,
    );
    // Rencana yang sudah punya realisasi — catatan lamanya tidak boleh tertimpa.
    await db.query("INSERT INTO task_logs (task_id, user_id, tanggal, jenis) VALUES (?, ?, '2026-09-09', 'rencana')").run(
      taskId,
      tenagaId,
    );
    await db.query(
      "INSERT INTO task_logs (task_id, user_id, tanggal, jenis, catatan) VALUES (?, ?, '2026-09-09', 'realisasi', 'Beres')",
    ).run(taskId, tenagaId);
  });

  test("ditolak tanpa login", async () => {
    const res = await handleCloseTask(req("POST", `/api/tasks/${taskId}/tutup`), taskId);
    expect(res.status).toBe(401);
  });

  test("ditolak untuk yang bukan anggota aktif project", async () => {
    const res = await handleCloseTask(req("POST", `/api/tasks/${taskId}/tutup`, luarToken, {}), taskId);
    expect(res.status).toBe(403);
  });

  test("task tidak ditemukan (404)", async () => {
    const res = await handleCloseTask(req("POST", "/api/tasks/999999/tutup", tenagaToken, {}), 999999);
    expect(res.status).toBe(404);
  });

  test("berhasil menutup dengan deskripsi; rencana belum direalisasi jadi realisasi otomatis, yang sudah direalisasi tidak tertimpa", async () => {
    const res = await handleCloseTask(
      req("POST", `/api/tasks/${taskId}/tutup`, tenagaToken, { deskripsiPenutupan: "Sudah kelar semua" }),
      taskId,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { task: { status: string; deskripsiPenutupan: string } };
    expect(body.task.status).toBe("closed");
    expect(body.task.deskripsiPenutupan).toBe("Sudah kelar semua");

    // Rencana 2026-09-10 belum punya realisasi sebelumnya — sekarang harus ada, catatannya
    // dari deskripsi penutupan, dan rencananya sendiri tidak dihapus (histori tetap utuh).
    const rencanaLama = await db
      .query("SELECT id FROM task_logs WHERE task_id = ? AND tanggal = '2026-09-10' AND jenis = 'rencana'")
      .get(taskId);
    expect(rencanaLama).not.toBeNull();
    const realisasiBaru = await db
      .query("SELECT catatan FROM task_logs WHERE task_id = ? AND tanggal = '2026-09-10' AND jenis = 'realisasi'")
      .get(taskId) as { catatan: string } | null;
    expect(realisasiBaru?.catatan).toBe("Sudah kelar semua");

    // Rencana 2026-09-09 sudah punya realisasi "Beres" — catatan itu tidak boleh tertimpa.
    const realisasiLama = await db
      .query("SELECT catatan FROM task_logs WHERE task_id = ? AND tanggal = '2026-09-09' AND jenis = 'realisasi'")
      .get(taskId) as { catatan: string };
    expect(realisasiLama.catatan).toBe("Beres");
  });

  test("menutup ulang task yang sudah closed ditolak (409)", async () => {
    const res = await handleCloseTask(req("POST", `/api/tasks/${taskId}/tutup`, tenagaToken, {}), taskId);
    expect(res.status).toBe(409);
  });

  test("task closed tidak lagi muncul di daftar task terbuka", async () => {
    const res = await handleListTasks(req("GET", `/api/tasks?projectId=${projectId}`, tenagaToken));
    return res.json().then((body: { tasks: { deskripsi: string }[] }) => {
      expect(body.tasks.some((t) => t.deskripsi === "Task Ditutup")).toBe(false);
    });
  });

  test("tanpa deskripsi penutupan, catatan realisasi otomatis pakai fallback generik", async () => {
    const createRes = await handleCreateTask(
      req("POST", "/api/tasks", tenagaToken, { projectId, deskripsi: "Task Ditutup Tanpa Deskripsi" }),
    );
    const taskId2 = ((await createRes.json()) as { task: { id: number } }).task.id;
    await db.query("INSERT INTO task_logs (task_id, user_id, tanggal, jenis) VALUES (?, ?, '2026-09-11', 'rencana')").run(
      taskId2,
      tenagaId,
    );

    const res = await handleCloseTask(req("POST", `/api/tasks/${taskId2}/tutup`, tenagaToken, {}), taskId2);
    expect(res.status).toBe(200);

    const realisasi = await db
      .query("SELECT catatan FROM task_logs WHERE task_id = ? AND tanggal = '2026-09-11' AND jenis = 'realisasi'")
      .get(taskId2) as { catatan: string };
    expect(realisasi.catatan).toBe("Task ditutup.");
  });

  test("tanpa deskripsi penutupan tapi rencana sudah punya catatan sendiri, catatan itu dipakai (bukan fallback generik)", async () => {
    const createRes = await handleCreateTask(
      req("POST", "/api/tasks", tenagaToken, { projectId, deskripsi: "Task Ditutup Sudah Ada Catatan" }),
    );
    const taskId3 = ((await createRes.json()) as { task: { id: number } }).task.id;
    await db.query(
      "INSERT INTO task_logs (task_id, user_id, tanggal, jenis, catatan) VALUES (?, ?, '2026-09-12', 'rencana', ?)",
    ).run(taskId3, tenagaId, "- [ ] Penambahan Daftar Pengguna\n- [ ] Penambahan Form Tambah Pengguna");

    const res = await handleCloseTask(req("POST", `/api/tasks/${taskId3}/tutup`, tenagaToken, {}), taskId3);
    expect(res.status).toBe(200);

    const realisasi = await db
      .query("SELECT catatan FROM task_logs WHERE task_id = ? AND tanggal = '2026-09-12' AND jenis = 'realisasi'")
      .get(taskId3) as { catatan: string };
    expect(realisasi.catatan).toBe("- [ ] Penambahan Daftar Pengguna\n- [ ] Penambahan Form Tambah Pengguna");
  });
});

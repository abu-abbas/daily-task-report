import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "laporan-harian-test-")), "test.db");

const { db, runMigrations } = await import("../src/db");
const { login } = await import("../src/auth");
const { handleCreateProject, handleAddMember } = await import("../src/routes/projects");
const { handleCreateTask } = await import("../src/routes/tasks");
const { handleGetTodayInput, handleSaveTodayInput } = await import("../src/routes/task-logs");

const TENAGA_EMAIL = "tenaga.logs@example.test";
const REKAN_EMAIL = "rekan.logs@example.test";
const PASSWORD = "kata-sandi-aman";

// Dipilih di Oktober 2026 (Kamis, tidak beririsan dengan tanggal libur yang di-insert file
// test lain — db dibagi lintas file dalam satu proses "bun test") supaya simulasi murni
// berdasarkan aturan Senin-Jumat, tanpa bergantung isi tabel holidays.
const HARI_A = "2026-10-08"; // Kamis
const HARI_B = "2026-10-09"; // Jumat — previousWorkday = Kamis (Hari A)
const HARI_C = "2026-10-12"; // Senin — previousWorkday = Jumat (Hari B), melompati akhir pekan

let tenagaId: number;
let rekanId: number;
let tenagaToken: string;
let rekanToken: string;
let projectId: number;
let taskXId: number;
let taskYId: number;

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
    .run("Tenaga Logs", TENAGA_EMAIL, hash);
  tenagaId = Number(tenagaResult.lastInsertRowid);
  db.query("INSERT INTO user_roles (user_id, role) VALUES (?, 'tenaga_ahli')").run(tenagaId);

  const rekanResult = db
    .query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)")
    .run("Rekan Logs", REKAN_EMAIL, hash);
  rekanId = Number(rekanResult.lastInsertRowid);
  db.query("INSERT INTO user_roles (user_id, role) VALUES (?, 'tenaga_ahli')").run(rekanId);

  db.query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)").run(
    "Admin Logs",
    "admin.logs@example.test",
    hash,
  );
  db.query("INSERT INTO user_roles (user_id, role) SELECT id, 'admin' FROM users WHERE email = ?").run(
    "admin.logs@example.test",
  );
  const adminToken = (await login("admin.logs@example.test", PASSWORD))!.token;

  const projectRes = await handleCreateProject(
    req("POST", "/api/projects", adminToken, { nama: "Project Logs", isActive: true }),
  );
  const projectBody = (await projectRes.json()) as { project: { id: number } };
  projectId = projectBody.project.id;
  await handleAddMember(req("POST", `/api/projects/${projectId}/members`, adminToken, { userId: tenagaId }), projectId);
  await handleAddMember(req("POST", `/api/projects/${projectId}/members`, adminToken, { userId: rekanId }), projectId);

  tenagaToken = (await login(TENAGA_EMAIL, PASSWORD))!.token;
  rekanToken = (await login(REKAN_EMAIL, PASSWORD))!.token;

  const taskXRes = await handleCreateTask(
    req("POST", "/api/tasks", tenagaToken, { projectId, deskripsi: "Task X" }),
  );
  taskXId = ((await taskXRes.json()) as { task: { id: number } }).task.id;
  const taskYRes = await handleCreateTask(
    req("POST", "/api/tasks", tenagaToken, { projectId, deskripsi: "Task Y" }),
  );
  taskYId = ((await taskYRes.json()) as { task: { id: number } }).task.id;
});

describe("Hari A — cold start, tanpa rencana sebelumnya", () => {
  test("checklist kosong karena belum pernah ada rencana", () => {
    const res = handleGetTodayInput(req("GET", "/api/task-logs/today", tenagaToken), HARI_A);
    expect(res.status).toBe(200);
    return res.json().then((body: { checklist: unknown[]; hariKerjaSebelumnya: string }) => {
      expect(body.checklist).toEqual([]);
      expect(body.hariKerjaSebelumnya).toBe("2026-10-07"); // Rabu, hari kerja biasa sebelum Kamis
    });
  });

  test("catatan realisasi kosong ditolak", async () => {
    const res = await handleSaveTodayInput(
      req("POST", "/api/task-logs", tenagaToken, {
        items: [{ taskId: taskXId, jenis: "realisasi", catatan: "   ", isExtra: true }],
      }),
      HARI_A,
    );
    expect(res.status).toBe(400);
  });

  test("kegagalan satu item tidak menyisakan simpan parsial", async () => {
    const res = await handleSaveTodayInput(
      req("POST", "/api/task-logs", tenagaToken, {
        items: [
          { taskId: taskXId, jenis: "realisasi", catatan: "Valid", isExtra: true },
          { taskId: taskYId, jenis: "realisasi", catatan: "", isExtra: true },
        ],
      }),
      HARI_A,
    );
    expect(res.status).toBe(400);
    const row = db
      .query("SELECT id FROM task_logs WHERE user_id = ? AND task_id = ?")
      .get(tenagaId, taskXId);
    expect(row).toBeNull();
  });

  test("kerjaan tambahan (cold start) berhasil, plus rencana hari ini", async () => {
    const res = await handleSaveTodayInput(
      req("POST", "/api/task-logs", tenagaToken, {
        items: [
          { taskId: taskXId, jenis: "realisasi", catatan: "Kerjaan kemarin manual", isExtra: true },
          { taskId: taskXId, jenis: "rencana" },
          { taskId: taskYId, jenis: "rencana" },
        ],
      }),
      HARI_A,
    );
    expect(res.status).toBe(200);
  });
});

describe("Hari B — realisasi sebagian dari rencana Hari A", () => {
  test("checklist berisi Task X dan Task Y dari rencana Hari A", async () => {
    const res = handleGetTodayInput(req("GET", "/api/task-logs/today", tenagaToken), HARI_B);
    const body = (await res.json()) as { checklist: { taskId: number; realisasiCatatan: string | null }[] };
    expect(body.checklist.map((c) => c.taskId).sort()).toEqual([taskXId, taskYId].sort());
    expect(body.checklist.every((c) => c.realisasiCatatan === null)).toBe(true);
  });

  test("centang Task X saja (realisasi sebagian) + tambahan + rencana baru", async () => {
    const res = await handleSaveTodayInput(
      req("POST", "/api/task-logs", tenagaToken, {
        items: [
          { taskId: taskXId, jenis: "realisasi", catatan: "Task X beres" },
          { newTask: { projectId, deskripsi: "Task tambahan hari B" }, jenis: "realisasi", catatan: "Kerjaan ekstra", isExtra: true },
          { taskId: taskXId, jenis: "rencana" },
        ],
      }),
      HARI_B,
    );
    expect(res.status).toBe(200);
  });

  test("Task Y yang tidak dicentang tidak menghasilkan realisasi", () => {
    const row = db
      .query("SELECT id FROM task_logs WHERE user_id = ? AND task_id = ? AND tanggal = ? AND jenis = 'realisasi'")
      .get(tenagaId, taskYId, HARI_A);
    expect(row).toBeNull();
  });

  test("GET ulang menunjukkan Task X sudah terisi, tambahan muncul terpisah", async () => {
    const res = handleGetTodayInput(req("GET", "/api/task-logs/today", tenagaToken), HARI_B);
    const body = (await res.json()) as {
      checklist: { taskId: number; realisasiCatatan: string | null }[];
      tambahan: { deskripsi: string }[];
    };
    const taskX = body.checklist.find((c) => c.taskId === taskXId);
    expect(taskX?.realisasiCatatan).toBe("Task X beres");
    expect(body.tambahan.some((t) => t.deskripsi === "Task tambahan hari B")).toBe(true);
  });

  test("submit ulang hari yang sama meng-update, bukan menggandakan baris", async () => {
    await handleSaveTodayInput(
      req("POST", "/api/task-logs", tenagaToken, {
        items: [{ taskId: taskXId, jenis: "realisasi", catatan: "Task X beres (revisi)" }],
      }),
      HARI_B,
    );
    const rows = db
      .query("SELECT catatan FROM task_logs WHERE user_id = ? AND task_id = ? AND tanggal = ? AND jenis = 'realisasi'")
      .all(tenagaId, taskXId, HARI_A) as { catatan: string }[];
    expect(rows.length).toBe(1);
    expect(rows[0]!.catatan).toBe("Task X beres (revisi)");
  });

  test("dua user beda bisa realisasi task+tanggal yang sama, catatan terpisah", async () => {
    const res = await handleSaveTodayInput(
      req("POST", "/api/task-logs", rekanToken, {
        items: [{ taskId: taskXId, jenis: "realisasi", catatan: "Catatan rekan", isExtra: true }],
      }),
      HARI_B,
    );
    expect(res.status).toBe(200);

    const tenagaRow = db
      .query("SELECT catatan FROM task_logs WHERE user_id = ? AND task_id = ? AND tanggal = ? AND jenis = 'realisasi'")
      .get(tenagaId, taskXId, HARI_A) as { catatan: string };
    const rekanRow = db
      .query("SELECT catatan FROM task_logs WHERE user_id = ? AND task_id = ? AND tanggal = ? AND jenis = 'realisasi'")
      .get(rekanId, taskXId, HARI_A) as { catatan: string };
    expect(tenagaRow.catatan).toBe("Task X beres (revisi)");
    expect(rekanRow.catatan).toBe("Catatan rekan");
  });
});

describe("Hari C — melompati akhir pekan, memakai rencana baru dari Hari B", () => {
  test("checklist berisi rencana baru (Task X) yang dibuat di Hari B", async () => {
    const res = handleGetTodayInput(req("GET", "/api/task-logs/today", tenagaToken), HARI_C);
    const body = (await res.json()) as { checklist: { taskId: number }[]; hariKerjaSebelumnya: string };
    expect(body.hariKerjaSebelumnya).toBe(HARI_B);
    expect(body.checklist.map((c) => c.taskId)).toEqual([taskXId]);
  });
});

describe("Otorisasi", () => {
  test("GET tanpa login ditolak", () => {
    const res = handleGetTodayInput(req("GET", "/api/task-logs/today"), HARI_A);
    expect(res.status).toBe(401);
  });

  test("POST realisasi pada task di project yang bukan keanggotaannya ditolak (403)", async () => {
    const res = await handleSaveTodayInput(
      req("POST", "/api/task-logs", tenagaToken, {
        items: [{ taskId: 999999, jenis: "realisasi", catatan: "Percobaan" }],
      }),
      HARI_A,
    );
    expect(res.status).toBe(404);
  });
});

import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "laporan-harian-test-")), "test.db");

const { db, runMigrations } = await import("../src/db");
const { login } = await import("../src/auth");
const { handleCreateProject, handleAddMember } = await import("../src/routes/projects");
const { handleCreateTask } = await import("../src/routes/tasks");
const { handleCreateKendala, handleDeleteKendala, handleResolveKendala } = await import("../src/routes/kendala");

const TENAGA_EMAIL = "tenaga.kendala@example.test";
const LUAR_EMAIL = "luar.kendala@example.test";
const PASSWORD = "kata-sandi-aman";

let tenagaId: number;
let tenagaToken: string;
let luarToken: string;
let projectId: number;
let taskId: number;
let realisasiLogId: number;
let rencanaLogId: number;

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
    .run("Tenaga Kendala", TENAGA_EMAIL, hash);
  tenagaId = Number(tenagaResult.lastInsertRowid);
  db.query("INSERT INTO user_roles (user_id, role) VALUES (?, 'tenaga_ahli')").run(tenagaId);

  db.query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)").run("Luar Kendala", LUAR_EMAIL, hash);
  db.query("INSERT INTO user_roles (user_id, role) SELECT id, 'tenaga_ahli' FROM users WHERE email = ?").run(
    LUAR_EMAIL,
  );

  db.query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)").run(
    "Admin Kendala",
    "admin.kendala@example.test",
    hash,
  );
  db.query("INSERT INTO user_roles (user_id, role) SELECT id, 'admin' FROM users WHERE email = ?").run(
    "admin.kendala@example.test",
  );
  const adminToken = (await login("admin.kendala@example.test", PASSWORD))!.token;

  const projectRes = await handleCreateProject(
    req("POST", "/api/projects", adminToken, { nama: "Project Kendala", isActive: true }),
  );
  const projectBody = (await projectRes.json()) as { project: { id: number } };
  projectId = projectBody.project.id;
  await handleAddMember(req("POST", `/api/projects/${projectId}/members`, adminToken, { userId: tenagaId }), projectId);

  tenagaToken = (await login(TENAGA_EMAIL, PASSWORD))!.token;
  luarToken = (await login(LUAR_EMAIL, PASSWORD))!.token;

  const taskRes = await handleCreateTask(req("POST", "/api/tasks", tenagaToken, { projectId, deskripsi: "Task Kendala" }));
  taskId = ((await taskRes.json()) as { task: { id: number } }).task.id;

  const realisasiResult = db
    .query("INSERT INTO task_logs (task_id, user_id, tanggal, jenis, catatan) VALUES (?, ?, '2026-09-07', 'realisasi', 'Sudah dikerjakan')")
    .run(taskId, tenagaId);
  realisasiLogId = Number(realisasiResult.lastInsertRowid);

  const rencanaResult = db
    .query("INSERT INTO task_logs (task_id, user_id, tanggal, jenis) VALUES (?, ?, '2026-09-08', 'rencana')")
    .run(taskId, tenagaId);
  rencanaLogId = Number(rencanaResult.lastInsertRowid);
});

describe("POST /api/kendala", () => {
  test("ditolak tanpa login", async () => {
    const res = await handleCreateKendala(req("POST", "/api/kendala", undefined, { taskLogId: realisasiLogId, deskripsi: "Blocked" }));
    expect(res.status).toBe(401);
  });

  test("ditolak (404) task_log tidak ada", async () => {
    const res = await handleCreateKendala(req("POST", "/api/kendala", tenagaToken, { taskLogId: 999999, deskripsi: "Blocked" }));
    expect(res.status).toBe(404);
  });

  test("ditolak (403) bukan pemilik log", async () => {
    const res = await handleCreateKendala(req("POST", "/api/kendala", luarToken, { taskLogId: realisasiLogId, deskripsi: "Blocked" }));
    expect(res.status).toBe(403);
  });

  test("ditolak (400) log jenis rencana", async () => {
    const res = await handleCreateKendala(req("POST", "/api/kendala", tenagaToken, { taskLogId: rencanaLogId, deskripsi: "Blocked" }));
    expect(res.status).toBe(400);
  });

  test("berhasil menambah kendala ke log realisasi milik sendiri", async () => {
    const res = await handleCreateKendala(
      req("POST", "/api/kendala", tenagaToken, { taskLogId: realisasiLogId, deskripsi: "Menunggu akses server" }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { kendala: { id: number; taskLogId: number; deskripsi: string; status: string } };
    expect(body.kendala.taskLogId).toBe(realisasiLogId);
    expect(body.kendala.deskripsi).toBe("Menunggu akses server");
    expect(body.kendala.status).toBe("open");
  });
});

describe("POST /api/kendala/:id/resolve dan DELETE /api/kendala/:id", () => {
  let kendalaId: number;

  beforeAll(async () => {
    const res = await handleCreateKendala(
      req("POST", "/api/kendala", tenagaToken, { taskLogId: realisasiLogId, deskripsi: "Nunggu approval" }),
    );
    kendalaId = ((await res.json()) as { kendala: { id: number } }).kendala.id;
  });

  test("resolve ditolak tanpa login", async () => {
    const res = await handleResolveKendala(req("POST", `/api/kendala/${kendalaId}/resolve`), kendalaId);
    expect(res.status).toBe(401);
  });

  test("resolve ditolak (404) kendala tidak ada", async () => {
    const res = await handleResolveKendala(req("POST", "/api/kendala/999999/resolve", tenagaToken), 999999);
    expect(res.status).toBe(404);
  });

  test("resolve ditolak (403) bukan pembuat log", async () => {
    const res = await handleResolveKendala(req("POST", `/api/kendala/${kendalaId}/resolve`, luarToken), kendalaId);
    expect(res.status).toBe(403);
  });

  test("resolve tetap berhasil walau tanggal log sudah di luar bulan berjalan (boleh kapan saja, ADR-0015)", async () => {
    // realisasiLogId bertanggal 2026-09-07 — tanggal "hari ini" asli saat test dijalankan
    // pasti sudah lewat itu, jadi ini sudah membuktikan resolve tidak terikat bulan berjalan.
    const res = await handleResolveKendala(req("POST", `/api/kendala/${kendalaId}/resolve`, tenagaToken), kendalaId);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { kendala: { status: string } };
    expect(body.kendala.status).toBe("resolved");
  });

  test("resolve ulang ditolak (409), satu arah tidak ada reopen", async () => {
    const res = await handleResolveKendala(req("POST", `/api/kendala/${kendalaId}/resolve`, tenagaToken), kendalaId);
    expect(res.status).toBe(409);
  });

  test("delete ditolak (403) bukan pembuat log", async () => {
    const res = await handleDeleteKendala(req("DELETE", `/api/kendala/${kendalaId}`, luarToken), kendalaId);
    expect(res.status).toBe(403);
  });

  test("delete berhasil (204) dan hilang dari tabel", async () => {
    const res = await handleDeleteKendala(req("DELETE", `/api/kendala/${kendalaId}`, tenagaToken), kendalaId);
    expect(res.status).toBe(204);
    const row = db.query("SELECT id FROM kendala WHERE id = ?").get(kendalaId);
    expect(row).toBeNull();
  });

  test("delete ditolak (404) kendala tidak ada", async () => {
    const res = await handleDeleteKendala(req("DELETE", `/api/kendala/${kendalaId}`, tenagaToken), kendalaId);
    expect(res.status).toBe(404);
  });
});

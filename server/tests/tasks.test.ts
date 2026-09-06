import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "laporan-harian-test-")), "test.db");

const { db, runMigrations } = await import("../src/db");
const { login } = await import("../src/auth");
const { handleCreateProject, handleAddMember } = await import("../src/routes/projects");
const { handleListTasks, handleCreateTask } = await import("../src/routes/tasks");

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
  runMigrations();
  const hash = await Bun.password.hash(PASSWORD);

  const tenagaResult = db
    .query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)")
    .run("Tenaga Tasks", TENAGA_EMAIL, hash);
  tenagaId = Number(tenagaResult.lastInsertRowid);
  db.query("INSERT INTO user_roles (user_id, role) VALUES (?, 'tenaga_ahli')").run(tenagaId);

  db.query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)").run(
    "Luar Tasks",
    LUAR_EMAIL,
    hash,
  );
  db.query("INSERT INTO user_roles (user_id, role) SELECT id, 'tenaga_ahli' FROM users WHERE email = ?").run(
    LUAR_EMAIL,
  );

  // Admin sementara cuma untuk membuat project — dibuat lewat query langsung supaya tidak
  // ikut jadi anggota (fokus test ini ke tasks, bukan otorisasi admin).
  const adminHash = await Bun.password.hash(PASSWORD);
  db.query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)").run(
    "Admin Tasks",
    "admin.tasks@example.test",
    adminHash,
  );
  db.query("INSERT INTO user_roles (user_id, role) SELECT id, 'admin' FROM users WHERE email = ?").run(
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
  test("ditolak tanpa login", () => {
    const res = handleListTasks(req("GET", `/api/tasks?projectId=${projectId}`));
    expect(res.status).toBe(401);
  });

  test("ditolak tanpa projectId", () => {
    const res = handleListTasks(req("GET", "/api/tasks", tenagaToken));
    expect(res.status).toBe(400);
  });

  test("ditolak untuk yang bukan anggota aktif project", () => {
    const res = handleListTasks(req("GET", `/api/tasks?projectId=${projectId}`, luarToken));
    expect(res.status).toBe(403);
  });

  test("anggota aktif bisa lihat daftar (kosong di awal)", () => {
    const res = handleListTasks(req("GET", `/api/tasks?projectId=${projectId}`, tenagaToken));
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

  test("task baru muncul di daftar", () => {
    const res = handleListTasks(req("GET", `/api/tasks?projectId=${projectId}`, tenagaToken));
    return res.json().then((body: { tasks: { deskripsi: string }[] }) => {
      expect(body.tasks.some((t) => t.deskripsi === "Setup CI")).toBe(true);
    });
  });
});

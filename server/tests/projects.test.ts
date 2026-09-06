import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// DATABASE_PATH harus di-set sebelum src/db di-import (module top-level membaca env sekali).
// "../src/db" adalah singleton ESM yang dibagi lintas file test dalam satu proses "bun test",
// jadi db ini juga dipakai file test lain — jangan ditutup/dihapus di sini.
process.env.DATABASE_PATH ??= join(mkdtempSync(join(tmpdir(), "laporan-harian-test-")), "test.db");

const { db, runMigrations } = await import("../src/db");
const { login } = await import("../src/auth");
const {
  handleListProjects,
  handleListMyProjects,
  handleCreateProject,
  handleUpdateProject,
  handleAddMember,
  handleEndMembership,
  isActiveProjectMember,
} = await import("../src/routes/projects");

const ADMIN_EMAIL = "admin.projects@example.test";
const TENAGA_EMAIL = "tenaga.projects@example.test";
const PASSWORD = "kata-sandi-aman";

let tenagaId: number;
let adminToken: string;
let tenagaToken: string;

beforeAll(async () => {
  runMigrations();
  const hash = await Bun.password.hash(PASSWORD);

  db.query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)").run(
    "Admin Projects",
    ADMIN_EMAIL,
    hash,
  );
  db.query("INSERT INTO user_roles (user_id, role) SELECT id, 'admin' FROM users WHERE email = ?").run(
    ADMIN_EMAIL,
  );

  const tenagaResult = db
    .query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)")
    .run("Tenaga Projects", TENAGA_EMAIL, hash);
  tenagaId = Number(tenagaResult.lastInsertRowid);
  db.query("INSERT INTO user_roles (user_id, role) VALUES (?, 'tenaga_ahli')").run(tenagaId);

  adminToken = (await login(ADMIN_EMAIL, PASSWORD))!.token;
  tenagaToken = (await login(TENAGA_EMAIL, PASSWORD))!.token;
});

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

describe("GET /api/projects", () => {
  test("ditolak untuk non-admin", () => {
    const res = handleListProjects(req("GET", "/api/projects", tenagaToken));
    expect(res.status).toBe(403);
  });

  test("ditolak tanpa login", () => {
    const res = handleListProjects(req("GET", "/api/projects"));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/projects", () => {
  test("ditolak untuk non-admin", async () => {
    const res = await handleCreateProject(
      req("POST", "/api/projects", tenagaToken, { nama: "Percobaan", isActive: true }),
    );
    expect(res.status).toBe(403);
  });

  test("admin berhasil membuat project", async () => {
    const res = await handleCreateProject(
      req("POST", "/api/projects", adminToken, { nama: "Sistem Laporan Harian", isActive: true }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { project: { nama: string; members: unknown[] } };
    expect(body.project.nama).toBe("Sistem Laporan Harian");
    expect(body.project.members).toEqual([]);
  });
});

describe("Keanggotaan project", () => {
  let projectId: number;

  beforeAll(async () => {
    const res = await handleCreateProject(
      req("POST", "/api/projects", adminToken, { nama: "Migrasi Data", isActive: true }),
    );
    const body = (await res.json()) as { project: { id: number } };
    projectId = body.project.id;
  });

  test("tambah anggota berhasil", async () => {
    const res = await handleAddMember(
      req("POST", `/api/projects/${projectId}/members`, adminToken, { userId: tenagaId }),
      projectId,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { project: { members: { id: number }[] } };
    expect(body.project.members.map((m) => m.id)).toContain(tenagaId);
  });

  test("tambah anggota yang sama lagi ditolak (409)", async () => {
    const res = await handleAddMember(
      req("POST", `/api/projects/${projectId}/members`, adminToken, { userId: tenagaId }),
      projectId,
    );
    expect(res.status).toBe(409);
  });

  test("project muncul di daftar 'mine' milik anggotanya", () => {
    const res = handleListMyProjects(req("GET", "/api/projects/mine", tenagaToken));
    expect(res.status).toBe(200);
  });

  test("mengakhiri keanggotaan berhasil dan hilang dari member aktif", async () => {
    const res = await handleEndMembership(
      req("DELETE", `/api/projects/${projectId}/members/${tenagaId}`, adminToken),
      projectId,
      tenagaId,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { project: { members: { id: number }[] } };
    expect(body.project.members.map((m) => m.id)).not.toContain(tenagaId);
  });

  test("mengakhiri keanggotaan yang sudah tidak aktif → 404", async () => {
    const res = await handleEndMembership(
      req("DELETE", `/api/projects/${projectId}/members/${tenagaId}`, adminToken),
      projectId,
      tenagaId,
    );
    expect(res.status).toBe(404);
  });

  test("bergabung lagi setelah keluar mengaktifkan baris lama, bukan menggandakan", async () => {
    const res = await handleAddMember(
      req("POST", `/api/projects/${projectId}/members`, adminToken, { userId: tenagaId }),
      projectId,
    );
    expect(res.status).toBe(201);

    const rows = db
      .query<{ count: number }, [number, number]>(
        "SELECT COUNT(*) as count FROM user_project WHERE user_id = ? AND project_id = ?",
      )
      .get(tenagaId, projectId);
    expect(rows?.count).toBe(1);
  });
});

// Aturan penolakan pencatatan di luar keanggotaan (ADR-0005) diuji di sini terlepas dari
// endpoint pencatatan kerja itu sendiri yang baru dibangun Stage 3 — begitu endpoint itu ada,
// tinggal panggil fungsi ini, tidak menulis ulang query keanggotaan.
describe("isActiveProjectMember", () => {
  let projectId: number;

  beforeAll(async () => {
    const res = await handleCreateProject(
      req("POST", "/api/projects", adminToken, { nama: "Cek Keanggotaan", isActive: true }),
    );
    const body = (await res.json()) as { project: { id: number } };
    projectId = body.project.id;
    await handleAddMember(
      req("POST", `/api/projects/${projectId}/members`, adminToken, { userId: tenagaId }),
      projectId,
    );
  });

  test("true untuk anggota aktif", () => {
    expect(isActiveProjectMember(tenagaId, projectId)).toBe(true);
  });

  test("false untuk user yang bukan anggota project itu", async () => {
    const res = await handleCreateProject(
      req("POST", "/api/projects", adminToken, { nama: "Project Lain", isActive: true }),
    );
    const body = (await res.json()) as { project: { id: number } };
    expect(isActiveProjectMember(tenagaId, body.project.id)).toBe(false);
  });

  test("false setelah keluar project (ended_at terisi)", async () => {
    await handleEndMembership(
      req("DELETE", `/api/projects/${projectId}/members/${tenagaId}`, adminToken),
      projectId,
      tenagaId,
    );
    expect(isActiveProjectMember(tenagaId, projectId)).toBe(false);
  });

  test("false untuk project yang tidak ada", () => {
    expect(isActiveProjectMember(tenagaId, 999999)).toBe(false);
  });
});

describe("PUT /api/projects/:id", () => {
  test("404 kalau project tidak ada", async () => {
    const res = await handleUpdateProject(
      req("PUT", "/api/projects/9999", adminToken, { nama: "Tidak Ada", isActive: false }),
      9999,
    );
    expect(res.status).toBe(404);
  });
});

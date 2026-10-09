import { beforeAll, describe, expect, test } from "bun:test";

const { runMigrations } = await import("../src/db");
const { db } = await import("./raw-db");
const { login } = await import("../src/auth");
const { handleListUsers, handleCreateUser, handleUpdateUser } = await import("../src/routes/users");

const ADMIN_EMAIL = "admin@example.test";
const ATASAN_EMAIL = "atasan@example.test";
const TENAGA_EMAIL = "tenaga@example.test";
const PASSWORD = "kata-sandi-aman";

let atasanId: number;
let tenagaId: number;
let adminToken: string;
let tenagaToken: string;

beforeAll(async () => {
  await runMigrations();
  const hash = await Bun.password.hash(PASSWORD);

  await db.query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)").run(
    "Admin Uji",
    ADMIN_EMAIL,
    hash,
  );
  await db.query("INSERT INTO user_roles (user_id, role) SELECT id, 'admin' FROM users WHERE email = ?").run(
    ADMIN_EMAIL,
  );

  const atasanResult = await db
    .query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)")
    .run("Atasan Uji", ATASAN_EMAIL, hash);
  atasanId = Number(atasanResult.lastInsertRowid);
  await db.query("INSERT INTO user_roles (user_id, role) VALUES (?, 'atasan')").run(atasanId);

  const tenagaResult = await db
    .query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)")
    .run("Tenaga Uji", TENAGA_EMAIL, hash);
  tenagaId = Number(tenagaResult.lastInsertRowid);
  await db.query("INSERT INTO user_roles (user_id, role) VALUES (?, 'tenaga_ahli')").run(tenagaId);

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

describe("GET /api/users", () => {
  test("ditolak tanpa login", async () => {
    const res = await handleListUsers(req("GET", "/api/users"));
    expect(res.status).toBe(401);
  });

  test("ditolak untuk non-admin", async () => {
    const res = await handleListUsers(req("GET", "/api/users", tenagaToken));
    expect(res.status).toBe(403);
  });

  test("admin bisa lihat daftar user", async () => {
    const res = await handleListUsers(req("GET", "/api/users", adminToken));
    expect(res.status).toBe(200);
    // >=3 (bukan pas 3): db dibagi lintas file test dalam satu proses "bun test",
    // jadi bisa ada user tambahan dari file test lain.
    const body = (await res.json()) as { users: { email: string }[] };
    expect(body.users.length).toBeGreaterThanOrEqual(3);
    const emails = body.users.map((u) => u.email);
    expect(emails).toEqual(expect.arrayContaining([ADMIN_EMAIL, ATASAN_EMAIL, TENAGA_EMAIL]));
  });
});

describe("POST /api/users", () => {
  test("berhasil membuat user baru dengan supervisi di bawah atasan", async () => {
    const res = await handleCreateUser(
      req("POST", "/api/users", adminToken, {
        nama: "Supervisi Baru",
        email: "supervisi.baru@example.test",
        password: "password-baru",
        roles: ["supervisi"],
        atasanId,
        supervisiId: null,
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { user: { id: number; roles: string[] } };
    expect(body.user.roles).toEqual(["supervisi"]);
  });

  test("ditolak kalau email sudah dipakai", async () => {
    const res = await handleCreateUser(
      req("POST", "/api/users", adminToken, {
        nama: "Duplikat",
        email: ADMIN_EMAIL,
        password: "password-baru",
        roles: ["tenaga_ahli"],
        atasanId: null,
        supervisiId: null,
      }),
    );
    expect(res.status).toBe(409);
  });

  test("ditolak kalau tidak ada peran dipilih", async () => {
    const res = await handleCreateUser(
      req("POST", "/api/users", adminToken, {
        nama: "Tanpa Peran",
        email: "tanpa.peran@example.test",
        password: "password-baru",
        roles: [],
        atasanId: null,
        supervisiId: null,
      }),
    );
    expect(res.status).toBe(400);
  });

  test("ditolak kalau atasanId menunjuk user yang bukan atasan", async () => {
    const res = await handleCreateUser(
      req("POST", "/api/users", adminToken, {
        nama: "Salah Atasan",
        email: "salah.atasan@example.test",
        password: "password-baru",
        roles: ["tenaga_ahli"],
        atasanId: tenagaId,
        supervisiId: null,
      }),
    );
    expect(res.status).toBe(400);
  });

  test("ditolak untuk non-admin", async () => {
    const res = await handleCreateUser(
      req("POST", "/api/users", tenagaToken, {
        nama: "Percobaan",
        email: "percobaan@example.test",
        password: "password-baru",
        roles: ["tenaga_ahli"],
        atasanId: null,
        supervisiId: null,
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/users/:id", () => {
  test("berhasil mengubah peran dan hierarki", async () => {
    const res = await handleUpdateUser(
      req("PUT", `/api/users/${tenagaId}`, adminToken, {
        nama: "Tenaga Uji",
        email: TENAGA_EMAIL,
        roles: ["tenaga_ahli", "supervisi"],
        atasanId,
        supervisiId: null,
      }),
      tenagaId,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { roles: string[]; atasanId: number } };
    expect(body.user.roles.sort()).toEqual(["supervisi", "tenaga_ahli"]);
    expect(body.user.atasanId).toBe(atasanId);
  });

  test("ditolak kalau atasan diri sendiri", async () => {
    const res = await handleUpdateUser(
      req("PUT", `/api/users/${atasanId}`, adminToken, {
        nama: "Atasan Uji",
        email: ATASAN_EMAIL,
        roles: ["atasan"],
        atasanId,
        supervisiId: null,
      }),
      atasanId,
    );
    expect(res.status).toBe(400);
  });

  test("404 kalau user tidak ada", async () => {
    const res = await handleUpdateUser(
      req("PUT", "/api/users/9999", adminToken, {
        nama: "Tidak Ada",
        email: "tidak.ada@example.test",
        roles: ["tenaga_ahli"],
        atasanId: null,
        supervisiId: null,
      }),
      9999,
    );
    expect(res.status).toBe(404);
  });
});

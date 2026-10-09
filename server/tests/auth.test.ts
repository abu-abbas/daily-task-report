import { beforeAll, describe, expect, test } from "bun:test";

const { runMigrations } = await import("../src/db");
const { db } = await import("./raw-db");
const { login, logout, getAuthContext } = await import("../src/auth");

const EMAIL = "tenaga.ahli@example.test";
const PASSWORD = "kata-sandi-aman";

beforeAll(async () => {
  await runMigrations();
  const passwordHash = await Bun.password.hash(PASSWORD);
  await db.query(
    "INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)",
  ).run("Tenaga Ahli Uji", EMAIL, passwordHash);
});

describe("login/session", () => {
  test("kredensial benar menghasilkan session yang valid", async () => {
    const session = await login(EMAIL, PASSWORD);
    expect(session).not.toBeNull();

    const ctx = await getAuthContext(session!.token);
    expect(ctx?.user.email).toBe(EMAIL);
  });

  test("password salah ditolak", async () => {
    const session = await login(EMAIL, "password-salah");
    expect(session).toBeNull();
  });

  test("email tidak terdaftar ditolak", async () => {
    const session = await login("tidak-ada@example.test", PASSWORD);
    expect(session).toBeNull();
  });

  test("token acak tanpa login ditolak", async () => {
    expect(await getAuthContext("token-yang-tidak-pernah-ada")).toBeNull();
  });

  test("logout mencabut session", async () => {
    const session = await login(EMAIL, PASSWORD);
    await logout(session!.token);
    expect(await getAuthContext(session!.token)).toBeNull();
  });
});

describe("login email tidak terdaftar", () => {
  test("tetap menjalankan verifikasi argon2 penuh (tidak membocorkan email terdaftar lewat waktu)", async () => {
    const ukur = async (email: string) => {
      const mulai = performance.now();
      await login(email, "password-salah");
      return performance.now() - mulai;
    };
    await ukur("pemanasan@example.test");
    const terdaftar = await ukur(EMAIL);
    const tidakTerdaftar = await ukur("tidak-ada-lagi@example.test");
    expect(tidakTerdaftar).toBeGreaterThan(terdaftar * 0.3);
  });
});

describe("pruneExpiredSessions", () => {
  test("menghapus sesi kedaluwarsa saja", async () => {
    const { pruneExpiredSessions } = await import("../src/auth");
    const aktif = (await login(EMAIL, PASSWORD))!.token;
    const user = await db.query<{ id: number }>("SELECT id FROM users WHERE email = ?").get(EMAIL);
    await db
      .query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, now() - interval '1 day')")
      .run("hash-kedaluwarsa-uji", user!.id);

    expect(await pruneExpiredSessions()).toBeGreaterThanOrEqual(1);
    expect(await db.query("SELECT 1 FROM sessions WHERE token_hash = ?").get("hash-kedaluwarsa-uji")).toBeNull();
    expect(await getAuthContext(aktif)).not.toBeNull();
  });
});

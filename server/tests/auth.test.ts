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

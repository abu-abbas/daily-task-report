import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// DATABASE_PATH harus di-set sebelum src/db di-import (module top-level membaca env sekali).
const tmpDir = mkdtempSync(join(tmpdir(), "laporan-harian-test-"));
process.env.DATABASE_PATH = join(tmpDir, "test.db");

const { db, runMigrations } = await import("../src/db");
const { login, logout, getAuthContext } = await import("../src/auth");

const EMAIL = "tenaga.ahli@example.test";
const PASSWORD = "kata-sandi-aman";

beforeAll(async () => {
  runMigrations();
  const passwordHash = await Bun.password.hash(PASSWORD);
  db.query(
    "INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)",
  ).run("Tenaga Ahli Uji", EMAIL, passwordHash);
});

afterAll(() => {
  db.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("login/session", () => {
  test("kredensial benar menghasilkan session yang valid", async () => {
    const session = await login(EMAIL, PASSWORD);
    expect(session).not.toBeNull();

    const ctx = getAuthContext(session!.token);
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

  test("token acak tanpa login ditolak", () => {
    expect(getAuthContext("token-yang-tidak-pernah-ada")).toBeNull();
  });

  test("logout mencabut session", async () => {
    const session = await login(EMAIL, PASSWORD);
    logout(session!.token);
    expect(getAuthContext(session!.token)).toBeNull();
  });
});

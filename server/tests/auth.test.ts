import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// DATABASE_PATH harus di-set sebelum src/db di-import (module top-level membaca env sekali).
// Paksa timpa (bukan ??=): kalau server/.env kebetulan sudah men-set DATABASE_PATH, biarpun
// itu dimuat otomatis oleh Bun sebelum baris ini jalan, test tetap wajib pakai db temp sendiri
// — bukan diam-diam jatuh ke db development beneran.
// "../src/db" adalah singleton ESM yang dibagi lintas file test dalam satu proses "bun test",
// jadi db ini juga dipakai file test lain — jangan ditutup/dihapus di sini (lihat users.test.ts).
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "laporan-harian-test-")), "test.db");

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

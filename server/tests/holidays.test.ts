import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// DATABASE_PATH harus di-set sebelum src/db di-import (module top-level membaca env sekali).
// Paksa timpa (bukan ??=): kalau server/.env kebetulan sudah men-set DATABASE_PATH, biarpun
// itu dimuat otomatis oleh Bun sebelum baris ini jalan, test tetap wajib pakai db temp sendiri
// — bukan diam-diam jatuh ke db development beneran.
// "../src/db" adalah singleton ESM yang dibagi lintas file test dalam satu proses "bun test",
// jadi db ini juga dipakai file test lain — jangan ditutup/dihapus di sini.
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "laporan-harian-test-")), "test.db");

const { sqlite: db, runMigrations } = await import("../src/db");
const { login } = await import("../src/auth");
const { handleListHolidays, handleCreateHoliday, handleDeleteHoliday } = await import(
  "../src/routes/holidays"
);

const ADMIN_EMAIL = "admin.holidays@example.test";
const TENAGA_EMAIL = "tenaga.holidays@example.test";
const PASSWORD = "kata-sandi-aman";

let adminToken: string;
let tenagaToken: string;

beforeAll(async () => {
  runMigrations();
  const hash = await Bun.password.hash(PASSWORD);

  db.query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)").run(
    "Admin Holidays",
    ADMIN_EMAIL,
    hash,
  );
  db.query("INSERT INTO user_roles (user_id, role) SELECT id, 'admin' FROM users WHERE email = ?").run(
    ADMIN_EMAIL,
  );

  db.query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)").run(
    "Tenaga Holidays",
    TENAGA_EMAIL,
    hash,
  );
  db.query(
    "INSERT INTO user_roles (user_id, role) SELECT id, 'tenaga_ahli' FROM users WHERE email = ?",
  ).run(TENAGA_EMAIL);

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

describe("GET /api/holidays", () => {
  test("ditolak tanpa login", async () => {
    const res = await handleListHolidays(req("GET", "/api/holidays"));
    expect(res.status).toBe(401);
  });

  test("tenaga ahli (bukan admin) tetap bisa membaca", async () => {
    const res = await handleListHolidays(req("GET", "/api/holidays", tenagaToken));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/holidays", () => {
  test("ditolak untuk non-admin", async () => {
    const res = await handleCreateHoliday(
      req("POST", "/api/holidays", tenagaToken, {
        nama: "Percobaan",
        tanggalMulai: "2026-12-24",
        tanggalAkhir: "2026-12-24",
      }),
    );
    expect(res.status).toBe(403);
  });

  test("admin berhasil menambah libur satu hari", async () => {
    const res = await handleCreateHoliday(
      req("POST", "/api/holidays", adminToken, {
        nama: "Kelahiran Yesus Kristus",
        tanggalMulai: "2026-12-25",
        tanggalAkhir: "2026-12-25",
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { holiday: { nama: string; tanggalMulai: string } };
    expect(body.holiday.nama).toBe("Kelahiran Yesus Kristus");
  });

  test("ditolak kalau tanggal akhir sebelum tanggal mulai", async () => {
    const res = await handleCreateHoliday(
      req("POST", "/api/holidays", adminToken, {
        nama: "Rentang Salah",
        tanggalMulai: "2026-12-25",
        tanggalAkhir: "2026-12-20",
      }),
    );
    expect(res.status).toBe(400);
  });

  test("ditolak kalau format tanggal bukan ISO", async () => {
    const res = await handleCreateHoliday(
      req("POST", "/api/holidays", adminToken, {
        nama: "Format Salah",
        tanggalMulai: "25-12-2026",
        tanggalAkhir: "25-12-2026",
      }),
    );
    expect(res.status).toBe(400);
  });

  test("muncul di daftar setelah ditambahkan", async () => {
    const res = await handleListHolidays(req("GET", "/api/holidays", adminToken));
    const body = (await res.json()) as { holidays: { nama: string }[] };
    expect(body.holidays.some((h) => h.nama === "Kelahiran Yesus Kristus")).toBe(true);
  });
});

describe("DELETE /api/holidays/:id", () => {
  let holidayId: number;

  beforeAll(async () => {
    const res = await handleCreateHoliday(
      req("POST", "/api/holidays", adminToken, {
        nama: "Akan Dihapus",
        tanggalMulai: "2026-11-11",
        tanggalAkhir: "2026-11-11",
      }),
    );
    const body = (await res.json()) as { holiday: { id: number } };
    holidayId = body.holiday.id;
  });

  test("ditolak untuk non-admin", async () => {
    const res = await handleDeleteHoliday(req("DELETE", `/api/holidays/${holidayId}`, tenagaToken), holidayId);
    expect(res.status).toBe(403);
  });

  test("admin berhasil menghapus", async () => {
    const res = await handleDeleteHoliday(req("DELETE", `/api/holidays/${holidayId}`, adminToken), holidayId);
    expect(res.status).toBe(204);
  });

  test("404 kalau sudah tidak ada", async () => {
    const res = await handleDeleteHoliday(req("DELETE", `/api/holidays/${holidayId}`, adminToken), holidayId);
    expect(res.status).toBe(404);
  });
});

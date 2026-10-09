import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "laporan-harian-test-")), "test.db");

const { sqlite: db, runMigrations } = await import("../src/db");
const { login } = await import("../src/auth");
const { handleGetSaran, handleSaveSaran, isSaranTerisi } = await import("../src/routes/saran");

const TENAGA_EMAIL = "tenaga.saran@example.test";
const PASSWORD = "kata-sandi-aman";
let tenagaId: number;
let tenagaToken: string;

beforeAll(async () => {
  runMigrations();
  const hash = await Bun.password.hash(PASSWORD);
  const tenaga = db
    .query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)")
    .run("Tenaga Saran", TENAGA_EMAIL, hash);
  tenagaId = Number(tenaga.lastInsertRowid);
  db.query("INSERT INTO user_roles (user_id, role) VALUES (?, 'tenaga_ahli')").run(tenagaId);
  tenagaToken = (await login(TENAGA_EMAIL, PASSWORD))!.token;
});

function req(method: string, path: string, token?: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Cookie: `session=${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("GET/PUT /api/saran", () => {
  test("belum pernah diisi → kosong (TIDAK prefill dari bulan lain, beda dari Pendahuluan)", async () => {
    const res = await handleGetSaran(req("GET", "/api/saran?bulan=2026-01", tenagaToken));
    const body = (await res.json()) as { isi: string };
    expect(body.isi).toBe("");
  });

  test("isSaranTerisi false sebelum diisi", async () => {
    expect(await isSaranTerisi(tenagaId, "2026-01")).toBe(false);
  });

  test("simpan saran bulan Januari", async () => {
    const res = await handleSaveSaran(
      req("PUT", "/api/saran?bulan=2026-01", tenagaToken, { isi: "1) Terapkan CI/CD\n2) Tambah unit test" }),
    );
    expect(res.status).toBe(200);
  });

  test("isSaranTerisi true setelah diisi", async () => {
    expect(await isSaranTerisi(tenagaId, "2026-01")).toBe(true);
  });

  test("bulan Februari tetap kosong meski Januari sudah diisi (tidak carry-forward)", async () => {
    const res = await handleGetSaran(req("GET", "/api/saran?bulan=2026-02", tenagaToken));
    const body = (await res.json()) as { isi: string };
    expect(body.isi).toBe("");
    expect(await isSaranTerisi(tenagaId, "2026-02")).toBe(false);
  });

  test("isi hanya whitespace dianggap belum terisi", async () => {
    await handleSaveSaran(req("PUT", "/api/saran?bulan=2026-03", tenagaToken, { isi: "   \n  " }));
    expect(await isSaranTerisi(tenagaId, "2026-03")).toBe(false);
  });
});

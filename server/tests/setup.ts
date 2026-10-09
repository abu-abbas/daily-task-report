import { SQL } from "bun";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Dijalankan sekali sebelum semua file test (bunfig.toml → preload), sebelum src/db di-import.
// Semua file test dalam satu proses "bun test" berbagi satu database (src/db adalah singleton
// ESM), jadi data seed tiap file harus memakai email/nama sendiri.
//
// Attachment, template Word, log, dan database PGlite test ditulis ke folder sementara.
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "laporan-harian-test-"));

// Default: PGlite baru di folder sementara itu, jadi `bun test` jalan tanpa server Postgres.
// Dengan TEST_DATABASE_URL, test jalan di server Postgres sungguhan. Nilai DATABASE_URL dari
// server/.env selalu ditimpa supaya test tidak pernah menyentuh database development.
const url = process.env.TEST_DATABASE_URL?.trim();
if (!url) {
  delete process.env.DATABASE_URL;
} else {
  const dbName = new URL(url).pathname.slice(1);
  // Pengaman: skema database ini dikosongkan tiap run, jadi tolak nama yang bukan database test.
  if (!dbName.endsWith("_test")) {
    throw new Error(`TEST_DATABASE_URL harus menunjuk database berakhiran _test, bukan "${dbName}".`);
  }
  process.env.DATABASE_URL = url;
  const admin = new SQL(url);
  await admin.unsafe("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;").simple();
  await admin.close();
}

// Migration dijalankan sekali di sini, di luar batas waktu hook test: inisialisasi PGlite (WASM)
// plus migration pertama bisa lebih lama dari timeout beforeAll bawaan bun test (5 detik).
// runMigrations() di beforeAll tiap file test tetap ada dan cepat karena sudah tercatat.
const { runMigrations } = await import("../src/db");
await runMigrations();

import { SQL } from "bun";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Dijalankan sekali sebelum semua file test (bunfig.toml → preload), sebelum src/db di-import.
// Semua file test dalam satu proses "bun test" berbagi satu koneksi dan satu database ini
// (src/db adalah singleton ESM), jadi data seed tiap file harus memakai email/nama sendiri.
//
// Database test dipaksa timpa (bukan ??=): kalau server/.env kebetulan sudah men-set
// DATABASE_URL ke database development, test tetap wajib pakai database test sendiri.
const url = process.env.TEST_DATABASE_URL ?? "postgres://laporan:laporan@localhost:5432/laporan_harian_test";
const dbName = new URL(url).pathname.slice(1);
// Pengaman: skema database ini dikosongkan tiap run, jadi tolak nama yang bukan database test.
if (!dbName.endsWith("_test")) {
  throw new Error(`TEST_DATABASE_URL harus menunjuk database berakhiran _test, bukan "${dbName}".`);
}
process.env.DATABASE_URL = url;
// Attachment, template Word, dan log test ditulis ke folder sementara, bukan data/ development.
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "laporan-harian-test-"));

const admin = new SQL(url);
await admin.unsafe("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;").simple();
await admin.close();

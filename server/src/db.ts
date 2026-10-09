import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import * as schema from "./schema";
import { mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
// Migration Postgres hasil `bun run db:generate` (ADR-0049 tahap 3). Rangkaian SQLite lama
// diarsipkan di docs/schema/sqlite-arsip/ dan tidak dijalankan lagi.
const migrationsFolder = join(serverRoot, "..", "docs", "schema", "postgres");

// Folder data di disk: attachment, template Word, dan log (ADR-0048). Database sudah tidak di
// sini lagi (pindah ke Postgres), tapi file tetap di disk. Test mengarahkan DATA_DIR ke tmpdir
// (tests/setup.ts) supaya file uji tidak bercampur dengan data development.
export const storageDir = resolve(process.env.DATA_DIR ?? join(serverRoot, "..", "data"));
mkdirSync(storageDir, { recursive: true });

export const databaseUrl = process.env.DATABASE_URL ?? "postgres://laporan:laporan@localhost:5432/laporan_harian";

// Client Postgres bawaan Bun (Bun.sql). Dipakai Drizzle untuk semua query aplikasi; test juga
// memakainya langsung untuk seeding data.
export const client = new SQL(databaseUrl);

export const db = drizzle({ client, schema });

export async function runMigrations() {
  await migrate(db, { migrationsFolder });
}

// Pelanggaran UNIQUE dari Postgres (SQLSTATE 23505). Drizzle membungkus error driver
// (DrizzleQueryError, pesan "Failed query: ...") dengan error asli di `cause`, jadi rantai cause
// ikut diperiksa. Bun.sql menaruh SQLSTATE di `errno`, driver lain (postgres.js, pg) di `code`.
export function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err; e instanceof Error; e = e.cause) {
    const { code, errno } = e as { code?: unknown; errno?: unknown };
    if (code === "23505" || errno === "23505") return true;
  }
  return false;
}

// Baris pertama hasil query, atau undefined. Pengganti `.get()` milik driver SQLite.
export function first<T>(rows: T[]): T | undefined {
  return rows[0];
}

// Tipe transaksi Drizzle, untuk helper yang dipanggil dari dalam db.transaction(...).
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

import { SQL } from "bun";
import { PGlite } from "@electric-sql/pglite";
import { sql, type SQL as DrizzleSQL } from "drizzle-orm";
import { drizzle as drizzleBunSql } from "drizzle-orm/bun-sql";
import { migrate as migrateBunSql } from "drizzle-orm/bun-sql/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
// Migration Postgres hasil `bun run db:generate` (ADR-0049 tahap 3). Rangkaian SQLite lama
// diarsipkan di docs/schema/sqlite-arsip/ dan tidak dijalankan lagi.
const migrationsFolder = join(serverRoot, "..", "docs", "schema", "postgres");

// Folder data di disk: attachment, template Word, log (ADR-0048), dan database PGlite lokal.
// Test mengarahkan DATA_DIR ke tmpdir (tests/setup.ts) supaya file uji tidak bercampur dengan
// data development.
export const storageDir = resolve(process.env.DATA_DIR ?? join(serverRoot, "..", "data"));
mkdirSync(storageDir, { recursive: true });

// Dua mode koneksi, skema dan migration tetap satu (ADR-0049):
// - DATABASE_URL diisi → server PostgreSQL lewat Bun.sql (produksi, atau lokal yang punya Postgres).
// - DATABASE_URL kosong → PGlite: PostgreSQL asli (WASM) yang jalan di dalam proses, data di
//   DATA_DIR/pglite. Untuk development lokal tanpa install Postgres, mirip file SQLite dulu.
const databaseUrl = process.env.DATABASE_URL?.trim() || null;
export const driver: "postgres" | "pglite" = databaseUrl ? "postgres" : "pglite";

type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

let database: Database;
let migrateFn: () => Promise<void>;
let closeFn: () => Promise<void>;

if (databaseUrl) {
  const client = new SQL(databaseUrl);
  const bunDb = drizzleBunSql({ client, schema });
  database = bunDb as unknown as Database;
  migrateFn = () => migrateBunSql(bunDb, { migrationsFolder });
  closeFn = () => client.close();
} else {
  const client = new PGlite(join(storageDir, "pglite"));
  const pgliteDb = drizzlePglite({ client, schema });
  database = pgliteDb as unknown as Database;
  migrateFn = () => migratePglite(pgliteDb, { migrationsFolder });
  closeFn = () => client.close();
}

export const db = database;

export function closeDb(): Promise<void> {
  return closeFn();
}

export async function runMigrations(): Promise<void> {
  await migrateFn();
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

// SQL mentah dengan placeholder `?`, untuk skrip (salin-data) dan seeding test; kode aplikasi
// memakai query builder Drizzle. Hasil execute berbeda bentuk per driver (Bun.sql: array baris,
// PGlite: { rows }), jadi diseragamkan jadi array baris di sini.
export async function rawQuery<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
  runner: Pick<Database, "execute"> = db,
): Promise<T[]> {
  const parts = text.split("?");
  const chunks: DrizzleSQL[] = [sql.raw(parts[0]!)];
  parts.slice(1).forEach((part, i) => chunks.push(sql`${params[i]}`, sql.raw(part)));
  const result = (await runner.execute(sql.join(chunks))) as unknown;
  return (Array.isArray(result) ? result : (result as { rows: T[] }).rows) as T[];
}

// Tipe transaksi Drizzle, untuk helper yang dipanggil dari dalam db.transaction(...).
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

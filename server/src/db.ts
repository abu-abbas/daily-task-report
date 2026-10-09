import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { readdirSync, readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dataDir = join(serverRoot, "..", "data");
// Skema fisik (ADR-0036) disimpan di docs/schema — satu sumber, dipakai dokumentasi dan migration.
const schemaDir = join(serverRoot, "..", "docs", "schema");

mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DATABASE_PATH ?? join(dataDir, "app.db");
// Basis penyimpanan attachment (server/src/storage.ts) — diturunkan dari dbPath, bukan dataDir,
// supaya test yang override DATABASE_PATH ke tmpdir otomatis mengisolasi file attachment juga,
// konsisten dengan pola isolasi test sqlite yang sudah ada, tanpa perlu env var baru.
export const storageDir = dirname(dbPath);

// Koneksi bun:sqlite mentah cuma dipakai migration di bawah dan seeding data di test. Kode
// aplikasi memakai `db` (Drizzle, ADR-0049 tahap 2) supaya tahap 3 cukup mengganti driver.
export const sqlite = new Database(dbPath, { create: true });
sqlite.run("PRAGMA foreign_keys = ON;");
sqlite.run("PRAGMA journal_mode = WAL;");

export const db = drizzle(sqlite, { schema });

function ensureMigrationsTable() {
  sqlite.run(
    `CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
  );
}

export function runMigrations() {
  ensureMigrationsTable();
  const applied = new Set(
    sqlite.query("SELECT name FROM _migrations").all().map((r) => (r as { name: string }).name),
  );

  const files = readdirSync(schemaDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(schemaDir, file), "utf-8");
    const runMigration = sqlite.transaction(() => {
      sqlite.run(sql);
      sqlite.query("INSERT INTO _migrations (name) VALUES (?)").run(file);
    });
    runMigration();
    console.log(`[migrate] applied ${file}`);
  }
}

// Pelanggaran UNIQUE dari driver mana pun. Drizzle membungkus error driver (DrizzleQueryError,
// pesan "Failed query: ...") dengan error asli di `cause`, jadi rantai cause ikut diperiksa.
// SQLite: pesan "UNIQUE constraint failed". Postgres (tahap 3): kode SQLSTATE 23505.
export function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err; e instanceof Error; e = e.cause) {
    if (e.message.includes("UNIQUE constraint failed")) return true;
    if ((e as { code?: unknown }).code === "23505") return true;
  }
  return false;
}

// Tipe transaksi Drizzle, untuk helper yang dipanggil dari dalam db.transaction(...).
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

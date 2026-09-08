import { Database } from "bun:sqlite";
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

export const db = new Database(dbPath, { create: true });
db.run("PRAGMA foreign_keys = ON;");
db.run("PRAGMA journal_mode = WAL;");

function ensureMigrationsTable() {
  db.run(
    `CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
  );
}

export function runMigrations() {
  ensureMigrationsTable();
  const applied = new Set(
    db.query("SELECT name FROM _migrations").all().map((r) => (r as { name: string }).name),
  );

  const files = readdirSync(schemaDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(schemaDir, file), "utf-8");
    const runMigration = db.transaction(() => {
      db.run(sql);
      db.query("INSERT INTO _migrations (name) VALUES (?)").run(file);
    });
    runMigration();
    console.log(`[migrate] applied ${file}`);
  }
}

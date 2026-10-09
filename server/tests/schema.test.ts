import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getTableConfig, type SQLiteTable } from "drizzle-orm/sqlite-core";

// Lihat users.test.ts soal kenapa DATABASE_PATH dipaksa timpa sebelum import.
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "laporan-harian-test-")), "test.db");

const { sqlite, runMigrations } = await import("../src/db");
const schema = await import("../src/schema");

beforeAll(() => {
  runMigrations();
});

// schema.ts ditulis tangan sebagai cerminan migration SQL (ADR-0049 tahap 2) — test ini menjaga
// keduanya tidak diam-diam berbeda: setiap tabel dan kolom harus sama persis dengan database
// hasil migration, termasuk NOT NULL dan primary key.
describe("schema Drizzle sama dengan database hasil migration", () => {
  const tables = Object.values(schema).filter(
    (v): v is SQLiteTable => typeof v === "object" && v !== null && Symbol.for("drizzle:IsDrizzleTable") in v,
  );

  test("semua tabel aplikasi tercakup", () => {
    const dbTables = sqlite
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '_migrations'",
      )
      .all()
      .map((r) => r.name)
      .sort();
    expect(tables.map((t) => getTableConfig(t).name).sort()).toEqual(dbTables);
  });

  for (const table of tables) {
    const config = getTableConfig(table);
    test(`kolom ${config.name}`, () => {
      const dbCols = sqlite
        .query<{ name: string; notnull: number; pk: number }, []>(`PRAGMA table_info(${config.name})`)
        .all()
        .map((c) => ({ name: c.name, notNull: c.notnull === 1 || (c.pk > 0 && config.primaryKeys.length === 0), pk: c.pk > 0 }))
        .sort((a, b) => a.name.localeCompare(b.name));
      const compositePk = new Set(config.primaryKeys.flatMap((pk) => pk.columns.map((c) => c.name)));
      const schemaCols = config.columns
        .map((c) => ({ name: c.name, notNull: c.notNull, pk: c.primary || compositePk.has(c.name) }))
        .sort((a, b) => a.name.localeCompare(b.name));
      expect(schemaCols).toEqual(dbCols);
    });
  }
});

import { beforeAll, describe, expect, test } from "bun:test";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";

const { runMigrations } = await import("../src/db");
const { db } = await import("./raw-db");
const schema = await import("../src/schema");

beforeAll(async () => {
  await runMigrations();
});

// Migration di docs/schema/postgres/ dihasilkan drizzle-kit dari schema.ts (ADR-0049 tahap 3).
// Test ini menjaga keduanya tidak diam-diam berbeda, mis. schema.ts diubah tapi lupa
// `bun run db:generate`: setiap tabel dan kolom harus sama dengan database hasil migration,
// termasuk tipe, NOT NULL, dan primary key.
describe("schema Drizzle sama dengan database hasil migration", () => {
  const tables = Object.values(schema).filter(
    (v): v is PgTable => typeof v === "object" && v !== null && Symbol.for("drizzle:IsDrizzleTable") in v,
  );

  test("semua tabel aplikasi tercakup", async () => {
    const dbTables = (
      await db.query<{ table_name: string }>(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
      ).all()
    )
      .map((r) => r.table_name)
      .sort();
    expect(tables.map((t) => getTableConfig(t).name).sort()).toEqual(dbTables);
  });

  for (const table of tables) {
    const config = getTableConfig(table);
    test(`kolom ${config.name}`, async () => {
      const pkCols = new Set(
        (
          await db.query<{ column_name: string }>(
            `SELECT k.column_name FROM information_schema.table_constraints c
             JOIN information_schema.key_column_usage k
               ON k.constraint_name = c.constraint_name AND k.table_schema = c.table_schema
             WHERE c.table_schema = 'public' AND c.table_name = ? AND c.constraint_type = 'PRIMARY KEY'`,
          ).all(config.name)
        ).map((r) => r.column_name),
      );
      const dbCols = (
        await db.query<{ column_name: string; is_nullable: string; data_type: string }>(
          "SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ?",
        ).all(config.name)
      )
        .map((c) => ({ name: c.column_name, type: c.data_type, notNull: c.is_nullable === "NO", pk: pkCols.has(c.column_name) }))
        .sort((a, b) => a.name.localeCompare(b.name));
      const compositePk = new Set(config.primaryKeys.flatMap((pk) => pk.columns.map((c) => c.name)));
      const schemaCols = config.columns
        .map((c) => ({
          name: c.name,
          type: c.getSQLType(),
          notNull: c.notNull || c.primary || compositePk.has(c.name),
          pk: c.primary || compositePk.has(c.name),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      expect(schemaCols).toEqual(dbCols);
    });
  }
});

// Skrip sekali jalan (ADR-0049 tahap 3): menyalin seluruh data dari database SQLite lama
// (data/app.db) ke PostgreSQL. Jalankan SETELAH `bun run migrate` membuat tabel di Postgres:
//
//   bun run salin-data                      # SQLite di ../data/app.db, tujuan Postgres dari DATABASE_URL
//                                           # (atau PGlite di data/pglite kalau DATABASE_URL kosong)
//   SQLITE_PATH=/path/app.db bun run salin-data
//
// Aman diulang: skrip menolak jalan kalau tabel Postgres sudah berisi, dan semua penyalinan
// berada dalam satu transaksi (gagal di tengah = tidak ada yang tersalin). File attachment dan
// template Word tidak perlu disalin; tetap di folder data/ seperti sebelumnya.
import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import { closeDb, db, driver, rawQuery } from "../src/db";
import * as schema from "../src/schema";

const sqlitePath = process.env.SQLITE_PATH ?? join(import.meta.dir, "..", "..", "data", "app.db");
if (!existsSync(sqlitePath)) {
  console.error(`[salin-data] file SQLite tidak ditemukan: ${sqlitePath}`);
  process.exit(1);
}
const sqlite = new Database(sqlitePath, { readonly: true });

// Urutan aman terhadap foreign key: induk dulu, baru anak.
const tables: PgTable[] = [
  schema.users,
  schema.userRoles,
  schema.sessions,
  schema.projects,
  schema.userProject,
  schema.tasks,
  schema.taskLogs,
  schema.kendala,
  schema.attachments,
  schema.leaves,
  schema.holidays,
  schema.saranBulanan,
  schema.laporanTemplate,
  schema.taskLogCommits,
];

// SQLite menyimpan CURRENT_TIMESTAMP sebagai "YYYY-MM-DD HH:MM:SS" dalam UTC tanpa penanda zona.
// Tanpa "+00" Postgres akan membacanya sebagai waktu lokal sesi, jadi tandai UTC secara eksplisit.
// Nilai yang sudah ISO dengan zona (expires_at, authored_at) dibiarkan apa adanya.
const SQLITE_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/;
function nilai(value: unknown, sqlType: string): unknown {
  if (typeof value === "string" && sqlType.startsWith("timestamp") && SQLITE_TIMESTAMP.test(value)) {
    return `${value}+00`;
  }
  return value;
}

const hitungSqlite = (name: string) =>
  (sqlite.query(`SELECT COUNT(*) AS c FROM ${name}`).get() as { c: number }).c;
const hitungPostgres = async (name: string) =>
  Number((await rawQuery<{ c: number }>(`SELECT COUNT(*)::int AS c FROM "${name}"`))[0]!.c);

const isiAwal = [];
for (const table of tables) {
  const name = getTableConfig(table).name;
  isiAwal.push({ name, n: await hitungPostgres(name) });
}
const sudahBerisi = isiAwal.filter((t) => t.n > 0);
if (sudahBerisi.length > 0) {
  console.error(
    `[salin-data] Postgres sudah berisi data (${sudahBerisi.map((t) => `${t.name}: ${t.n}`).join(", ")}). ` +
      "Skrip ini hanya untuk database kosong hasil `bun run migrate`.",
  );
  process.exit(1);
}

await db.transaction(async (tx) => {
  for (const table of tables) {
    const config = getTableConfig(table);
    const columns = config.columns.map((c) => ({ name: c.name, sqlType: c.getSQLType() }));
    const hasIdentity = config.columns.some((c) => c.name === "id" && c.primary);
    // users.atasan_id/supervisi_id menunjuk users lain yang mungkin belum tersalin; diisi
    // belakangan lewat UPDATE setelah semua user ada.
    const tunda = config.name === "users" ? new Set(["atasan_id", "supervisi_id"]) : new Set<string>();

    const rows = sqlite
      .query(`SELECT ${columns.map((c) => c.name).join(", ")} FROM ${config.name}${hasIdentity ? " ORDER BY id" : ""}`)
      .all() as Record<string, unknown>[];

    const insertCols = columns.filter((c) => !tunda.has(c.name));
    const placeholders = insertCols.map(() => "?").join(", ");
    const insertSql =
      `INSERT INTO "${config.name}" (${insertCols.map((c) => `"${c.name}"`).join(", ")}) ` +
      `${hasIdentity ? "OVERRIDING SYSTEM VALUE " : ""}VALUES (${placeholders})`;
    for (const row of rows) {
      await rawQuery(insertSql, insertCols.map((c) => nilai(row[c.name], c.sqlType)), tx);
    }

    if (tunda.size > 0) {
      for (const row of rows) {
        if (row.atasan_id === null && row.supervisi_id === null) continue;
        await rawQuery("UPDATE users SET atasan_id = ?, supervisi_id = ? WHERE id = ?", [row.atasan_id, row.supervisi_id, row.id], tx);
      }
    }

    // Id identity berikutnya harus melanjutkan id terbesar yang disalin, bukan mulai dari 1.
    if (hasIdentity && rows.length > 0) {
      await rawQuery(`SELECT setval(pg_get_serial_sequence('"${config.name}"', 'id'), (SELECT MAX(id) FROM "${config.name}"))`, [], tx);
    }
  }
});

// Pemeriksaan jumlah baris per tabel: SQLite (sumber) vs Postgres (tujuan).
let cocok = true;
console.log(`[salin-data] tujuan: ${driver}`);
console.log("[salin-data] tabel                 sqlite  postgres");
for (const table of tables) {
  const name = getTableConfig(table).name;
  const sumber = hitungSqlite(name);
  const tujuan = await hitungPostgres(name);
  if (sumber !== tujuan) cocok = false;
  console.log(`[salin-data] ${name.padEnd(20)} ${String(sumber).padStart(7)} ${String(tujuan).padStart(9)}${sumber === tujuan ? "" : "  <- BEDA"}`);
}
await closeDb();
sqlite.close();

if (!cocok) {
  console.error("[salin-data] jumlah baris tidak cocok, periksa tabel bertanda BEDA.");
  process.exit(1);
}
console.log("[salin-data] selesai, semua tabel cocok.");

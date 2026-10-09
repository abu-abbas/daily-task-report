import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";

// Lihat users.test.ts soal kenapa DATABASE_PATH dipaksa timpa sebelum import.
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "laporan-harian-test-")), "test.db");

const { db, isUniqueViolation, runMigrations } = await import("../src/db");
const { holidays, users } = await import("../src/schema");

beforeAll(() => {
  runMigrations();
});

describe("lapisan Drizzle (ADR-0049 tahap 2)", () => {
  test("transaksi dengan callback sinkron di-rollback utuh saat gagal di tengah", async () => {
    expect(() =>
      db.transaction((tx) => {
        tx.insert(holidays).values({ nama: "Rollback uji", tanggal_mulai: "2030-01-01", tanggal_akhir: "2030-01-01" }).run();
        throw new Error("gagal di tengah");
      }),
    ).toThrow("gagal di tengah");
    const rows = await db.select().from(holidays).where(eq(holidays.nama, "Rollback uji"));
    expect(rows).toHaveLength(0);
  });

  test("isUniqueViolation mengenali pelanggaran UNIQUE yang dibungkus Drizzle", async () => {
    await db.insert(users).values({ nama: "Satu", email: "unik.db@example.test" });
    let caught: unknown;
    try {
      await db.insert(users).values({ nama: "Dua", email: "unik.db@example.test" });
    } catch (err) {
      caught = err;
    }
    expect(isUniqueViolation(caught)).toBe(true);
    expect(isUniqueViolation(new Error("lain"))).toBe(false);
  });
});

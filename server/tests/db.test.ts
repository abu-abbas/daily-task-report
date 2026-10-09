import { beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

const { db, isUniqueViolation, runMigrations } = await import("../src/db");
const { holidays, users } = await import("../src/schema");

beforeAll(async () => {
  await runMigrations();
});

describe("lapisan Drizzle di Postgres (ADR-0049 tahap 3)", () => {
  test("transaksi async di-rollback utuh saat gagal di tengah", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.insert(holidays).values({ nama: "Rollback uji", tanggal_mulai: "2030-01-01", tanggal_akhir: "2030-01-01" });
        throw new Error("gagal di tengah");
      }),
    ).rejects.toThrow("gagal di tengah");
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

  test("kolom date dibaca sebagai string YYYY-MM-DD tanpa geser zona waktu", async () => {
    const [row] = await db
      .insert(holidays)
      .values({ nama: "Tanggal uji", tanggal_mulai: "2030-02-01", tanggal_akhir: "2030-02-02" })
      .returning();
    expect(row!.tanggal_mulai).toBe("2030-02-01");
    expect(row!.tanggal_akhir).toBe("2030-02-02");
  });
});

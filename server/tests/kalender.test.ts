import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "laporan-harian-test-")), "test.db");

const { db, runMigrations } = await import("../src/db");
const { isWorkday, previousWorkday } = await import("../src/kalender");

beforeAll(() => {
  runMigrations();
  // 2026-09-07 Senin, 2026-09-08 Selasa: libur tambahan berturutan (di luar akhir pekan).
  db.query("INSERT INTO holidays (nama, tanggal_mulai, tanggal_akhir) VALUES (?, ?, ?)").run(
    "Uji Libur Beruntun",
    "2026-09-07",
    "2026-09-08",
  );
  // Libur tunggal pas Jumat, dipakai kasus lintas-akhir-pekan.
  db.query("INSERT INTO holidays (nama, tanggal_mulai, tanggal_akhir) VALUES (?, ?, ?)").run(
    "Uji Libur Jumat",
    "2026-01-02",
    "2026-01-02",
  );
});

describe("isWorkday", () => {
  test("Senin-Jumat biasa adalah hari kerja", () => {
    expect(isWorkday("2026-09-09")).toBe(true); // Rabu
  });

  test("Sabtu-Minggu selalu libur", () => {
    expect(isWorkday("2026-09-05")).toBe(false); // Sabtu
    expect(isWorkday("2026-09-06")).toBe(false); // Minggu
  });

  test("tanggal dalam rentang holidays jadi libur walau hari kerja", () => {
    expect(isWorkday("2026-09-07")).toBe(false); // Senin, masuk rentang libur
    expect(isWorkday("2026-09-08")).toBe(false); // Selasa, masuk rentang libur
  });
});

describe("previousWorkday", () => {
  test("hari Rabu biasa -> Selasa sebelumnya", () => {
    expect(previousWorkday("2026-09-16")).toBe("2026-09-15");
  });

  test("Senin -> lompat akhir pekan ke Jumat", () => {
    expect(previousWorkday("2026-09-14")).toBe("2026-09-11");
  });

  test("melompati libur beruntun (Senin-Selasa libur) sampai ke Jumat sebelumnya", () => {
    // 2026-09-09 Rabu, mundur: Selasa 08 (libur), Senin 07 (libur), Minggu 06 (akhir
    // pekan), Sabtu 05 (akhir pekan), Jumat 04 (hari kerja).
    expect(previousWorkday("2026-09-09")).toBe("2026-09-04");
  });

  test("lintas tahun: hari kerja pertama Januari mundur ke Desember tahun lalu", () => {
    // 2026-01-01 Kamis adalah hari kerja itu sendiri; ujung transisi tahun diuji lewat
    // tanggal berikutnya yang melompati libur Jumat 2 Jan.
    expect(previousWorkday("2026-01-01")).toBe("2025-12-31");
  });

  test("melompati libur tunggal yang jatuh pas Jumat, lanjut ke Kamis", () => {
    // 2026-01-05 Senin mundur: Minggu 04 (akhir pekan), Sabtu 03 (akhir pekan),
    // Jumat 02 (libur), Kamis 01 (hari kerja).
    expect(previousWorkday("2026-01-05")).toBe("2026-01-01");
  });
});

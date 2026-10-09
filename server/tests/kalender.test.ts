import { beforeAll, describe, expect, test } from "bun:test";

const { runMigrations } = await import("../src/db");
const { db } = await import("./raw-db");
const { isWorkday, previousWorkday } = await import("../src/kalender");

beforeAll(async () => {
  await runMigrations();
  // 2026-09-07 Senin, 2026-09-08 Selasa: libur tambahan berturutan (di luar akhir pekan).
  await db.query("INSERT INTO holidays (nama, tanggal_mulai, tanggal_akhir) VALUES (?, ?, ?)").run(
    "Uji Libur Beruntun",
    "2026-09-07",
    "2026-09-08",
  );
  // Libur tunggal pas Jumat, dipakai kasus lintas-akhir-pekan.
  await db.query("INSERT INTO holidays (nama, tanggal_mulai, tanggal_akhir) VALUES (?, ?, ?)").run(
    "Uji Libur Jumat",
    "2026-01-02",
    "2026-01-02",
  );
});

describe("isWorkday", () => {
  test("Senin-Jumat biasa adalah hari kerja", async () => {
    expect(await isWorkday("2026-09-09")).toBe(true); // Rabu
  });

  test("Sabtu-Minggu selalu libur", async () => {
    expect(await isWorkday("2026-09-05")).toBe(false); // Sabtu
    expect(await isWorkday("2026-09-06")).toBe(false); // Minggu
  });

  test("tanggal dalam rentang holidays jadi libur walau hari kerja", async () => {
    expect(await isWorkday("2026-09-07")).toBe(false); // Senin, masuk rentang libur
    expect(await isWorkday("2026-09-08")).toBe(false); // Selasa, masuk rentang libur
  });
});

describe("previousWorkday", () => {
  test("hari Rabu biasa -> Selasa sebelumnya", async () => {
    expect(await previousWorkday("2026-09-16")).toBe("2026-09-15");
  });

  test("Senin -> lompat akhir pekan ke Jumat", async () => {
    expect(await previousWorkday("2026-09-14")).toBe("2026-09-11");
  });

  test("melompati libur beruntun (Senin-Selasa libur) sampai ke Jumat sebelumnya", async () => {
    // 2026-09-09 Rabu, mundur: Selasa 08 (libur), Senin 07 (libur), Minggu 06 (akhir
    // pekan), Sabtu 05 (akhir pekan), Jumat 04 (hari kerja).
    expect(await previousWorkday("2026-09-09")).toBe("2026-09-04");
  });

  test("lintas tahun: hari kerja pertama Januari mundur ke Desember tahun lalu", async () => {
    // 2026-01-01 Kamis adalah hari kerja itu sendiri; ujung transisi tahun diuji lewat
    // tanggal berikutnya yang melompati libur Jumat 2 Jan.
    expect(await previousWorkday("2026-01-01")).toBe("2025-12-31");
  });

  test("melompati libur tunggal yang jatuh pas Jumat, lanjut ke Kamis", async () => {
    // 2026-01-05 Senin mundur: Minggu 04 (akhir pekan), Sabtu 03 (akhir pekan),
    // Jumat 02 (libur), Kamis 01 (hari kerja).
    expect(await previousWorkday("2026-01-05")).toBe("2026-01-01");
  });
});

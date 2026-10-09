import { beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Lihat users.test.ts soal kenapa DATABASE_PATH dipaksa timpa sebelum import.
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "laporan-harian-test-")), "test.db");

const { log, logDir, pruneOldLogs } = await import("../src/logger");
const { todayJakarta } = await import("../src/kalender");

beforeEach(() => {
  // logDir dibagi lintas file test (storageDir singleton) — kosongkan supaya hitungan file pasti.
  rmSync(logDir, { recursive: true, force: true });
  delete process.env.LOG_MAX_FILE_SIZE_BYTES;
  delete process.env.LOG_RETENTION_DAYS;
});

describe("logger (ADR-0048)", () => {
  test("menulis JSON Lines ke file harian tanggal Jakarta", () => {
    log("error", "uji", { userId: 7 });
    const file = join(logDir, `app-${todayJakarta()}.log`);
    const [line] = readFileSync(file, "utf-8").trim().split("\n");
    const entry = JSON.parse(line!);
    expect(entry.level).toBe("error");
    expect(entry.message).toBe("uji");
    expect(entry.userId).toBe(7);
    expect(typeof entry.ts).toBe("string");
  });

  test("pindah ke file bernomor saat file hari ini tembus batas ukuran", () => {
    process.env.LOG_MAX_FILE_SIZE_BYTES = "50";
    log("error", "baris pertama yang cukup panjang supaya melewati batas");
    log("error", "baris kedua");
    const hari = todayJakarta();
    expect(existsSync(join(logDir, `app-${hari}.log`))).toBe(true);
    expect(readFileSync(join(logDir, `app-${hari}.1.log`), "utf-8")).toContain("baris kedua");
  });

  test("menghapus file yang lebih tua dari masa retensi, sisanya tetap", () => {
    process.env.LOG_RETENTION_DAYS = "7";
    mkdirSync(logDir, { recursive: true });
    for (const f of ["app-2026-10-01.log", "app-2026-10-01.1.log", "app-2026-10-02.log", "app-2026-10-09.log", "lain.txt"]) {
      writeFileSync(join(logDir, f), "x\n");
    }
    pruneOldLogs("2026-10-09");
    expect(readdirSync(logDir).sort()).toEqual(["app-2026-10-02.log", "app-2026-10-09.log", "lain.txt"]);
  });
});

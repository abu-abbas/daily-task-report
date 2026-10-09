import { appendFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { storageDir } from "./db";
import { todayJakarta } from "./kalender";

// Logging aplikasi (ADR-0048): JSON Lines per hari (tanggal Asia/Jakarta), rotasi ukuran sebagai
// pengaman, retensi N hari. Modul sendiri tanpa library, mengikuti pola storage.ts. Folder
// diturunkan dari storageDir (bukan dataDir) supaya test yang override DATABASE_PATH ke tmpdir
// otomatis mengisolasi file log juga.
export type LogLevel = "error" | "warn" | "info";

// Dibaca saat dipakai, bukan sekali saat import, supaya bisa diatur per test.
const maxFileSizeBytes = () => Number(process.env.LOG_MAX_FILE_SIZE_BYTES ?? 10 * 1024 * 1024);
const retentionDays = () => Number(process.env.LOG_RETENTION_DAYS ?? 7);
const FILE_RE = /^app-(\d{4}-\d{2}-\d{2})(?:\.(\d+))?\.log$/;

export const logDir = join(storageDir, "logs");

// Tanggal terakhir pruning dijalankan — pruning ulang dipicu dari log() saat tanggal berganti,
// bukan cron/scheduler terpisah (ADR-0048).
let lastPrunedFor = "";

function fileFor(tanggal: string, n: number): string {
  return join(logDir, n === 0 ? `app-${tanggal}.log` : `app-${tanggal}.${n}.log`);
}

function sizeOf(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

// File terakhir untuk tanggal ini yang masih di bawah batas ukuran; kalau penuh, lanjut ke
// nomor berikutnya (app-YYYY-MM-DD.1.log, .2.log, dst) — bukan menimpa atau berhenti logging.
function currentFile(tanggal: string): string {
  let n = 0;
  while (sizeOf(fileFor(tanggal, n)) >= maxFileSizeBytes()) n++;
  return fileFor(tanggal, n);
}

function minusDays(tanggal: string, days: number): string {
  const d = new Date(`${tanggal}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function pruneOldLogs(hariIni = todayJakarta()): void {
  lastPrunedFor = hariIni;
  const batas = minusDays(hariIni, retentionDays());
  let files: string[];
  try {
    files = readdirSync(logDir);
  } catch {
    return; // folder belum ada — belum ada yang perlu dihapus.
  }
  for (const f of files) {
    const m = FILE_RE.exec(f);
    if (m && m[1] < batas) {
      try {
        unlinkSync(join(logDir, f));
      } catch {
        // sudah terhapus proses lain — abaikan.
      }
    }
  }
}

export function log(level: LogLevel, message: string, meta: Record<string, unknown> = {}): void {
  const hariIni = todayJakarta();
  if (hariIni !== lastPrunedFor) pruneOldLogs(hariIni);

  const line = JSON.stringify({ ts: new Date().toISOString(), level, message, ...meta }) + "\n";
  try {
    mkdirSync(logDir, { recursive: true });
    appendFileSync(currentFile(hariIni), line);
  } catch (err) {
    // Gagal menulis log (disk penuh, izin folder) tidak boleh ikut menggagalkan request.
    console.error("[logger] gagal menulis log:", err, line);
  }
}

// Ubah nilai error apa pun jadi field log yang bisa dibaca (Error asli bawa stack trace).
export function errorMeta(err: unknown): Record<string, unknown> {
  if (err instanceof Error) return { error: err.message, stack: err.stack };
  return { error: String(err) };
}

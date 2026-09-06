import { db } from "./db";

// Timezone bisnis (ADR-0032), sama dengan TZ di server/.env — dipakai eksplisit di sini
// (bukan cuma andalkan TZ proses) supaya "hari ini" tetap benar walau proses dijalankan
// tanpa TZ diset.
const BUSINESS_TIMEZONE = process.env.TZ ?? "Asia/Jakarta";

export function todayJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Parsing manual "YYYY-MM-DD" lewat Date.UTC + getUTCDay supaya perhitungan hari-dalam-minggu
// tidak bergantung timezone proses (TZ env var) — tanggal kalender kerja adalah tanggal
// kalender polos, bukan instan waktu (ADR-0032).
function dayOfWeek(tanggal: string): number {
  const [y, m, d] = tanggal.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Minggu, 6 = Sabtu
}

function addDays(tanggal: string, delta: number): string {
  const [y, m, d] = tanggal.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + delta));
  return next.toISOString().slice(0, 10);
}

// Libur tambahan di luar akhir pekan (ADR-0026/ADR-0028): tanggal masuk salah satu rentang
// tanggal_mulai..tanggal_akhir pada tabel holidays.
function isHoliday(tanggal: string): boolean {
  const row = db
    .query<{ id: number }, [string, string]>(
      "SELECT id FROM holidays WHERE tanggal_mulai <= ? AND tanggal_akhir >= ? LIMIT 1",
    )
    .get(tanggal, tanggal);
  return row !== null;
}

// Aturan inti ADR-0026: Senin-Jumat kerja, Sabtu-Minggu libur, dikurangi tanggal yang masuk
// rentang holidays. Tidak ada "hari kerja khusus" akhir pekan (ADR-0026 revisi).
export function isWorkday(tanggal: string): boolean {
  const day = dayOfWeek(tanggal);
  if (day === 0 || day === 6) return false;
  return !isHoliday(tanggal);
}

// ADR-0006: telusuri mundur dari tanggal laporan sampai ketemu hari kerja, termasuk lintas
// bulan/tahun. Batas 400 hari cuma pengaman kalau ada bug tak terduga (mis. holidays salah
// isi menutupi rentang sangat panjang) — bukan aturan bisnis.
export function previousWorkday(tanggal: string): string {
  let cursor = addDays(tanggal, -1);
  for (let i = 0; i < 400; i++) {
    if (isWorkday(cursor)) return cursor;
    cursor = addDays(cursor, -1);
  }
  throw new Error(`Tidak menemukan hari kerja sebelum ${tanggal} dalam 400 hari.`);
}

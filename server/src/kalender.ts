import { and, gte, lte } from "drizzle-orm";
import { db, first } from "./db";
import { holidays } from "./schema";

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
async function isHoliday(tanggal: string): Promise<boolean> {
  const row = await db
    .select({ id: holidays.id })
    .from(holidays)
    .where(and(lte(holidays.tanggal_mulai, tanggal), gte(holidays.tanggal_akhir, tanggal)))
    .limit(1)
    .then(first);
  return row !== undefined;
}

// Aturan inti ADR-0026: Senin-Jumat kerja, Sabtu-Minggu libur, dikurangi tanggal yang masuk
// rentang holidays. Tidak ada "hari kerja khusus" akhir pekan (ADR-0026 revisi).
export async function isWorkday(tanggal: string): Promise<boolean> {
  const day = dayOfWeek(tanggal);
  if (day === 0 || day === 6) return false;
  return !(await isHoliday(tanggal));
}

// ADR-0006: telusuri mundur dari tanggal laporan sampai ketemu hari kerja, termasuk lintas
// bulan/tahun. Batas 400 hari cuma pengaman kalau ada bug tak terduga (mis. holidays salah
// isi menutupi rentang sangat panjang) — bukan aturan bisnis.
export async function previousWorkday(tanggal: string): Promise<string> {
  let cursor = addDays(tanggal, -1);
  for (let i = 0; i < 400; i++) {
    if (await isWorkday(cursor)) return cursor;
    cursor = addDays(cursor, -1);
  }
  throw new Error(`Tidak menemukan hari kerja sebelum ${tanggal} dalam 400 hari.`);
}

function firstOfMonth(tanggal: string): string {
  return `${tanggal.slice(0, 7)}-01`;
}

// ADR-0008: laporan terlewat cuma boleh diisi/dikoreksi dalam bulan berjalan (relatif hari
// ini sungguhan, bukan tanggal yang sedang dilihat) — bukan izin backdate tanpa batas.
export function dalamBulanBerjalan(tanggal: string, hariIni: string): boolean {
  return tanggal >= firstOfMonth(hariIni) && tanggal <= hariIni;
}

// ADR-0030: hari kerja terakhir bulan lalu boleh diisi/dikoreksi HANYA pada hari kerja
// pertama bulan baru — persis saat tanggal laporan yang dipilih = hari ini sungguhan, bukan
// backdate ke tanggal awal bulan itu kapan pun setelahnya ("memilih tanggal formulir awal
// bulan pada hari berikutnya tidak membuka kembali pengecualian").
export async function realisasiTanggalDiizinkan(tanggalLaporan: string, hariIni: string): Promise<boolean> {
  const hariKerjaSebelumnya = await previousWorkday(tanggalLaporan);
  if (hariKerjaSebelumnya >= firstOfMonth(hariIni)) return true;
  return tanggalLaporan === hariIni;
}

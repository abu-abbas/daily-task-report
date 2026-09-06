// Timezone bisnis dan locale tampilan (ADR-0032) — dipusatkan di sini supaya diatur lewat
// .env (VITE_LOCALE/VITE_TIMEZONE), bukan tersebar sebagai string hardcode di tiap komponen.
export const LOCALE = import.meta.env.VITE_LOCALE ?? "id-ID";
export const TIMEZONE = import.meta.env.VITE_TIMEZONE ?? "Asia/Jakarta";

const formatterTanggalPanjang = new Intl.DateTimeFormat(LOCALE, {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

// Tanggal kalender murni ("YYYY-MM-DD", tanpa jam) — di-parse manual lalu diformat dengan
// timeZone "UTC" supaya tidak bergeser sehari akibat timezone lokal browser (bukan Date.parse).
export function formatTanggalPanjang(tanggal: string): string {
  const [y, m, d] = tanggal.split("-").map(Number);
  return formatterTanggalPanjang.format(new Date(Date.UTC(y, m - 1, d)));
}

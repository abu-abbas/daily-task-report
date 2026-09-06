// Timezone bisnis dan locale tampilan (ADR-0032) — dipusatkan di sini supaya diatur lewat
// .env (VITE_LOCALE/VITE_TIMEZONE), bukan tersebar sebagai string hardcode di tiap komponen.
export const LOCALE = import.meta.env.VITE_LOCALE ?? "id-ID";
export const TIMEZONE = import.meta.env.VITE_TIMEZONE ?? "Asia/Jakarta";

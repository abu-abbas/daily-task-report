# ADR-0002: SQLite untuk tahap awal

- Status: digantikan oleh [ADR-0049](0049-hono-drizzle-postgres.md) (pindah ke PostgreSQL, tahap 3).
- Tanggal: 2026-09-05.
- Stage utama: [01](../stages/01-fondasi-akses.md).

## Konteks

Keputusan bisnis 2: pengguna memilih SQLite.

## Keputusan

Gunakan SQLite pada versi awal. Pertahankan entitas dan relasi spec dengan penyesuaian sintaks SQL yang diperlukan.

## Konsekuensi

Aktifkan dan verifikasi foreign key. Penyimpanan database harus persisten. PostgreSQL dan migrasinya bukan cakupan saat ini. Perubahan struktur bisnis perlu dijelaskan sebelum diterapkan.

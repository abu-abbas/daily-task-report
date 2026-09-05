# ADR-0029: Cakupan atasan berdasarkan tenaga ahli

- Status: digantikan oleh [ADR-0031](0031-hierarki-supervisi.md).
- Tanggal: 2026-09-05.
- Stage: 0 untuk keputusan; 1/2 untuk data dan akses; 6 untuk rekap.
- Melengkapi: [ADR-0004](0004-hak-akses.md).

## Konteks

Pengguna memilih daftar tenaga ahli dengan masing-masing satu atasan langsung sebagai dasar cakupan laporan atasan.

Pengguna kemudian mengoreksi menjadi atasan → banyak supervisi → banyak tenaga ahli. Isi berikut dipertahankan sebagai riwayat keputusan lama dan tidak lagi menjadi acuan implementasi.

## Keputusan

Setiap tenaga ahli memiliki satu atasan langsung. Atasan melihat laporan tenaga ahli yang menjadi tanggung jawabnya, termasuk pekerjaan mereka pada beberapa project. Keanggotaan project tetap membatasi project tempat tenaga ahli dapat mencatat pekerjaan.

## Konsekuensi

Filter dan otorisasi rekap mengikuti hubungan atasan–tenaga ahli, bukan semua anggota project yang kebetulan sama. Akses file mengikuti akses laporan. Jangan memberi akses rekursif ke bawahan dari atasan lain tanpa aturan tambahan.

Usulan penyimpanan users.atasan_id belum menjadi migration. Masa transisi user yang belum dipetakan, hak admin atas laporan, rangkap peran, serta akses histori ketika atasan/keanggotaan berubah masih perlu dirinci pada Q-02.

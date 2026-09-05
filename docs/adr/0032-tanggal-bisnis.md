# ADR-0032: Timezone, cuti pribadi, dan tanggal histori

- Status: diterima.
- Tanggal: 2026-09-05.
- Stage: 0, 2, 3, 4, 6, dan 7.

## Konteks

Pengguna menyetujui Asia/Jakarta, pemisahan cuti pribadi dari kalender bersama, dan perlindungan tanggal log yang sudah tersimpan saat kalender berubah.

## Keputusan

- Tanggal bisnis dan batas hari/bulan ditentukan dalam timezone Asia/Jakarta.
- Cuti pribadi tetap dicatat dalam leaves dan tidak mengubah kalender kerja bersama.
- Perubahan kalender tidak mengubah tanggal task_logs yang sudah tersimpan.

## Konsekuensi

Penentuan hari kerja sebelumnya memakai kalender bersama, bukan otomatis melewati cuti pribadi seorang user. Timestamp input tetap berbeda dari tanggal pekerjaan. Saat formulir lama dibuka ulang, tampilkan log tersimpan dengan tanggal aslinya; jangan memindahkannya ke hasil perhitungan kalender terbaru.

Pengecualian awal bulan tetap mengikuti [ADR-0030](0030-pengecualian-awal-bulan.md). Detail edit/carry-over ketika kalender berubah harus diuji pada Stage 3/4 tanpa mengubah keputusan tanggal ini.

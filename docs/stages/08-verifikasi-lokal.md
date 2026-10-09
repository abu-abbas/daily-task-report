# Stage 08 — Verifikasi akhir dan operasi lokal

- Status: Belum dimulai.
- Prasyarat: Stage 1–7 untuk penyelesaian seluruh cakupan; sebagian verifikasi dapat dilakukan selama tahap sebelumnya.
- Keputusan: [ADR-0001](../adr/0001-stack-typescript.md), [ADR-0002](../adr/0002-database-sqlite.md), [ADR-0003](../adr/0003-login-session.md), [ADR-0004](../adr/0004-hak-akses.md), [ADR-0019](../adr/0019-word-per-tipe.md), [ADR-0020](../adr/0020-operasional-lokal.md), [ADR-0023](../adr/0023-mobile-first.md), [ADR-0024](../adr/0024-tema.md), [ADR-0025](../adr/0025-metode-ponytail.md), [ADR-0026](../adr/0026-kalender-kerja-tahunan.md).

## Cakupan

- Jalankan pemeriksaan integrasi login → input → edit/izin → riwayat → dashboard → ekspor.
- Periksa batas bulan, kalender kerja, otorisasi API/file, dan rollback transaksi yang relevan.
- Periksa mobile/laptop, light/dark mode, label, focus keyboard, serta feedback validasi.
- Dokumentasikan setup, menjalankan aplikasi, konfigurasi minimum, dan backup/restore PostgreSQL (`pg_dump`/`pg_restore`, [ADR-0049](../adr/0049-hono-drizzle-postgres.md)) beserta attachment.

## Kriteria selesai dan pemeriksaan

- [ ] Pemeriksaan bermakna untuk alur bisnis utama dan typecheck lolos; keterbatasan yang masih ada dicatat.
- [ ] Data PostgreSQL dan attachment dapat dipulihkan bersama dari backup dan dibaca kembali.
- [ ] Instruksi lokal dapat diikuti dari setup baru.
- [ ] Tidak menyatakan seluruh aplikasi selesai bila template atau fitur wajib lain masih menunggu input.

## Dependensi terbuka

Selesaikan keputusan terbuka yang memengaruhi fitur; deployment publik bukan kriteria tahap ini. Lihat [daftar keputusan terbuka](../open-decisions.md).

## Bukti pelaksanaan

Belum ada implementasi atau pemeriksaan aplikasi. Isi hasil pemeriksaan dan keterbatasan aktual saat tahap dikerjakan. Berhenti setelah kriteria tahap terpenuhi; jangan menambahkan fitur di luar cakupan.

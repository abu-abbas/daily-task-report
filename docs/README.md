# Laporan Harian Tenaga Ahli — keputusan dan tahapan

Dokumen ini mencatat spec dan keputusan percakapan pada 5 September 2026. Pekerjaan saat ini hanya dokumentasi; aplikasi belum diimplementasikan.

## Cara membaca

- ADR berstatus diterima adalah keputusan pengguna, bukan bukti implementasi. Jawaban "ok" pada daftar pilihan berarti menerima opsi rekomendasi, kecuali ada koreksi eksplisit.
- Instruksi pengguna terbaru mengungguli ADR lama; ADR yang berubah harus diperbarui atau digantikan dengan tautan penggantinya. Catat status serta alasan perubahan tanpa menghapus konteks.
- ADR mengungguli [spec awal](references/spec-original.md) dan [referensi UI](references/ui-reference.md) jika ada perbedaan. Spec awal disimpan apa adanya sebagai sumber historis.
- Rincian yang belum diputuskan ada di [keputusan terbuka](open-decisions.md). Jangan menyebut usulan sebagai persetujuan atau implementasi.
- Gunakan ponytail full: minimum yang memenuhi kebutuhan, tanpa mengurangi validasi, keamanan, aksesibilitas, atau pemeriksaan perilaku.

## Ringkasan yang dikunci

Bun + Vue 3 + Vite + TypeScript, SQLite, login email/password, peran tenaga ahli/atasan/admin, shadcn-vue + Tailwind, tampilan minimalis mobile-first, light/dark mode, dan operasi lokal dahulu. Task tanpa pemilik permanen; realisasi bertanggal pekerjaan. Penutupan eksplisit memiliki deskripsi opsional. Kalender kerja tahunan menentukan hari kerja sebelumnya dan indikator nyangkut. Word memakai template berbeda per tipe programmer; file template menyusul.

## Indeks keputusan

ADR-0001–0020 mengikuti nomor keputusan bisnis. ADR-0021–0024 mengikuti empat keputusan frontend. ADR-0025 dan ADR-0026 mencatat instruksi tambahan.

| ADR | Keputusan |
| --- | --- |
| 0001 | [Stack aplikasi TypeScript](adr/0001-stack-typescript.md) |
| 0002 | [SQLite untuk tahap awal](adr/0002-database-sqlite.md) |
| 0003 | [Login email dan password](adr/0003-login-session.md) |
| 0004 | [Peran dan cakupan akses](adr/0004-hak-akses.md) |
| 0005 | [Pengelolaan project oleh admin](adr/0005-project-keanggotaan.md) |
| 0006 | [Kemarin berarti hari kerja sebelumnya](adr/0006-hari-kerja.md) |
| 0007 | [Tanggal log adalah tanggal pekerjaan](adr/0007-tanggal-realisasi.md) |
| 0008 | [Pengisian laporan yang terlewat](adr/0008-laporan-terlewat.md) |
| 0009 | [Edit laporan dan submit ulang](adr/0009-edit-submit.md) |
| 0010 | [Pemilihan task dan kepemilikan harian](adr/0010-task-tanpa-pemilik.md) |
| 0011 | [Beberapa orang pada task yang sama](adr/0011-kolaborasi-task.md) |
| 0012 | [Penutupan task eksplisit dengan deskripsi opsional](adr/0012-penutupan-task.md) |
| 0013 | [Izin hari ini tetap mengizinkan realisasi sebelumnya](adr/0013-izin-form.md) |
| 0014 | [Izin dan realisasi tidak boleh pada tanggal yang sama](adr/0014-izin-realisasi.md) |
| 0015 | [Kendala per log dan penyelesaiannya](adr/0015-kendala.md) |
| 0016 | [Attachment gambar pada log](adr/0016-attachment.md) |
| 0017 | [Definisi indikator task nyangkut](adr/0017-task-nyangkut.md) |
| 0018 | [Laporan tanpa workflow approval](adr/0018-tanpa-approval.md) |
| 0019 | [Ekspor Word menurut tipe programmer](adr/0019-word-per-tipe.md) |
| 0020 | [Validasi lokal terlebih dahulu](adr/0020-operasional-lokal.md) |
| 0021 | [shadcn-vue dan Tailwind CSS](adr/0021-komponen-ui.md) |
| 0022 | [Visual minimalis dengan referensi sebagai inspirasi](adr/0022-arah-visual.md) |
| 0023 | [Mobile-first dan tetap nyaman di laptop](adr/0023-mobile-first.md) |
| 0024 | [Light mode dan dark mode](adr/0024-tema.md) |
| 0025 | [Ponytail wajib digunakan](adr/0025-metode-ponytail.md) |
| 0026 | [Tabel kalender kerja tahunan](adr/0026-kalender-kerja-tahunan.md) |

## Tahapan pekerjaan

Setiap stage menggabungkan UI, backend, dan pemeriksaan yang relevan. Status dan bukti pemeriksaan dicatat pada file stage, bukan diasumsikan dari keberadaan dokumentasi.

| Stage | Cakupan | Status awal |
| --- | --- | --- |
| 00 | [Keputusan dan desain layar](stages/00-keputusan-desain.md) | Dokumentasi tersedia; desain dan rincian belum selesai |
| 01 | [Fondasi aplikasi dan akses](stages/01-fondasi-akses.md) | Belum dimulai |
| 02 | [User, project, dan kalender kerja](stages/02-user-project.md) | Belum dimulai |
| 03 | [Input harian inti](stages/03-input-harian.md) | Belum dimulai |
| 04 | [Koreksi laporan, izin, dan penutupan task](stages/04-koreksi-izin-penutupan.md) | Belum dimulai |
| 05 | [Kendala, attachment, dan riwayat](stages/05-kendala-attachment-riwayat.md) | Belum dimulai |
| 06 | [Dashboard dan rekap atasan](stages/06-dashboard.md) | Belum dimulai |
| 07 | [Ekspor Word menurut tipe programmer](stages/07-ekspor-word.md) | Menunggu template; belum dimulai |
| 08 | [Verifikasi akhir dan operasi lokal](stages/08-verifikasi-lokal.md) | Belum dimulai |

Stage 3 menjadi titik uji alur bisnis utama. Stage 7 menunggu template asli dan tidak menghalangi Stage 1–6. Stage 8 tidak boleh menyatakan seluruh cakupan selesai selama fitur wajib masih tertunda.

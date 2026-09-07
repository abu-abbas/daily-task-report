# Laporan Harian Tenaga Ahli — keputusan dan tahapan

Dokumen ini mencatat spec dan keputusan percakapan pada 5 September 2026. Dokumentasi dan tooling commit tersedia; aplikasi belum diimplementasikan.

Gunakan [checklist pekerjaan](TODO.md) sebagai panduan progres dan urutan langkah berikutnya.

[Buka preview Stage 0](stages/00-preview.html) di browser untuk memeriksa Input Harian, Riwayat, dan Rekap dalam light/dark mode. Preview menggunakan data contoh dan belum menyimpan laporan.

Referensi pengguna: [spec awal](references/spec-original.md), [tampilan input harian](references/ui-reference.md), dan [pengaturan rentang libur](references/holiday-settings.md).

## Cara membaca

- ADR berstatus diterima adalah keputusan pengguna, bukan bukti implementasi. Jawaban "ok" pada daftar pilihan berarti menerima opsi rekomendasi, kecuali ada koreksi eksplisit.
- Instruksi pengguna terbaru mengungguli ADR lama; ADR yang berubah harus diperbarui atau digantikan dengan tautan penggantinya. Catat status serta alasan perubahan tanpa menghapus konteks.
- ADR mengungguli [spec awal](references/spec-original.md) dan [referensi UI](references/ui-reference.md) jika ada perbedaan. Spec awal disimpan apa adanya sebagai sumber historis.
- Rincian yang belum diputuskan ada di [keputusan terbuka](open-decisions.md). Jangan menyebut usulan sebagai persetujuan atau implementasi.
- Gunakan ponytail full: minimum yang memenuhi kebutuhan, tanpa mengurangi validasi, keamanan, aksesibilitas, atau pemeriksaan perilaku.

## Ringkasan yang dikunci

Bun + Vue 3 + Vite + TypeScript, SQLite, login email/password, akun dengan rangkap peran tenaga ahli/supervisi/atasan/admin, shadcn-vue + Tailwind, tampilan minimalis mobile-first, light/dark mode, dan operasi lokal dahulu. Hierarki atasan → supervisi → tenaga ahli menentukan akses histori melalui hubungan aktif. Tanggal bisnis memakai Asia/Jakarta. Task tanpa pemilik permanen; realisasi bertanggal pekerjaan. Penutupan eksplisit memiliki deskripsi opsional. Kalender kerja tahunan menentukan hari kerja sebelumnya dan indikator nyangkut. Word memakai template berbeda per tipe programmer; file template menyusul.

## Indeks keputusan

ADR-0001–0020 mengikuti nomor keputusan bisnis. ADR-0021–0024 mengikuti empat keputusan frontend. ADR-0025 dan seterusnya mencatat instruksi tambahan.

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
| 0026 | [Aturan kalender kerja — default mingguan plus tabel libur](adr/0026-kalender-kerja-tahunan.md) |
| 0027 | [Hook Conventional Commits](adr/0027-hook-conventional-commits.md) |
| 0028 | [Pengelolaan kalender bersama sebagai daftar libur](adr/0028-pengelolaan-kalender.md) |
| 0029 | [Cakupan atasan langsung — digantikan ADR-0031](adr/0029-atasan-langsung.md) |
| 0030 | [Pengecualian realisasi pada awal bulan](adr/0030-pengecualian-awal-bulan.md) |
| 0031 | [Hierarki atasan, supervisi, dan tenaga ahli](adr/0031-hierarki-supervisi.md) |
| 0032 | [Timezone, cuti pribadi, dan tanggal histori](adr/0032-tanggal-bisnis.md) |
| 0033 | [Satu akun dapat merangkap peran](adr/0033-rangkap-peran.md) |
| 0034 | [Akses histori mengikuti hubungan aktif](adr/0034-akses-histori.md) |
| 0035 | [Bun native tanpa framework/ORM](adr/0035-backend-framework.md) |
| 0036 | [Skema fisik minimum Stage 1](adr/0036-skema-fisik-stage1.md) |
| 0037 | [vee-validate+zod, TanStack Query, TanStack Table](adr/0037-library-frontend-tambahan.md) |
| 0038 | [Login SSO via GitLab CE self-hosted](adr/0038-sso-gitlab.md) |
| 0039 | [Commit GitLab sebagai bukti pendukung laporan](adr/0039-integrasi-commit-gitlab.md) |
| 0040 | [Import project dari GitLab CE sebagai alternatif input manual](adr/0040-import-project-gitlab.md) |
| 0041 | [Identitas item task_logs — satu baris per upsert](adr/0041-identitas-item-task-log.md) |
| 0042 | [Usulan project via "Lainnya" dengan rekonsiliasi admin](adr/0042-project-lainnya-usulan.md) |
| 0043 | [Beranda sebagai preview rencana hari ini, todo-list opsional dalam catatan](adr/0043-beranda-dan-todo-list-rencana.md) |

## Tahapan pekerjaan

Setiap stage menggabungkan UI, backend, dan pemeriksaan yang relevan. Status dan bukti pemeriksaan dicatat pada file stage, bukan diasumsikan dari keberadaan dokumentasi.

| Stage | Cakupan | Status awal |
| --- | --- | --- |
| 00 | [Keputusan dan desain layar](stages/00-keputusan-desain.md) | Berjalan; keputusan dasar, preview, dan skema fisik (Q-03) terverifikasi; rincian lanjutan Q-01/Q-02 tetap diselesaikan sebelum stage terkait |
| 01 | [Fondasi aplikasi dan akses](stages/01-fondasi-akses.md) | Berjalan; fondasi backend dan login terverifikasi, layout perlu pemeriksaan visual manual |
| 02 | [User, project, dan kalender kerja](stages/02-user-project.md) | Belum dimulai |
| 03 | [Input harian inti](stages/03-input-harian.md) | Belum dimulai |
| 04 | [Koreksi laporan, izin, dan penutupan task](stages/04-koreksi-izin-penutupan.md) | Belum dimulai |
| 05 | [Kendala, attachment, dan riwayat](stages/05-kendala-attachment-riwayat.md) | Belum dimulai |
| 06 | [Dashboard dan rekap atasan](stages/06-dashboard.md) | Belum dimulai |
| 07 | [Ekspor Word menurut tipe programmer](stages/07-ekspor-word.md) | Menunggu template; belum dimulai |
| 08 | [Verifikasi akhir dan operasi lokal](stages/08-verifikasi-lokal.md) | Belum dimulai |

Stage 3 menjadi titik uji alur bisnis utama. Stage 7 menunggu template asli dan tidak menghalangi Stage 1–6. Stage 8 tidak boleh menyatakan seluruh cakupan selesai selama fitur wajib masih tertunda.

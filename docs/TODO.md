# Checklist pekerjaan Laporan Harian

Posisi saat ini: aplikasi fungsional sudah berjalan (Bun + Vue 3, backend+frontend nyata, bukan cuma preview). **Stage 1 selesai.** **Stage 2 hampir selesai** — pengelolaan user, project, keanggotaan, dan kalender/libur semuanya end-to-end (backend+frontend+test); tersisa satu kriteria yang baru bisa diverifikasi penuh begitu Stage 3 ada. Lanjut ke Stage 3 (Input Harian).

## Cara memakai checklist

1. Mulai dari item belum selesai pada stage aktif; baca ADR dan file stage yang ditautkan.
2. Selesaikan keputusan terbuka yang memengaruhi pekerjaan tersebut. Jangan menganggap usulan sudah disetujui.
3. Kerjakan cakupan minimum dengan ponytail, termasuk UI/backend dan pemeriksaan yang relevan.
4. Centang kriteria pada file stage setelah ada bukti pemeriksaan; catat hasil dan keterbatasannya di bagian Bukti pelaksanaan.
5. Centang stage di halaman ini hanya jika seluruh kriteria wajibnya terpenuhi. Perbarui status di indeks dokumentasi agar konsisten.

ADR menjadi sumber keputusan, file stage menjadi sumber kriteria selesai, dan halaman ini menjadi navigasi progres. Tidak perlu menyalin semua checklist detail ke sini.

## Persiapan

- [x] Simpan spec awal dan referensi UI.
- [x] Catat [contoh pengaturan libur berbentuk rentang](references/holiday-settings.md) serta usulan penerapannya pada kalender bersama; skema fisik belum final.
- [x] Dokumentasikan keputusan dalam ADR dan rencana Stage 0–8.
- [x] Hubungkan repo ke GitHub dan push commit dokumentasi awal.
- [x] Aktifkan hook Conventional Commits dan verifikasi pesan valid/invalid; bukti pada [ADR-0027](adr/0027-hook-conventional-commits.md).
- [ ] Commit dan push perubahan tooling hook serta dokumentasi setelah siap dikirim. Ini belum dilakukan dan tidak menghalangi rancangan Stage 0.

## Stage 0 (selesai) — arsip keputusan dasar

- [x] Tetapkan kalender bersama oleh admin, pola awal Senin–Jumat, dan blok submit jika kalender belum tersedia — [ADR-0028](adr/0028-pengelolaan-kalender.md).
- [x] Tetapkan hierarki atasan → banyak supervisi → banyak tenaga ahli — [ADR-0031](adr/0031-hierarki-supervisi.md), menggantikan ADR-0029.
- [x] Tetapkan pengecualian pengisian/koreksi realisasi hari kerja terakhir bulan lalu pada hari kerja pertama bulan baru — [ADR-0030](adr/0030-pengecualian-awal-bulan.md).
- [x] Tetapkan Asia/Jakarta, cuti pribadi terpisah, dan tanggal log tersimpan tidak berubah — [ADR-0032](adr/0032-tanggal-bisnis.md). Detail generate ulang dan hitungan nyangkut dilanjutkan pada Stage 2/6.
- [x] Pastikan supervisi memiliki akun login dan akses laporan tenaga ahli di bawahnya — [ADR-0031](adr/0031-hierarki-supervisi.md).
- [x] Tetapkan rangkap peran, akses histori berdasarkan hubungan aktif, dan batas hak admin — [ADR-0033](adr/0033-rangkap-peran.md) / [ADR-0034](adr/0034-akses-histori.md). Detail provisioning dan koreksi setelah keluar project dilanjutkan pada Stage 1/2/4.
- [x] Tetapkan skema fisik final (DDL) dan framework backend sebelum migration — [ADR-0035](adr/0035-backend-framework.md), [ADR-0036](adr/0036-skema-fisik-stage1.md), [ADR-0037](adr/0037-library-frontend-tambahan.md) menutup Q-03. Migration sudah dijalankan sejak Stage 1 dan diperbarui lagi di Stage 2 (tabel `holidays` menggantikan `work_calendar`, ADR-0026 revisi).
- [x] Buat wireframe Input Harian mobile-first beserta keadaan kosong, task dicentang, catatan wajib, kendala, attachment, izin, dan feedback validasi; lihat [bahan review](stages/00-review.md). Belum berupa halaman browser.
- [x] Lengkapi rancangan Riwayat dan Dashboard; [preview](stages/00-preview.html) lolos 12 kombinasi layar/tema/viewport dan pemeriksaan interaksi dasar. Bukti pada Stage 0.
- [x] Catat jawaban serta koreksi terbaru di ADR dan perbarui [keputusan terbuka](open-decisions.md). Skema fisik dan rincian tahap berikutnya tetap dipisahkan dari keputusan pengguna.
- [x] Selesaikan seluruh kriteria [Stage 0](stages/00-keputusan-desain.md).

Langkah berikutnya: lanjut Stage 3 (input harian) — checklist realisasi, kerjaan tambahan, cold start, rencana manual, simpan atomik. Rincian keanggotaan/kalender sudah tuntas di Stage 2, tinggal dipakai. Q-04/Q-05 sebelum fitur edit, sedangkan template Word menunggu Stage 7.

## Urutan implementasi

- [x] **[Stage 1 — Fondasi dan akses](stages/01-fondasi-akses.md):** Selesai — setup aplikasi, migration, login/session, dan layout dasar (mobile/laptop, kedua tema) terverifikasi (lihat bukti pelaksanaan).
- [ ] **[Stage 2 — User, project, kalender](stages/02-user-project.md):** Hampir selesai — pengelolaan user, project, keanggotaan, dan kalender/libur semuanya sudah end-to-end (backend+frontend+test); tersisa satu kriteria (pembatasan pencatatan di luar keanggotaan) yang baru bisa diverifikasi penuh begitu Stage 3 ada.
- [ ] **[Stage 3 — Input harian](stages/03-input-harian.md):** checklist realisasi, kerjaan tambahan, cold start, rencana manual, dan simpan atomik. Rinci identitas item/submit pada Q-05 sebelum membangun penyimpanan.
- [ ] **[Stage 4 — Koreksi, izin, penutupan](stages/04-koreksi-izin-penutupan.md):** edit/backdate, cegah duplikasi, konflik izin/realisasi, serta penutupan dengan deskripsi opsional. Selesaikan Q-04/Q-05 yang relevan.
- [ ] **[Stage 5 — Kendala, attachment, riwayat](stages/05-kendala-attachment-riwayat.md):** resolve kendala, upload gambar tervalidasi, akses file, serta detail laporan per tanggal.
- [ ] **[Stage 6 — Dashboard](stages/06-dashboard.md):** rekap sesuai tim dan indikator task nyangkut berdasarkan kalender kerja.
- [ ] **[Stage 7 — Word per tipe programmer](stages/07-ekspor-word.md):** terima template, selesaikan Q-06, lalu verifikasi ekspor per orang/bulan untuk setiap tipe yang disepakati.
- [ ] **[Stage 8 — Verifikasi lokal](stages/08-verifikasi-lokal.md):** uji alur lengkap, hak akses, kalender/batas bulan, kedua tema, serta backup/restore database dan attachment.

Stage 3 adalah titik uji pertama alur bisnis utama, bukan tanda seluruh aplikasi selesai. Template Word yang belum tersedia tidak menghalangi Stage 1–6.

## Ditunda sampai dibutuhkan

- **Semantic-release dan CI:** saat pipeline release dikerjakan, tambahkan validasi commit di CI dan preset release yang konsisten dengan [ADR-0027](adr/0027-hook-conventional-commits.md).
- **Deployment untuk tim:** tentukan server dan operasional setelah validasi lokal; belum menjadi pekerjaan aktif.

Daftar ini tidak menambah fitur di luar [keputusan dan tahapan yang disepakati](README.md).

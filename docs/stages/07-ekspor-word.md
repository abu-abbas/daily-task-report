# Stage 07 — Ekspor Word menurut tipe programmer

- Status: Cicilan awal (PDF generik, tanpa template) selesai 2026-09-08 buat validasi data laporan; layout Word asli per tipe programmer masih menunggu template.
- Prasyarat: Stage 5 untuk data laporan. Urutan kerja normal setelah Stage 6; template tidak menghalangi Stage 1–6.
- Keputusan: [ADR-0007](../adr/0007-tanggal-realisasi.md), [ADR-0013](../adr/0013-izin-form.md), [ADR-0014](../adr/0014-izin-realisasi.md), [ADR-0016](../adr/0016-attachment.md), [ADR-0019](../adr/0019-word-per-tipe.md), [ADR-0025](../adr/0025-metode-ponytail.md).

## Cakupan

- Terima dan pelajari contoh .docx untuk setiap tipe programmer yang masuk cakupan.
- Tetapkan pemetaan tipe programmer ke template dan jelaskan perubahan skema minimum jika diperlukan.
- Hasilkan satu dokumen per tenaga ahli per bulan: timesheet, narasi realisasi, izin, serta lampiran sesuai template.
- Gunakan placeholder dari spec hanya bila cocok dengan template aktual; jangan membuat editor template generik.

## Kriteria selesai dan pemeriksaan

- [ ] Dokumen untuk setiap tipe yang disepakati dapat dibuka dan layout/isinya sesuai contoh pengguna.
- [ ] Data dipilih berdasarkan tanggal pekerjaan pada bulan dan user yang benar.
- [ ] Izin, hari tanpa laporan, libur, dan attachment mengikuti aturan template; tidak ada penggandaan aktivitas karena join.
- [ ] Template/tipe yang belum tersedia ditangani dengan pesan jelas, tidak memakai template yang keliru diam-diam.

## Dependensi terbuka

File template dan seluruh Q-06; hasil ekspor belum dapat dinyatakan final sebelum tersedia. Lihat [daftar keputusan terbuka](../open-decisions.md).

## Bukti pelaksanaan

Kriteria selesai di atas mengukur deliverable Word per tipe programmer (inti stage ini) — belum terpenuhi, masih menunggu template asli dan Q-06. Sebagai cicilan awal, dibangun ekspor **PDF generik satu layout** (bukan per tipe) buat validasi data laporan lebih dulu — lihat detail keputusan di [ADR-0019 bagian "Implementasi awal"](../adr/0019-word-per-tipe.md#implementasi-awal-pdf-generik).

**PDF generik** — selesai 2026-09-08:

- **Backend**: `server/src/report-pdf.ts` (baru) — `buildMonthlyReportPdf` murni fungsi build PDF pakai `pdf-lib` (3 bagian: timesheet landscape, tabel aktifitas portrait, lampiran portrait), tanpa akses DB. `catatanToLines` konversi markdown checklist/bullet ke teks ASCII-aman (`[x]`/`[ ]`/`•` — glyph Unicode ☐/☑ gagal di-encode font WinAnsi standar, ditemukan lewat error runtime nyata saat verifikasi, bukan diantisipasi dari awal). `server/src/routes/reports.ts` (baru) — `handleMonthlyReportPdf` (`GET /api/reports/monthly?bulan=YYYY-MM`, 401/400, agregasi task_logs realisasi + attachment bytes dari disk + `isWorkday`/`leaves` buat kalender timesheet, reuse `kalender.ts`/`storage.ts` apa adanya).
- **Test otomatis**: `server/tests/reports.test.ts` (baru, 5 test) — 401, 400 format bulan salah, 200+`Content-Type: application/pdf`+signature `%PDF-`+struktur valid (`PDFDocument.load` lolos), bulan tanpa data tetap 200, isolasi antar user. Total 160 test lolos lintas file.
- **Frontend**: `RiwayatView.vue` — widget kecil (prev/next bulan + tombol "Unduh laporan (PDF)", `monthlyReportPdfUrl` di `lib/api.ts`) di atas heatmap; link langsung (`<a :href target="_blank">`), bukan fetch+blob, sama pola `AttachmentList.vue`.
- **Diverifikasi lewat Playwright + inspeksi manual** (akun uji sementara, data dihapus setelah selesai): data seed 2 project, 2 task (satu open satu closed), realisasi lintas 4 tanggal dengan catatan bullet+checkbox, 2 attachment gambar asli, 1 izin. Unduh PDF lewat UI (event `download` di browser context, bukan asumsi), lalu PDF dipecah per halaman (`pdf-lib` `copyPages`) dan dirender ke gambar lewat `qlmanage -t` (headless Chromium di lingkungan CI ini tidak merender PDF native — dicoba `<embed>` dan `<iframe>`, keduanya gagal, jadi verifikasi visual pakai QuickLook macOS). Hasil dicek manual: timesheet — sel merah persis di akhir pekan Sept 2026 sungguhan (5-6, 12-13, 19-20, 26-27), sel kuning di tanggal izin, sel abu-abu persis di tanggal realisasi tiap task; tabel aktifitas — tanggal/project/kegiatan/catatan(bullet+checkbox ASCII)/status(Proses vs Selesai sesuai `tasks.status`)/nomor lampiran semua cocok data seed; lampiran — 2 gambar ke-embed dengan caption bernomor yang match rujukan di tabel aktifitas.

**Belum dikerjakan**: layout Word asli per tipe programmer (nunggu Q-06/template dari user), akses admin/atasan generate laporan orang lain, tampilan kendala di laporan, bold/italic di teks catatan PDF.

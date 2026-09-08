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

- **Backend**: `server/src/report-pdf.ts` (baru) — `buildMonthlyReportPdf` murni fungsi build PDF pakai `pdf-lib` (3 bagian: timesheet landscape, tabel aktifitas portrait, lampiran portrait), tanpa akses DB. `catatanToLines` konversi markdown checklist/bullet jadi bullet "•" biasa (status tercentang/belum tidak berarti apa-apa di dokumen cetak yang tidak interaktif — awalnya sempat dipertahankan sebagai `[x]`/`[ ]` ASCII, disederhanakan lagi jadi bullet polos; glyph Unicode ☐/☑ pernah dicoba duluan tapi gagal di-encode font WinAnsi standar, ditemukan lewat error runtime nyata, bukan diantisipasi dari awal). `server/src/routes/reports.ts` — `aggregateMonthlyReport` (fungsi bersama: query task_logs realisasi, nomor task tetap, kalender `isWorkday`/`leaves`, metadata attachment) dipakai dua handler: `handleMonthlyReportPdf` (`GET /api/reports/monthly?bulan=YYYY-MM`, baca bytes attachment dari disk + panggil `buildMonthlyReportPdf`) dan `handleMonthlyReportPreview` (`GET /api/reports/monthly-preview?bulan=YYYY-MM`, JSON buat pratinjau layar — lihat bagian "Halaman Laporan" di bawah).
- **Test otomatis**: `server/tests/reports.test.ts` (9 test) — PDF: 401, 400 format bulan salah, 200+`Content-Type: application/pdf`+signature `%PDF-`+struktur valid, bulan tanpa data tetap 200, isolasi antar user; preview: 401, 400, `items` cocok data seed, `tanggalKosong` benar (hari kerja tanpa realisasi masuk, izin dan tanggal setelah `hariIniOverride` tidak). Total 164 test lolos lintas file.
- **Diverifikasi lewat Playwright + inspeksi manual** (akun uji sementara, data dihapus setelah selesai): data seed 2 project, 2 task (satu open satu closed), realisasi lintas 4 tanggal dengan catatan bullet+checkbox, 2 attachment gambar asli, 1 izin. Unduh PDF lewat UI (event `download` di browser context, bukan asumsi), lalu PDF dipecah per halaman (`pdf-lib` `copyPages`) dan dirender ke gambar lewat `qlmanage -t` (headless Chromium di lingkungan CI ini tidak merender PDF native — dicoba `<embed>` dan `<iframe>`, keduanya gagal, jadi verifikasi visual pakai QuickLook macOS). Hasil dicek manual: timesheet — sel merah persis di akhir pekan Sept 2026 sungguhan (5-6, 12-13, 19-20, 26-27), sel kuning di tanggal izin, sel abu-abu persis di tanggal realisasi tiap task; tabel aktifitas — tanggal/project/kegiatan/catatan/status(Proses vs Selesai sesuai `tasks.status`)/nomor lampiran semua cocok data seed; lampiran — 2 gambar ke-embed dengan caption bernomor yang match rujukan di tabel aktifitas.

**Halaman Laporan tersendiri + pratinjau sebelum cetak** — selesai 2026-09-08 (lihat [ADR-0019](../adr/0019-word-per-tipe.md)):

- **Frontend**: `LaporanView.vue` (baru, route `/laporan`, nav item "Laporan" di `AppSidebar.vue`) — Popover pemilih bulan (dipindah persis dari widget lama di `RiwayatView.vue`, termasuk fix bug focus-race satu-Popover-dua-tampilan yang sudah ditemukan sebelumnya, bukan ditulis ulang), tombol "Tampilkan" (`useMonthlyReportPreviewQuery` di `composables/useReports.ts`, lazy — baru fetch begitu diklik, lalu auto-refetch kalau bulan diganti setelahnya) menampilkan tabel pratinjau (`components/ui/table`, kolom No/Tanggal/Aplikasi-Modul/Kegiatan/Catatan/Status/Lampiran, catatan pakai `MiniMarkdownText.vue` reuse langsung karena data dari server RAW markdown bukan versi teks-ASCII ala PDF) dan callout "N hari kerja belum ada realisasi" kalau `tanggalKosong` tidak kosong. Tombol "Unduh laporan (PDF)" tetap selalu aktif, tidak digembok di belakang "Tampilkan". `RiwayatView.vue` dikembalikan bersih (cuma `Select` project di toolbar) setelah widgetnya pindah ke sini.
- **Diverifikasi lewat Playwright**: data seed realisasi 2 tanggal + izin 1 tanggal + sengaja sisakan beberapa hari kerja kosong di bulan berjalan. Buka `/laporan` dari sidebar → default bulan berjalan benar. Klik "Tampilkan" → tabel cocok data seed (termasuk kolom Status "Proses"/Lampiran count lewat pengecekan per-kolom, bukan cuma jumlah baris — jumlah baris sempat kelihatan salah "7" karena selector Playwright ikut kehitung tabel kalender di sidebar kanan, dikoreksi lewat pengecekan isi kolom eksplisit). Callout tanggal kosong benar (mengecualikan tanggal izin dan tanggal setelah hari ini). Ganti bulan lewat popover → pilih bulan kosong → empty state benar, tombol Unduh ikut pindah ke bulan itu (dikonfirmasi lewat event `download`, nama file mengandung bulan yang benar). Riwayat dicek sudah bersih dari widget laporan. Screenshot desktop+dark, desktop+light, mobile+dark.

**Pratinjau jadi dua tab (Daftar + Timesheet)** — selesai 2026-09-08 (lihat [ADR-0019 bagian "Pratinjau jadi dua tab"](../adr/0019-word-per-tipe.md#pratinjau-jadi-dua-tab-daftar--timesheet)):

- **Backend**: `handleMonthlyReportPreview` menambah field `timesheet` (tasks/hari/taskDatesWorked, sumber data sama persis dengan `buildMonthlyReportPdf` lewat `aggregateMonthlyReport`) — test baru di `server/tests/reports.test.ts` (total jadi 10 test file ini, 165 test lintas backend) mengecek nomor+label task, jumlah hari sebulan penuh, `isIzin` di tanggal yang benar, dan `taskDatesWorked` cocok data seed.
- **Frontend**: `components/reports/TimesheetPreview.vue` (baru) — grid CSS task × hari dengan warna cell yang disamakan persis dengan `drawTimesheetPages` (merah=libur, kuning=izin, abu=ada realisasi, kosong=transparan), dibungkus `ScrollArea`+`ScrollBar orientation="horizontal"` (pola `w-full min-w-0` dari `ActivityHeatmap.vue` dipakai ulang biar tidak melebarkan parent). `LaporanView.vue` dibungkus jadi `Tabs` (shadcn-vue) dua tab "Daftar"/"Timesheet"; tabel Daftar yang sebelumnya `overflow-x-auto` polos ikut dibenahi jadi `ScrollArea` juga di turn yang sama.
- **Diverifikasi lewat Playwright** (akun uji sementara, 3 task lintas 2 tag, realisasi di beberapa tanggal termasuk yang bertabrakan dengan akhir pekan sungguhan bulan berjalan, data dihapus setelah selesai): buka tab Timesheet → warna cell cocok (abu di tanggal realisasi per task, merah persis di akhir pekan sungguhan bulan itu). Cek lewat `scrollWidth`/`clientWidth` DOM (bukan cuma visual) bahwa kedua `ScrollArea` (Daftar dan Timesheet) benar-benar bisa di-scroll horizontal dan `document.body` TIDAK ikut melebar (tidak ada scroll halaman ke samping) — lalu scroll manual ke kanan dan screenshot ulang, kolom "Lampiran"/hari-hari akhir bulan yang tadinya terpotong jadi kelihatan. Screenshot desktop+dark, desktop+light, mobile+dark — di mobile grid timesheet tetap ke-clip rapi oleh `ScrollArea`, tidak bocor ke luar layar.

**Belum dikerjakan**: layout Word asli per tipe programmer (nunggu Q-06/template dari user), akses admin/atasan generate laporan orang lain, tampilan kendala di laporan, bold/italic di teks catatan PDF.

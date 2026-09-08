# ADR-0019: Ekspor Word menurut tipe programmer

- Status: diterima; rincian terbuka dicatat di bawah.
- Tanggal: 2026-09-05.
- Stage utama: [07](../stages/07-ekspor-word.md).

## Konteks

Keputusan bisnis 19: pengguna menyatakan template menyusul dan berbeda per tipe programmer; mempertahankan usulan satu orang per bulan.

## Keputusan

Ekspor menghasilkan dokumen Word per tenaga ahli per bulan, menggunakan template sesuai tipe programmer. Rekap tanggal, narasi realisasi, izin, dan attachment mengikuti template asli.

## Konsekuensi

Template belum tersedia. Jangan menganggap semua tipe menggunakan satu layout atau placeholder identik. Klasifikasi programmer, pemetaan template, dan kebijakan perubahan tipe perlu diputuskan setelah contoh diterima; lihat Q-06. Tidak membangun editor template generik.

## Implementasi awal (PDF generik)

Selesai 2026-09-08. Sebelum template Word asli tersedia, dibangun cicilan awal berupa ekspor **PDF generik satu layout** (bukan per tipe programmer) — tujuannya validasi data laporan (task, tanggal, catatan, lampiran, status, kalender kerja), bukan hasil akhir. Keputusan:

- Cakupan akses: diri sendiri saja (generate laporan bulanan milik sendiri), sama seperti Riwayat. Akses admin/atasan generate laporan orang lain belum dibangun.
- Isi laporan mengikuti 3 contoh dokumen nyata yang dikirim user (bukan tebakan): timesheet Gantt (task × tanggal, warna merah=libur/kuning=izin/abu=ada realisasi), tabel "Aktifitas Pekerjaan/Kegiatan" (satu baris per log realisasi, kolom Status dari `tasks.status`), dan lampiran hasil kerja (gambar + caption bernomor).
- Rencana tidak ikut jadi baris tabel aktifitas — laporan ini murni "hasil pekerjaan" yang sudah dikerjakan. Kendala tidak ditampilkan — tidak ada di contoh dokumen.
- `pdf-lib` dipakai murni (bukan render HTML-ke-PDF) karena tabel/warna kustom dan embed gambar JPG/PNG langsung dari file attachment yang sudah ada — tanpa dependency headless-browser tambahan.
- Font standar `pdf-lib` (WinAnsi/CP1252) tidak bisa encode glyph checkbox Unicode (☐/☑), ditemukan lewat error runtime saat verifikasi. Awalnya diganti ASCII `[ ]`/`[x]`, lalu disederhanakan lagi (2026-09-08) jadi bullet "•" biasa buat checklist maupun bullet — status tercentang/belum tidak berarti apa-apa di dokumen cetak yang tidak interaktif, beda dari tampilan UI (`MiniMarkdownText.vue`) yang tetap pakai `<input type="checkbox">` sungguhan.
- Layout Word asli per tipe programmer (inti ADR ini) masih menunggu template dan Q-06 — PDF generik ini tidak menggantikannya.

## Halaman Laporan tersendiri + pratinjau sebelum cetak

Selesai 2026-09-08 (permintaan user sehari sebelumnya, langsung dikerjakan). Ekspor PDF generik pindah dari widget kecil di Riwayat jadi **halaman sendiri** (`/laporan`, nav item baru di sidebar), default menampilkan bulan berjalan. Widget lama di Riwayat (Popover bulan-terbaru + grid bulan/tahun) **dipindah seluruhnya** ke sini — Riwayat kembali fokus ke heatmap+daftar Realisasi saja.

- Sebelum tombol unduh PDF, ada tombol **"Tampilkan"** yang menampilkan pratinjau di layar — tabel mirip "Aktifitas Pekerjaan" (No, Tanggal, Aplikasi/Modul, Kegiatan, Catatan, Status, Lampiran), diambil dari `GET /api/reports/monthly-preview?bulan=` (endpoint baru, berbagi fungsi agregasi data (`aggregateMonthlyReport`) yang sama dengan endpoint PDF — cuma beda cara menyajikan hasilnya, bukan query terpisah). Catatan dikirim RAW (markdown asli) supaya bisa dirender pakai `MiniMarkdownText.vue` yang sudah ada di UI (reuse, bukan versi teks-polos ala PDF).
- **Callout "N hari kerja belum ada realisasi"** muncul kalau ada hari kerja (`isWorkday`) di bulan itu yang bukan izin dan belum ada realisasi — dibatasi sampai hari ini (`todayJakarta()`) supaya tanggal di masa depan yang belum waktunya tidak ikut ditandai kosong. Ini yang memenuhi tujuan awal: user bisa mengecek dulu ada tidaknya tanggal kosong sebelum mencetak, bukan baru ketahuan setelah PDF jadi.
- Tombol "Unduh laporan (PDF)" tetap selalu aktif (tidak digembok di belakang "Tampilkan") — pratinjau itu bantuan opsional, bukan gate wajib.
- Popover pemilih bulan di halaman baru ini pakai ulang persis pola yang sudah diperbaiki di widget Riwayat sebelumnya (satu `Popover` dua tampilan internal, bukan `DropdownMenu`+`Popover` terpisah — lihat catatan bug focus-race di `docs/stages/07-ekspor-word.md`) — dipindah, bukan ditulis ulang dari nol.

## Pratinjau jadi dua tab: Daftar + Timesheet

Selesai 2026-09-08 (permintaan user langsung setelah halaman Laporan di atas jadi). Pratinjau sebelum cetak dipecah jadi dua `Tabs` (shadcn-vue) — bukan cuma tabel "Aktifitas Pekerjaan" tapi juga rendering layar dari timesheet Gantt (task × tanggal) yang sebelumnya cuma ada di dalam PDF.

- Backend: `handleMonthlyReportPreview` menambah field `timesheet` di response — `tasks`/`hari` dipakai apa adanya dari `aggregateMonthlyReport`, `taskDatesWorked` dikonversi dari `Map<number, Set<string>>` (tidak bisa di-JSON) jadi `Record<string, string[]>` keyed by `taskId` sebagai string. Tidak ada query baru — data yang sama persis dengan yang dipakai `buildMonthlyReportPdf`.
- Frontend: `TimesheetPreview.vue` (baru, `components/reports/`) me-render grid CSS (bukan `<table>`, kolom hari bisa sampai 31) dengan warna cell yang SENGAJA disamakan persis dengan `drawTimesheetPages` di `report-pdf.ts` — merah=libur, kuning=izin, abu=ada realisasi, transparan=kosong — supaya pratinjau layar dan hasil PDF tidak pernah kelihatan beda.
- Kedua tab (Daftar dan Timesheet) dibungkus `ScrollArea` (shadcn-vue) horizontal, bukan `overflow-x-auto` polos — tabel Daftar pun ikut dibenahi jadi `ScrollArea` di turn ini (awalnya masih `overflow-x-auto` bawaan browser, kelihatan jelek/scrollbar-nya beda gaya dari komponen lain). Root `ScrollArea` butuh class `w-full min-w-0` supaya tidak melebarkan grid/flex parent-nya — bug yang sama seperti yang sudah ditemukan sebelumnya di `ActivityHeatmap.vue`, dipakai ulang polanya di sini.
- Kolom Catatan di tab Daftar sempat masih menampilkan checkbox interaktif asli (`MiniMarkdownText.vue` dipakai apa adanya, ketahuan dari screenshot user) — padahal pratinjau ini merepresentasikan PDF, yang checklist-nya sudah disederhanakan jadi bullet polos (lihat "Implementasi awal" di atas). Diperbaiki dengan konversi teks `- [ ]`/`- [x]` jadi `- ` biasa sebelum dikirim ke `MiniMarkdownText` (`catatanUntukPratinjau` di `LaporanView.vue`) — bukan mengubah `MiniMarkdownText.vue` sendiri, karena Input Harian/Riwayat tetap butuh checkbox interaktif di situ.

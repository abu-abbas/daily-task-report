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

## Rencana lanjutan (belum dikerjakan)

Catatan arahan user (2026-09-08) buat putaran berikutnya, sebelum benar-benar mencetak PDF:

- Ekspor PDF generik pindah dari widget kecil di Riwayat jadi **halaman sendiri**, default menampilkan bulan berjalan (bukan widget prev/next kecil yang sekarang nempel di Riwayat).
- Sebelum tombol unduh/cetak PDF, ada tombol "Tampilkan" yang menampilkan **pratinjau di layar** — daftar mirip tabel "Aktifitas Pekerjaan" (tanggal, project, kegiatan, dst) dari data bulan yang dipilih.
- Tujuan pratinjau ini: user bisa mengecek dulu apakah ada tanggal yang masih kosong/belum ada realisasi sebelum mencetak, bukan baru ketahuan setelah PDF jadi.

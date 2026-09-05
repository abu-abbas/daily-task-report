# Referensi visual pengguna

Sumber: gambar "Laporan Harian" yang dilampirkan pengguna pada percakapan 5 September 2026. Gambar telah dilihat; pengguna menyatakan gambar hanya referensi. File gambar belum tersedia sebagai aset lokal di dokumentasi ini; deskripsi berikut mempertahankan konteksnya tanpa membuat tautan file palsu.

## Unsur yang terlihat

- Judul Laporan Harian dan tanggal, dengan pilihan nama user pada pojok atas.
- Navigasi Input hari ini dan Riwayat.
- Section Realisasi kemarin berisi penjelasan dan jumlah dikerjakan/lepas.
- Kartu task: checkbox, badge project, tag opsional, teks deskripsi, dan ikon attachment.
- Section Kerjaan tambahan kemarin dengan tombol Tambah tugas baru yang lebar.
- Toggle Izin / tidak masuk hari ini sebelum section Rencana hari ini.
- Section Rencana hari ini bersifat opsional, dengan tombol tambah eksplisit.
- Tombol Kirim laporan hari ini di akhir; kartu membulat, pemisah section, warna netral, dan ruang antar-elemen yang lapang.

## Adaptasi sesuai keputusan final

- Mobile-first dengan form bertumpuk dan tombol mudah disentuh; tetap nyaman di laptop.
- shadcn-vue + Tailwind CSS, light mode dan dark mode.
- Checkbox, tombol tambah, kendala, dan attachment memiliki label/focus yang jelas. Jangan meniru kontras teks abu-abu yang terlalu rendah pada gambar.
- Dropdown nama pada referensi bukan otorisasi untuk mengganti identitas; gunakan session login. Pemilihan user oleh atasan harus mengikuti cakupan akses yang diputuskan.
- "Kemarin" dihitung dari tabel kalender kerja; tampilkan tanggal pekerjaan agar libur beruntun tidak membingungkan.
- Izin tanggal laporan hanya mengganti rencana tanggal itu; realisasi dan tambahan tanggal sebelumnya tetap tersedia.
- Deskripsi penutupan opsional berbeda dari catatan hasil realisasi yang wajib.
- Gambar tidak memperlihatkan semua state. Rancangan tetap harus mencakup cold start, item dicentang, catatan wajib, kendala, upload, edit, validasi, dan kedua tema.

Adaptasi tersedia sebagai [wireframe](../stages/00-review.md) dan [preview browser](../stages/00-preview.html). Preview belum merupakan aplikasi fungsional. Hasil pemeriksaan ada pada [Stage 0](../stages/00-keputusan-desain.md).

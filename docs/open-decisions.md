# Rincian keputusan yang masih terbuka

Status per 5 September 2026. Keputusan utama sudah ada dalam ADR; daftar ini hanya merinci hal yang belum dijawab. Tidak semuanya perlu ditanyakan sekaligus: selesaikan sebelum stage yang bergantung padanya.

| ID | Rincian yang perlu ditetapkan | Dibutuhkan sebelum |
| --- | --- | --- |
| Q-01 | Tabel kalender tahunan sudah wajib. Tentukan siapa yang mengelola, cara mengisi tahun baru, status tanggal yang belum tersedia, timezone bisnis, cuti pribadi sebagai pengecualian atau tidak, serta pengaruh perubahan kalender terhadap laporan lama. Tentukan perhitungan tepat ambang 5 hari kerja. Bedakan batas bulan untuk tanggal formulir dan tanggal pekerjaan: laporan awal bulan dapat memuat realisasi bulan sebelumnya. Penelusuran awal Januari mungkin memerlukan kalender Desember tahun sebelumnya. | Stage 2; aturan tanggal lengkap sebelum Stage 3/4, ambang sebelum Stage 6 |
| Q-02 | Bagaimana atasan terhubung dengan tim? Apa hak admin terhadap isi laporan? Bagaimana akses riwayat setelah user dikeluarkan dari project? Peran dan keanggotaan dasar sudah diterima. | Stage 1/2 |
| Q-03 | Jelaskan struktur minimum untuk kredensial/session, peran/cakupan tim, deskripsi penutupan, dan DDL kalender kerja sebelum mengubah skema. Kebutuhan tabel kalender sudah disetujui; bentuk fisiknya belum. Framework backend atau ORM tertentu belum dipilih. | Migration terkait pada Stage 1/2/4 |
| Q-04 | Siapa boleh menutup task bersama? Apakah reopen diperlukan? Bagaimana rencana yang sudah tersimpan saat task ditutup? Apakah resolve kendala dan deskripsi penutupan tetap bisa diubah setelah batas edit bulanan? Jangan membangun reopen sebelum diperlukan. | Stage 4/5 |
| Q-05 | Apakah satu user boleh punya beberapa log dengan task/tanggal/jenis sama, atau edit satu item? Tentukan efek uncheck/hapus item yang sudah tersimpan, dan nasib rencana lama ketika izin diaktifkan. Submit ulang wajib tidak menggandakan data; konflik izin/realisasi tidak boleh menyebabkan penghapusan diam-diam. | Desain simpan Stage 3; lengkap sebelum Stage 4 |
| Q-06 | Pengguna akan memberikan template Word per tipe programmer. Tentukan daftar tipe, pemetaan tipe user ke template, perubahan tipe antarbulan, placeholder aktual, lampiran, dan perlakuan hari tanpa laporan/libur. Jangan menebak isi template. | Stage 7 |

## Detail UI yang dapat diputuskan saat rancangan

Warna aksen final dan default tema belum dikunci; light/dark mode serta mobile-first sudah wajib. Usulan default mengikuti sistem dan penyimpanan preferensi harus dicatat sebagai pilihan implementasi, bukan jawaban pengguna. Referensi gambar bersifat inspirasi, bukan spesifikasi pixel-perfect.

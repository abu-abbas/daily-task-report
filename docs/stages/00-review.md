# Stage 0 — bahan review keputusan, skema, dan layar

Status: keputusan inti kalender/atasan/awal bulan telah diterima; **skema dan wireframe masih bahan review**, bukan migration atau implementasi aplikasi. Rincian tambahan yang diberi label usulan belum menjadi keputusan pengguna.

## Keputusan inti yang sudah diterima

| Topik | Keputusan | Dampak |
| --- | --- | --- |
| Kalender | Satu kalender bersama dikelola admin. Buat tanggal setahun dengan pola awal Senin–Jumat kerja; admin dapat mengubah hari kerja/libur beserta keterangannya. | Tidak memerlukan relasi kalender per project. Generate tahun tidak boleh menimpa koreksi yang sudah ada. |
| Kalender kosong | Tahan submit jika rentang tanggal yang diperlukan belum tersedia; tampilkan tanggal yang perlu dilengkapi. | Jangan melompati tanggal kosong karena dapat menghasilkan hari kerja sebelumnya yang salah. Data laporan yang sudah tersimpan tetap dapat dibaca. |
| Cakupan atasan | Atasan membawahi banyak supervisi; setiap supervisi membawahi banyak tenaga ahli. | Cakupan atasan melewati supervisi; usulan relasi langsung pada tenaga ahli sudah digantikan. |
| Awal bulan | Pada hari kerja pertama bulan baru, izinkan pengisian/koreksi realisasi hari kerja terakhir bulan lalu; hari lama lain tetap terkunci. | Pengecualian harus diperiksa dengan tanggal sekarang, bukan sekadar memilih ulang formulir awal bulan. |

Sumber keputusan: [ADR-0028](../adr/0028-pengelolaan-kalender.md), [ADR-0031](../adr/0031-hierarki-supervisi.md) yang menggantikan ADR-0029, dan [ADR-0030](../adr/0030-pengecualian-awal-bulan.md). Aturan generate ulang tanpa menimpa koreksi adalah usulan pengamanan implementasi.

Rincian lanjutan Q-01/Q-02 yang telah diterima:

- [ADR-0032](../adr/0032-tanggal-bisnis.md): timezone Asia/Jakarta; cuti pribadi tetap dalam leaves; perubahan kalender tidak mengubah tanggal log tersimpan.
- [ADR-0033](../adr/0033-rangkap-peran.md): satu akun boleh merangkap peran, termasuk mencatat pekerjaan sendiri sebagai tenaga ahli.
- [ADR-0034](../adr/0034-akses-histori.md): tenaga ahli tetap membaca histori sendiri setelah keluar project; atasan/supervisi membaca histori berdasarkan hubungan aktif; admin tidak otomatis mengedit laporan orang lain.

Rincian implementasi yang masih diusulkan: jumlah hari kerja untuk indikator dihitung setelah tanggal realisasi terakhir/pembuatan task sampai tanggal evaluasi; aktif pada jumlah 5. Kalender harus lengkap. Hak koreksi riwayat setelah keluar project tetap perlu diputuskan sebelum Stage 4.

Semua rincian yang belum diputuskan tetap tercatat pada [keputusan terbuka](../open-decisions.md).

## Usulan perubahan skema minimum

Tabel asli tetap dipakai. Berikut tambahan yang menjawab kebutuhan baru; nama kolom dan bentuk final masih usulan, belum migration.

| Area | Usulan perubahan | Alasan dan batasan |
| --- | --- | --- |
| users | password_hash; email wajib bagi akun yang dapat login | Login email/password telah dipilih. Jangan menyimpan password mentah. |
| Peran | user_roles: user_id, role, primary key gabungan; role dibatasi tenaga_ahli/supervisi/atasan/admin | Mengikuti rangkap peran ADR-0033; tidak perlu tabel katalog permission. |
| Hierarki supervisi | Dua hubungan user: atasan → supervisi dan supervisi → tenaga ahli | Usulkan atasan_id pada akun supervisi serta supervisi_id pada tenaga ahli; validasi peran tujuan, larang diri sendiri/siklus. Jangan memakai atasan_id langsung sebagai relasi tenaga ahli ke atasan. |
| Session | sessions: token_hash unik, user_id, expires_at | Session dapat dicabut saat logout; cookie membawa token acak, bukan identitas yang dipercaya dari klien. Durasi dan atribut cookie ditentukan saat implementasi login. |
| Kalender | work_calendar: tanggal sebagai primary key, is_workday wajib, keterangan opsional | Satu sumber status harian. Usulan form nama/mulai/akhir dari referensi libur memperbarui rentang tanggal secara atomik; tidak membutuhkan tabel libur duplikat. |
| Penutupan task | tasks.deskripsi_penutupan nullable | Deskripsi opsional berbeda dari catatan hasil realisasi. Hak penutupan tetap menunggu Q-04. |
| Integritas SQLite | Foreign key aktif; NOT NULL/CHECK sesuai field wajib dan enum yang telah disepakati | Penyesuaian dari DDL awal dijelaskan sebelum migration. Jangan menambah unique constraint log yang melarang beberapa orang mengerjakan task sama. |

Keputusan ORM/framework backend dan pemetaan template Word tidak diselesaikan dengan tabel ini. Skema fisik mengikuti keputusan akses yang diterima serta rincian Q-02 yang masih terbuka.

Usulan provisioning minimum: akun yang belum dipetakan tidak memperoleh cakupan laporan orang lain. Hak membaca/mencatat laporan sendiri tetap bergantung pada peran tenaga ahli dan keanggotaan project; tidak menggunakan fallback ke seluruh tim.

Pengguna memberikan [referensi tabel rentang libur](../references/holiday-settings.md). Usulan form admin mengikuti nama libur, tanggal mulai, dan tanggal akhir inklusif. Penyimpanan per tanggal di atas tetap usulan; contoh tabel rentang belum berarti pengguna menyetujui salah satu bentuk fisik. Referensi tersebut juga menjelaskan syarat kelengkapan tahun bila tabel rentang menjadi sumber utama.

## Preview yang dapat dibuka

Buka [00-preview.html](00-preview.html) langsung di browser. Pilih light/dark dan layar Input Harian, Riwayat, atau Rekap atasan. Checkbox membuka catatan hasil; toggle izin menyembunyikan rencana tetapi mempertahankan realisasi sebelumnya. Bagian bawah menampilkan contoh keadaan kosong/loading/error.

Preview memakai HTML/CSS native tanpa dependency tambahan untuk review Stage 0. Aplikasi tetap akan memakai Vue + shadcn-vue. Data bersifat contoh, pilihan filter/tanggal tidak mengambil data, dan tombol simpan dinonaktifkan; ini belum implementasi bisnis atau otorisasi.

## Rancangan layar Input Harian

Wireframe mobile berikut menggunakan contoh tanggal, bukan hasil query atau kalender yang sudah dibuat. Tanggal realisasi ditampilkan eksplisit agar arti kemarin jelas setelah libur.

```text
Laporan Harian           [Tema] [Akun]
[Input] [Riwayat]

Tanggal laporan [tanggal yang dipilih]
Realisasi: [hari kerja sebelumnya]

Realisasi kemarin
1 dikerjakan · 1 belum dicentang
┌──────────────────────────────────┐
│ [✓] E-OFFICE  #180                │
│ Perbaikan detail perbal           │
│ Hasil pekerjaan *                │
│ [textarea catatan hasil         ] │
│ [+ Tambah kendala] [+ Lampiran]   │
│ [ ] Tandai task selesai          │
│ Deskripsi penutupan (opsional)   │
└──────────────────────────────────┘
┌──────────────────────────────────┐
│ [ ] E-OFFICE                     │
│ Perbaikan template naskah dinas  │
└──────────────────────────────────┘

Kerjaan tambahan kemarin
[+ Pilih task / tambah kerjaan]

[ ] Izin / tidak masuk tanggal ini

Rencana hari ini · opsional
[+ Pilih task / tambah rencana]

[       Simpan laporan           ]
```

- Checkbox membuka catatan hasil yang wajib untuk realisasi. Item tidak dicentang tidak meminta alasan; angka belum dicentang tidak menyatakan task itu tidak dikerjakan orang lain.
- Form tambah menampilkan pilihan project anggota, pilihan task open atau Buat task baru, deskripsi/tag untuk task baru, dan catatan sesuai jenis log.
- Tambah kendala membuka textarea per kendala dengan tombol hapus yang jelas. Attachment menampilkan nama/preview file, status upload, dan tombol hapus berlabel.
- Pilihan Tandai task selesai membuka deskripsi penutupan opsional; tampilan aksi mengikuti kewenangan yang masih dirinci di Q-04.
- Saat izin aktif, rencana tanggal laporan diganti jenis cuti/sakit/izin dan alasan opsional. Realisasi dan tambahan tanggal sebelumnya tetap terlihat. Data rencana yang sudah ada tidak dihapus diam-diam.
- Tombol Simpan berada setelah form, lebar penuh pada mobile. Sesudah sukses, tampilkan konfirmasi beserta tanggal pekerjaan yang disimpan.

## Rancangan Riwayat

```text
Riwayat laporan          [Tema] [Akun]
[Input] [Riwayat]
[Bulan] [Project]
[Ekspor Word] — saat Stage 7 tersedia

┌──────────────────────────────────┐
│ [Tanggal pekerjaan]             │
│ 2 realisasi · 1 rencana          │
│ [Lihat detail]                   │
│   Project · task · jenis log     │
│   Catatan hasil                  │
│   Kendala: open / resolved       │
│   [Lihat lampiran]               │
│   [Edit bila masih diizinkan]    │
└──────────────────────────────────┘
┌──────────────────────────────────┐
│ [Tanggal pekerjaan] · Izin      │
│ Jenis dan alasan bila ada       │
└──────────────────────────────────┘
```

Kelompok tanggal mengikuti pekerjaan, bukan created_at. Badge rencana dan realisasi harus jelas. Tanggal tanpa laporan tidak otomatis disebut izin. Aksi edit tidak tersedia untuk tanggal terkunci; jelaskan penyebabnya. Ekspor tidak diaktifkan sebelum implementasi/template tersedia.

## Rancangan Dashboard atasan dan cakupan supervisi

```text
Rekap tim                [Tema] [Akun]
[Rentang tanggal]
[Project] [Supervisi] [Tenaga ahli sesuai akses]

Aktivitas tim
┌──────────────────────────────────┐
│ Nama · project · tanggal         │
│ Task dan hasil realisasi         │
│ [Lihat detail]                   │
└──────────────────────────────────┘

Task tanpa realisasi ≥ 5 hari kerja
┌──────────────────────────────────┐
│ Project · task                   │
│ Realisasi terakhir / dibuat      │
│ 5 hari kerja tanpa realisasi     │
│ [Lihat riwayat task]             │
└──────────────────────────────────┘
```

Task nyangkut ditampilkan sebagai kondisi task, bukan pemilik tetap atau kesalahan orang tertentu. Jika kalender untuk perhitungan belum lengkap, tampilkan status perhitungan belum tersedia, bukan angka nol. Pilihan supervisi/user dan detail laporan mengikuti dua tingkat hierarki ADR-0031; jangan membocorkan log orang lain pada task kolaboratif. Supervisi memiliki akses login; rekapnya hanya mencakup tenaga ahli di bawah supervisi tersebut, tanpa pilihan berpindah ke supervisi lain.

## Adaptasi laptop dan tema

Pada laptop, konten tetap memiliki batas lebar agar catatan mudah dibaca. Filter boleh sejajar, input harian tetap berurutan satu kolom. Dashboard dapat menampilkan aktivitas dan task nyangkut berdampingan. Pada mobile semuanya bertumpuk, teks panjang membungkus, dan tidak ada aksi yang hanya muncul saat hover.

Implementasi memakai shadcn-vue dan token Tailwind yang konsisten. Berikut arah warna usulan, belum stylesheet final:

| Unsur | Light | Dark |
| --- | --- | --- |
| Background | slate-50 | slate-950 |
| Kartu | white | slate-900 |
| Teks utama | slate-900 | slate-100 |
| Teks pendukung | slate-600 | slate-300 |
| Aksi utama | blue-700 dengan teks putih | blue-300 dengan teks slate-950 |
| Error | red-700 dan pesan tertulis | red-300 dan pesan tertulis |

Sediakan pilihan tema yang berlabel jelas, focus keyboard terlihat, label untuk semua input, serta target sentuh sekitar 44 px. Warna saja tidak menyampaikan error atau status. Kontras dan responsivitas harus diperiksa pada render nyata saat UI tersedia; belum diklaim lolos dari wireframe teks.

## Keadaan yang harus ditangani

| Keadaan | Perilaku UI yang direncanakan |
| --- | --- |
| Tidak ada rencana sebelumnya | Section realisasi tetap tampil dengan CTA Tambah kerjaan kemarin (manual). |
| Kalender belum lengkap | Tampilkan tanggal/rentang yang perlu dilengkapi; jangan menebak tanggal realisasi. Blok submit sesuai ADR-0028. |
| Memuat data | Tampilkan status memuat; jangan sementara menampilkan keadaan kosong yang keliru. |
| Gagal memuat | Pesan yang dapat dipahami dan tombol Coba lagi; perubahan lokal tidak dibuang. |
| Catatan realisasi kosong | Pesan di bawah textarea, fokus ke field pertama yang gagal saat submit. |
| Menyimpan | Tombol menunjukkan Menyimpan; cegah klik ganda selama request berjalan. Backend tetap wajib mencegah duplikasi. |
| Gagal menyimpan | Pertahankan input; tampilkan sebab yang dapat diperbaiki dan pilihan mencoba kembali. |
| Upload tidak sah/gagal | Jelaskan batas JPG/PNG, 5 file/log, 5 MB/file; file gagal tidak dianggap berhasil disimpan. |
| Izin bertabrakan dengan realisasi | Jelaskan tanggal konflik; minta koreksi, tanpa menghapus laporan lama secara diam-diam. |
| Riwayat/rekap kosong | Tampilkan keadaan kosong sesuai filter, bukan error. |
| Session berakhir | Minta login kembali; jangan menampilkan konfirmasi simpan palsu. |

## Batas hasil review ini

Wireframe, preview browser, dan usulan skema tersedia. Belum ada migration, backend, atau aplikasi fungsional. Hasil pemeriksaan preview dicatat pada [Stage 0](00-keputusan-desain.md); kriteria aplikasi tetap diuji saat implementasi, bukan dianggap lolos karena preview. Lihat [checklist utama](../TODO.md).

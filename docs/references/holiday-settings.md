# Referensi pengaturan libur dari aplikasi yang sudah ada

Sumber: screenshot tabel yang diberikan pengguna pada percakapan 5 September 2026. Ini referensi struktur dan cara input, bukan persetujuan mengganti skema kalender atau daftar libur resmi untuk seed. File gambar belum tersedia sebagai aset lokal.

## Struktur yang terlihat

| Kolom | Fungsi yang terlihat |
| --- | --- |
| ID | Identitas baris libur |
| HOLIDAY | Nama hari libur/cuti bersama |
| START_HOLIDAY | Tanggal mulai, ditampilkan dengan waktu 00:00:00 |
| END_HOLIDAY | Tanggal akhir, ditampilkan dengan waktu 00:00:00 |

Contoh pada gambar: Cuti Bersama Idul Fitri 1447 Hijriah memiliki tanggal mulai 2026-03-23 dan akhir 2026-03-24. Satu baris mewakili rentang dua tanggal. Libur satu hari menggunakan tanggal mulai dan akhir yang sama. Nilai di sini hanya ditranskripsikan dari gambar, belum diverifikasi sebagai kalender resmi.

## Usulan penerapan pada aplikasi baru

Admin dapat memasukkan nama/keterangan, tanggal mulai, dan tanggal akhir. Usulan rentang bersifat inklusif: libur 23–24 berarti kedua tanggal libur, sedangkan libur satu hari cukup memakai mulai = akhir. Validasi tanggal mulai tidak boleh sesudah tanggal akhir.

Untuk mempertahankan usulan penyimpanan minimum Stage 0, satu input rentang dapat memperbarui baris-baris tanggal pada work_calendar secara atomik. Ini memakai satu sumber status harian dan tetap mendukung Sabtu khusus kerja melalui is_workday. Tidak perlu menyimpan tabel rentang dan kalender harian sebagai dua sumber yang harus selalu disinkronkan.

Pilihan ini masih usulan desain. Jika pengguna ingin tabel rentang seperti screenshot menjadi sumber penyimpanan utama, skema perlu dirinci ulang: pola mingguan menjadi dasar, rentang menjadi pengecualian, serta status kelengkapan setiap tahun dan hari kerja khusus harus tetap dapat direpresentasikan.

## Kelengkapan kalender

- Tidak adanya libur pada suatu tanggal berbeda dari belum tersedianya kalender tahun tersebut.
- Pada usulan satu baris per tanggal, periksa kelengkapan tanggal dalam rentang yang diperlukan; jangan menganggap tanggal yang hilang sebagai libur atau hari kerja.
- Pada model yang hanya menyimpan rentang libur, daftar kosong tidak membuktikan satu tahun sudah lengkap. Diperlukan penanda atau proses konfirmasi kelengkapan tahunan jika model itu dipilih.
- Saat menelusuri hari kerja sebelumnya, lewati akhir pekan dan seluruh tanggal berstatus libur, termasuk rentang libur beruntun dan lintas tahun. Tanggal khusus yang ditetapkan sebagai hari kerja tetap dihormati.
- Kalender yang diperlukan tetapi belum tersedia menahan submit sesuai [ADR-0028](../adr/0028-pengelolaan-kalender.md).

## Usulan form admin

```text
Kalender kerja [Tahun]
[+ Tambah libur]

Nama/keterangan  [Cuti bersama              ]
Tanggal mulai    [2026-03-23                 ]
Tanggal akhir    [2026-03-24                 ]

2 tanggal akan ditandai libur.
[Batal] [Simpan libur]
```

Pengubahan rentang tidak boleh diam-diam menimpa hari kerja khusus atau koreksi lain. Tampilkan tanggal terdampak sebelum menyimpan. Rincian kebijakan perubahan kalender historis tetap terbuka di Q-01.

Lihat [bahan review Stage 0](../stages/00-review.md) dan [keputusan terbuka](../open-decisions.md).

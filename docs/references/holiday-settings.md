# Referensi pengaturan libur dari aplikasi yang sudah ada

Sumber: screenshot tabel yang diberikan pengguna pada percakapan 5 September 2026. Bentuk tabel (nama, tanggal mulai, tanggal akhir) menjadi dasar tabel `holidays` di skema fisik ([ADR-0026](../adr/0026-kalender-kerja-tahunan.md), [ADR-0036](../adr/0036-skema-fisik-stage1.md)). Isi tanggal pada gambar hanya transkripsi contoh, bukan daftar libur resmi untuk seed.

## Struktur yang terlihat

| Kolom | Fungsi yang terlihat |
| --- | --- |
| ID | Identitas baris libur |
| HOLIDAY | Nama hari libur/cuti bersama |
| START_HOLIDAY | Tanggal mulai, ditampilkan dengan waktu 00:00:00 |
| END_HOLIDAY | Tanggal akhir, ditampilkan dengan waktu 00:00:00 |

Contoh pada gambar: Cuti Bersama Idul Fitri 1447 Hijriah memiliki tanggal mulai 2026-03-23 dan akhir 2026-03-24. Satu baris mewakili rentang dua tanggal. Libur satu hari menggunakan tanggal mulai dan akhir yang sama.

## Keputusan: tabel rentang sebagai sumber utama

Pengguna memilih pendekatan ini sebagai sumber utama, bukan sekadar input UI di atas tabel per tanggal. Alasannya: Sabtu-Minggu selalu libur tanpa pengecualian, jadi tidak perlu disimpan satu baris per tanggal untuk seluruh tahun — cukup simpan pengecualiannya.

- **Aturan default** (dihitung, tidak disimpan): Senin-Jumat = hari kerja, Sabtu-Minggu = libur.
- **Tabel `holidays`**: `id`, `nama`, `tanggal_mulai`, `tanggal_akhir` (rentang inklusif). Setiap tanggal di dalam rentang berstatus libur, termasuk bila jatuh pada hari kerja normal.
- `isWorkday(tanggal)` = hari itu Senin-Jumat DAN tidak berada dalam rentang mana pun di `holidays`.
- Tidak ada mekanisme menjadikan Sabtu/Minggu sebagai hari kerja khusus — di luar cakupan karena tidak dibutuhkan.

Validasi input: tanggal mulai tidak boleh sesudah tanggal akhir (`tanggal_akhir >= tanggal_mulai`, ditegakkan sebagai `CHECK` di DDL).

## Konsekuensi terhadap kelengkapan kalender

Karena status hari kerja selalu dihitung dari aturan + daftar libur, tidak ada lagi keadaan "kalender tahun ini belum diisi" — pertanyaan "apakah tanggal X hari kerja?" selalu punya jawaban. Ini menghapus mekanisme blok submit yang sebelumnya ada di [ADR-0028](../adr/0028-pengelolaan-kalender.md) versi awal.

Saat menelusuri hari kerja sebelumnya (ADR-0006), lewati akhir pekan dan seluruh tanggal yang termasuk rentang `holidays`, termasuk rentang beruntun dan lintas tahun.

## Usulan form admin

```text
Daftar libur
[+ Tambah libur]

Nama/keterangan  [Cuti bersama              ]
Tanggal mulai    [2026-03-23                 ]
Tanggal akhir    [2026-03-24                 ]

2 tanggal akan ditandai libur.
[Batal] [Simpan libur]
```

Perubahan/penghapusan baris `holidays` tidak boleh diam-diam menimpa koreksi lain yang sudah tersimpan pada log realisasi. Tampilkan tanggal terdampak sebelum menyimpan. Rincian kebijakan perubahan kalender terhadap histori tetap terbuka di Q-01.

Lihat [ADR-0026](../adr/0026-kalender-kerja-tahunan.md), [ADR-0028](../adr/0028-pengelolaan-kalender.md), dan [keputusan terbuka](../open-decisions.md).

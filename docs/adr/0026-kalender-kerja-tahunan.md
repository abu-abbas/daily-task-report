# ADR-0026: Aturan kalender kerja — default mingguan plus tabel libur

- Status: diterima; menggantikan pendekatan tabel kalender per tanggal pada versi awal ADR ini.
- Tanggal: 2026-09-05 (revisi: 2026-09-05).
- Stage utama: [02](../stages/02-user-project.md).

## Konteks

Instruksi tambahan pengguna: wajib ada mekanisme kalender kerja untuk mengatur libur selama setahun dan menentukan pekerjaan kemarin. Rancangan awal memakai satu tabel berisi satu baris per tanggal (`work_calendar`) yang harus digenerate/diisi penuh untuk tiap tahun. Pengguna menilai ini merepotkan: Sabtu-Minggu selalu libur tanpa pengecualian, sehingga tidak perlu disimpan; admin cukup mengelola daftar hari libur tambahan, mengikuti tabel libur berbentuk rentang yang sudah dipakai di kantor pengguna (kolom nama, tanggal mulai, tanggal akhir — lihat [referensi](../references/holiday-settings.md)).

## Keputusan

Status hari kerja dihitung, bukan disimpan per tanggal:

- **Aturan default**: Senin-Jumat = hari kerja, Sabtu-Minggu = libur. Tidak ada pengecualian yang menjadikan Sabtu/Minggu hari kerja.
- **Tabel `holidays`**: daftar libur/cuti bersama sebagai rentang tanggal (nama, tanggal mulai, tanggal akhir, inklusif). Tanggal apa pun yang jatuh di dalam salah satu rentang berstatus libur, meskipun jatuh pada hari kerja normal.
- `isWorkday(tanggal)` = hari itu Senin-Jumat DAN tidak termasuk rentang mana pun di `holidays`.

Hari kerja sebelumnya (ADR-0006) dan ambang 5 hari kerja task nyangkut memakai aturan yang sama, termasuk saat penelusuran melintasi tahun.

## Konsekuensi

- Tidak ada lagi tabel bervolume satu baris per tanggal, tidak ada proses "generate tahun", dan tidak ada keadaan "kalender belum lengkap" — aturan di atas selalu punya jawaban untuk tanggal berapa pun karena Senin-Jumat/Sabtu-Minggu dihitung langsung dari tanggal. Ini menggantikan mekanisme blok submit pada [ADR-0028](0028-pengelolaan-kalender.md).
- Admin hanya menambah/mengubah/menghapus baris `holidays`; tidak ada langkah wajib "isi kalender tahun depan".
- Karena Sabtu-Minggu tidak pernah bisa dijadikan hari kerja, kebutuhan "hari kerja khusus di akhir pekan" dari draf awal dihapus dari cakupan; jika suatu saat dibutuhkan, ini jadi keputusan baru terpisah, bukan bagian dari ADR ini.
- DDL final: tabel `holidays` (`id`, `nama`, `tanggal_mulai`, `tanggal_akhir`) di [`schema/0001_initial.sql`](../schema/0001_initial.sql); lihat [ADR-0036](0036-skema-fisik-stage1.md).
- Tidak mengasumsikan integrasi API libur eksternal; admin input manual.

# ADR-0044: Pilih tanggal laporan, edit data tersimpan, dan form izin

- Status: diterima.
- Tanggal: 2026-09-07.
- Stage utama: [04](../stages/04-koreksi-izin-penutupan.md).
- Melengkapi: [ADR-0007](0007-tanggal-realisasi.md), [ADR-0008](0008-laporan-terlewat.md), [ADR-0009](0009-edit-submit.md), [ADR-0013](0013-izin-form.md), [ADR-0014](0014-izin-realisasi.md), [ADR-0030](0030-pengecualian-awal-bulan.md).

## Konteks

Stage 3 cuma bisa mengisi "hari ini" — tidak ada cara membuka laporan tanggal lain dalam bulan berjalan untuk diisi/dikoreksi (ADR-0008/0009), dan tidak ada jalur mencatat cuti/sakit/izin (ADR-0013/0014). Ini bagian pertama Stage 4; penutupan task (ADR-0012) sengaja tidak termasuk — independen (aksi per-task, bukan bagian form harian) dan masih ada keputusan bisnis (Q-04: siapa boleh menutup, reopen) yang belum diputuskan.

Tiga rincian terbuka Q-05 dijawab di sini:

1. **Uncheck item realisasi checklist yang sudah tersimpan** (dari hari kerja sebelumnya, lalu disimpan ulang) → baris lamanya **dihapus**, bukan dibiarkan nyangkut. Cakupannya cuma checklist (`is_extra = 0`); kerjaan tambahan dan rencana lain di luar cakupan ini — dihapus lewat aksi eksplisit kalau/ketika dibutuhkan nanti.
2. **Rencana yang sudah tersimpan di tanggal yang di-set izin** → **otomatis dihapus** dalam transaksi yang sama saat izin disimpan (izin dan rencana tidak boleh coexist di tanggal sama).
3. **Pengecualian lintas-bulan** (ADR-0030) sudah cukup jelas dari teksnya sendiri, tidak perlu tanya user: cuma berlaku persis saat tanggal laporan yang dipilih = hari ini sungguhan (bukan backdate ke tanggal awal bulan itu kapan pun sesudahnya).

## Keputusan

**Tanggal laporan** kini bisa dipilih lewat `<input type="date">` di `/input` (query string `?tanggal=`, bukan route baru), dibatasi `min`/`max` ke bulan berjalan (dari `data.hariIni`, bukan jam browser). Backend memisahkan dua peran tanggal yang sebelumnya digabung jadi satu parameter test-only: `hariIni` (hari ini sungguhan, dari `todayJakarta()` atau override test) dan `tanggal` (yang dipilih klien, lewat query string di GET / field body di POST). Endpoint di-generalisasi: `GET /task-logs/today` → `GET /task-logs/daily?tanggal=`, `POST /task-logs` bertambah field `tanggal`.

**Efek uncheck**: `POST /task-logs` menghitung ulang set task checklist (jenis `rencana`) di hari kerja sebelumnya, lalu menghapus baris realisasi checklist (`is_extra=0`) untuk task yang tidak lagi ada di item yang dikirim — dalam transaksi yang sama dengan upsert item lain.

**Form izin** (`POST /leaves`, `DELETE /leaves/:tanggal`) — tabel `leaves` (sudah ada sejak migration awal, belum pernah dipakai) sekarang punya endpoint: upsert per `(user_id, tanggal)` seperti `task_logs` (ADR-0041), `potong_cuti_tahunan` tetap null (tidak menghitung kuota cuti). Toggle checkbox "Izin / tidak masuk tanggal laporan" di card "Rencana" menyembunyikan form rencana, menggantinya dengan `Select` jenis (Cuti/Sakit/Izin) + `Textarea` alasan opsional — persis wireframe Stage 0. Card "Realisasi" (checklist + kerjaan tambahan hari kerja sebelumnya) **tetap tampil** apa adanya, tidak terpengaruh toggle ini (ADR-0013).

**Validasi konflik dua arah** (ADR-0014): `POST /task-logs` menolak (409) realisasi kalau hari kerja sebelumnya sudah tercatat izin; `POST /leaves` menolak (409) izin kalau tanggal itu sudah punya realisasi tersimpan.

Beranda (ADR-0043) menampilkan banner "Cuti/Sakit/Izin hari ini" menggantikan card rencana kalau `data.izin` tidak null untuk hari ini.

## Konsekuensi

Tidak ada migration baru — skema (`tasks.status`/`deskripsi_penutupan`, `leaves`) sudah disiapkan sejak Stage 1. `TodayInput` (tipe frontend) berganti nama jadi `DailyInput`, bertambah field `hariIni` dan `izin`. Penutupan task (ADR-0012) dan Q-04 masih terbuka, jadi putaran kerja terpisah — lihat [Stage 4](../stages/04-koreksi-izin-penutupan.md).

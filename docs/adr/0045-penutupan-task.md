# ADR-0045: Penutupan task eksplisit dengan deskripsi opsional

- Status: diterima.
- Tanggal: 2026-09-08.
- Stage utama: [04](../stages/04-koreksi-izin-penutupan.md).
- Melengkapi: [ADR-0010](0010-task-tanpa-pemilik.md), [ADR-0011](0011-kolaborasi-task.md), [ADR-0012](0012-penutupan-task.md).

## Konteks

ADR-0012 sudah memutuskan task cuma menjadi closed lewat aksi eksplisit "Tandai task selesai" dengan deskripsi penutupan opsional, tapi menyisakan tiga rincian di Q-04: siapa boleh menutup, nasib rencana yang belum direalisasi, dan apakah reopen dibutuhkan. Ini jawabannya.

## Keputusan

1. **Siapa boleh menutup**: siapa pun anggota aktif project task itu — sama seperti akses baca-tulis task lainnya (task tanpa pemilik tetap, ADR-0010; dikerjakan bareng, ADR-0011). Tidak ada role khusus.
2. **Rencana yang belum direalisasi**: dihapus otomatis dalam transaksi yang sama saat task ditutup — pola sama dengan izin menghapus rencana lama (ADR-0044). Rencana yang **sudah** punya realisasi tetap dipertahankan sebagai histori.
3. **Reopen**: tidak dibangun sekarang (YAGNI, sesuai teks ADR-0012 sendiri). Task closed tetap closed; kalau nanti terbukti dibutuhkan, jadi ADR/pekerjaan terpisah.
4. **Resolve kendala setelah batas edit bulanan**: di luar cakupan sekarang — kendala (ADR-0015) belum dibangun (Stage 5), jadi belum ada yang perlu diputuskan soal interaksinya dengan penutupan task.

Deskripsi penutupan pakai textarea polos (bukan `MiniMarkdownEditor`) — teks penutupan singkat, bukan catatan kerja harian.

## Konsekuensi

Endpoint baru `POST /api/tasks/:id/tutup` (body `{deskripsiPenutupan?}`) menulis ke kolom `tasks.status`/`tasks.deskripsi_penutupan` yang sudah ada sejak migration awal — tidak ada migration baru. Task closed otomatis tidak lagi muncul di `GET /api/tasks` (filter `status='open'` sudah ada sejak Stage 3). UI: tombol "Tandai selesai" di setiap task pada kartu "Kerjaan tambahan" dan "Rencana" (`InputHarianView.vue`), dialog konfirmasi tunggal dipakai ulang untuk task mana pun yang diklik.

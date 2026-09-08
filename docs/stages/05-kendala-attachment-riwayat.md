# Stage 05 — Kendala, attachment, dan riwayat

- Status: Sedang dikerjakan — kendala per log realisasi selesai (2026-09-08); attachment, riwayat, dan tautan commit GitLab menyusul.
- Prasyarat: Stage 4.
- Keputusan: [ADR-0004](../adr/0004-hak-akses.md), [ADR-0009](../adr/0009-edit-submit.md), [ADR-0015](../adr/0015-kendala.md), [ADR-0016](../adr/0016-attachment.md), [ADR-0023](../adr/0023-mobile-first.md), [ADR-0024](../adr/0024-tema.md), [ADR-0025](../adr/0025-metode-ponytail.md), [ADR-0039](../adr/0039-integrasi-commit-gitlab.md).

## Cakupan

- Tambahkan kendala opsional per task_log dan aksi resolved oleh pembuat log.
- Upload JPG/PNG maksimal 5 file per log dan 5 MB per file; gunakan attachments polymorphic dengan target task_log saja.
- Validasi server dan pembatasan akses file mengikuti kewenangan laporan.
- Bangun riwayat per tanggal pekerjaan dengan detail realisasi/rencana, kendala, attachment, dan izin.
- Tangani kegagalan upload serta edit/penghapusan referensi file secara konsisten.
- Sediakan penautan commit GitLab (manual, milik user sendiri) ke task_log sebagai bukti pendukung, sesuai [ADR-0039](../adr/0039-integrasi-commit-gitlab.md).

## Kriteria selesai dan pemeriksaan

- [ ] Riwayat sesuai log yang tersimpan; tanggal izin tetap terlihat walaupun tidak ada log.
- [ ] Upload dengan jenis, jumlah, atau ukuran tidak sah ditolak; user tanpa hak tidak dapat mengakses file.
- [x] Kendala terikat pada log yang benar dan hanya aktor yang berhak dapat resolve.
- [ ] Edit/kegagalan upload tidak meninggalkan attachment rusak pada laporan.
- [ ] Riwayat dapat dibaca dan dioperasikan di mobile/laptop serta kedua tema.

## Dependensi terbuka

Aturan resolve lintas bulan pada Q-04 **selesai** (lihat [ADR-0015](../adr/0015-kendala.md): boleh kapan saja). Perubahan data tersimpan pada Q-05 masih relevan untuk bagian attachment/riwayat yang belum dikerjakan. Lihat [daftar keputusan terbuka](../open-decisions.md).

## Bukti pelaksanaan

**Kendala per log realisasi** ([ADR-0015](../adr/0015-kendala.md)) — selesai 2026-09-08:

- **Backend**: `server/src/routes/kendala.ts` (baru) — `handleCreateKendala` (`POST /api/kendala`, body `{taskLogId, deskripsi}`, 400 kalau log-nya jenis rencana, 403 kalau bukan pembuat log, 404 kalau log tidak ada), `handleResolveKendala` (`POST /api/kendala/:id/resolve`, 409 kalau sudah resolved — satu arah, tidak ada reopen), `handleDeleteKendala` (`DELETE /api/kendala/:id`, 204). Otorisasi murni kepemilikan `task_logs.user_id`, tanpa cek ulang keanggotaan project. `server/src/routes/task-logs.ts`: `GET /task-logs/daily` sekarang ikut mengembalikan `taskLogId` dan `kendala[]` per item checklist dan kerjaan tambahan (query kendala sekali jalan per `task_log_id`, bukan N+1).
- **Test otomatis**: `server/tests/kendala.test.ts` (baru, 13 test) — otorisasi, 404/403/400/409, kendala hanya untuk log realisasi, resolve tetap berhasil walau tanggal log sudah lama (membuktikan "boleh kapan saja"). Total 119 test lolos lintas file.
- **Frontend**: komponen baru `KendalaList.vue` (`components/input-harian/`) dipakai di kartu "Realisasi" (checklist, cuma tampil saat item dicentang) dan "Kerjaan tambahan" di `InputHarianView.vue` — daftar kendala dengan badge status (`Kendala`/`Selesai`), tombol "Tandai selesai" (hilang otomatis setelah resolved) dan "Hapus", plus form kecil "+ Tambah kendala" (disembunyikan kalau log belum pernah tersimpan). Tiap aksi (`useCreateKendala`/`useResolveKendala`/`useDeleteKendala`, baru di `composables/useTaskLogs.ts`) manggil API langsung dan invalidate query harian — tidak dibundel ke tombol "Simpan" utama.
- **Diverifikasi lewat Playwright** (akun uji sementara, data dihapus setelah selesai): tambah kendala ke item checklist yang sudah tersimpan → badge "Kendala" muncul dengan tombol "Tandai selesai"+"Hapus" → klik "Tandai selesai" → badge jadi "Selesai", tombol resolve hilang, "Hapus" tetap ada. Tambah kendala ke item "Kerjaan tambahan" → hapus → baris hilang dari daftar. Screenshot desktop+dark dan mobile+light, layout badge/tombol tetap rapi (wrap dengan benar) di kedua ukuran.

Attachment, riwayat, dan tautan commit GitLab belum dikerjakan — putaran terpisah berikutnya.

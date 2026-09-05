# Stage 02 — User, project, dan kalender kerja

- Status: Berjalan — pengelolaan user (CRUD, peran, hierarki) selesai dan teruji; project, keanggotaan, dan kalender/libur belum dikerjakan.
- Prasyarat: Stage 1.
- Keputusan: [ADR-0004](../adr/0004-hak-akses.md), [ADR-0005](../adr/0005-project-keanggotaan.md), [ADR-0025](../adr/0025-metode-ponytail.md), [ADR-0026](../adr/0026-kalender-kerja-tahunan.md), [ADR-0040](../adr/0040-import-project-gitlab.md).

## Cakupan

- Sediakan pengelolaan user, project, dan keanggotaan oleh admin.
- Siapkan data contoh secukupnya untuk menguji satu user dengan beberapa project dan satu project dengan beberapa user.
- Filter pilihan project berdasarkan keanggotaan; periksa kembali pada backend.
- Sediakan pengelolaan daftar libur/cuti bersama (`holidays`, berbentuk rentang tanggal) oleh admin; Senin–Jumat kerja dan Sabtu–Minggu libur dihitung tetap, tidak diatur admin, sesuai [ADR-0028](../adr/0028-pengelolaan-kalender.md).
- Sediakan alternatif impor project dari GitLab CE (admin pilih satu-satu, sekali impor lalu independen), berdampingan dengan pembuatan manual, sesuai [ADR-0040](../adr/0040-import-project-gitlab.md).

## Kriteria selesai dan pemeriksaan

- [ ] Admin dapat mengelola data yang diperlukan untuk input harian. Bagian user selesai (lihat bukti); project, keanggotaan, dan kalender/libur masih tersisa.
- [ ] Tenaga ahli tidak dapat mencatat pekerjaan pada project di luar keanggotaannya, termasuk lewat request langsung.
- [ ] Perubahan keanggotaan mengikuti kebijakan riwayat yang sudah dirinci, tanpa menghilangkan histori secara tidak sengaja.
- [ ] Hari libur dapat diatur admin (rentang tanggal) dan dipakai bersama aturan default mingguan untuk penelusuran hari kerja sebelumnya, termasuk lintas tahun.

## Dependensi terbuka

Kebijakan keanggotaan pada Q-02 dan rincian pengelolaan kalender pada Q-01. Lihat [daftar keputusan terbuka](../open-decisions.md).

## Bukti pelaksanaan

- **Backend**: `GET/POST /api/users` dan `PUT /api/users/:id` (`server/src/routes/users.ts`), dilindungi `requireAdmin` (`server/src/authz.ts`) — 401 tanpa login, 403 untuk non-admin. Validasi: minimal satu peran, email unik (409 kalau dobel), `atasanId`/`supervisiId` harus menunjuk user yang benar-benar berperan atasan/supervisi dan bukan diri sendiri (SQLite `CHECK` tidak bisa validasi lintas tabel — divalidasi di kode sesuai [ADR-0036](../adr/0036-skema-fisik-stage1.md)). Password di-hash `Bun.password.hash`; update peran mengganti seluruh baris `user_roles` per user (hapus lalu insert ulang) dalam satu transaksi bersama update `users`.
- **Test otomatis**: `server/tests/users.test.ts` (10 test) — otorisasi (401/403), create sukses, email dobel, tanpa peran, atasan salah peran, update sukses, atasan diri sendiri, user tidak ditemukan. Total 16 test lolos bersama `auth.test.ts` yang sudah ada.
- **Catatan isolasi test**: `server/src/db.ts` adalah singleton ESM yang otomatis dibagi lintas file test dalam satu proses `bun test` — `db.close()`/hapus folder tmp tidak boleh dipanggil per file (bikin file lain crash), sekarang hanya `DATABASE_PATH` yang di-set sekali (`??=`) dan dibiarkan hidup sampai proses test selesai.
- **Frontend**: `AdminUsersView.vue` sudah memakai data sungguhan lewat `useUsersQuery`/`useCreateUser`/`useUpdateUser` (`composables/useUsers.ts`, TanStack Query) menggantikan fixture; error 409 (email dobel) ditampilkan sebagai error field email, error lain lewat toast. Diverifikasi end-to-end lewat UI nyata (bukan fixture): login admin sungguhan, tabel menampilkan isi database apa adanya, tambah user lewat form + AlertDialog konfirmasi benar-benar tersimpan ke SQLite dan muncul setelah refresh.
- **Belum dikerjakan**: pengelolaan project, keanggotaan (`user_project`), dan kalender/libur (`holidays`) — masih fixture di sidebar, backend menyusul.

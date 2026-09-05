# Stage 00 — Keputusan dan desain layar

- Status: Berjalan; keputusan dasar dan preview terverifikasi tersedia, finalisasi skema sebelum migration masih tersisa.
- Prasyarat: Tidak ada.
- Keputusan: [ADR-0001](../adr/0001-stack-typescript.md), [ADR-0002](../adr/0002-database-sqlite.md), [ADR-0003](../adr/0003-login-session.md), [ADR-0004](../adr/0004-hak-akses.md), [ADR-0006](../adr/0006-hari-kerja.md), [ADR-0007](../adr/0007-tanggal-realisasi.md), [ADR-0012](../adr/0012-penutupan-task.md), [ADR-0019](../adr/0019-word-per-tipe.md), [ADR-0021](../adr/0021-komponen-ui.md), [ADR-0022](../adr/0022-arah-visual.md), [ADR-0023](../adr/0023-mobile-first.md), [ADR-0024](../adr/0024-tema.md), [ADR-0025](../adr/0025-metode-ponytail.md), [ADR-0026](../adr/0026-kalender-kerja-tahunan.md), [ADR-0035](../adr/0035-backend-framework.md), [ADR-0036](../adr/0036-skema-fisik-stage1.md), [ADR-0037](../adr/0037-library-frontend-tambahan.md).

## Cakupan

- Kunci ADR yang diterima dan pisahkan rincian terbuka dari keputusan final.
- Rancang Input Harian, Riwayat, dan Dashboard mobile-first dengan shadcn-vue, light/dark mode, dan referensi visual pengguna.
- Tetapkan rincian penggunaan kalender kerja tahunan yang sudah disetujui: pengisian, timezone, tanggal kosong, perubahan histori, dan batas bulan/tahun; rinci cakupan tim atasan.
- Jelaskan kebutuhan perubahan skema: kredensial/session, peran/cakupan tim, deskripsi penutupan, dan tabel kalender kerja yang diminta pengguna. Pemetaan tipe programmer menunggu Stage 7.

## Kriteria selesai dan pemeriksaan

- [x] Rancangan layar dapat direview pada mobile dan laptop, mencakup kedua tema serta empty/error/loading state.
- [x] Tidak ada perubahan skema yang diasumsikan sudah disetujui hanya karena tercantum sebagai kebutuhan; usulan fisik diberi label dan belum ada migration.
- [x] Q-03 (DDL fisik dan framework backend) selesai — lihat bukti pelaksanaan. Q-01/Q-02 rincian lanjutan (generate ulang kalender, ambang nyangkut, provisioning) tetap diselesaikan sebelum stage yang bergantung padanya masing-masing.

## Dependensi terbuka

Keputusan tanggal, rangkap peran, dan akses histori dasar telah diterima. Finalisasi Q-03 diperlukan sebelum migration; rincian perhitungan kalender, provisioning, serta edit tetap diselesaikan sebelum stage terkait. Template Word tidak menghalangi fondasi. Lihat [daftar keputusan terbuka](../open-decisions.md).

## Bukti pelaksanaan

[Bahan review Stage 0](00-review.md) memuat keputusan inti kalender/akses/batas bulan, usulan skema minimum, wireframe Input Harian/Riwayat/Dashboard, adaptasi laptop, kedua tema, dan keadaan error/loading/empty. Kalender dan batas bulan dicatat pada [ADR-0028](../adr/0028-pengelolaan-kalender.md) dan [ADR-0030](../adr/0030-pengecualian-awal-bulan.md). Koreksi pengguna menjadi hierarki atasan → supervisi → tenaga ahli dicatat pada [ADR-0031](../adr/0031-hierarki-supervisi.md), menggantikan ADR-0029; rincian tambahan Q-01/Q-02 masih terbuka.

Keputusan lanjutan dicatat pada [ADR-0032](../adr/0032-tanggal-bisnis.md), [ADR-0033](../adr/0033-rangkap-peran.md), dan [ADR-0034](../adr/0034-akses-histori.md).

Q-03 ditutup: DDL fisik final ada di [`schema/0001_initial.sql`](../schema/0001_initial.sql) dengan rasionalnya pada [ADR-0036](../adr/0036-skema-fisik-stage1.md); backend memakai Bun native + `bun:sqlite` tanpa framework/ORM ([ADR-0035](../adr/0035-backend-framework.md)); form validation tetap di jalur shadcn-vue lewat vee-validate+zod, ditambah TanStack Query/Table ([ADR-0037](../adr/0037-library-frontend-tambahan.md)) — Element Plus tidak dipakai agar tidak melanggar [ADR-0021](../adr/0021-komponen-ui.md). DDL ini belum dijalankan sebagai migration; eksekusi dan pemeriksaan persistensi menjadi bukti Stage 1.

[Preview HTML](00-preview.html) diperiksa melalui Chrome headless: 3 layar × 2 tema × lebar viewport 390/1366 px, tinggi 1000 px, seluruhnya tanpa overflow horizontal. Pemeriksaan DOM memastikan checkbox menyembunyikan/membuka catatan dan izin menyembunyikan rencana sambil mempertahankan realisasi. Screenshot input mobile light/dark dan rekap desktop dark diperiksa secara visual.

Ini bukti preview HTML/CSS, bukan aplikasi Vue/shadcn-vue fungsional. Filter, validasi backend, login, upload, dan penyimpanan belum diimplementasikan. Pemeriksaan kontras otomatis dan keyboard menyeluruh belum dijalankan. Berhenti setelah kriteria tahap terpenuhi; jangan menambahkan fitur di luar cakupan.

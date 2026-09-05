# ADR-0040: Import project dari GitLab CE sebagai alternatif input manual

- Status: diterima; rincian implementasi dicatat di bawah.
- Tanggal: 2026-09-05.
- Stage utama: [02](../stages/02-user-project.md).
- Melengkapi: [ADR-0005](0005-project-keanggotaan.md) (pengelolaan project oleh admin).
- Bergantung pada: [ADR-0038](0038-sso-gitlab.md) (token GitLab admin yang sedang login).
- Terkait: [ADR-0039](0039-integrasi-commit-gitlab.md) — project yang tertaut GitLab memudahkan penautan commit karena repo sumbernya sudah diketahui.

## Konteks

Admin sudah membuat project yang sama di GitLab CE (self-hosted). Daripada mengetik ulang nama project secara manual di aplikasi, pengguna ingin bisa mengimpornya langsung dari GitLab.

## Keputusan

- Admin membuka daftar project GitLab yang bisa diakses **token OAuth miliknya sendiri** (hasil login SSO, [ADR-0038](0038-sso-gitlab.md)) — bukan service account terpisah. Daftar yang muncul otomatis terbatas ke apa yang admin itu bisa lihat di GitLab.
- Admin **memilih satu-satu** project mana yang mau diimpor jadi project aplikasi (bukan import massal otomatis).
- Import bersifat **sekali jalan, lalu independen**: nama dan status project di aplikasi disalin saat import, setelah itu diedit manual seperti project biasa (ADR-0005) dan tidak lagi mengikuti perubahan nama/status/arsip di GitLab. Tidak ada job sinkronisasi berkala.
- Pembuatan project manual (tanpa GitLab) tetap tersedia berdampingan — import ini alternatif, bukan pengganti satu-satunya cara admin membuat project.
- Simpan asal-usul tautan: `projects.gitlab_project_id` (nullable, unik) menandai project yang berasal dari import; `NULL` untuk project yang dibuat manual. Mencegah project GitLab yang sama diimpor dua kali (tombol import menampilkan "sudah diimpor" untuk project yang gitlab_project_id-nya sudah ada).

## Konsekuensi

- Kolom baru `projects.gitlab_project_id` ditambahkan lewat migration Stage 2 (`000N_*.sql`), bukan mengedit `0001_initial.sql` yang sudah berjalan ([ADR-0036](0036-skema-fisik-stage1.md)).
- Karena independen setelah import, project yang diarsipkan/dihapus di GitLab tidak otomatis menonaktifkan project di aplikasi — admin yang mengelola `is_active` secara manual seperti biasa.
- `gitlab_project_id` yang tersimpan berguna sebagai sumber default saat menautkan commit ([ADR-0039](0039-integrasi-commit-gitlab.md)): task pada project yang tertaut GitLab bisa langsung menawarkan commit dari repo itu, tanpa user memilih repo lagi. Project yang dibuat manual (tanpa tautan) tetap bisa dipakai; penautan commit untuk kasus itu tinggal minta user memilih repo secara eksplisit.
- Scope OAuth admin perlu mencakup baca daftar project (`read_api` sudah dicakup [ADR-0038](0038-sso-gitlab.md) untuk kebutuhan commit; cukup dipakai ulang di sini, tidak perlu scope tambahan).

## Rincian terbuka

- Tampilan daftar project GitLab untuk dipilih (pencarian/pagination) dirinci saat implementasi Stage 2, mengikuti volume project yang wajar untuk tim ini.
- Perilaku saat token admin kedaluwarsa saat membuka daftar import mengikuti kebijakan refresh token pada [ADR-0038](0038-sso-gitlab.md).

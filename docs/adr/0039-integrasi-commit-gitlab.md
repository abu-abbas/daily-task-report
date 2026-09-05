# ADR-0039: Commit GitLab sebagai bukti pendukung laporan

- Status: diterima; rincian implementasi dicatat di bawah.
- Tanggal: 2026-09-05.
- Stage utama: [05](../stages/05-kendala-attachment-riwayat.md) (pelengkap attachment/riwayat).
- Melengkapi: [ADR-0016](0016-attachment.md) (attachment pada log), [ADR-0034](0034-akses-histori.md) (cakupan baca histori).
- Bergantung pada: [ADR-0038](0038-sso-gitlab.md) (token GitLab per user untuk memanggil API).

## Konteks

Setelah SSO GitLab ([ADR-0038](0038-sso-gitlab.md)) tersedia, pengguna ingin commit dari GitLab CE dipakai sebagai bukti pendukung/cross-check laporan harian — dilihat supervisi/atasan saat meninjau, melengkapi attachment gambar yang sudah diputuskan pada [ADR-0016](0016-attachment.md).

## Keputusan

- Tenaga ahli dapat **menautkan commit miliknya sendiri secara manual** ke satu `task_log` saat mengisi/mengedit laporan — bukan pencocokan otomatis. Pencocokan otomatis (commit ↔ task) dihindari karena tidak ada penanda andal yang menghubungkan keduanya; menebaknya lewat pesan commit berisiko salah kaitan.
- Aplikasi mengambil daftar commit lewat GitLab API (`/api/v4/...`) memakai token OAuth user yang sedang login ([ADR-0038](0038-sso-gitlab.md)), **difilter ke commit yang penulisnya adalah akun GitLab user tersebut** — mencegah user menautkan commit orang lain sebagai bukti kerjanya sendiri.
- Data yang disimpan per tautan hanya referensi ringan: SHA commit, pesan, URL commit, dan waktu commit — bukan salinan diff/isi commit. Membuka detail commit mengarahkan ke GitLab CE asli (butuh akses user di sana, yang sudah tentu dimiliki).
- **Tabel baru terpisah** untuk tautan ini (bukan menumpang ke `attachments`): `attachments.file_path` menurut [ADR-0020](0020-operasional-lokal.md)/[ADR-0036](0036-skema-fisik-stage1.md) berarti path lokal di disk untuk file yang diunggah, bukan referensi/URL eksternal — memaksakan commit ke sana mencampur dua arti berbeda. Usulan struktur minimum: `task_log_commits` (`id`, `task_log_id`, `commit_sha`, `commit_url`, `pesan`, `authored_at`, `ditambahkan_oleh`, `created_at`); DDL final ditulis saat Stage 5 diimplementasikan, mengikuti pola [ADR-0036](0036-skema-fisik-stage1.md).
- Akses baca tautan commit mengikuti cakupan histori yang sama dengan attachment/log ([ADR-0034](0034-akses-histori.md)): pemilik laporan, supervisi/atasan aktif di atasnya, dan admin sesuai batasannya — bukan seluruh anggota project.

## Konsekuensi

- Scope OAuth pada [ADR-0038](0038-sso-gitlab.md) harus mencakup akses baca commit (mis. `read_api`/`read_repository`) sejak awal.
- Fitur ini murni pelengkap bukti; tidak menggantikan atau mengubah alur simpan checklist realisasi ([ADR-0006](0006-hari-kerja.md), Stage 3) maupun attachment gambar ([ADR-0016](0016-attachment.md)) yang sudah ada.
- Menautkan commit tidak butuh dan tidak boleh dianggap sebagai persetujuan/approval — tetap sejalan dengan [ADR-0018](0018-tanpa-approval.md) (tanpa workflow approval).

## Rincian terbuka

- Bagaimana user memilih project/repository GitLab sumber commit (pilih repo dulu baru cari commit, atau pencarian lintas repo yang bisa diakses user) — dirinci saat Stage 5.
- Batas jumlah commit yang bisa ditautkan per log, dan apakah commit yang sama boleh ditautkan ke lebih dari satu log — dirinci saat Stage 5, ikut prinsip minimum [ADR-0025](0025-metode-ponytail.md).
- Perilaku saat token GitLab user kedaluwarsa/dicabut saat mencoba menautkan commit (idealnya sama dengan penanganan refresh token pada [ADR-0038](0038-sso-gitlab.md)).

# ADR-0005: Pengelolaan project oleh admin

- Status: diterima; rincian terbuka dicatat di bawah.
- Tanggal: 2026-09-05.
- Stage utama: [02](../stages/02-user-project.md).

## Konteks

Keputusan bisnis 5: menerima rekomendasi A.

## Keputusan

Admin mengelola user, project, dan keanggotaan user_project. Tenaga ahli hanya mencatat pekerjaan pada project yang diikutinya.

## Konsekuensi

Validasi keanggotaan dilakukan di backend. User tidak membuat project atau bergabung sendiri. Tenaga ahli tetap membaca histori miliknya setelah keluar project sesuai [ADR-0034](0034-akses-histori.md); hak mengoreksi histori setelah keluar masih dirinci pada Stage 4.

Pengecualian sempit untuk project yang belum sempat di-mapping admin diatur pada [ADR-0042](0042-project-lainnya-usulan.md): usulan "Lainnya" tetap membuat project nyata dengan keanggotaan otomatis, bukan izin bebas memilih project siapa pun.

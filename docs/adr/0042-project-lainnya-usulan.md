# ADR-0042: Usulan project via "Lainnya" dengan rekonsiliasi admin

- Status: diterima; rincian terbuka dicatat di bawah.
- Tanggal: 2026-09-07.
- Stage utama: [03](../stages/03-input-harian.md) untuk input; [02](../stages/02-user-project.md) untuk rekonsiliasi admin; [06](../stages/06-dashboard.md) untuk rekap; [07](../stages/07-ekspor-word.md) untuk ekspor.
- Melengkapi: [ADR-0005](0005-project-keanggotaan.md).

## Konteks

Google Form lama menyediakan pilihan "Other" untuk kerjaan pada project yang belum sempat di-mapping admin. ADR-0005 menutup jalur ini di aplikasi baru: tenaga ahli hanya mencatat pekerjaan pada project yang diikutinya, admin mengelola keanggotaan. Tanpa jalur keluar, kerjaan mendadak di project yang belum di-mapping jadi terhambat sampai admin sempat menambahkan keanggotaan.

## Keputusan

Dropdown "Pilih project" pada Kerjaan tambahan mendapat opsi "Lainnya" dengan input nama bebas. Memilihnya membuat project baru dengan flag `belum_direkonsiliasi = true`, otomatis menjadikan user pembuatnya sebagai anggota (supaya validasi keanggotaan ADR-0005 tetap berlaku dan log bisa langsung tersimpan). Project ini tidak muncul di dropdown user lain.

Di dashboard (Stage 06) dan ekspor Word (Stage 07), seluruh project berflag itu digabung tampil sebagai satu baris agregat "Project Lainnya" — bukan satu-satu per nama usulan. Tujuannya supaya volume "Project Lainnya" yang besar terlihat oleh atasan/pimpinan pembaca laporan dan mendorong admin merekonsiliasi, alih-alih disembunyikan.

Admin mendapat halaman rincian "Project Lainnya" (breakdown per nama usulan, pemakai, jumlah log) — untuk saat ini aksesnya admin saja, belum dibuka ke atasan/pimpinan. Dari situ admin merekonsiliasi tiap usulan dengan salah satu dari:
- **Konfirmasi jadi project baru**: lepas flag `belum_direkonsiliasi`, nama usulan jadi nama resmi.
- **Gabungkan ke project existing**: pindahkan `project_id` semua task/log dari project usulan ke project tujuan, tambahkan user pembuat sebagai anggota project tujuan, hapus project usulan.

## Konsekuensi

Validasi keanggotaan ADR-0005 tidak dilonggarkan — user tetap hanya jadi anggota project yang otomatis dibuat untuknya, bukan bebas pilih project siapa pun. Rekap/dashboard yang tampil sebelum rekonsiliasi menunjukkan "Project Lainnya" sebagai kategori sah, bukan data rusak.

Rincian yang masih terbuka dicatat di [daftar keputusan terbuka](../open-decisions.md) Q-10: apakah usulan yang tidak pernah dikonfirmasi diarsipkan atau tetap menumpuk, kapan akses breakdown diperluas ke atasan, dan penanganan kemiripan nama usulan (typo) saat admin memilih project tujuan gabungan.

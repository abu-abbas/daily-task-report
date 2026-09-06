# ADR-0041: Identitas item task_logs — satu baris per upsert

- Status: diterima.
- Tanggal: 2026-09-06.
- Stage utama: [03](../stages/03-input-harian.md).
- Melengkapi: [ADR-0009](0009-edit-submit.md), [ADR-0010](0010-task-tanpa-pemilik.md), [ADR-0011](0011-kolaborasi-task.md).
- Menutup sebagian: [Q-05](../open-decisions.md) — bagian "identitas item" yang menghalangi desain penyimpanan Stage 3.

## Konteks

[ADR-0036](0036-skema-fisik-stage1.md) sengaja tidak menambah unique constraint pada `task_logs` (kombinasi task/tanggal/user/jenis) karena kolaborasi banyak user pada task/tanggal sama harus tetap mungkin (ADR-0011), tapi duplikasi item milik **user yang sama** dibiarkan terbuka sebagai Q-05. Stage 3 tidak bisa membangun logic simpan tanpa keputusan ini.

## Keputusan

Untuk kombinasi (`user_id`, `task_id`, `tanggal`, `jenis`) yang sama, hanya ada **satu baris** `task_logs`. Mengisi/menyimpan ulang task yang sama pada tanggal yang sama (dalam sesi submit yang sama, sebelum pindah ke tanggal lain) **meng-update** baris itu (upsert berdasarkan kombinasi 4 kolom di atas), bukan menambah baris baru.

Ini cocok dengan model checklist: mencentang task menulis/menimpa satu catatan hasil untuk task itu pada tanggal itu — bukan jadi jurnal bebas dengan banyak entri per task per hari.

## Konsekuensi

- Endpoint simpan Stage 3 melakukan upsert per baris (`INSERT ... ON CONFLICT` manual via cek-lalu-update/insert dalam transaksi, karena tidak ada unique constraint di DB — pengecekan dilakukan di kode aplikasi, konsisten dengan pola `isActiveProjectMember`/pengecekan manual lain di proyek ini) memakai kunci (`user_id`, `task_id`, `tanggal`, `jenis`).
- Kolaborasi banyak user pada task/tanggal sama ([ADR-0011](0011-kolaborasi-task.md)) tidak terpengaruh — kunci upsert menyertakan `user_id`, jadi user lain tetap independen.
- Yang **belum** ditutup ADR ini (tetap di Q-05, dirinci saat Stage 4): makna "uncheck" pada item yang sudah tersimpan dari **hari sebelumnya** (edit/koreksi, bukan submit awal), nasib rencana lama ketika izin diaktifkan, dan larangan penghapusan diam-diam saat konflik izin/realisasi. Stage 3 hanya menangani alur input awal dalam satu sesi submit.

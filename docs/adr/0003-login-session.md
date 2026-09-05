# ADR-0003: Login email dan password

- Status: diterima; rincian terbuka dicatat di bawah.
- Tanggal: 2026-09-05.
- Stage utama: [01](../stages/01-fondasi-akses.md).

## Konteks

Keputusan bisnis 3: menerima rekomendasi B.

## Keputusan

Gunakan login email/password dan session untuk pemakaian tim; bukan dropdown untuk berganti identitas.

## Konsekuensi

Skema users awal belum menyimpan kredensial. Rancang penyimpanan hash password dan session pada Stage 0/1. Backend menentukan user aktif; dropdown pada referensi gambar tidak boleh menjadi cara menyamar sebagai user lain. SSO dan registrasi publik belum diminta.

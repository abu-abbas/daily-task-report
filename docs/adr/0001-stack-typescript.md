# ADR-0001: Stack aplikasi TypeScript

- Status: diterima; rincian terbuka dicatat di bawah.
- Tanggal: 2026-09-05.
- Stage utama: [01](../stages/01-fondasi-akses.md).

## Konteks

Keputusan bisnis 1: menerima rekomendasi A.

## Keputusan

Bun sebagai runtime backend; Vue 3 + Vite + TypeScript untuk frontend. Logika aplikasi frontend dan backend ditulis dalam TypeScript. Kontrak tipe dapat digunakan bersama tanpa membawa kode server ke browser.

## Konsekuensi

Type checking tetap menjadi pemeriksaan terpisah. Framework backend, akses database/ORM, dan struktur internal belum dipilih; jangan menganggap Elysia, Hono, atau ORM tertentu sudah disetujui.

# ADR-0035: Bun native tanpa framework/ORM untuk backend

- Status: diterima.
- Tanggal: 2026-09-05.
- Stage utama: [01](../stages/01-fondasi-akses.md).
- Melengkapi: [ADR-0001](0001-stack-typescript.md), [ADR-0002](0002-database-sqlite.md), [ADR-0025](0025-metode-ponytail.md).

## Konteks

[Q-03](../open-decisions.md) mencatat framework backend/ORM belum dipilih. Stage 1 butuh keputusan ini sebelum scaffolding. Sesuai [ADR-0025](0025-metode-ponytail.md), pilih dependency minimum yang memenuhi kebutuhan Stage 1 (routing sederhana, SQLite, session cookie), bukan yang paling banyak fitur.

## Keputusan

Gunakan `Bun.serve()` bawaan Bun untuk HTTP/routing dan `bun:sqlite` bawaan Bun untuk akses database. Tidak memakai framework HTTP (Hono/Express/dst) maupun ORM (Drizzle/Prisma/dst) pada Stage 1. Migration ditulis sebagai file SQL polos yang dijalankan berurutan, bukan lewat ORM migration tool.

## Konsekuensi

- Routing, parsing body, dan validasi request ditulis manual per endpoint; tetap gunakan fungsi bantu bersama supaya tidak duplikatif, tanpa membangun router generik yang tidak dibutuhkan.
- Query SQL ditulis langsung dengan prepared statement `bun:sqlite`; tidak ada query builder/ORM yang menyembunyikan SQL.
- Jika kebutuhan Stage 2+ (misal jumlah endpoint atau kompleksitas query) menunjukkan biaya nyata dari pendekatan manual ini, framework/ORM boleh dipertimbangkan ulang lewat ADR baru — bukan diasumsikan sekarang.
- Skema fisik yang dipakai migration ada di [ADR-0036](0036-skema-fisik-stage1.md).

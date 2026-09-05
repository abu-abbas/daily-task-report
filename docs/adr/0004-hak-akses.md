# ADR-0004: Peran dan cakupan akses

- Status: diterima; rincian terbuka dicatat di bawah.
- Tanggal: 2026-09-05.
- Stage utama: [01](../stages/01-fondasi-akses.md).

## Konteks

Keputusan bisnis 4: menerima rekomendasi A.

## Keputusan

Tenaga ahli melihat laporan miliknya. Supervisi dapat login dan melihat laporan tenaga ahli di bawahnya. Atasan melihat laporan tim melalui supervisi di bawahnya. Admin mengelola user dan project.

## Konsekuensi

Otorisasi wajib berlaku pada API dan attachment, bukan hanya menu. Cakupan atasan mengikuti hierarki atasan → supervisi → tenaga ahli pada [ADR-0031](0031-hierarki-supervisi.md), menggantikan hubungan langsung pada ADR-0029. Rangkap peran mengikuti [ADR-0033](0033-rangkap-peran.md); akses histori berdasarkan hubungan aktif dan batas hak admin mengikuti [ADR-0034](0034-akses-histori.md).

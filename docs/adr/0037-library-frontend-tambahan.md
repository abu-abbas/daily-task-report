# ADR-0037: vee-validate+zod, TanStack Query, dan TanStack Table sebagai library tambahan

- Status: diterima.
- Tanggal: 2026-09-05.
- Stage utama: [01](../stages/01-fondasi-akses.md), penggunaan meluas ke Stage 2–6.
- Melengkapi: [ADR-0021](0021-komponen-ui.md).

## Konteks

Pengguna meminta kemudahan form validation serta data-fetching/tabel yang enak dipakai. [ADR-0021](0021-komponen-ui.md) sudah mengunci shadcn-vue + Tailwind dan secara eksplisit meminta menghindari library UI kedua tanpa kebutuhan nyata. Element Plus adalah design system komponen penuh (bukan sekadar util validasi) sehingga menambahkannya akan bertentangan dengan ADR-0021. Pengguna memilih tetap pada shadcn-vue.

## Keputusan

- Form validation memakai **vee-validate + zod** — ini pasangan resmi yang dipakai komponen `Form` shadcn-vue, jadi tidak menambah design system kedua.
- Data-fetching (loading/error/cache state untuk panggilan API) memakai **TanStack Query**.
- Tabel (Riwayat per project/bulan, rekap tim) memakai **TanStack Table** — ini pasangan resmi komponen `DataTable` shadcn-vue.

## Konsekuensi

- Ketiganya headless/logic-only: tidak membawa komponen visual sendiri, sehingga tidak melanggar batasan "hindari UI library kedua" pada ADR-0021.
- Styling tabel/form tetap memakai komponen shadcn-vue + Tailwind yang sudah ada.
- Tidak ada perubahan pada ADR-0021; Element Plus tidak dipakai.

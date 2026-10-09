import { rawQuery } from "../src/db";

// SQL mentah untuk seeding dan pengecekan di test, dengan bentuk pemanggilan mirip bun:sqlite
// (`query(sql).run/get/all(...params)`, placeholder `?`) supaya test lama cukup ditambah await.
// Jalan di kedua driver (PGlite dan Postgres). Kode aplikasi tidak memakai ini.
export const db = {
  query<T = Record<string, unknown>, _P = unknown>(text: string) {
    return {
      all(...params: unknown[]): Promise<T[]> {
        return rawQuery<T>(text, params);
      },
      async get(...params: unknown[]): Promise<T | null> {
        return (await rawQuery<T>(text, params))[0] ?? null;
      },
      // INSERT tanpa RETURNING otomatis diberi RETURNING * supaya id baris baru bisa dibaca
      // seperti lastInsertRowid di bun:sqlite.
      async run(...params: unknown[]): Promise<{ lastInsertRowid: number }> {
        const isInsert = /^\s*insert\b/i.test(text) && !/\breturning\b/i.test(text);
        const rows = await rawQuery<{ id?: number }>(isInsert ? `${text} RETURNING *` : text, params);
        return { lastInsertRowid: Number(rows[0]?.id ?? 0) };
      },
    };
  },
};

import { client } from "../src/db";

// SQL mentah untuk seeding dan pengecekan di test, dengan bentuk pemanggilan mirip bun:sqlite
// (`query(sql).run/get/all(...params)`, placeholder `?`) supaya test lama cukup ditambah await.
// Kode aplikasi tidak memakai ini; semua query aplikasi lewat Drizzle.
function toPostgres(text: string): string {
  let n = 0;
  return text.replace(/\?/g, () => `$${++n}`);
}

export const db = {
  query<T = Record<string, unknown>, _P = unknown>(text: string) {
    const pgText = toPostgres(text);
    return {
      async all(...params: unknown[]): Promise<T[]> {
        return [...(await client.unsafe(pgText, params))] as T[];
      },
      async get(...params: unknown[]): Promise<T | null> {
        const rows = await client.unsafe(pgText, params);
        return (rows[0] as T | undefined) ?? null;
      },
      // INSERT tanpa RETURNING otomatis diberi RETURNING * supaya id baris baru bisa dibaca
      // seperti lastInsertRowid di bun:sqlite.
      async run(...params: unknown[]): Promise<{ lastInsertRowid: number }> {
        const isInsert = /^\s*insert\b/i.test(text) && !/\breturning\b/i.test(text);
        const rows = await client.unsafe(isInsert ? `${pgText} RETURNING *` : pgText, params);
        return { lastInsertRowid: Number((rows[0] as { id?: number } | undefined)?.id ?? 0) };
      },
    };
  },
};

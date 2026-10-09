import { requireLogin } from "../authz";
import { z } from "zod/v4";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { saranBulanan } from "../schema";
import { errorResponse, json } from "../http";

const BULAN_RE = /^\d{4}-\d{2}$/;

const saranPayloadSchema = z.object({
  isi: z.string().optional().default(""),
});

// BAB V — TIDAK prefill dari bulan sebelumnya (beda dari Pendahuluan): wajib diisi ulang
// tiap bulan (ADR-0019), kosong kalau belum pernah disimpan.
export async function handleGetSaran(req: Request): Promise<Response> {
  const ctx = await requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const bulan = url.searchParams.get("bulan");
  if (!bulan || !BULAN_RE.test(bulan)) return errorResponse(400, "Format bulan tidak valid (YYYY-MM).");

  return json({ isi: await getSaranIsi(ctx.user.id, bulan) });
}

export async function handleSaveSaran(req: Request): Promise<Response> {
  const ctx = await requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const bulan = url.searchParams.get("bulan");
  if (!bulan || !BULAN_RE.test(bulan)) return errorResponse(400, "Format bulan tidak valid (YYYY-MM).");

  const body = await req.json().catch(() => null);
  const parsed = saranPayloadSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Data tidak valid.");

  await db
    .insert(saranBulanan)
    .values({ user_id: ctx.user.id, bulan, isi: parsed.data.isi })
    .onConflictDoUpdate({
      target: [saranBulanan.user_id, saranBulanan.bulan],
      set: { isi: parsed.data.isi, updated_at: sql`CURRENT_TIMESTAMP` },
    });

  return json({ isi: parsed.data.isi });
}

// Dipakai endpoint unduh laporan (Stage 7 "laporan gabungan") untuk menggembok tombol unduh
// sampai Saran & Rekomendasi terisi (ADR-0019) — teks kosong/whitespace dianggap belum diisi.
async function getSaranIsi(userId: number, bulan: string): Promise<string> {
  const row = await db
    .select({ isi: saranBulanan.isi })
    .from(saranBulanan)
    .where(and(eq(saranBulanan.user_id, userId), eq(saranBulanan.bulan, bulan)))
    .get();
  return row?.isi ?? "";
}

export async function isSaranTerisi(userId: number, bulan: string): Promise<boolean> {
  return (await getSaranIsi(userId, bulan)).trim() !== "";
}

// Baris saran, satu item per baris (bukan markdown) — dipakai agregasi laporan PDF setelah
// isSaranTerisi memastikan sudah diisi.
export async function getSaranLines(userId: number, bulan: string): Promise<string[]> {
  return (await getSaranIsi(userId, bulan))
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

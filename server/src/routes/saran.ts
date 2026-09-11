import { z } from "zod/v4";
import { db } from "../db";
import { errorResponse, json } from "../http";
import { getAuthContext, parseCookie, SESSION_COOKIE } from "../auth";

const BULAN_RE = /^\d{4}-\d{2}$/;

interface SaranRow {
  user_id: number;
  bulan: string;
  isi: string;
  updated_at: string;
}

const saranPayloadSchema = z.object({
  isi: z.string().optional().default(""),
});

// BAB V — TIDAK prefill dari bulan sebelumnya (beda dari Pendahuluan): wajib diisi ulang
// tiap bulan (ADR-0019), kosong kalau belum pernah disimpan.
export function handleGetSaran(req: Request): Response {
  const token = parseCookie(req.headers.get("Cookie"), SESSION_COOKIE);
  const ctx = getAuthContext(token);
  if (!ctx) return errorResponse(401, "Belum login.");

  const url = new URL(req.url);
  const bulan = url.searchParams.get("bulan");
  if (!bulan || !BULAN_RE.test(bulan)) return errorResponse(400, "Format bulan tidak valid (YYYY-MM).");

  const row = db
    .query<SaranRow, [number, string]>("SELECT * FROM saran_bulanan WHERE user_id = ? AND bulan = ?")
    .get(ctx.user.id, bulan);
  return json({ isi: row?.isi ?? "" });
}

export async function handleSaveSaran(req: Request): Promise<Response> {
  const token = parseCookie(req.headers.get("Cookie"), SESSION_COOKIE);
  const ctx = getAuthContext(token);
  if (!ctx) return errorResponse(401, "Belum login.");

  const url = new URL(req.url);
  const bulan = url.searchParams.get("bulan");
  if (!bulan || !BULAN_RE.test(bulan)) return errorResponse(400, "Format bulan tidak valid (YYYY-MM).");

  const body = await req.json().catch(() => null);
  const parsed = saranPayloadSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Data tidak valid.");

  db.query(
    `INSERT INTO saran_bulanan (user_id, bulan, isi, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, bulan) DO UPDATE SET isi = excluded.isi, updated_at = CURRENT_TIMESTAMP`,
  ).run(ctx.user.id, bulan, parsed.data.isi);

  return json({ isi: parsed.data.isi });
}

// Dipakai endpoint unduh laporan (Stage 7 "laporan gabungan") untuk menggembok tombol unduh
// sampai Saran & Rekomendasi terisi (ADR-0019) — teks kosong/whitespace dianggap belum diisi.
export function isSaranTerisi(userId: number, bulan: string): boolean {
  const row = db
    .query<{ isi: string }, [number, string]>("SELECT isi FROM saran_bulanan WHERE user_id = ? AND bulan = ?")
    .get(userId, bulan);
  return (row?.isi ?? "").trim() !== "";
}

// Baris saran, satu item per baris (bukan markdown) — dipakai agregasi laporan PDF setelah
// isSaranTerisi memastikan sudah diisi.
export function getSaranLines(userId: number, bulan: string): string[] {
  const row = db
    .query<{ isi: string }, [number, string]>("SELECT isi FROM saran_bulanan WHERE user_id = ? AND bulan = ?")
    .get(userId, bulan);
  return (row?.isi ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

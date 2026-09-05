import { z } from "zod/v4";
import { db } from "../db";
import { errorResponse, json } from "../http";
import { requireAdmin } from "../authz";
import { getAuthContext, parseCookie, SESSION_COOKIE } from "../auth";

interface HolidayRow {
  id: number;
  nama: string;
  tanggal_mulai: string;
  tanggal_akhir: string;
}

function publicHoliday(row: HolidayRow) {
  return {
    id: row.id,
    nama: row.nama,
    tanggalMulai: row.tanggal_mulai,
    tanggalAkhir: row.tanggal_akhir,
  };
}

const holidayPayloadSchema = z.object({
  nama: z.string().min(1, "Nama wajib diisi."),
  tanggalMulai: z.iso.date("Tanggal mulai tidak valid."),
  tanggalAkhir: z.iso.date("Tanggal akhir tidak valid."),
});

// Baca daftar libur tidak dibatasi admin — dipakai semua user untuk penelusuran hari
// kerja sebelumnya (ADR-0006/ADR-0026) begitu Stage 3 dibangun, bukan cuma untuk admin.
export function handleListHolidays(req: Request): Response {
  const token = parseCookie(req.headers.get("Cookie"), SESSION_COOKIE);
  const ctx = getAuthContext(token);
  if (!ctx) return errorResponse(401, "Belum login.");

  const rows = db
    .query<HolidayRow, []>(
      "SELECT id, nama, tanggal_mulai, tanggal_akhir FROM holidays ORDER BY tanggal_mulai",
    )
    .all();
  return json({ holidays: rows.map(publicHoliday) });
}

export async function handleCreateHoliday(req: Request): Promise<Response> {
  const ctx = requireAdmin(req);
  if (ctx instanceof Response) return ctx;

  const body = await req.json().catch(() => null);
  const parsed = holidayPayloadSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Data tidak valid.");

  if (parsed.data.tanggalAkhir < parsed.data.tanggalMulai) {
    return errorResponse(400, "Tanggal akhir tidak boleh sebelum tanggal mulai.");
  }

  const result = db
    .query("INSERT INTO holidays (nama, tanggal_mulai, tanggal_akhir) VALUES (?, ?, ?)")
    .run(parsed.data.nama, parsed.data.tanggalMulai, parsed.data.tanggalAkhir);

  const row = db
    .query<HolidayRow, [number]>(
      "SELECT id, nama, tanggal_mulai, tanggal_akhir FROM holidays WHERE id = ?",
    )
    .get(Number(result.lastInsertRowid))!;
  return json({ holiday: publicHoliday(row) }, { status: 201 });
}

export async function handleDeleteHoliday(req: Request, id: number): Promise<Response> {
  const ctx = requireAdmin(req);
  if (ctx instanceof Response) return ctx;

  if (!Number.isInteger(id)) return errorResponse(400, "ID tidak valid.");
  const existing = db.query<{ id: number }, [number]>("SELECT id FROM holidays WHERE id = ?").get(id);
  if (!existing) return errorResponse(404, "Data libur tidak ditemukan.");

  db.query("DELETE FROM holidays WHERE id = ?").run(id);
  return new Response(null, { status: 204 });
}

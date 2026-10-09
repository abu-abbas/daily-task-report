import { z } from "zod/v4";
import { asc, eq } from "drizzle-orm";
import { db, first } from "../db";
import { holidays } from "../schema";
import { errorResponse, json } from "../http";
import { requireAdmin, requireLogin } from "../authz";

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
export async function handleListHolidays(req: Request): Promise<Response> {
  const ctx = await requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const rows: HolidayRow[] = await db.select().from(holidays).orderBy(asc(holidays.tanggal_mulai));
  return json({ holidays: rows.map(publicHoliday) });
}

export async function handleCreateHoliday(req: Request): Promise<Response> {
  const ctx = await requireAdmin(req);
  if (ctx instanceof Response) return ctx;

  const body = await req.json().catch(() => null);
  const parsed = holidayPayloadSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Data tidak valid.");

  if (parsed.data.tanggalAkhir < parsed.data.tanggalMulai) {
    return errorResponse(400, "Tanggal akhir tidak boleh sebelum tanggal mulai.");
  }

  const [row] = await db
    .insert(holidays)
    .values({
      nama: parsed.data.nama,
      tanggal_mulai: parsed.data.tanggalMulai,
      tanggal_akhir: parsed.data.tanggalAkhir,
    })
    .returning();
  return json({ holiday: publicHoliday(row!) }, { status: 201 });
}

export async function handleDeleteHoliday(req: Request, id: number): Promise<Response> {
  const ctx = await requireAdmin(req);
  if (ctx instanceof Response) return ctx;

  if (!Number.isInteger(id)) return errorResponse(400, "ID tidak valid.");
  const existing = await db.select({ id: holidays.id }).from(holidays).where(eq(holidays.id, id)).then(first);
  if (!existing) return errorResponse(404, "Data libur tidak ditemukan.");

  await db.delete(holidays).where(eq(holidays.id, id));
  return new Response(null, { status: 204 });
}

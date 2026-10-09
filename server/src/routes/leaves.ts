import { requireLogin } from "../authz";
import { z } from "zod/v4";
import { db } from "../db";
import { errorResponse, json } from "../http";
import { dalamBulanBerjalan, todayJakarta } from "../kalender";

const TANGGAL_RE = /^\d{4}-\d{2}-\d{2}$/;

const saveLeaveSchema = z.object({
  tanggal: z.string().regex(TANGGAL_RE, "Format tanggal tidak valid."),
  jenis: z.enum(["cuti", "sakit", "izin"]),
  alasan: z.string().optional(),
});

// ADR-0013/0014: izin/cuti/sakit per tanggal, satu baris per (user, tanggal) — submit ulang
// meng-update, bukan menggandakan (pola sama ADR-0041 pada task_logs). potong_cuti_tahunan
// tetap null (tidak menghitung kuota cuti, di luar cakupan stage ini).
// hariIniOverride: test-only, pola sama seperti handleSaveDailyInput di routes/task-logs.ts.
export async function handleSaveLeave(req: Request, hariIniOverride?: string): Promise<Response> {
  const ctx = requireLogin(req);
  if (ctx instanceof Response) return ctx;
  const userId = ctx.user.id;

  const body = await req.json().catch(() => null);
  const parsed = saveLeaveSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Data tidak valid.");
  const { tanggal, jenis } = parsed.data;
  const alasan = parsed.data.alasan?.trim() || null;

  const hariIni = hariIniOverride ?? todayJakarta();
  if (!dalamBulanBerjalan(tanggal, hariIni)) {
    return errorResponse(400, "Tanggal di luar bulan berjalan.");
  }

  // ADR-0014: tanggal yang sudah punya realisasi tidak boleh sekaligus jadi izin.
  const realisasiBentrok = db
    .query<{ id: number }, [number, string]>(
      "SELECT id FROM task_logs WHERE user_id = ? AND tanggal = ? AND jenis = 'realisasi'",
    )
    .get(userId, tanggal);
  if (realisasiBentrok) {
    return errorResponse(409, "Tanggal itu sudah punya realisasi tersimpan, tidak bisa jadi izin/cuti/sakit.");
  }

  db.transaction(() => {
    const existing = db
      .query<{ id: number }, [number, string]>("SELECT id FROM leaves WHERE user_id = ? AND tanggal = ?")
      .get(userId, tanggal);
    if (existing) {
      db.query("UPDATE leaves SET jenis = ?, alasan = ? WHERE id = ?").run(jenis, alasan, existing.id);
    } else {
      db.query(
        "INSERT INTO leaves (user_id, tanggal, jenis, alasan, potong_cuti_tahunan) VALUES (?, ?, ?, ?, NULL)",
      ).run(userId, tanggal, jenis, alasan);
    }
    // Rencana yang sudah tersimpan di tanggal ini otomatis dihapus — izin dan rencana tidak
    // boleh coexist di tanggal yang sama (keputusan produk, melengkapi ADR-0014 yang eksplisit
    // baru menyebut realisasi).
    db.query("DELETE FROM task_logs WHERE user_id = ? AND tanggal = ? AND jenis = 'rencana'").run(userId, tanggal);
  })();

  return json({ tanggal, jenis, alasan });
}

export async function handleCancelLeave(req: Request, tanggal: string): Promise<Response> {
  const ctx = requireLogin(req);
  if (ctx instanceof Response) return ctx;

  if (!TANGGAL_RE.test(tanggal)) return errorResponse(400, "Format tanggal tidak valid.");

  db.query("DELETE FROM leaves WHERE user_id = ? AND tanggal = ?").run(ctx.user.id, tanggal);
  return json({ tanggal });
}

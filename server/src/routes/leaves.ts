import { requireLogin } from "../authz";
import { z } from "zod/v4";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { leaves, taskLogs } from "../schema";
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
  const ctx = await requireLogin(req);
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
  const realisasiBentrok = await db
    .select({ id: taskLogs.id })
    .from(taskLogs)
    .where(and(eq(taskLogs.user_id, userId), eq(taskLogs.tanggal, tanggal), eq(taskLogs.jenis, "realisasi")))
    .get();
  if (realisasiBentrok) {
    return errorResponse(409, "Tanggal itu sudah punya realisasi tersimpan, tidak bisa jadi izin/cuti/sakit.");
  }

  // Callback transaksi sinkron (.get/.run), lihat catatan di routes/users.ts.
  db.transaction((tx) => {
    const existing = tx
      .select({ id: leaves.id })
      .from(leaves)
      .where(and(eq(leaves.user_id, userId), eq(leaves.tanggal, tanggal)))
      .get();
    if (existing) {
      tx.update(leaves).set({ jenis, alasan }).where(eq(leaves.id, existing.id)).run();
    } else {
      tx.insert(leaves).values({ user_id: userId, tanggal, jenis, alasan, potong_cuti_tahunan: null }).run();
    }
    // Rencana yang sudah tersimpan di tanggal ini otomatis dihapus — izin dan rencana tidak
    // boleh coexist di tanggal yang sama (keputusan produk, melengkapi ADR-0014 yang eksplisit
    // baru menyebut realisasi).
    tx.delete(taskLogs)
      .where(and(eq(taskLogs.user_id, userId), eq(taskLogs.tanggal, tanggal), eq(taskLogs.jenis, "rencana")))
      .run();
  });

  return json({ tanggal, jenis, alasan });
}

export async function handleCancelLeave(req: Request, tanggal: string): Promise<Response> {
  const ctx = await requireLogin(req);
  if (ctx instanceof Response) return ctx;

  if (!TANGGAL_RE.test(tanggal)) return errorResponse(400, "Format tanggal tidak valid.");

  await db.delete(leaves).where(and(eq(leaves.user_id, ctx.user.id), eq(leaves.tanggal, tanggal)));
  return json({ tanggal });
}

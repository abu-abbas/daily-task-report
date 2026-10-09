import { requireLogin } from "../authz";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { kendala, taskLogs } from "../schema";
import { errorResponse, json } from "../http";

interface KendalaRow {
  id: number;
  task_log_id: number;
  deskripsi: string;
  status: "open" | "resolved";
}

function publicKendala(row: KendalaRow) {
  return { id: row.id, taskLogId: row.task_log_id, deskripsi: row.deskripsi, status: row.status };
}

const kendalaColumns = {
  id: kendala.id,
  task_log_id: kendala.task_log_id,
  deskripsi: kendala.deskripsi,
  status: kendala.status,
};

async function getKendala(id: number): Promise<KendalaRow | undefined> {
  return db.select(kendalaColumns).from(kendala).where(eq(kendala.id, id)).get();
}

async function getTaskLog(taskLogId: number): Promise<{ userId: number; jenis: string } | undefined> {
  return db
    .select({ userId: taskLogs.user_id, jenis: taskLogs.jenis })
    .from(taskLogs)
    .where(eq(taskLogs.id, taskLogId))
    .get();
}

// Otorisasi kendala = kepemilikan task_log (ADR-0015), bukan keanggotaan project — user yang
// sudah keluar dari project tetap boleh mengelola kendala di histori laporannya sendiri.
async function getKendalaOwner(kendalaId: number): Promise<number | null> {
  const row = await db
    .select({ userId: taskLogs.user_id })
    .from(kendala)
    .innerJoin(taskLogs, eq(taskLogs.id, kendala.task_log_id))
    .where(eq(kendala.id, kendalaId))
    .get();
  return row?.userId ?? null;
}

const createSchema = z.object({
  taskLogId: z.number().int().positive(),
  deskripsi: z.string().min(1, "Deskripsi kendala wajib diisi."),
});

// Kendala cuma untuk log realisasi (ADR-0015) — muncul saat mengerjakan, bukan saat merencanakan.
export async function handleCreateKendala(req: Request): Promise<Response> {
  const ctx = await requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Data tidak valid.");

  const taskLog = await getTaskLog(parsed.data.taskLogId);
  if (!taskLog) return errorResponse(404, "Log tidak ditemukan.");
  if (taskLog.userId !== ctx.user.id) return errorResponse(403, "Bukan pembuat log ini.");
  if (taskLog.jenis !== "realisasi") return errorResponse(400, "Kendala hanya untuk log realisasi.");

  const [row] = await db
    .insert(kendala)
    .values({ task_log_id: parsed.data.taskLogId, deskripsi: parsed.data.deskripsi.trim() })
    .returning(kendalaColumns);
  return json({ kendala: publicKendala(row!) }, { status: 201 });
}

// Resolve satu arah (tidak ada reopen, YAGNI, konsisten ADR-0045) dan boleh kapan saja, tidak
// terikat jendela edit bulan berjalan (ADR-0009) — cuma ubah status, bukan isi laporan historis.
export async function handleResolveKendala(req: Request, id: number): Promise<Response> {
  const ctx = await requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const ownerId = await getKendalaOwner(id);
  if (ownerId === null) return errorResponse(404, "Kendala tidak ditemukan.");
  if (ownerId !== ctx.user.id) return errorResponse(403, "Bukan pembuat log ini.");

  const existing = (await getKendala(id))!;
  if (existing.status === "resolved") return errorResponse(409, "Kendala sudah resolved.");

  await db.update(kendala).set({ status: "resolved" }).where(eq(kendala.id, id));
  return json({ kendala: publicKendala((await getKendala(id))!) });
}

export async function handleDeleteKendala(req: Request, id: number): Promise<Response> {
  const ctx = await requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const ownerId = await getKendalaOwner(id);
  if (ownerId === null) return errorResponse(404, "Kendala tidak ditemukan.");
  if (ownerId !== ctx.user.id) return errorResponse(403, "Bukan pembuat log ini.");

  await db.delete(kendala).where(eq(kendala.id, id));
  return new Response(null, { status: 204 });
}

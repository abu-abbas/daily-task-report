import { requireLogin } from "../authz";
import { z } from "zod/v4";
import { db } from "../db";
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

function getKendala(id: number): KendalaRow | null {
  return db.query<KendalaRow, [number]>("SELECT id, task_log_id, deskripsi, status FROM kendala WHERE id = ?").get(id);
}

function getTaskLog(taskLogId: number): { userId: number; jenis: string } | null {
  return db
    .query<{ userId: number; jenis: string }, [number]>(
      "SELECT user_id AS userId, jenis FROM task_logs WHERE id = ?",
    )
    .get(taskLogId);
}

// Otorisasi kendala = kepemilikan task_log (ADR-0015), bukan keanggotaan project — user yang
// sudah keluar dari project tetap boleh mengelola kendala di histori laporannya sendiri.
function getKendalaOwner(kendalaId: number): number | null {
  const row = db
    .query<{ userId: number }, [number]>(
      "SELECT tl.user_id AS userId FROM kendala k JOIN task_logs tl ON tl.id = k.task_log_id WHERE k.id = ?",
    )
    .get(kendalaId);
  return row?.userId ?? null;
}

const createSchema = z.object({
  taskLogId: z.number().int().positive(),
  deskripsi: z.string().min(1, "Deskripsi kendala wajib diisi."),
});

// Kendala cuma untuk log realisasi (ADR-0015) — muncul saat mengerjakan, bukan saat merencanakan.
export async function handleCreateKendala(req: Request): Promise<Response> {
  const ctx = requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Data tidak valid.");

  const taskLog = getTaskLog(parsed.data.taskLogId);
  if (!taskLog) return errorResponse(404, "Log tidak ditemukan.");
  if (taskLog.userId !== ctx.user.id) return errorResponse(403, "Bukan pembuat log ini.");
  if (taskLog.jenis !== "realisasi") return errorResponse(400, "Kendala hanya untuk log realisasi.");

  const result = db
    .query("INSERT INTO kendala (task_log_id, deskripsi) VALUES (?, ?)")
    .run(parsed.data.taskLogId, parsed.data.deskripsi.trim());
  const row = getKendala(Number(result.lastInsertRowid))!;
  return json({ kendala: publicKendala(row) }, { status: 201 });
}

// Resolve satu arah (tidak ada reopen, YAGNI, konsisten ADR-0045) dan boleh kapan saja, tidak
// terikat jendela edit bulan berjalan (ADR-0009) — cuma ubah status, bukan isi laporan historis.
export async function handleResolveKendala(req: Request, id: number): Promise<Response> {
  const ctx = requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const ownerId = getKendalaOwner(id);
  if (ownerId === null) return errorResponse(404, "Kendala tidak ditemukan.");
  if (ownerId !== ctx.user.id) return errorResponse(403, "Bukan pembuat log ini.");

  const existing = getKendala(id)!;
  if (existing.status === "resolved") return errorResponse(409, "Kendala sudah resolved.");

  db.query("UPDATE kendala SET status = 'resolved' WHERE id = ?").run(id);
  return json({ kendala: publicKendala(getKendala(id)!) });
}

export async function handleDeleteKendala(req: Request, id: number): Promise<Response> {
  const ctx = requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const ownerId = getKendalaOwner(id);
  if (ownerId === null) return errorResponse(404, "Kendala tidak ditemukan.");
  if (ownerId !== ctx.user.id) return errorResponse(403, "Bukan pembuat log ini.");

  db.query("DELETE FROM kendala WHERE id = ?").run(id);
  return new Response(null, { status: 204 });
}

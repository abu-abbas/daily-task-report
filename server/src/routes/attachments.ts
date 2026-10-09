import { requireLogin } from "../authz";
import { db } from "../db";
import { errorResponse, json } from "../http";
import {
  absoluteAttachmentPath,
  deleteAttachmentFile,
  detectImageExt,
  extToMime,
  saveAttachmentFile,
} from "../storage";

const MAX_FILES_PER_LOG = 5;
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

interface AttachmentRow {
  id: number;
  file_path: string;
  file_type: string | null;
  nama_asli: string;
  ukuran_bytes: number;
  uploaded_at: string;
}

function publicAttachment(row: AttachmentRow) {
  return {
    id: row.id,
    namaAsli: row.nama_asli,
    fileType: row.file_type,
    ukuranBytes: row.ukuran_bytes,
    uploadedAt: row.uploaded_at,
  };
}

function getAttachment(id: number): AttachmentRow | null {
  return db
    .query<AttachmentRow, [number]>(
      "SELECT id, file_path, file_type, nama_asli, ukuran_bytes, uploaded_at FROM attachments WHERE id = ?",
    )
    .get(id);
}

function getTaskLog(id: number): { userId: number; jenis: string; tanggal: string } | null {
  return db
    .query<{ userId: number; jenis: string; tanggal: string }, [number]>(
      "SELECT user_id AS userId, jenis, tanggal FROM task_logs WHERE id = ?",
    )
    .get(id);
}

function countAttachments(taskLogId: number): number {
  const row = db
    .query<{ c: number }, [number]>(
      "SELECT COUNT(*) AS c FROM attachments WHERE attachable_type = 'task_log' AND attachable_id = ?",
    )
    .get(taskLogId)!;
  return row.c;
}

// Otorisasi kendala = kepemilikan task_log (ADR-0016, sama pola ADR-0015), bukan keanggotaan
// project — user yang sudah keluar dari project tetap boleh kelola lampiran di histori sendiri.
function getAttachmentOwner(attachmentId: number): number | null {
  const row = db
    .query<{ userId: number }, [number]>(
      `SELECT tl.user_id AS userId FROM attachments a
       JOIN task_logs tl ON tl.id = a.attachable_id AND a.attachable_type = 'task_log'
       WHERE a.id = ?`,
    )
    .get(attachmentId);
  return row?.userId ?? null;
}

// Lampiran cuma untuk log realisasi (ADR-0016, konsisten scope kendala) — bukti kerja yang
// sudah dilakukan, bukan sesuatu yang nempel ke rencana yang belum dikerjakan. Boleh diunggah
// kapan saja, tidak terikat jendela edit bulan berjalan (sama alasan resolve kendala).
export async function handleUploadAttachment(req: Request): Promise<Response> {
  const ctx = requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const form = await req.formData().catch(() => null);
  if (!form) return errorResponse(400, "Data tidak valid.");

  const taskLogIdRaw = form.get("taskLogId");
  const file = form.get("file");
  const taskLogId = Number(taskLogIdRaw);
  if (!taskLogIdRaw || !Number.isInteger(taskLogId) || taskLogId <= 0) {
    return errorResponse(400, "taskLogId wajib diisi.");
  }
  if (!(file instanceof File)) return errorResponse(400, "File wajib diunggah.");

  const taskLog = getTaskLog(taskLogId);
  if (!taskLog) return errorResponse(404, "Log tidak ditemukan.");
  if (taskLog.userId !== ctx.user.id) return errorResponse(403, "Bukan pembuat log ini.");
  if (taskLog.jenis !== "realisasi") return errorResponse(400, "Lampiran hanya untuk log realisasi.");

  if (countAttachments(taskLogId) >= MAX_FILES_PER_LOG) {
    return errorResponse(400, `Maksimal ${MAX_FILES_PER_LOG} lampiran per log.`);
  }
  if (file.size > MAX_SIZE_BYTES) {
    return errorResponse(400, "Ukuran file maksimal 5 MB.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = detectImageExt(bytes);
  if (!ext) return errorResponse(400, "Hanya file JPG/PNG yang diizinkan.");

  const filePath = await saveAttachmentFile(taskLog.tanggal, taskLogId, bytes, ext);

  const result = db
    .query(
      `INSERT INTO attachments (attachable_type, attachable_id, file_path, file_type, nama_asli, ukuran_bytes, uploaded_by)
       VALUES ('task_log', ?, ?, ?, ?, ?, ?)`,
    )
    .run(taskLogId, filePath, extToMime(ext), file.name, bytes.length, ctx.user.id);

  const row = getAttachment(Number(result.lastInsertRowid))!;
  return json({ attachment: publicAttachment(row) }, { status: 201 });
}

export async function handleDeleteAttachment(req: Request, id: number): Promise<Response> {
  const ctx = requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const ownerId = getAttachmentOwner(id);
  if (ownerId === null) return errorResponse(404, "Lampiran tidak ditemukan.");
  if (ownerId !== ctx.user.id) return errorResponse(403, "Bukan pembuat log ini.");

  const row = getAttachment(id)!;
  deleteAttachmentFile(row.file_path);
  db.query("DELETE FROM attachments WHERE id = ?").run(id);
  return new Response(null, { status: 204 });
}

export async function handleGetAttachmentFile(req: Request, id: number): Promise<Response> {
  const ctx = requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const ownerId = getAttachmentOwner(id);
  if (ownerId === null) return errorResponse(404, "Lampiran tidak ditemukan.");
  if (ownerId !== ctx.user.id) return errorResponse(403, "Bukan pembuat log ini.");

  const row = getAttachment(id)!;
  const bunFile = Bun.file(absoluteAttachmentPath(row.file_path));
  if (!(await bunFile.exists())) return errorResponse(404, "File tidak ditemukan di disk.");

  return new Response(bunFile, {
    headers: {
      "Content-Type": row.file_type ?? "application/octet-stream",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(row.nama_asli)}`,
    },
  });
}

// Dipakai task-logs.ts saat efek-uncheck menghapus task_logs — attachments itu polymorphic
// (attachable_type/attachable_id generik), BUKAN FK sungguhan seperti kendala, jadi tidak
// auto-cascade dan harus dibersihkan manual di sini supaya tidak jadi file/baris yatim.
export function deleteAttachmentsByTaskLogIds(taskLogIds: number[]): void {
  if (taskLogIds.length === 0) return;
  const placeholders = taskLogIds.map(() => "?").join(",");
  const rows = db
    .query<{ filePath: string }, number[]>(
      `SELECT file_path AS filePath FROM attachments WHERE attachable_type = 'task_log' AND attachable_id IN (${placeholders})`,
    )
    .all(...taskLogIds);
  for (const row of rows) deleteAttachmentFile(row.filePath);
  db.query(
    `DELETE FROM attachments WHERE attachable_type = 'task_log' AND attachable_id IN (${placeholders})`,
  ).run(...taskLogIds);
}

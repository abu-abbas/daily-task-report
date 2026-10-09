import { requireLogin } from "../authz";
import { and, count, eq, inArray } from "drizzle-orm";
import { db, type Tx, first } from "../db";
import { attachments, taskLogs } from "../schema";
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

const attachmentColumns = {
  id: attachments.id,
  file_path: attachments.file_path,
  file_type: attachments.file_type,
  nama_asli: attachments.nama_asli,
  ukuran_bytes: attachments.ukuran_bytes,
  uploaded_at: attachments.uploaded_at,
};

// attachments polymorphic (attachable_type/attachable_id); semua lampiran saat ini milik task_log.
const milikTaskLog = eq(attachments.attachable_type, "task_log");

async function getAttachment(id: number): Promise<AttachmentRow | undefined> {
  return db.select(attachmentColumns).from(attachments).where(eq(attachments.id, id)).then(first);
}

async function getTaskLog(id: number): Promise<{ userId: number; jenis: string; tanggal: string } | undefined> {
  return db
    .select({ userId: taskLogs.user_id, jenis: taskLogs.jenis, tanggal: taskLogs.tanggal })
    .from(taskLogs)
    .where(eq(taskLogs.id, id))
    .then(first);
}

async function countAttachments(taskLogId: number): Promise<number> {
  const row = await db
    .select({ c: count() })
    .from(attachments)
    .where(and(milikTaskLog, eq(attachments.attachable_id, taskLogId)))
    .then(first);
  return row?.c ?? 0;
}

// Otorisasi kendala = kepemilikan task_log (ADR-0016, sama pola ADR-0015), bukan keanggotaan
// project — user yang sudah keluar dari project tetap boleh kelola lampiran di histori sendiri.
async function getAttachmentOwner(attachmentId: number): Promise<number | null> {
  const row = await db
    .select({ userId: taskLogs.user_id })
    .from(attachments)
    .innerJoin(taskLogs, and(eq(taskLogs.id, attachments.attachable_id), milikTaskLog))
    .where(eq(attachments.id, attachmentId))
    .then(first);
  return row?.userId ?? null;
}

// Lampiran cuma untuk log realisasi (ADR-0016, konsisten scope kendala) — bukti kerja yang
// sudah dilakukan, bukan sesuatu yang nempel ke rencana yang belum dikerjakan. Boleh diunggah
// kapan saja, tidak terikat jendela edit bulan berjalan (sama alasan resolve kendala).
export async function handleUploadAttachment(req: Request): Promise<Response> {
  const ctx = await requireLogin(req);
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

  const taskLog = await getTaskLog(taskLogId);
  if (!taskLog) return errorResponse(404, "Log tidak ditemukan.");
  if (taskLog.userId !== ctx.user.id) return errorResponse(403, "Bukan pembuat log ini.");
  if (taskLog.jenis !== "realisasi") return errorResponse(400, "Lampiran hanya untuk log realisasi.");

  if ((await countAttachments(taskLogId)) >= MAX_FILES_PER_LOG) {
    return errorResponse(400, `Maksimal ${MAX_FILES_PER_LOG} lampiran per log.`);
  }
  if (file.size > MAX_SIZE_BYTES) {
    return errorResponse(400, "Ukuran file maksimal 5 MB.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = detectImageExt(bytes);
  if (!ext) return errorResponse(400, "Hanya file JPG/PNG yang diizinkan.");

  const filePath = await saveAttachmentFile(taskLog.tanggal, taskLogId, bytes, ext);

  const [row] = await db
    .insert(attachments)
    .values({
      attachable_type: "task_log",
      attachable_id: taskLogId,
      file_path: filePath,
      file_type: extToMime(ext),
      nama_asli: file.name,
      ukuran_bytes: bytes.length,
      uploaded_by: ctx.user.id,
    })
    .returning(attachmentColumns);
  return json({ attachment: publicAttachment(row!) }, { status: 201 });
}

export async function handleDeleteAttachment(req: Request, id: number): Promise<Response> {
  const ctx = await requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const ownerId = await getAttachmentOwner(id);
  if (ownerId === null) return errorResponse(404, "Lampiran tidak ditemukan.");
  if (ownerId !== ctx.user.id) return errorResponse(403, "Bukan pembuat log ini.");

  const row = (await getAttachment(id))!;
  deleteAttachmentFile(row.file_path);
  await db.delete(attachments).where(eq(attachments.id, id));
  return new Response(null, { status: 204 });
}

export async function handleGetAttachmentFile(req: Request, id: number): Promise<Response> {
  const ctx = await requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const ownerId = await getAttachmentOwner(id);
  if (ownerId === null) return errorResponse(404, "Lampiran tidak ditemukan.");
  if (ownerId !== ctx.user.id) return errorResponse(403, "Bukan pembuat log ini.");

  const row = (await getAttachment(id))!;
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
// Dipanggil dari dalam transaksi simpan harian.
export async function deleteAttachmentsByTaskLogIds(tx: Tx, taskLogIds: number[]): Promise<void> {
  if (taskLogIds.length === 0) return;
  const where = and(milikTaskLog, inArray(attachments.attachable_id, taskLogIds));
  const rows = await tx.select({ filePath: attachments.file_path }).from(attachments).where(where);
  for (const row of rows) deleteAttachmentFile(row.filePath);
  await tx.delete(attachments).where(where);
}

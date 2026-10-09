import { requireLogin } from "../authz";
import { eq, sql } from "drizzle-orm";
import { db, first } from "../db";
import { laporanTemplate } from "../schema";
import { errorResponse, json } from "../http";
import {
  absoluteLaporanTemplatePath,
  deleteLaporanTemplateFile,
  isZipSignature,
  saveLaporanTemplateFile,
} from "../storage";

const MAX_SIZE_BYTES = 20 * 1024 * 1024;

interface LaporanTemplateRow {
  user_id: number;
  file_path: string;
  nama_asli: string;
  uploaded_at: string;
}

async function getRow(userId: number): Promise<LaporanTemplateRow | undefined> {
  return db.select().from(laporanTemplate).where(eq(laporanTemplate.user_id, userId)).then(first);
}

function publicRow(row: LaporanTemplateRow) {
  return { namaAsli: row.nama_asli, uploadedAt: row.uploaded_at };
}

// Metadata template milik sendiri (bukan isi file) — dipakai UI buat tahu sudah upload atau
// belum, sebelum menawarkan tombol "Unduh laporan (Word)".
export async function handleGetMyLaporanTemplate(req: Request): Promise<Response> {
  const ctx = await requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const row = await getRow(ctx.user.id);
  return json({ template: row ? publicRow(row) : null });
}

// Satu template per user, upload ulang menimpa yang lama (bukan riwayat) — cuma versi terbaru
// yang pernah dipakai untuk mail-merge (ADR-0019 revisi 2026-09-11).
export async function handleUploadLaporanTemplate(req: Request): Promise<Response> {
  const ctx = await requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const form = await req.formData().catch(() => null);
  if (!form) return errorResponse(400, "Data tidak valid.");

  const file = form.get("file");
  if (!(file instanceof File)) return errorResponse(400, "File wajib diunggah.");
  if (file.size > MAX_SIZE_BYTES) return errorResponse(400, "Ukuran file maksimal 20 MB.");
  if (!file.name.toLowerCase().endsWith(".docx")) return errorResponse(400, "Hanya file .docx yang diizinkan.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  // docx adalah file ZIP — sniff signature dulu (ADR-0016 pola sama untuk lampiran gambar),
  // validasi lebih dalam (docxtemplater bisa membukanya) dilakukan saat benar-benar generate
  // laporan, bukan di sini (supaya upload tetap cepat, tidak dobel parse tiap upload).
  if (!isZipSignature(bytes)) return errorResponse(400, "File bukan .docx yang valid.");

  const existing = await getRow(ctx.user.id);
  const filePath = await saveLaporanTemplateFile(ctx.user.id, bytes);

  if (existing) {
    await db
      .update(laporanTemplate)
      .set({ file_path: filePath, nama_asli: file.name, uploaded_at: sql`CURRENT_TIMESTAMP` })
      .where(eq(laporanTemplate.user_id, ctx.user.id));
    // File baru sudah berhasil ditulis (nama unik per upload) — baru sekarang hapus file lama,
    // supaya kalau penulisan file baru gagal di tengah jalan, file lama yang masih berfungsi
    // tidak ikut hilang.
    if (existing.file_path !== filePath) deleteLaporanTemplateFile(existing.file_path);
  } else {
    await db.insert(laporanTemplate).values({ user_id: ctx.user.id, file_path: filePath, nama_asli: file.name });
  }

  return json({ template: publicRow((await getRow(ctx.user.id))!) }, { status: 201 });
}

export async function handleDeleteLaporanTemplate(req: Request): Promise<Response> {
  const ctx = await requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const row = await getRow(ctx.user.id);
  if (!row) return errorResponse(404, "Belum ada template.");

  deleteLaporanTemplateFile(row.file_path);
  await db.delete(laporanTemplate).where(eq(laporanTemplate.user_id, ctx.user.id));
  return new Response(null, { status: 204 });
}

// Dipakai reports.ts saat generate laporan Word — bytes template dibaca dari disk cuma saat
// benar-benar dibutuhkan (bukan disimpan di memori), sama pola attachment.
export async function getLaporanTemplatePath(userId: number): Promise<string | null> {
  const row = await getRow(userId);
  return row ? absoluteLaporanTemplatePath(row.file_path) : null;
}

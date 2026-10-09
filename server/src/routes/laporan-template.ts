import { requireLogin } from "../authz";
import { db } from "../db";
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

function getRow(userId: number): LaporanTemplateRow | null {
  return db.query<LaporanTemplateRow, [number]>("SELECT * FROM laporan_template WHERE user_id = ?").get(userId);
}

function publicRow(row: LaporanTemplateRow) {
  return { namaAsli: row.nama_asli, uploadedAt: row.uploaded_at };
}

// Metadata template milik sendiri (bukan isi file) — dipakai UI buat tahu sudah upload atau
// belum, sebelum menawarkan tombol "Unduh laporan (Word)".
export function handleGetMyLaporanTemplate(req: Request): Response {
  const ctx = requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const row = getRow(ctx.user.id);
  return json({ template: row ? publicRow(row) : null });
}

// Satu template per user, upload ulang menimpa yang lama (bukan riwayat) — cuma versi terbaru
// yang pernah dipakai untuk mail-merge (ADR-0019 revisi 2026-09-11).
export async function handleUploadLaporanTemplate(req: Request): Promise<Response> {
  const ctx = requireLogin(req);
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

  const existing = getRow(ctx.user.id);
  const filePath = await saveLaporanTemplateFile(ctx.user.id, bytes);

  if (existing) {
    db.query("UPDATE laporan_template SET file_path = ?, nama_asli = ?, uploaded_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(
      filePath,
      file.name,
      ctx.user.id,
    );
    // File baru sudah berhasil ditulis (nama unik per upload) — baru sekarang hapus file lama,
    // supaya kalau penulisan file baru gagal di tengah jalan, file lama yang masih berfungsi
    // tidak ikut hilang.
    if (existing.file_path !== filePath) deleteLaporanTemplateFile(existing.file_path);
  } else {
    db.query("INSERT INTO laporan_template (user_id, file_path, nama_asli) VALUES (?, ?, ?)").run(
      ctx.user.id,
      filePath,
      file.name,
    );
  }

  return json({ template: publicRow(getRow(ctx.user.id)!) }, { status: 201 });
}

export async function handleDeleteLaporanTemplate(req: Request): Promise<Response> {
  const ctx = requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const row = getRow(ctx.user.id);
  if (!row) return errorResponse(404, "Belum ada template.");

  deleteLaporanTemplateFile(row.file_path);
  db.query("DELETE FROM laporan_template WHERE user_id = ?").run(ctx.user.id);
  return new Response(null, { status: 204 });
}

// Dipakai reports.ts saat generate laporan Word — bytes template dibaca dari disk cuma saat
// benar-benar dibutuhkan (bukan disimpan di memori), sama pola attachment.
export function getLaporanTemplatePath(userId: number): string | null {
  const row = getRow(userId);
  return row ? absoluteLaporanTemplatePath(row.file_path) : null;
}

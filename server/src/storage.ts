import { mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { storageDir } from "./db";

const attachmentsRoot = join(storageDir, "attachments");

// YYYY/MM/DD dari tanggal LAPORAN (task_logs.tanggal), bukan waktu upload sungguhan — konsisten
// dengan cara app ini selalu berpikir soal tanggal bisnis (ADR-0032), bukan timestamp teknis.
function pathSegments(tanggal: string, taskLogId: number): string[] {
  const [yyyy, mm, dd] = tanggal.split("-");
  return [yyyy, mm, dd, String(taskLogId)];
}

// Return path RELATIF terhadap storageDir (disimpan di attachments.file_path) — bukan absolut,
// supaya seluruh folder data/ (db + attachment) tetap portable saat backup/restore (ADR-0020).
export async function saveAttachmentFile(
  tanggal: string,
  taskLogId: number,
  bytes: Uint8Array,
  ext: "jpg" | "png",
): Promise<string> {
  const segs = pathSegments(tanggal, taskLogId);
  const dir = join(attachmentsRoot, ...segs);
  mkdirSync(dir, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  await Bun.write(join(dir, filename), bytes);
  return join("attachments", ...segs, filename);
}

export function deleteAttachmentFile(relativePath: string): void {
  try {
    unlinkSync(join(storageDir, relativePath));
  } catch {
    // Sudah tidak ada di disk — abaikan, tetap lanjut hapus baris DB-nya.
  }
}

export function absoluteAttachmentPath(relativePath: string): string {
  return join(storageDir, relativePath);
}

// Sniff signature asli file, JANGAN percaya file.type dari klien (ADR-0016: validasi isi/jenis
// file di server, bukan cuma ekstensi/MIME yang diklaim).
export function detectImageExt(bytes: Uint8Array): "jpg" | "png" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  return null;
}

export function extToMime(ext: "jpg" | "png"): string {
  return ext === "jpg" ? "image/jpeg" : "image/png";
}

import { db } from "../db";
import { errorResponse, json } from "../http";
import { getAuthContext, parseCookie, SESSION_COOKIE } from "../auth";
import { dalamBulanBerjalan, todayJakarta } from "../kalender";
import { attachmentsByTaskLogId, kendalaByTaskLogId } from "./task-logs";

const TANGGAL_RE = /^\d{4}-\d{2}-\d{2}$/;

interface RiwayatLogRow {
  taskLogId: number;
  taskId: number;
  deskripsi: string;
  tag: string | null;
  taskStatus: "open" | "closed";
  projectId: number;
  projectNama: string;
  jenis: "realisasi" | "rencana";
  isExtra: number;
  catatan: string | null;
}

// 12 bulan kalender penuh berakhir hari ini, dipangkas ke tanggal 1 supaya label bulan di
// heatmap rapi (tidak potong di tengah bulan) — dihitung dari hari ini SUNGGUHAN di server,
// bukan input klien, sama alasan dalamBulanBerjalan menghitung sendiri dari todayJakarta().
function rentangHeatmap(hariIni: string): { dari: string; sampai: string } {
  const [y, m] = hariIni.split("-").map(Number);
  const mulai = new Date(Date.UTC(y, m - 1 - 11, 1));
  const dari = `${mulai.getUTCFullYear()}-${String(mulai.getUTCMonth() + 1).padStart(2, "0")}-01`;
  return { dari, sampai: hariIni };
}

// Heatmap aktivitas (gaya GitHub) — warna kotak murni dari jumlah log REALISASI per tanggal
// (bukan rencana, bukan izin, ADR-0034 tetap baca-sendiri tanpa batas bulan). Dipakai
// RiwayatView.vue sebagai satu-satunya ringkasan; klik kotak baru fetch detail lewat
// handleGetRiwayatDetail di bawah.
export function handleGetActivityHeatmap(req: Request, hariIniOverride?: string): Response {
  const token = parseCookie(req.headers.get("Cookie"), SESSION_COOKIE);
  const ctx = getAuthContext(token);
  if (!ctx) return errorResponse(401, "Belum login.");

  const url = new URL(req.url);
  const projectIdParam = url.searchParams.get("projectId");
  const projectId = projectIdParam ? Number(projectIdParam) : null;

  const { dari, sampai } = rentangHeatmap(hariIniOverride ?? todayJakarta());

  const rows = db
    .query<{ tanggal: string; c: number }, (number | string)[]>(
      `SELECT tl.tanggal, COUNT(*) AS c FROM task_logs tl
       JOIN tasks t ON t.id = tl.task_id
       WHERE tl.user_id = ? AND tl.jenis = 'realisasi' AND tl.tanggal >= ? AND tl.tanggal <= ?
       ${projectId ? "AND t.project_id = ?" : ""}
       GROUP BY tl.tanggal`,
    )
    .all(...(projectId ? [ctx.user.id, dari, sampai, projectId] : [ctx.user.id, dari, sampai]));

  const hari = rows.map((r) => ({ tanggal: r.tanggal, realisasiCount: r.c }));

  return json({ dari, sampai, hari });
}

export function handleGetRiwayatDetail(req: Request, tanggal: string, hariIniOverride?: string): Response {
  const token = parseCookie(req.headers.get("Cookie"), SESSION_COOKIE);
  const ctx = getAuthContext(token);
  if (!ctx) return errorResponse(401, "Belum login.");

  if (!TANGGAL_RE.test(tanggal)) return errorResponse(400, "Format tanggal tidak valid.");

  const rows = db
    .query<RiwayatLogRow, [number, string]>(
      `SELECT tl.id AS taskLogId, tl.task_id AS taskId, t.deskripsi, t.tag, t.status AS taskStatus,
              t.project_id AS projectId, p.nama AS projectNama, tl.jenis, tl.is_extra AS isExtra, tl.catatan
       FROM task_logs tl
       JOIN tasks t ON t.id = tl.task_id
       JOIN projects p ON p.id = t.project_id
       WHERE tl.user_id = ? AND tl.tanggal = ?
       ORDER BY p.nama, t.deskripsi`,
    )
    .all(ctx.user.id, tanggal);

  const realisasiTaskLogIds = rows.filter((r) => r.jenis === "realisasi").map((r) => r.taskLogId);
  const kendalaMap = kendalaByTaskLogId(realisasiTaskLogIds);
  const attachmentMap = attachmentsByTaskLogId(realisasiTaskLogIds);

  const items = rows.map((r) => ({
    taskLogId: r.taskLogId,
    taskId: r.taskId,
    deskripsi: r.deskripsi,
    tag: r.tag,
    taskStatus: r.taskStatus,
    projectId: r.projectId,
    projectNama: r.projectNama,
    jenis: r.jenis,
    isExtra: r.isExtra === 1,
    catatan: r.catatan,
    kendala: kendalaMap.get(r.taskLogId) ?? [],
    attachments: attachmentMap.get(r.taskLogId) ?? [],
  }));

  const izin = db
    .query<{ jenis: "cuti" | "sakit" | "izin"; alasan: string | null }, [number, string]>(
      "SELECT jenis, alasan FROM leaves WHERE user_id = ? AND tanggal = ?",
    )
    .get(ctx.user.id, tanggal);

  const hariIni = hariIniOverride ?? todayJakarta();
  const bolehEdit = dalamBulanBerjalan(tanggal, hariIni);

  return json({ tanggal, bolehEdit, izin: izin ?? null, items });
}

import { db } from "../db";
import { errorResponse, json } from "../http";
import { getAuthContext, parseCookie, SESSION_COOKIE } from "../auth";
import { dalamBulanBerjalan, todayJakarta } from "../kalender";
import { attachmentsByTaskLogId, kendalaByTaskLogId } from "./task-logs";

const TANGGAL_RE = /^\d{4}-\d{2}-\d{2}$/;
const BULAN_RE = /^\d{4}-\d{2}$/;

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

// ADR-0034: tenaga ahli boleh baca histori laporannya sendiri kapan saja — beda dari Input
// Harian, endpoint ini TIDAK menerapkan dalamBulanBerjalan sebagai gate baca (cuma dipakai
// buat menentukan apakah tautan "Edit" ditampilkan di detail). Cakupan putaran ini: baca punya
// sendiri saja, akses supervisi/atasan lihat riwayat bawahan belum diimplementasikan.
export function handleListRiwayat(req: Request): Response {
  const token = parseCookie(req.headers.get("Cookie"), SESSION_COOKIE);
  const ctx = getAuthContext(token);
  if (!ctx) return errorResponse(401, "Belum login.");

  const url = new URL(req.url);
  const bulan = url.searchParams.get("bulan");
  if (!bulan || !BULAN_RE.test(bulan)) return errorResponse(400, "Format bulan tidak valid (YYYY-MM).");
  const projectIdParam = url.searchParams.get("projectId");
  const projectId = projectIdParam ? Number(projectIdParam) : null;

  const logRows = db
    .query<{ tanggal: string; jenis: "realisasi" | "rencana" }, (number | string)[]>(
      `SELECT tl.tanggal, tl.jenis FROM task_logs tl
       JOIN tasks t ON t.id = tl.task_id
       WHERE tl.user_id = ? AND tl.tanggal LIKE ? || '%'
       ${projectId ? "AND t.project_id = ?" : ""}`,
    )
    .all(...(projectId ? [ctx.user.id, bulan, projectId] : [ctx.user.id, bulan]));

  const izinRows = db
    .query<{ tanggal: string; jenis: "cuti" | "sakit" | "izin" }, [number, string]>(
      "SELECT tanggal, jenis FROM leaves WHERE user_id = ? AND tanggal LIKE ? || '%'",
    )
    .all(ctx.user.id, bulan);

  const hariMap = new Map<string, { realisasiCount: number; rencanaCount: number }>();
  for (const row of logRows) {
    const entry = hariMap.get(row.tanggal) ?? { realisasiCount: 0, rencanaCount: 0 };
    if (row.jenis === "realisasi") entry.realisasiCount += 1;
    else entry.rencanaCount += 1;
    hariMap.set(row.tanggal, entry);
  }

  const izinMap = new Map(izinRows.map((r) => [r.tanggal, r.jenis]));
  // Tanggal izin SELALU muncul walau projectId difilter — izin bukan spesifik project.
  for (const tanggal of izinMap.keys()) {
    if (!hariMap.has(tanggal)) hariMap.set(tanggal, { realisasiCount: 0, rencanaCount: 0 });
  }

  const hari = [...hariMap.entries()]
    .map(([tanggal, count]) => ({
      tanggal,
      realisasiCount: count.realisasiCount,
      rencanaCount: count.rencanaCount,
      izin: izinMap.has(tanggal) ? { jenis: izinMap.get(tanggal)! } : null,
    }))
    .sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));

  return json({ bulan, hari });
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

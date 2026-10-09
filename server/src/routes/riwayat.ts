import { requireLogin } from "../authz";
import { db } from "../db";
import { errorResponse, json } from "../http";
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
// bukan input klien, sama alasan dalamBulanBerjalan menghitung sendiri dari todayJakarta(). Query
// tetap ringan di rentang ini — cuma filter user_id+tanggal (index idx_task_logs_user_tanggal)
// lalu GROUP BY, bukan full scan. Grid-nya biasanya lebih lebar dari lebar konten default
// (max-w-3xl) — ActivityHeatmap.vue auto-scroll ke bulan terbaru, bukan dipendekkan rentangnya.
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
  const ctx = requireLogin(req);
  if (ctx instanceof Response) return ctx;

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

interface ActivityLogRow {
  taskLogId: number;
  tanggal: string;
  deskripsi: string;
  tag: string | null;
  projectNama: string;
}

const LOG_PAGE_SIZE = 20;

// Cursor "tanggal|taskLogId" — bukan offset, supaya insert/hapus log di tengah pemuatan tidak
// menggeser halaman berikutnya (ADR-0041 identitas item pun sama alasannya hindari offset).
function parseCursor(cursor: string | null): { tanggal: string; taskLogId: number } | null {
  if (!cursor) return null;
  const idx = cursor.lastIndexOf("|");
  if (idx === -1) return null;
  const tanggal = cursor.slice(0, idx);
  const taskLogId = Number(cursor.slice(idx + 1));
  if (!TANGGAL_RE.test(tanggal) || !Number.isInteger(taskLogId)) return null;
  return { tanggal, taskLogId };
}

// Batas aman satu tanggal — realistis tidak akan pernah sebanyak ini dalam sehari, cuma jaga-jaga
// dari LIMIT tanpa batas kalau data testing/nyangkut aneh.
const TANGGAL_FILTER_LIMIT = 200;

// Daftar realisasi, terbuka dua mode lewat query string:
// - tanpa `tanggal`: lintas waktu (tidak dibatasi rentang heatmap), terbaru dulu, dipaginasi lazy
//   (cursor) — feed utama di bawah heatmap.
// - dengan `tanggal`: heatmap diklik untuk memfilter feed ke satu tanggal itu saja (bukan buka
//   Dialog langsung — hindari dua jalur "lihat detail" yang tumpang tindih); tidak dipaginasi,
//   `cursor` diabaikan kalau `tanggal` ada.
export function handleListActivityLog(req: Request): Response {
  const ctx = requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const projectIdParam = url.searchParams.get("projectId");
  const projectId = projectIdParam ? Number(projectIdParam) : null;
  const tanggalFilter = url.searchParams.get("tanggal");
  if (tanggalFilter && !TANGGAL_RE.test(tanggalFilter)) {
    return errorResponse(400, "Format tanggal tidak valid.");
  }
  const cursor = tanggalFilter ? null : parseCursor(url.searchParams.get("cursor"));

  const params: (number | string)[] = [ctx.user.id];
  let where = "tl.user_id = ? AND tl.jenis = 'realisasi'";
  if (projectId) {
    where += " AND t.project_id = ?";
    params.push(projectId);
  }
  if (tanggalFilter) {
    where += " AND tl.tanggal = ?";
    params.push(tanggalFilter);
  } else if (cursor) {
    where += " AND (tl.tanggal < ? OR (tl.tanggal = ? AND tl.id < ?))";
    params.push(cursor.tanggal, cursor.tanggal, cursor.taskLogId);
  }
  const limit = tanggalFilter ? TANGGAL_FILTER_LIMIT : LOG_PAGE_SIZE + 1;
  params.push(limit);

  const rows = db
    .query<ActivityLogRow, (number | string)[]>(
      `SELECT tl.id AS taskLogId, tl.tanggal, t.deskripsi, t.tag, p.nama AS projectNama
       FROM task_logs tl
       JOIN tasks t ON t.id = tl.task_id
       JOIN projects p ON p.id = t.project_id
       WHERE ${where}
       ORDER BY tl.tanggal DESC, tl.id DESC
       LIMIT ?`,
    )
    .all(...params);

  if (tanggalFilter) return json({ items: rows, nextCursor: null });

  const hasMore = rows.length > LOG_PAGE_SIZE;
  const items = hasMore ? rows.slice(0, LOG_PAGE_SIZE) : rows;
  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? `${last.tanggal}|${last.taskLogId}` : null;

  return json({ items, nextCursor });
}

export function handleGetRiwayatDetail(req: Request, tanggal: string, hariIniOverride?: string): Response {
  const ctx = requireLogin(req);
  if (ctx instanceof Response) return ctx;

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

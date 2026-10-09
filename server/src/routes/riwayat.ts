import { requireLogin } from "../authz";
import { and, asc, count, desc, eq, gte, lt, lte, or } from "drizzle-orm";
import { db } from "../db";
import { leaves, projects, taskLogs, tasks } from "../schema";
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
export async function handleGetActivityHeatmap(req: Request, hariIniOverride?: string): Promise<Response> {
  const ctx = await requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const projectIdParam = url.searchParams.get("projectId");
  const projectId = projectIdParam ? Number(projectIdParam) : null;

  const { dari, sampai } = rentangHeatmap(hariIniOverride ?? todayJakarta());

  const rows = await db
    .select({ tanggal: taskLogs.tanggal, c: count() })
    .from(taskLogs)
    .innerJoin(tasks, eq(tasks.id, taskLogs.task_id))
    .where(
      and(
        eq(taskLogs.user_id, ctx.user.id),
        eq(taskLogs.jenis, "realisasi"),
        gte(taskLogs.tanggal, dari),
        lte(taskLogs.tanggal, sampai),
        projectId ? eq(tasks.project_id, projectId) : undefined,
      ),
    )
    .groupBy(taskLogs.tanggal);

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
export async function handleListActivityLog(req: Request): Promise<Response> {
  const ctx = await requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const projectIdParam = url.searchParams.get("projectId");
  const projectId = projectIdParam ? Number(projectIdParam) : null;
  const tanggalFilter = url.searchParams.get("tanggal");
  if (tanggalFilter && !TANGGAL_RE.test(tanggalFilter)) {
    return errorResponse(400, "Format tanggal tidak valid.");
  }
  const cursor = tanggalFilter ? null : parseCursor(url.searchParams.get("cursor"));

  const limit = tanggalFilter ? TANGGAL_FILTER_LIMIT : LOG_PAGE_SIZE + 1;

  const rows: ActivityLogRow[] = await db
    .select({
      taskLogId: taskLogs.id,
      tanggal: taskLogs.tanggal,
      deskripsi: tasks.deskripsi,
      tag: tasks.tag,
      projectNama: projects.nama,
    })
    .from(taskLogs)
    .innerJoin(tasks, eq(tasks.id, taskLogs.task_id))
    .innerJoin(projects, eq(projects.id, tasks.project_id))
    .where(
      and(
        eq(taskLogs.user_id, ctx.user.id),
        eq(taskLogs.jenis, "realisasi"),
        projectId ? eq(tasks.project_id, projectId) : undefined,
        tanggalFilter ? eq(taskLogs.tanggal, tanggalFilter) : undefined,
        !tanggalFilter && cursor
          ? or(
              lt(taskLogs.tanggal, cursor.tanggal),
              and(eq(taskLogs.tanggal, cursor.tanggal), lt(taskLogs.id, cursor.taskLogId)),
            )
          : undefined,
      ),
    )
    .orderBy(desc(taskLogs.tanggal), desc(taskLogs.id))
    .limit(limit);

  if (tanggalFilter) return json({ items: rows, nextCursor: null });

  const hasMore = rows.length > LOG_PAGE_SIZE;
  const items = hasMore ? rows.slice(0, LOG_PAGE_SIZE) : rows;
  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? `${last.tanggal}|${last.taskLogId}` : null;

  return json({ items, nextCursor });
}

export async function handleGetRiwayatDetail(
  req: Request,
  tanggal: string,
  hariIniOverride?: string,
): Promise<Response> {
  const ctx = await requireLogin(req);
  if (ctx instanceof Response) return ctx;

  if (!TANGGAL_RE.test(tanggal)) return errorResponse(400, "Format tanggal tidak valid.");

  const rows: RiwayatLogRow[] = await db
    .select({
      taskLogId: taskLogs.id,
      taskId: taskLogs.task_id,
      deskripsi: tasks.deskripsi,
      tag: tasks.tag,
      taskStatus: tasks.status,
      projectId: tasks.project_id,
      projectNama: projects.nama,
      jenis: taskLogs.jenis,
      isExtra: taskLogs.is_extra,
      catatan: taskLogs.catatan,
    })
    .from(taskLogs)
    .innerJoin(tasks, eq(tasks.id, taskLogs.task_id))
    .innerJoin(projects, eq(projects.id, tasks.project_id))
    .where(and(eq(taskLogs.user_id, ctx.user.id), eq(taskLogs.tanggal, tanggal)))
    .orderBy(asc(projects.nama), asc(tasks.deskripsi));

  const realisasiTaskLogIds = rows.filter((r) => r.jenis === "realisasi").map((r) => r.taskLogId);
  const kendalaMap = await kendalaByTaskLogId(realisasiTaskLogIds);
  const attachmentMap = await attachmentsByTaskLogId(realisasiTaskLogIds);

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

  const izin = await db
    .select({ jenis: leaves.jenis, alasan: leaves.alasan })
    .from(leaves)
    .where(and(eq(leaves.user_id, ctx.user.id), eq(leaves.tanggal, tanggal)))
    .get();

  const hariIni = hariIniOverride ?? todayJakarta();
  const bolehEdit = dalamBulanBerjalan(tanggal, hariIni);

  return json({ tanggal, bolehEdit, izin: izin ?? null, items });
}

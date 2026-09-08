import { db } from "../db";
import { errorResponse } from "../http";
import { getAuthContext, parseCookie, SESSION_COOKIE } from "../auth";
import { isWorkday } from "../kalender";
import { absoluteAttachmentPath } from "../storage";
import { buildMonthlyReportPdf, catatanToLines, type ReportAktivitasRow, type ReportHari, type ReportLampiran, type ReportTask } from "../report-pdf";

const BULAN_RE = /^\d{4}-\d{2}$/;

const TANGGAL_LABEL_FMT = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
function tanggalLabel(tanggal: string): string {
  const [y, m, d] = tanggal.split("-").map(Number);
  return TANGGAL_LABEL_FMT.format(new Date(Date.UTC(y, m - 1, d)));
}

function daysInMonth(bulan: string): number {
  const [y, m] = bulan.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function slug(nama: string): string {
  return nama
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function taskLabel(deskripsi: string, tag: string | null): string {
  return tag ? `${tag}: ${deskripsi}` : deskripsi;
}

interface RealisasiRow {
  taskLogId: number;
  taskId: number;
  deskripsi: string;
  tag: string | null;
  taskStatus: "open" | "closed";
  projectNama: string;
  tanggal: string;
  catatan: string | null;
}

interface AttachmentRow {
  taskLogId: number;
  filePath: string;
  fileType: string | null;
}

// Cicilan awal Stage 7 (ADR-0019) — laporan PDF generik satu layout, tanpa template Word (itu
// masih menunggu Q-06). Cakupan diri-sendiri saja, sama seperti Riwayat.
export async function handleMonthlyReportPdf(req: Request): Promise<Response> {
  const token = parseCookie(req.headers.get("Cookie"), SESSION_COOKIE);
  const ctx = getAuthContext(token);
  if (!ctx) return errorResponse(401, "Belum login.");

  const url = new URL(req.url);
  const bulan = url.searchParams.get("bulan");
  if (!bulan || !BULAN_RE.test(bulan)) return errorResponse(400, "Format bulan tidak valid (YYYY-MM).");

  const rows = db
    .query<RealisasiRow, [number, string]>(
      `SELECT tl.id AS taskLogId, tl.task_id AS taskId, t.deskripsi, t.tag, t.status AS taskStatus,
              p.nama AS projectNama, tl.tanggal, tl.catatan
       FROM task_logs tl
       JOIN tasks t ON t.id = tl.task_id
       JOIN projects p ON p.id = t.project_id
       WHERE tl.user_id = ? AND tl.jenis = 'realisasi' AND tl.tanggal LIKE ? || '%'
       ORDER BY tl.tanggal ASC, t.id ASC`,
    )
    .all(ctx.user.id, bulan);

  // Nomor task tetap (dipakai ulang di timesheet dan tabel aktifitas) — urutan kemunculan
  // pertama pada bulan itu, bukan penomoran ulang per baris aktifitas.
  const taskNoMap = new Map<number, number>();
  const tasks: ReportTask[] = [];
  const taskDatesWorked = new Map<number, Set<string>>();
  for (const r of rows) {
    if (!taskNoMap.has(r.taskId)) {
      taskNoMap.set(r.taskId, tasks.length + 1);
      tasks.push({ taskId: r.taskId, no: taskNoMap.get(r.taskId)!, label: taskLabel(r.deskripsi, r.tag) });
    }
    const dates = taskDatesWorked.get(r.taskId) ?? new Set<string>();
    dates.add(r.tanggal);
    taskDatesWorked.set(r.taskId, dates);
  }

  const taskLogIds = rows.map((r) => r.taskLogId);
  const attachmentsByLog = new Map<number, AttachmentRow[]>();
  if (taskLogIds.length > 0) {
    const placeholders = taskLogIds.map(() => "?").join(",");
    const attachmentRows = db
      .query<AttachmentRow, number[]>(
        `SELECT attachable_id AS taskLogId, file_path AS filePath, file_type AS fileType
         FROM attachments WHERE attachable_type = 'task_log' AND attachable_id IN (${placeholders})
         ORDER BY id ASC`,
      )
      .all(...taskLogIds);
    for (const a of attachmentRows) {
      const list = attachmentsByLog.get(a.taskLogId) ?? [];
      list.push(a);
      attachmentsByLog.set(a.taskLogId, list);
    }
  }

  // Penomoran lampiran global lintas dokumen, urut sesuai urutan baris aktifitas ditemukan.
  const lampiran: ReportLampiran[] = [];
  const aktivitas: ReportAktivitasRow[] = [];
  for (const r of rows) {
    const lampiranNumbers: number[] = [];
    for (const a of attachmentsByLog.get(r.taskLogId) ?? []) {
      const ext = a.fileType === "image/png" ? "png" : "jpg";
      const bytes = await Bun.file(absoluteAttachmentPath(a.filePath))
        .arrayBuffer()
        .then((b) => new Uint8Array(b))
        .catch(() => null);
      const nomor = lampiran.length + 1;
      lampiranNumbers.push(nomor);
      lampiran.push({
        nomor,
        bytes: bytes ?? new Uint8Array(),
        ext,
        caption: taskLabel(r.deskripsi, r.tag),
      });
    }

    aktivitas.push({
      no: taskNoMap.get(r.taskId)!,
      tanggalLabel: tanggalLabel(r.tanggal),
      projectNama: r.projectNama,
      kegiatan: taskLabel(r.deskripsi, r.tag),
      catatanLines: catatanToLines(r.catatan),
      status: r.taskStatus === "closed" ? "Selesai" : "Proses",
      lampiranNumbers,
    });
  }

  const izinRows = db
    .query<{ tanggal: string }, [number, string]>(
      "SELECT tanggal FROM leaves WHERE user_id = ? AND tanggal LIKE ? || '%'",
    )
    .all(ctx.user.id, bulan);
  const izinSet = new Set(izinRows.map((r) => r.tanggal));

  const hari: ReportHari[] = [];
  const total = daysInMonth(bulan);
  for (let d = 1; d <= total; d++) {
    const tanggal = `${bulan}-${String(d).padStart(2, "0")}`;
    hari.push({ tanggal, isWorkday: isWorkday(tanggal), isIzin: izinSet.has(tanggal) });
  }

  const [tahun, bulanAngka] = bulan.split("-").map(Number);
  const bulanLabel = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(tahun!, bulanAngka! - 1, 1)),
  );

  const bytes = await buildMonthlyReportPdf({
    namaUser: ctx.user.nama,
    bulanLabel,
    hari,
    tasks,
    taskDatesWorked,
    aktivitas,
    lampiran,
  });

  // pdf-lib mengembalikan Uint8Array<ArrayBufferLike> yang generic-nya tidak cocok langsung
  // dengan BodyInit (ArrayBuffer murni) di tsc versi ini — salin ke ArrayBuffer baru.
  const pdfBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(pdfBuffer).set(bytes);

  return new Response(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="laporan-${slug(ctx.user.nama)}-${bulan}.pdf"`,
    },
  });
}

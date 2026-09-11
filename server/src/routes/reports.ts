import { db } from "../db";
import { errorResponse, json } from "../http";
import { getAuthContext, parseCookie, SESSION_COOKIE } from "../auth";
import { isWorkday, todayJakarta } from "../kalender";
import { absoluteAttachmentPath } from "../storage";
import { buildMonthlyReportPdf, catatanToLines, type ReportAktivitasRow, type ReportHari, type ReportLampiran, type ReportTask } from "../report-pdf";
import { buildMonthlyReportDocx } from "../report-docx";
import { getSaranLines } from "./saran";
import { getLaporanTemplatePath } from "./laporan-template";

const BULAN_RE = /^\d{4}-\d{2}$/;

const TANGGAL_LABEL_FMT = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
function tanggalLabel(tanggal: string): string {
  const [y, m, d] = tanggal.split("-").map(Number);
  return TANGGAL_LABEL_FMT.format(new Date(Date.UTC(y, m - 1, d)));
}

const TANGGAL_PANJANG_FMT = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
// Nama bulan SAJA (tanpa tahun) — dipakai khusus {BULAN} di template Word, karena template
// sudah punya {TA} (tahun) terpisah di kotak sendiri; kalau {BULAN} ikut bawa tahun juga,
// tahunnya kelihatan dobel di cover (ditemukan lewat screenshot user, render nyata di MS Word).
const BULAN_SAJA_FMT = new Intl.DateTimeFormat("id-ID", { month: "long", timeZone: "UTC" });
function bulanSajaLabel(bulan: string): string {
  const [tahun, bulanAngka] = bulan.split("-").map(Number);
  return BULAN_SAJA_FMT.format(new Date(Date.UTC(tahun!, bulanAngka! - 1, 1)));
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

interface AggregatedReport {
  bulanLabel: string;
  tasks: ReportTask[];
  taskNoMap: Map<number, number>;
  taskDatesWorked: Map<number, Set<string>>;
  hari: ReportHari[];
  rows: RealisasiRow[];
  attachmentsByLog: Map<number, AttachmentRow[]>;
}

// Agregasi bersama PDF (handleMonthlyReportPdf) dan pratinjau layar (handleMonthlyReportPreview)
// — query task_logs realisasi, nomor task tetap, kalender hari (isWorkday/izin), dan attachment
// per log (metadata saja, BUKAN bytes — itu cuma dibaca saat benar-benar bikin PDF).
async function aggregateMonthlyReport(userId: number, bulan: string): Promise<AggregatedReport> {
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
    .all(userId, bulan);

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

  const izinRows = db
    .query<{ tanggal: string }, [number, string]>(
      "SELECT tanggal FROM leaves WHERE user_id = ? AND tanggal LIKE ? || '%'",
    )
    .all(userId, bulan);
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

  return { bulanLabel, tasks, taskNoMap, taskDatesWorked, hari, rows, attachmentsByLog };
}

// Dipakai handleMonthlyReportPdf dan handleMonthlyReportWord — sama-sama butuh baris tabel
// aktifitas + bytes lampiran dari agregasi yang sama, beda cuma cara merender jadi dokumen akhir.
// Penomoran lampiran global lintas dokumen, urut sesuai urutan baris aktifitas ditemukan.
async function buildLampiranDanAktivitas(
  agg: AggregatedReport,
): Promise<{ lampiran: ReportLampiran[]; aktivitas: ReportAktivitasRow[] }> {
  const lampiran: ReportLampiran[] = [];
  const aktivitas: ReportAktivitasRow[] = [];
  for (const r of agg.rows) {
    const lampiranNumbers: number[] = [];
    for (const a of agg.attachmentsByLog.get(r.taskLogId) ?? []) {
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
      no: agg.taskNoMap.get(r.taskId)!,
      tanggalLabel: tanggalLabel(r.tanggal),
      projectNama: r.projectNama,
      kegiatan: taskLabel(r.deskripsi, r.tag),
      catatanLines: catatanToLines(r.catatan),
      status: r.taskStatus === "closed" ? "Selesai" : "Proses",
      lampiranNumbers,
    });
  }
  return { lampiran, aktivitas };
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

  const agg = await aggregateMonthlyReport(ctx.user.id, bulan);
  const { lampiran, aktivitas } = await buildLampiranDanAktivitas(agg);

  const bytes = await buildMonthlyReportPdf({
    namaUser: ctx.user.nama,
    bulanLabel: agg.bulanLabel,
    hari: agg.hari,
    tasks: agg.tasks,
    taskDatesWorked: agg.taskDatesWorked,
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

// ADR-0019 revisi (2026-09-11, disederhanakan lagi setelahnya): laporan diunduh sebagai Word
// hasil mail-merge ke template MILIK TENAGA AHLI SENDIRI (routes/laporan-template.ts) — bukan
// digambar dari nol seperti PDF. Cover/Pendahuluan/Ruang Lingkup/Penutup sudah statis di dalam
// file template masing-masing orang; di sini cuma isi placeholder nama/timesheet/tabel
// aktifitas/lampiran/saran. Tidak ada gate — saran kosong cukup dirender kosong.
export async function handleMonthlyReportWord(req: Request): Promise<Response> {
  const token = parseCookie(req.headers.get("Cookie"), SESSION_COOKIE);
  const ctx = getAuthContext(token);
  if (!ctx) return errorResponse(401, "Belum login.");

  const url = new URL(req.url);
  const bulan = url.searchParams.get("bulan");
  if (!bulan || !BULAN_RE.test(bulan)) return errorResponse(400, "Format bulan tidak valid (YYYY-MM).");

  const templatePath = getLaporanTemplatePath(ctx.user.id);
  if (!templatePath) {
    return errorResponse(409, "Anda belum mengunggah template Word. Unggah dulu sebelum mengunduh laporan.");
  }
  const templateBytes = await Bun.file(templatePath)
    .arrayBuffer()
    .then((b) => new Uint8Array(b))
    .catch(() => null);
  if (!templateBytes) return errorResponse(404, "File template tidak ditemukan di disk.");

  const agg = await aggregateMonthlyReport(ctx.user.id, bulan);
  const { lampiran, aktivitas } = await buildLampiranDanAktivitas(agg);

  const [tahun] = bulan.split("-");
  const akhirBulan = `${bulan}-${String(daysInMonth(bulan)).padStart(2, "0")}`;
  const tanggalAkhirLabel = TANGGAL_PANJANG_FMT.format(new Date(`${akhirBulan}T00:00:00Z`));

  let bytes: Uint8Array;
  try {
    bytes = buildMonthlyReportDocx(templateBytes, {
      tahun: tahun!,
      namaUser: ctx.user.nama,
      // Nama bulan SAJA (bukan agg.bulanLabel yang "September 2026") — tahun sudah ada
      // terpisah di {TA}. Kapital semua karena teks statis "BULAN" di template juga kapital.
      bulanLabel: bulanSajaLabel(bulan).toUpperCase(),
      tanggalAkhirLabel,
      hari: agg.hari,
      tasks: agg.tasks,
      taskDatesWorked: agg.taskDatesWorked,
      aktivitas,
      lampiran,
      saranLines: getSaranLines(ctx.user.id, bulan),
    });
  } catch (err) {
    // Template rusak/tidak sesuai format docx yang bisa dibaca docxtemplater — pesan jelas,
    // bukan 500 mentah (ADR-0019: "jangan menebak isi template", tapi juga jangan diam-diam
    // gagal kalau ternyata memang tidak valid).
    return errorResponse(400, err instanceof Error ? `Template Word tidak valid: ${err.message}` : "Template Word tidak valid.");
  }

  const docxBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(docxBuffer).set(bytes);

  return new Response(docxBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="laporan-${slug(ctx.user.nama)}-${bulan}.docx"`,
    },
  });
}

// Pratinjau di layar sebelum cetak (ADR-0019 "Rencana lanjutan") — supaya user bisa mengecek ada
// tidaknya hari kerja yang masih kosong (belum ada realisasi) sebelum benar-benar mengunduh PDF.
export async function handleMonthlyReportPreview(req: Request, hariIniOverride?: string): Promise<Response> {
  const token = parseCookie(req.headers.get("Cookie"), SESSION_COOKIE);
  const ctx = getAuthContext(token);
  if (!ctx) return errorResponse(401, "Belum login.");

  const url = new URL(req.url);
  const bulan = url.searchParams.get("bulan");
  if (!bulan || !BULAN_RE.test(bulan)) return errorResponse(400, "Format bulan tidak valid (YYYY-MM).");

  const agg = await aggregateMonthlyReport(ctx.user.id, bulan);

  const items = agg.rows.map((r) => ({
    no: agg.taskNoMap.get(r.taskId)!,
    tanggal: r.tanggal,
    tanggalLabel: tanggalLabel(r.tanggal),
    projectNama: r.projectNama,
    kegiatan: taskLabel(r.deskripsi, r.tag),
    catatan: r.catatan,
    status: r.taskStatus === "closed" ? "Selesai" : "Proses",
    lampiranCount: (agg.attachmentsByLog.get(r.taskLogId) ?? []).length,
  }));

  // Hari kerja yang belum ada realisasi sama sekali — dibatasi sampai hari ini biar tanggal
  // yang belum kejadian (masa depan) tidak ikut ditandai "kosong". Rencana-tanpa-realisasi
  // tetap dianggap kosong (cuma realisasi yang dihitung "sudah ada").
  const hariIni = hariIniOverride ?? todayJakarta();
  const tanggalAdaRealisasi = new Set(agg.rows.map((r) => r.tanggal));
  const tanggalKosong = agg.hari
    .filter((h) => h.isWorkday && !h.isIzin && h.tanggal <= hariIni && !tanggalAdaRealisasi.has(h.tanggal))
    .map((h) => h.tanggal);

  // Data timesheet (task x hari) buat pratinjau layar juga — bentuknya sama dengan yang dipakai
  // buildMonthlyReportPdf, cuma taskDatesWorked diubah dari Map/Set (tidak bisa di-JSON) jadi
  // object biasa keyed by taskId.
  const timesheet = {
    tasks: agg.tasks,
    hari: agg.hari,
    taskDatesWorked: Object.fromEntries(
      [...agg.taskDatesWorked.entries()].map(([taskId, dates]) => [String(taskId), [...dates]]),
    ),
  };

  return json({ bulan, bulanLabel: agg.bulanLabel, items, tanggalKosong, timesheet });
}

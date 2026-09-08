import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

// Cicilan awal Stage 7 (ADR-0019) — PDF generik satu layout, bukan Word per tipe programmer
// (itu menunggu template asli, Q-06). Tujuannya validasi data laporan dulu: task, tanggal,
// catatan, lampiran, status, kalender kerja. Modul ini murni membangun bytes PDF dari data yang
// sudah diagregasi oleh routes/reports.ts — tidak menyentuh DB sama sekali.

const MARGIN = 30;
const COLOR_MERAH = rgb(0.937, 0.267, 0.267); // libur (weekend/holiday)
const COLOR_KUNING = rgb(0.98, 0.75, 0.14); // izin
const COLOR_ABU = rgb(0.6, 0.6, 0.6); // ada realisasi
const COLOR_PUTIH = rgb(1, 1, 1);
const COLOR_BORDER = rgb(0.8, 0.8, 0.8);
const COLOR_TEKS = rgb(0.1, 0.1, 0.1);

// Bullet markdown `- ` dan checkbox `- [ ]`/`- [x]` sama-sama jadi "• " di PDF — status
// tercentang/belum tidak berarti apa-apa lagi di dokumen cetak (tidak interaktif seperti UI),
// jadi disederhanakan jadi daftar bullet biasa, bukan dipertahankan sebagai "[ ]"/"[x]".
const CHECKBOX_RE = /^- \[([ xX])\] (.*)$/;
export function catatanToLines(catatan: string | null): string[] {
  if (!catatan) return [];
  return catatan.split("\n").map((line) => {
    const checkbox = line.match(CHECKBOX_RE);
    if (checkbox) return `• ${checkbox[2]}`;
    if (line.startsWith("- ")) return `• ${line.slice(2)}`;
    return line;
  });
}

function wrapText(font: PDFFont, size: number, text: string, maxWidth: number): string[] {
  if (text === "") return [""];
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function wrapLines(font: PDFFont, size: number, lines: string[], maxWidth: number): string[] {
  return lines.flatMap((line) => wrapText(font, size, line, maxWidth));
}

export interface ReportTask {
  taskId: number;
  no: number;
  label: string;
}

export interface ReportHari {
  tanggal: string;
  isWorkday: boolean;
  isIzin: boolean;
}

export interface ReportAktivitasRow {
  no: number;
  tanggalLabel: string;
  projectNama: string;
  kegiatan: string;
  catatanLines: string[];
  status: string;
  lampiranNumbers: number[];
}

export interface ReportLampiran {
  nomor: number;
  bytes: Uint8Array;
  ext: "jpg" | "png";
  caption: string;
}

export interface BuildReportInput {
  namaUser: string;
  bulanLabel: string;
  hari: ReportHari[];
  tasks: ReportTask[];
  taskDatesWorked: Map<number, Set<string>>;
  aktivitas: ReportAktivitasRow[];
  lampiran: ReportLampiran[];
}

interface Fonts {
  reguler: PDFFont;
  tebal: PDFFont;
}

async function drawTimesheetPages(doc: PDFDocument, fonts: Fonts, input: BuildReportInput): Promise<void> {
  const PAGE_W = 841.89;
  const PAGE_H = 595.28;
  const usableW = PAGE_W - MARGIN * 2;
  const colNo = 28;
  const colKegiatan = 220;
  const dayColW = (usableW - colNo - colKegiatan) / input.hari.length;
  const rowH = 16;
  const headerH = 40;
  const dayHeaderH = 16;
  const rowsPerPage = Math.floor((PAGE_H - MARGIN * 2 - headerH - dayHeaderH) / rowH);

  function drawHeader(page: PDFPage, top: number): number {
    page.drawText("TIMESHEET", { x: MARGIN, y: top - 14, size: 12, font: fonts.tebal, color: COLOR_TEKS });
    page.drawText(`${input.namaUser} — ${input.bulanLabel}`, {
      x: MARGIN,
      y: top - 28,
      size: 9,
      font: fonts.reguler,
      color: COLOR_TEKS,
    });
    const dayHeaderY = top - headerH;
    let x = MARGIN + colNo + colKegiatan;
    for (const h of input.hari) {
      const day = Number(h.tanggal.slice(8, 10));
      page.drawText(String(day), {
        x: x + dayColW / 2 - fonts.reguler.widthOfTextAtSize(String(day), 6) / 2,
        y: dayHeaderY - dayHeaderH + 5,
        size: 6,
        font: fonts.reguler,
        color: COLOR_TEKS,
      });
      x += dayColW;
    }
    page.drawText("No", { x: MARGIN + 3, y: dayHeaderY - dayHeaderH + 5, size: 7, font: fonts.tebal, color: COLOR_TEKS });
    page.drawText("Kegiatan/Masalah", {
      x: MARGIN + colNo + 3,
      y: dayHeaderY - dayHeaderH + 5,
      size: 7,
      font: fonts.tebal,
      color: COLOR_TEKS,
    });
    return dayHeaderY - dayHeaderH;
  }

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let cursorY = drawHeader(page, PAGE_H - MARGIN);
  let rowsOnPage = 0;

  for (const task of input.tasks) {
    if (rowsOnPage >= rowsPerPage) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      cursorY = drawHeader(page, PAGE_H - MARGIN);
      rowsOnPage = 0;
    }
    const rowTop = cursorY;
    page.drawText(String(task.no), { x: MARGIN + 3, y: rowTop - rowH + 5, size: 6.5, font: fonts.reguler, color: COLOR_TEKS });
    const label = wrapText(fonts.reguler, 6.5, task.label, colKegiatan - 6)[0] ?? task.label;
    page.drawText(label, { x: MARGIN + colNo + 3, y: rowTop - rowH + 5, size: 6.5, font: fonts.reguler, color: COLOR_TEKS });

    const worked = input.taskDatesWorked.get(task.taskId) ?? new Set<string>();
    let x = MARGIN + colNo + colKegiatan;
    for (const h of input.hari) {
      let fill = COLOR_PUTIH;
      if (h.isIzin) fill = COLOR_KUNING;
      else if (!h.isWorkday) fill = COLOR_MERAH;
      else if (worked.has(h.tanggal)) fill = COLOR_ABU;
      page.drawRectangle({
        x,
        y: rowTop - rowH,
        width: dayColW,
        height: rowH,
        color: fill,
        borderColor: COLOR_BORDER,
        borderWidth: 0.4,
      });
      x += dayColW;
    }
    page.drawRectangle({
      x: MARGIN,
      y: rowTop - rowH,
      width: colNo + colKegiatan,
      height: rowH,
      borderColor: COLOR_BORDER,
      borderWidth: 0.4,
    });
    cursorY -= rowH;
    rowsOnPage++;
  }
}

const AKTIVITAS_COLS = [
  { key: "no", label: "No", width: 20 },
  { key: "tanggal", label: "Tanggal", width: 42 },
  { key: "aplikasi", label: "Aplikasi/Modul", width: 65 },
  { key: "kegiatan", label: "Kegiatan/Masalah", width: 110 },
  { key: "tindak", label: "Tindak Lanjut/Solusi", width: 140 },
  { key: "status", label: "Status", width: 40 },
  { key: "lampiran", label: "Lampiran", width: 55 },
] as const;

function drawAktivitasHeader(page: PDFPage, fonts: Fonts, top: number): number {
  const PAGE_W = 595.28;
  page.drawText("BAB IV — HASIL PEKERJAAN", { x: MARGIN, y: top - 14, size: 12, font: fonts.tebal, color: COLOR_TEKS });
  page.drawText("a. Aktifitas Pekerjaan/Kegiatan", {
    x: MARGIN,
    y: top - 28,
    size: 9,
    font: fonts.reguler,
    color: COLOR_TEKS,
  });
  let x = MARGIN;
  const headerTop = top - 38;
  for (const col of AKTIVITAS_COLS) {
    page.drawText(col.label, { x: x + 2, y: headerTop - 10, size: 6.5, font: fonts.tebal, color: COLOR_TEKS });
    x += col.width;
  }
  page.drawRectangle({
    x: MARGIN,
    y: headerTop - 14,
    width: PAGE_W - MARGIN * 2,
    height: 14,
    borderColor: COLOR_BORDER,
    borderWidth: 0.4,
  });
  return headerTop - 14;
}

async function drawAktivitasPages(doc: PDFDocument, fonts: Fonts, input: BuildReportInput): Promise<void> {
  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const size = 6.5;
  const lineH = 8;
  const padY = 3;

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let cursorY = drawAktivitasHeader(page, fonts, PAGE_H - MARGIN);

  for (const row of input.aktivitas) {
    const kegiatanLines = wrapText(fonts.reguler, size, row.kegiatan, AKTIVITAS_COLS[3].width - 4);
    const tindakLines =
      row.catatanLines.length > 0 ? wrapLines(fonts.reguler, size, row.catatanLines, AKTIVITAS_COLS[4].width - 4) : [""];
    const lampiranText = row.lampiranNumbers.length > 0 ? row.lampiranNumbers.map((n) => `Lampiran ${n}`).join(", ") : "-";
    const lampiranLines = wrapText(fonts.reguler, size, lampiranText, AKTIVITAS_COLS[6].width - 4);
    const maxLines = Math.max(1, kegiatanLines.length, tindakLines.length, lampiranLines.length);
    const rowH = maxLines * lineH + padY * 2;

    if (cursorY - rowH < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      cursorY = drawAktivitasHeader(page, fonts, PAGE_H - MARGIN);
    }

    const rowTop = cursorY;
    const cells: Record<string, string[]> = {
      no: [String(row.no)],
      tanggal: [row.tanggalLabel],
      aplikasi: wrapText(fonts.reguler, size, row.projectNama, AKTIVITAS_COLS[2].width - 4),
      kegiatan: kegiatanLines,
      tindak: tindakLines,
      status: [row.status],
      lampiran: lampiranLines,
    };

    let x = MARGIN;
    for (const col of AKTIVITAS_COLS) {
      const lines = cells[col.key]!;
      lines.forEach((line, i) => {
        page.drawText(line, {
          x: x + 2,
          y: rowTop - padY - lineH * (i + 1) + 2,
          size,
          font: fonts.reguler,
          color: COLOR_TEKS,
        });
      });
      x += col.width;
    }
    page.drawRectangle({
      x: MARGIN,
      y: rowTop - rowH,
      width: AKTIVITAS_COLS.reduce((sum, c) => sum + c.width, 0),
      height: rowH,
      borderColor: COLOR_BORDER,
      borderWidth: 0.4,
    });
    cursorY -= rowH;
  }
}

async function drawLampiranPages(doc: PDFDocument, fonts: Fonts, input: BuildReportInput): Promise<void> {
  if (input.lampiran.length === 0) return;
  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const maxImgW = PAGE_W - MARGIN * 2;
  const maxImgH = 280;

  let page = doc.addPage([PAGE_W, PAGE_H]);
  page.drawText("b. Lampiran Hasil Pekerjaan", {
    x: MARGIN,
    y: PAGE_H - MARGIN - 14,
    size: 11,
    font: fonts.tebal,
    color: COLOR_TEKS,
  });
  let cursorY = PAGE_H - MARGIN - 34;

  for (const item of input.lampiran) {
    let embedded;
    try {
      embedded = item.ext === "jpg" ? await doc.embedJpg(item.bytes) : await doc.embedPng(item.bytes);
    } catch {
      embedded = null;
    }

    const captionLines = wrapText(fonts.reguler, 8, `Lampiran ${item.nomor}. ${item.caption}`, maxImgW);
    const captionH = captionLines.length * 10 + 6;
    let imgH = 0;
    let imgW = 0;
    if (embedded) {
      const scale = Math.min(maxImgW / embedded.width, maxImgH / embedded.height);
      imgW = embedded.width * scale;
      imgH = embedded.height * scale;
    } else {
      imgH = 20;
      imgW = maxImgW;
    }
    const blockH = imgH + captionH + 16;

    if (cursorY - blockH < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      cursorY = PAGE_H - MARGIN;
    }

    if (embedded) {
      page.drawImage(embedded, { x: MARGIN, y: cursorY - imgH, width: imgW, height: imgH });
    } else {
      page.drawText("Berkas tidak ditemukan.", { x: MARGIN, y: cursorY - 14, size: 9, font: fonts.reguler, color: COLOR_TEKS });
    }
    captionLines.forEach((line, i) => {
      page.drawText(line, {
        x: MARGIN,
        y: cursorY - imgH - 12 - i * 10,
        size: 8,
        font: fonts.reguler,
        color: COLOR_TEKS,
      });
    });
    cursorY -= blockH;
  }
}

export async function buildMonthlyReportPdf(input: BuildReportInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts: Fonts = {
    reguler: await doc.embedFont(StandardFonts.Helvetica),
    tebal: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  await drawTimesheetPages(doc, fonts, input);
  await drawAktivitasPages(doc, fonts, input);
  await drawLampiranPages(doc, fonts, input);

  return doc.save();
}

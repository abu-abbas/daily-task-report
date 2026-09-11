import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { createRequire } from "node:module";
import type { ReportAktivitasRow, ReportHari, ReportLampiran, ReportTask } from "./report-pdf";

// Mail-merge ke template Word MILIK TENAGA AHLI SENDIRI (ADR-0019 revisi 2026-09-11) — bukan
// menggambar dokumen dari nol seperti report-pdf.ts. Cover/Pendahuluan/Ruang Lingkup/Jabatan/
// Penutup sudah statis di dalam file template masing-masing orang (mesin kontrak/jabatan/ruang
// lingkup/pendahuluan yang sempat dibangun untuk itu sudah dihapus lagi — lihat ADR-0019); modul
// ini cuma mengisi placeholder: {TA} {BULAN} {NAMA_TENAGA_AHLI} {DATE_END} (teks biasa) dan
// {%TIMESHEET} {%AKTIVITAS} {%LAMPIRAN_PEKERJAAN} {%SARAN _REKOMENDASI} (raw XML — tabel/gambar
// utuh menggantikan satu paragraf placeholder, bukan mengisi teks di dalamnya).
//
// Template pakai prefix "%" untuk semua tag dinamis (bukan cuma gambar) — docxtemplater
// bawaan cuma menyediakan raw-xml module dengan prefix default "@". Dibuktikan lewat
// percobaan nyata (buka file .docx yang di-generate lalu unzip+cek document.xml) bahwa
// membuat instance kedua modul raw-xml bawaan dengan prefix "%" bekerja tanpa error dan
// tanpa perlu mengedit template — dipilih daripada minta user ganti "%" jadi "@" di template.
const require = createRequire(import.meta.url);
const createRawXmlModule = require("docxtemplater/js/modules/rawxml.js") as () => {
  name: string;
  prefix: string;
};

function createPercentRawXmlModule() {
  const mod = createRawXmlModule();
  mod.name = "RawXmlModulePercent";
  mod.prefix = "%";
  return mod;
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// Font+ukuran default template (dibaca sekali per buildMonthlyReportDocx dari word/styles.xml —
// lihat extractDefaultRunProps) — tanpa ini, paragraf yang kita suntik raw-XML jatuh ke font
// tema Word generik (bisa beda dari isi template) DAN ke ukuran hardcode yang ternyata cuma 8pt
// (sz="16" itu satuannya half-point, bukan point — kekecilan dibanding body text asli yang
// biasanya 10-11pt, ditemukan lewat screenshot user yang bandingkan toolbar font-size Word).
// Modul ini sinkron sepenuhnya (tidak ada await di antara set dan baca), jadi variabel modul
// aman dipakai — tidak ada request lain yang bisa menyelanya di tengah satu pemanggilan.
let currentRunProps = "";

function run(text: string, bold = false): string {
  const rPr = `<w:rPr>${currentRunProps}${bold ? "<w:b/>" : ""}</w:rPr>`;
  return `<w:r>${rPr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

function para(text: string, bold = false): string {
  return `<w:p>${text === "" ? "" : run(text, bold)}</w:p>`;
}

function multiPara(lines: string[]): string {
  return lines.length === 0 ? "<w:p/>" : lines.map((l) => para(l)).join("");
}

function cell(innerXml: string, widthTwips: number, opts: { shadeHex?: string; span?: number } = {}): string {
  const shd = opts.shadeHex ? `<w:shd w:val="clear" w:color="auto" w:fill="${opts.shadeHex}"/>` : "";
  const span = opts.span ? `<w:gridSpan w:val="${opts.span}"/>` : "";
  return `<w:tc><w:tcPr><w:tcW w:w="${widthTwips}" w:type="dxa"/>${span}${shd}</w:tcPr>${innerXml || "<w:p/>"}</w:tc>`;
}

function row(cellsXml: string[]): string {
  return `<w:tr>${cellsXml.join("")}</w:tr>`;
}

// `tblHeader` bikin Word/LibreOffice mengulang baris ini di tiap halaman kalau tabelnya
// pecah lintas halaman — tanpa ini, halaman lanjutan kehilangan label kolom sama sekali
// (ditemukan lewat render nyata: tabel timesheet 36 baris, kolom hari di halaman ke-2
// tidak ada keterangan tanggal apa-apa lagi).
function tblHeaderRow(cellsXml: string[]): string {
  return `<w:tr><w:trPr><w:tblHeader/></w:trPr>${cellsXml.join("")}</w:tr>`;
}

const TABLE_BORDERS = `<w:tblBorders>
  <w:top w:val="single" w:sz="4" w:color="auto"/>
  <w:left w:val="single" w:sz="4" w:color="auto"/>
  <w:bottom w:val="single" w:sz="4" w:color="auto"/>
  <w:right w:val="single" w:sz="4" w:color="auto"/>
  <w:insideH w:val="single" w:sz="4" w:color="auto"/>
  <w:insideV w:val="single" w:sz="4" w:color="auto"/>
</w:tblBorders>`;

function table(colWidths: number[], rowsXml: string[]): string {
  const grid = colWidths.map((w) => `<w:gridCol w:w="${w}"/>`).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${TABLE_BORDERS}</w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rowsXml.join("")}</w:tbl>`;
}

const COLOR_MERAH = "EF4444"; // libur
const COLOR_KUNING = "FABF24"; // izin
const COLOR_ABU = "999999"; // ada realisasi

function buildTimesheetXml(tasks: ReportTask[], hari: ReportHari[], taskDatesWorked: Map<number, Set<string>>): string {
  if (tasks.length === 0) return para("Belum ada rencana/realisasi bulan ini.");

  const colNo = 500;
  const colLabel = 2000;
  const colDay = 260;
  const widths = [colNo, colLabel, ...hari.map(() => colDay)];

  const headerRow = tblHeaderRow([
    cell(para("No", true), colNo),
    cell(para("Kegiatan", true), colLabel),
    ...hari.map((h) => cell(para(String(Number(h.tanggal.slice(8, 10))), true), colDay)),
  ]);

  const bodyRows = tasks.map((t) => {
    const worked = taskDatesWorked.get(t.taskId) ?? new Set<string>();
    return row([
      cell(para(String(t.no)), colNo),
      cell(para(t.label), colLabel),
      ...hari.map((h) => {
        const shade = h.isIzin ? COLOR_KUNING : !h.isWorkday ? COLOR_MERAH : worked.has(h.tanggal) ? COLOR_ABU : undefined;
        return cell("", colDay, { shadeHex: shade });
      }),
    ]);
  });

  return table(widths, [headerRow, ...bodyRows]);
}

function buildAktivitasXml(rows: ReportAktivitasRow[]): string {
  const widths = [500, 900, 1500, 2400, 2600, 900, 1300];
  const total = widths.reduce((a, b) => a + b, 0);
  const headerRow = tblHeaderRow([
    cell(para("No", true), widths[0]!),
    cell(para("Tanggal", true), widths[1]!),
    cell(para("Aplikasi/Modul", true), widths[2]!),
    cell(para("Kegiatan/Masalah", true), widths[3]!),
    cell(para("Tindak Lanjut/Solusi", true), widths[4]!),
    cell(para("Status", true), widths[5]!),
    cell(para("Lampiran", true), widths[6]!),
  ]);

  if (rows.length === 0) {
    return table(widths, [headerRow, row([cell(para("Belum ada realisasi bulan ini."), total, { span: widths.length })])]);
  }

  const bodyRows = rows.map((r) =>
    row([
      cell(para(String(r.no)), widths[0]!),
      cell(para(r.tanggalLabel), widths[1]!),
      cell(para(r.projectNama), widths[2]!),
      cell(para(r.kegiatan), widths[3]!),
      cell(multiPara(r.catatanLines), widths[4]!),
      cell(para(r.status), widths[5]!),
      cell(para(r.lampiranNumbers.length > 0 ? r.lampiranNumbers.map((n) => `Lampiran ${n}`).join(", ") : "-"), widths[6]!),
    ]),
  );
  return table(widths, [headerRow, ...bodyRows]);
}

function buildSaranXml(lines: string[]): string {
  if (lines.length === 0) return para("Tidak ada saran khusus bulan ini.");
  return lines.map((line, i) => para(`${i + 1}. ${line}`)).join("");
}

function getPngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  const width = ((bytes[16]! << 24) | (bytes[17]! << 16) | (bytes[18]! << 8) | bytes[19]!) >>> 0;
  const height = ((bytes[20]! << 24) | (bytes[21]! << 16) | (bytes[22]! << 8) | bytes[23]!) >>> 0;
  return { width, height };
}

// Baca dimensi dari marker SOF (Start Of Frame) — cukup buat ukuran gambar, bukan decoder JPEG
// penuh (tidak butuh apa-apa selain lebar/tinggi buat menghitung skala di halaman Word).
function getJpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = bytes[offset + 1]!;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9) break;
    const length = (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      const height = (bytes[offset + 5]! << 8) | bytes[offset + 6]!;
      const width = (bytes[offset + 7]! << 8) | bytes[offset + 8]!;
      return { width, height };
    }
    offset += 2 + length;
  }
  return null;
}

function getImageSize(bytes: Uint8Array, ext: "jpg" | "png"): { width: number; height: number } {
  const size = ext === "png" ? getPngSize(bytes) : getJpegSize(bytes);
  return size ?? { width: 400, height: 300 };
}

const EMU_PER_PX = 9525; // 96 DPI standar OOXML
const MAX_WIDTH_EMU = 5943600; // ~6.5 inch, muat di halaman A4/Letter portrait margin normal

function contentTypesEnsureDefault(xml: string, ext: string, contentType: string): string {
  if (xml.includes(`Extension="${ext}"`)) return xml;
  return xml.replace("<Types ", `<Types `).replace(
    /(<Types[^>]*>)/,
    `$1<Default Extension="${ext}" ContentType="${contentType}"/>`,
  );
}

// Embed gambar langsung ke ZIP docx (tambah word/media/*, relationship di
// word/_rels/document.xml.rels, pastikan [Content_Types].xml kenal ekstensinya) lalu kembalikan
// raw XML <w:drawing> + caption yang menggantikan placeholder {%LAMPIRAN_PEKERJAAN}. Dikerjakan
// manual (bukan pakai paket image-module docxtemplater) supaya tidak bentrok dengan prefix "%"
// yang sudah dipakai template untuk tag dinamis lain.
function embedLampiranAndBuildXml(zip: PizZip, lampiran: ReportLampiran[]): string {
  if (lampiran.length === 0) return para("Tidak ada lampiran bulan ini.");

  const relsPath = "word/_rels/document.xml.rels";
  let relsXml =
    zip.file(relsPath)?.asText() ??
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  const existingRelIds = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]));
  let nextRelId = existingRelIds.length > 0 ? Math.max(...existingRelIds) + 1 : 1;

  const existingMedia = zip.file(/word\/media\/image(\d+)\./) as unknown as { name: string }[];
  let mediaCounter =
    existingMedia.length > 0
      ? Math.max(...existingMedia.map((f) => Number(f.name.match(/image(\d+)\./)![1]!))) + 1
      : 1;

  let contentTypesXml = zip.file("[Content_Types].xml")?.asText() ?? "";
  contentTypesXml = contentTypesEnsureDefault(contentTypesXml, "png", "image/png");
  contentTypesXml = contentTypesEnsureDefault(contentTypesXml, "jpg", "image/jpeg");

  const paragraphs: string[] = [];
  for (const item of lampiran) {
    const { width, height } = getImageSize(item.bytes, item.ext);
    const scale = Math.min(MAX_WIDTH_EMU / (width * EMU_PER_PX), 1);
    const widthEmu = Math.round(width * EMU_PER_PX * scale);
    const heightEmu = Math.round(height * EMU_PER_PX * scale);

    const mediaName = `image${mediaCounter}.${item.ext}`;
    zip.file(`word/media/${mediaName}`, item.bytes);
    const rId = `rId${nextRelId}`;
    relsXml = relsXml.replace(
      "</Relationships>",
      `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/></Relationships>`,
    );

    const docPrId = 9000 + item.nomor;
    const drawing = `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${widthEmu}" cy="${heightEmu}"/><wp:docPr id="${docPrId}" name="Lampiran ${item.nomor}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${docPrId}" name="${mediaName}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;

    paragraphs.push(drawing, para(`Lampiran ${item.nomor}. ${item.caption}`));
    mediaCounter++;
    nextRelId++;
  }

  zip.file(relsPath, relsXml);
  zip.file("[Content_Types].xml", contentTypesXml);
  return paragraphs.join("");
}

export interface BuildReportDocxInput {
  tahun: string;
  namaUser: string;
  bulanLabel: string;
  tanggalAkhirLabel: string;
  hari: ReportHari[];
  tasks: ReportTask[];
  taskDatesWorked: Map<number, Set<string>>;
  aktivitas: ReportAktivitasRow[];
  lampiran: ReportLampiran[];
  saranLines: string[];
}

// Fallback dokumen-lebar (dipakai kalau paragraf tag spesifik tidak ketemu) — font+ukuran dari
// style "Normal", lalu docDefaults kalau Normal tidak override apa-apa.
function extractDefaultRunProps(zip: PizZip): string {
  const stylesXml = zip.file("word/styles.xml")?.asText() ?? "";
  const normalStyle = stylesXml.match(/<w:style[^>]*w:styleId="Normal"[^>]*>[\s\S]*?<\/w:style>/)?.[0] ?? "";
  const normalRPr = normalStyle.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0];
  const rFonts = normalRPr?.match(/<w:rFonts\b[^>]*\/>/)?.[0];
  const sz = normalRPr?.match(/<w:sz\b[^>]*\/>/)?.[0];
  if (rFonts || sz) return `${rFonts ?? ""}${sz ?? ""}`;
  const docDefaults = stylesXml.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/)?.[0] ?? "";
  return `${docDefaults.match(/<w:rFonts\b[^>]*\/>/)?.[0] ?? ""}${docDefaults.match(/<w:sz\b[^>]*\/>/)?.[0] ?? ""}`;
}

// Formatting paragraf yang SESUNGGUHNYA ditulis user di sekitar tag placeholder — raw-xml
// mengganti SELURUH paragraf (termasuk formatting run aslinya), jadi tanpa ini konten yang kita
// suntik jatuh ke formatting dokumen generik yang bisa beda dari yang user ketik langsung di
// paragraf itu (ditemukan lewat perbandingan toolbar Word: paragraf {%SARAN _REKOMENDASI} di
// template pakai Arial 12 langsung/direct formatting, beda dari Normal style dokumen (Calibri)).
// Cari <w:p> yang memuat teks tag itu, ambil <w:rPr> run PERTAMA di paragraf itu.
function extractRunPropsNearTag(documentXml: string, tagText: string): string | null {
  const tagIndex = documentXml.indexOf(tagText);
  if (tagIndex === -1) return null;

  const pOpenRe = /<w:p(?:\s[^>]*)?>/g;
  let paragraphStart = -1;
  let m: RegExpExecArray | null;
  while ((m = pOpenRe.exec(documentXml)) && m.index < tagIndex) {
    paragraphStart = m.index;
  }
  if (paragraphStart === -1) return null;
  const paragraphEnd = documentXml.indexOf("</w:p>", tagIndex);
  if (paragraphEnd === -1) return null;

  const paragraph = documentXml.slice(paragraphStart, paragraphEnd);
  const runWithRPr = paragraph.match(/<w:r>\s*<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0];
  return runWithRPr?.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0].replace(/^<w:rPr>|<\/w:rPr>$/g, "") ?? null;
}

// Buang <w:sz>/<w:szCs> dari run props lalu pasang ukuran tetap — dipakai tabel padat
// (Timesheet, Aktifitas) yang lebar kolomnya sudah dipatok pas buat font kecil, terlepas dari
// berapa pun ukuran font asli di paragraf template tempat placeholder-nya berada.
function withFixedSize(runProps: string, halfPoints: number): string {
  const withoutSize = runProps.replace(/<w:sz\b[^>]*\/>/g, "").replace(/<w:szCs\b[^>]*\/>/g, "");
  return `${withoutSize}<w:sz w:val="${halfPoints}"/><w:szCs w:val="${halfPoints}"/>`;
}

// templateBytes: file .docx milik tenaga ahli sendiri (routes/laporan-template.ts). Placeholder
// yang diisi mail-merge ini: {TA} {BULAN} {NAMA_TENAGA_AHLI} {DATE_END} (teks biasa) dan
// {%TIMESHEET} {%AKTIVITAS} {%LAMPIRAN_PEKERJAAN} {%SARAN _REKOMENDASI} (raw XML — perhatikan
// spasi di nama tag SARAN, persis seperti di template asli). Cover/Pendahuluan/Ruang
// Lingkup/Jabatan/Penutup sengaja TIDAK di-mail-merge (dianggap statis di template masing-masing
// orang) — kalau template masih punya tag semacam {JABATAN_TENAGA_AHLI}, nullGetter di bawah
// bikin itu dirender kosong saja, bukan error.
export function buildMonthlyReportDocx(templateBytes: Uint8Array, input: BuildReportDocxInput): Uint8Array {
  const zip = new PizZip(templateBytes);
  const documentXml = zip.file("word/document.xml")?.asText() ?? "";
  const fallbackRunProps = extractDefaultRunProps(zip);

  // Timesheet & Aktifitas: tabel padat (Timesheet sampai 31 kolom hari) yang lebar kolomnya
  // sudah dipatok pas buat ukuran font KECIL TETAP — ikut ukuran asli paragraf template di sini
  // bikin kolom kebanyakan (nomor hari jadi wrap 2 baris, ditemukan lewat screenshot user).
  // Font family tetap ikut template, cuma ukurannya dikunci balik ke kecil.
  currentRunProps = withFixedSize(extractRunPropsNearTag(documentXml, "{%TIMESHEET}") ?? fallbackRunProps, 16);
  const timesheetXml = buildTimesheetXml(input.tasks, input.hari, input.taskDatesWorked);

  currentRunProps = withFixedSize(extractRunPropsNearTag(documentXml, "{%AKTIVITAS}") ?? fallbackRunProps, 16);
  const aktivitasXml = buildAktivitasXml(input.aktivitas);

  currentRunProps = extractRunPropsNearTag(documentXml, "{%LAMPIRAN_PEKERJAAN}") ?? fallbackRunProps;
  const lampiranXml = embedLampiranAndBuildXml(zip, input.lampiran);

  currentRunProps = extractRunPropsNearTag(documentXml, "{%SARAN _REKOMENDASI}") ?? fallbackRunProps;
  const saranXml = buildSaranXml(input.saranLines);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    modules: [createPercentRawXmlModule()],
    nullGetter: () => "",
  });

  doc.render({
    TA: input.tahun,
    BULAN: input.bulanLabel,
    NAMA_TENAGA_AHLI: input.namaUser,
    DATE_END: input.tanggalAkhirLabel,
    TIMESHEET: timesheetXml,
    AKTIVITAS: aktivitasXml,
    LAMPIRAN_PEKERJAAN: lampiranXml,
    "SARAN _REKOMENDASI": saranXml,
  });

  return doc.getZip().generate({ type: "uint8array" });
}

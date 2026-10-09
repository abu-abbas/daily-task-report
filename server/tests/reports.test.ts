import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import PizZip from "pizzip";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "laporan-harian-test-")), "test.db");

const { sqlite: db, runMigrations } = await import("../src/db");
const { login } = await import("../src/auth");
const { isWorkday } = await import("../src/kalender");
const { handleCreateProject, handleAddMember } = await import("../src/routes/projects");
const { handleCreateTask } = await import("../src/routes/tasks");
const { handleMonthlyReportPdf, handleMonthlyReportPreview, handleMonthlyReportWord } = await import("../src/routes/reports");
const { handleUploadLaporanTemplate } = await import("../src/routes/laporan-template");

// Docx minimal valid dengan seluruh placeholder yang dipakai buildMonthlyReportDocx — bukan
// file template asli pengguna (itu privat), cukup untuk uji pipeline mail-merge end-to-end.
function buildMinimalDocx(): Uint8Array {
  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{TA} {BULAN} {NAMA_TENAGA_AHLI} {DATE_END}</w:t></w:r></w:p><w:p><w:r><w:t>{%TIMESHEET}</w:t></w:r></w:p><w:p><w:r><w:t>{%AKTIVITAS}</w:t></w:r></w:p><w:p><w:r><w:t>{%LAMPIRAN_PEKERJAAN}</w:t></w:r></w:p><w:p><w:r><w:t>{%SARAN _REKOMENDASI}</w:t></w:r></w:p></w:body></w:document>`,
  );
  return zip.generate({ type: "uint8array" });
}

const TENAGA_EMAIL = "tenaga.reports@example.test";
const PASSWORD = "kata-sandi-aman";
const BULAN = "2026-03";
// hariIniOverride tetap buat test tanggalKosong — supaya deterministik, tidak gantung jam
// sungguhan. Cari tanggal workday nyata (bukan tebak manual hari-dalam-minggu) buat kandidat
// "kosong" (sebelum hariIni, bukan 05/10 yang sudah kepakai) dan "masa depan" (setelah hariIni).
const HARI_INI_PREVIEW = "2026-03-15";
async function cariWorkday(dariHari: number, sampaiHari: number, kecuali: number[]): Promise<string> {
  for (let d = dariHari; d <= sampaiHari; d++) {
    if (kecuali.includes(d)) continue;
    const tanggal = `${BULAN}-${String(d).padStart(2, "0")}`;
    if (await isWorkday(tanggal)) return tanggal;
  }
  throw new Error(`Tidak ketemu workday di rentang ${dariHari}-${sampaiHari}`);
}
// Dihitung di beforeAll (butuh tabel holidays sudah ada lewat runMigrations()).
let TANGGAL_KOSONG_HARAPAN: string;
let TANGGAL_MASA_DEPAN: string;

let tenagaId: number;
let tenagaToken: string;
let projectId: number;
let taskId: number;

function req(path: string, token?: string): Request {
  return new Request(`http://localhost${path}`, {
    headers: token ? { Cookie: `session=${token}` } : {},
  });
}

function reqUploadTemplate(token: string, file: File): Request {
  const form = new FormData();
  form.set("file", file);
  return new Request("http://localhost/api/laporan-template", {
    method: "POST",
    headers: { Cookie: `session=${token}` },
    body: form,
  });
}

beforeAll(async () => {
  runMigrations();
  TANGGAL_KOSONG_HARAPAN = await cariWorkday(1, 15, [5, 10]);
  TANGGAL_MASA_DEPAN = await cariWorkday(16, 31, []);
  const hash = await Bun.password.hash(PASSWORD);

  const tenagaResult = db
    .query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)")
    .run("Tenaga Reports", TENAGA_EMAIL, hash);
  tenagaId = Number(tenagaResult.lastInsertRowid);
  db.query("INSERT INTO user_roles (user_id, role) VALUES (?, 'tenaga_ahli')").run(tenagaId);

  db.query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)").run(
    "Admin Reports",
    "admin.reports@example.test",
    hash,
  );
  db.query("INSERT INTO user_roles (user_id, role) SELECT id, 'admin' FROM users WHERE email = ?").run(
    "admin.reports@example.test",
  );
  const adminToken = (await login("admin.reports@example.test", PASSWORD))!.token;

  const projectRes = await handleCreateProject(
    new Request("http://localhost/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `session=${adminToken}` },
      body: JSON.stringify({ nama: "Project Reports", isActive: true }),
    }),
  );
  projectId = ((await projectRes.json()) as { project: { id: number } }).project.id;

  await handleAddMember(
    new Request(`http://localhost/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `session=${adminToken}` },
      body: JSON.stringify({ userId: tenagaId }),
    }),
    projectId,
  );

  tenagaToken = (await login(TENAGA_EMAIL, PASSWORD))!.token;

  const taskRes = await handleCreateTask(
    new Request("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `session=${tenagaToken}` },
      body: JSON.stringify({ projectId, deskripsi: "Task Reports", tag: "feat(reports)" }),
    }),
  );
  taskId = ((await taskRes.json()) as { task: { id: number } }).task.id;

  db.query("INSERT INTO saran_bulanan (user_id, bulan, isi) VALUES (?, ?, '1) Terapkan CI/CD')").run(tenagaId, BULAN);

  db.query(
    "INSERT INTO task_logs (task_id, user_id, tanggal, jenis, catatan) VALUES (?, ?, ?, 'realisasi', '- Poin satu\n- Poin dua')",
  ).run(taskId, tenagaId, `${BULAN}-05`);
  const logId = db
    .query("SELECT id FROM task_logs WHERE task_id = ? AND tanggal = ?")
    .get(taskId, `${BULAN}-05`) as { id: number };
  db.query(
    "INSERT INTO attachments (attachable_type, attachable_id, file_path, file_type, nama_asli, ukuran_bytes, uploaded_by) VALUES ('task_log', ?, 'attachments/tidak-ada.jpg', 'image/jpeg', 'bukti.jpg', 100, ?)",
  ).run(logId.id, tenagaId);
  db.query("INSERT INTO leaves (user_id, tanggal, jenis) VALUES (?, ?, 'sakit')").run(tenagaId, `${BULAN}-10`);
});

describe("GET /api/reports/monthly", () => {
  test("ditolak tanpa login", async () => {
    const res = await handleMonthlyReportPdf(req(`/api/reports/monthly?bulan=${BULAN}`));
    expect(res.status).toBe(401);
  });

  test("ditolak (400) format bulan salah", async () => {
    const res = await handleMonthlyReportPdf(req("/api/reports/monthly?bulan=2026-3", tenagaToken));
    expect(res.status).toBe(400);
  });

  test("200 + Content-Type application/pdf, byte pertama signature %PDF-, struktur valid", async () => {
    const res = await handleMonthlyReportPdf(req(`/api/reports/monthly?bulan=${BULAN}`, tenagaToken));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");

    const bytes = new Uint8Array(await res.arrayBuffer());
    const signature = new TextDecoder().decode(bytes.slice(0, 5));
    expect(signature).toBe("%PDF-");

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(0);
  });

  test("bulan tanpa data tetap 200 (PDF minimal, bukan error)", async () => {
    const res = await handleMonthlyReportPdf(req("/api/reports/monthly?bulan=2020-01", tenagaToken));
    expect(res.status).toBe(200);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(0);
  });

  test("isolasi antar user — laporan cuma berisi data milik sendiri (tidak error walau user lain punya data)", async () => {
    const lainResult = db
      .query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)")
      .run("User Lain Reports", "lain.reports@example.test", "x");
    const lainId = Number(lainResult.lastInsertRowid);
    db.query(
      "INSERT INTO task_logs (task_id, user_id, tanggal, jenis, catatan) VALUES (?, ?, ?, 'realisasi', 'Punya orang lain')",
    ).run(taskId, lainId, `${BULAN}-06`);

    const res = await handleMonthlyReportPdf(req(`/api/reports/monthly?bulan=${BULAN}`, tenagaToken));
    expect(res.status).toBe(200);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(0);
  });
});

describe("GET /api/reports/monthly-word", () => {
  test("ditolak tanpa login", async () => {
    const res = await handleMonthlyReportWord(req(`/api/reports/monthly-word?bulan=${BULAN}`));
    expect(res.status).toBe(401);
  });

  test("409 kalau belum pernah upload template", async () => {
    const res = await handleMonthlyReportWord(req(`/api/reports/monthly-word?bulan=${BULAN}`, tenagaToken));
    expect(res.status).toBe(409);
  });

  test("200 + Content-Type docx setelah upload template — merge nama/timesheet/aktivitas/lampiran/saran", async () => {
    const uploadRes = await handleUploadLaporanTemplate(
      reqUploadTemplate(tenagaToken, new File([buildMinimalDocx()], "template.docx")),
    );
    expect(uploadRes.status).toBe(201);

    const res = await handleMonthlyReportWord(req(`/api/reports/monthly-word?bulan=${BULAN}`, tenagaToken));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );

    const bytes = new Uint8Array(await res.arrayBuffer());
    const zip = new PizZip(bytes);
    const documentXml = zip.file("word/document.xml")!.asText();
    expect(documentXml).toContain("2026");
    expect(documentXml).toContain("Tenaga Reports");
    expect(documentXml).toContain("feat(reports): Task Reports");
    expect(zip.file(/word\/media\/image\d+\./)!.length).toBeGreaterThan(0);
  });

  test("ditolak (400) format bulan salah", async () => {
    const res = await handleMonthlyReportWord(req("/api/reports/monthly-word?bulan=2026-3", tenagaToken));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/reports/monthly-preview", () => {
  test("ditolak tanpa login", async () => {
    const res = await handleMonthlyReportPreview(req(`/api/reports/monthly-preview?bulan=${BULAN}`));
    expect(res.status).toBe(401);
  });

  test("ditolak (400) format bulan salah", async () => {
    const res = await handleMonthlyReportPreview(req("/api/reports/monthly-preview?bulan=2026-3", tenagaToken));
    expect(res.status).toBe(400);
  });

  test("items cocok data seed — tanggal/project/kegiatan/catatan RAW/status/lampiranCount", async () => {
    const res = await handleMonthlyReportPreview(
      req(`/api/reports/monthly-preview?bulan=${BULAN}`, tenagaToken),
      HARI_INI_PREVIEW,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: {
        tanggal: string;
        projectNama: string;
        kegiatan: string;
        catatan: string | null;
        status: string;
        lampiranCount: number;
      }[];
    };
    const item = body.items.find((i) => i.tanggal === `${BULAN}-05`)!;
    expect(item).toBeDefined();
    expect(item.projectNama).toBe("Project Reports");
    expect(item.kegiatan).toBe("feat(reports): Task Reports");
    expect(item.catatan).toBe("- Poin satu\n- Poin dua"); // RAW markdown, bukan hasil catatanToLines
    expect(item.status).toBe("Proses"); // task belum ditutup
    expect(item.lampiranCount).toBe(1);
  });

  test("tanggalKosong: hari kerja tanpa realisasi sampai hariIni masuk, izin dan masa depan tidak", async () => {
    const res = await handleMonthlyReportPreview(
      req(`/api/reports/monthly-preview?bulan=${BULAN}`, tenagaToken),
      HARI_INI_PREVIEW,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tanggalKosong: string[] };
    expect(body.tanggalKosong).toContain(TANGGAL_KOSONG_HARAPAN);
    expect(body.tanggalKosong).not.toContain(`${BULAN}-05`); // ada realisasi
    expect(body.tanggalKosong).not.toContain(`${BULAN}-10`); // izin, bukan kosong
    expect(body.tanggalKosong).not.toContain(TANGGAL_MASA_DEPAN); // setelah hariIni
  });

  test("timesheet: task+nomor benar, hari sebulan penuh dengan isIzin benar, taskDatesWorked cocok", async () => {
    const res = await handleMonthlyReportPreview(
      req(`/api/reports/monthly-preview?bulan=${BULAN}`, tenagaToken),
      HARI_INI_PREVIEW,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      timesheet: {
        tasks: { no: number; taskId: number; label: string }[];
        hari: { tanggal: string; isWorkday: boolean; isIzin: boolean }[];
        taskDatesWorked: Record<string, string[]>;
      };
    };
    expect(body.timesheet.tasks).toHaveLength(1);
    expect(body.timesheet.tasks[0]!.no).toBe(1);
    expect(body.timesheet.tasks[0]!.label).toBe("feat(reports): Task Reports");
    expect(body.timesheet.hari).toHaveLength(31); // Maret 2026

    const hariIzin = body.timesheet.hari.find((h) => h.tanggal === `${BULAN}-10`)!;
    expect(hariIzin.isIzin).toBe(true);

    const taskId = body.timesheet.tasks[0]!.taskId;
    expect(body.timesheet.taskDatesWorked[String(taskId)]).toContain(`${BULAN}-05`);
  });
});

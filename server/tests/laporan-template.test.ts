import { beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import PizZip from "pizzip";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "laporan-harian-test-")), "test.db");

const { db, runMigrations, storageDir } = await import("../src/db");
const { login } = await import("../src/auth");
const { handleGetMyLaporanTemplate, handleUploadLaporanTemplate, handleDeleteLaporanTemplate, getLaporanTemplatePath } =
  await import("../src/routes/laporan-template");

// Docx minimal valid (bukan file asli pengguna) — cukup untuk lolos validasi ZIP signature dan
// benar-benar dibuka docxtemplater di reports.test.ts, tanpa bergantung ke file pribadi user.
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
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{TA} {BULAN} {NAMA_TENAGA_AHLI} {JABATAN_TENAGA_AHLI} {DATE_END}</w:t></w:r></w:p><w:p><w:r><w:t>{%TIMESHEET}</w:t></w:r></w:p><w:p><w:r><w:t>{%AKTIVITAS}</w:t></w:r></w:p><w:p><w:r><w:t>{%LAMPIRAN_PEKERJAAN}</w:t></w:r></w:p><w:p><w:r><w:t>{%SARAN _REKOMENDASI}</w:t></w:r></w:p></w:body></w:document>`,
  );
  return zip.generate({ type: "uint8array" });
}

const TENAGA_EMAIL = "tenaga.template@example.test";
const PASSWORD = "kata-sandi-aman";
let tenagaId: number;
let tenagaToken: string;

beforeAll(async () => {
  runMigrations();
  const hash = await Bun.password.hash(PASSWORD);
  const tenaga = db
    .query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)")
    .run("Tenaga Template", TENAGA_EMAIL, hash);
  tenagaId = Number(tenaga.lastInsertRowid);
  db.query("INSERT INTO user_roles (user_id, role) VALUES (?, 'tenaga_ahli')").run(tenagaId);
  tenagaToken = (await login(TENAGA_EMAIL, PASSWORD))!.token;
});

function req(method: string, path: string, token?: string): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: token ? { Cookie: `session=${token}` } : {},
  });
}

function reqUpload(token: string | undefined, file: File): Request {
  const form = new FormData();
  form.set("file", file);
  return new Request("http://localhost/api/laporan-template", { method: "POST", headers: token ? { Cookie: `session=${token}` } : {}, body: form });
}

describe("GET /api/laporan-template", () => {
  test("ditolak tanpa login", async () => {
    expect((await handleGetMyLaporanTemplate(req("GET", "/api/laporan-template"))).status).toBe(401);
  });

  test("null kalau belum pernah upload", async () => {
    const res = await handleGetMyLaporanTemplate(req("GET", "/api/laporan-template", tenagaToken));
    const body = (await res.json()) as { template: unknown };
    expect(body.template).toBeNull();
  });
});

describe("POST /api/laporan-template", () => {
  test("ditolak bukan .docx (nama file)", async () => {
    const file = new File([buildMinimalDocx()], "template.pdf", {
      type: "application/pdf",
    });
    const res = await handleUploadLaporanTemplate(reqUpload(tenagaToken, file));
    expect(res.status).toBe(400);
  });

  test("ditolak isi bukan ZIP valid walau nama .docx", async () => {
    const file = new File([new TextEncoder().encode("bukan docx sama sekali")], "palsu.docx");
    const res = await handleUploadLaporanTemplate(reqUpload(tenagaToken, file));
    expect(res.status).toBe(400);
  });

  test("berhasil upload docx valid", async () => {
    const bytes = buildMinimalDocx();
    const file = new File([bytes], "Template Saya.docx");
    const res = await handleUploadLaporanTemplate(reqUpload(tenagaToken, file));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { template: { namaAsli: string } };
    expect(body.template.namaAsli).toBe("Template Saya.docx");

    const path = getLaporanTemplatePath(tenagaId);
    expect(path).not.toBeNull();
    expect(existsSync(path!)).toBe(true);
    expect(path!.startsWith(storageDir)).toBe(true);
  });

  test("upload ulang menimpa (bukan riwayat baru)", async () => {
    const file = new File([buildMinimalDocx()], "Versi Baru.docx");
    const res = await handleUploadLaporanTemplate(reqUpload(tenagaToken, file));
    expect(res.status).toBe(201);

    const rows = db.query("SELECT COUNT(*) as c FROM laporan_template WHERE user_id = ?").get(tenagaId) as { c: number };
    expect(rows.c).toBe(1);

    const getRes = await handleGetMyLaporanTemplate(req("GET", "/api/laporan-template", tenagaToken));
    const body = (await getRes.json()) as { template: { namaAsli: string } };
    expect(body.template.namaAsli).toBe("Versi Baru.docx");
  });
});

describe("DELETE /api/laporan-template", () => {
  test("ditolak tanpa login", async () => {
    expect((await handleDeleteLaporanTemplate(req("DELETE", "/api/laporan-template"))).status).toBe(401);
  });

  test("berhasil hapus, file hilang dari disk", async () => {
    const path = getLaporanTemplatePath(tenagaId)!;
    const res = await handleDeleteLaporanTemplate(req("DELETE", "/api/laporan-template", tenagaToken));
    expect(res.status).toBe(204);
    expect(existsSync(path)).toBe(false);
    expect(getLaporanTemplatePath(tenagaId)).toBeNull();
  });

  test("404 kalau sudah tidak ada", async () => {
    const res = await handleDeleteLaporanTemplate(req("DELETE", "/api/laporan-template", tenagaToken));
    expect(res.status).toBe(404);
  });
});

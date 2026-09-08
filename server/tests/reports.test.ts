import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "laporan-harian-test-")), "test.db");

const { db, runMigrations } = await import("../src/db");
const { login } = await import("../src/auth");
const { handleCreateProject, handleAddMember } = await import("../src/routes/projects");
const { handleCreateTask } = await import("../src/routes/tasks");
const { handleMonthlyReportPdf } = await import("../src/routes/reports");

const TENAGA_EMAIL = "tenaga.reports@example.test";
const PASSWORD = "kata-sandi-aman";
const BULAN = "2026-03";

let tenagaId: number;
let tenagaToken: string;
let projectId: number;
let taskId: number;

function req(path: string, token?: string): Request {
  return new Request(`http://localhost${path}`, {
    headers: token ? { Cookie: `session=${token}` } : {},
  });
}

beforeAll(async () => {
  runMigrations();
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

import { beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "laporan-harian-test-")), "test.db");

const { sqlite: db, runMigrations } = await import("../src/db");
const { storageDir } = await import("../src/db");
const { login } = await import("../src/auth");
const { handleCreateProject, handleAddMember } = await import("../src/routes/projects");
const { handleCreateTask } = await import("../src/routes/tasks");
const { handleSaveDailyInput } = await import("../src/routes/task-logs");
const {
  handleUploadAttachment,
  handleDeleteAttachment,
  handleGetAttachmentFile,
} = await import("../src/routes/attachments");

const TENAGA_EMAIL = "tenaga.attachments@example.test";
const LUAR_EMAIL = "luar.attachments@example.test";
const PASSWORD = "kata-sandi-aman";

// Signature JPEG asli (FF D8 FF) diikuti padding, biar bisa diuji ukuran juga.
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const NOT_IMAGE_BYTES = new TextEncoder().encode("ini bukan gambar sama sekali");

let tenagaId: number;
let tenagaToken: string;
let luarToken: string;
let projectId: number;
let taskId: number;
let realisasiLogId: number;
let rencanaLogId: number;

function req(method: string, path: string, token?: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Cookie: `session=${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function reqUpload(token: string | undefined, taskLogId: number, file: File): Request {
  const form = new FormData();
  form.set("taskLogId", String(taskLogId));
  form.set("file", file);
  return new Request("http://localhost/api/attachments", {
    method: "POST",
    headers: token ? { Cookie: `session=${token}` } : {},
    body: form,
  });
}

beforeAll(async () => {
  runMigrations();
  const hash = await Bun.password.hash(PASSWORD);

  const tenagaResult = db
    .query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)")
    .run("Tenaga Attachments", TENAGA_EMAIL, hash);
  tenagaId = Number(tenagaResult.lastInsertRowid);
  db.query("INSERT INTO user_roles (user_id, role) VALUES (?, 'tenaga_ahli')").run(tenagaId);

  db.query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)").run(
    "Luar Attachments",
    LUAR_EMAIL,
    hash,
  );
  db.query("INSERT INTO user_roles (user_id, role) SELECT id, 'tenaga_ahli' FROM users WHERE email = ?").run(
    LUAR_EMAIL,
  );

  db.query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)").run(
    "Admin Attachments",
    "admin.attachments@example.test",
    hash,
  );
  db.query("INSERT INTO user_roles (user_id, role) SELECT id, 'admin' FROM users WHERE email = ?").run(
    "admin.attachments@example.test",
  );
  const adminToken = (await login("admin.attachments@example.test", PASSWORD))!.token;

  const projectRes = await handleCreateProject(
    req("POST", "/api/projects", adminToken, { nama: "Project Attachments", isActive: true }),
  );
  const projectBody = (await projectRes.json()) as { project: { id: number } };
  projectId = projectBody.project.id;
  await handleAddMember(
    req("POST", `/api/projects/${projectId}/members`, adminToken, { userId: tenagaId }),
    projectId,
  );

  tenagaToken = (await login(TENAGA_EMAIL, PASSWORD))!.token;
  luarToken = (await login(LUAR_EMAIL, PASSWORD))!.token;

  const taskRes = await handleCreateTask(
    req("POST", "/api/tasks", tenagaToken, { projectId, deskripsi: "Task Attachments" }),
  );
  taskId = ((await taskRes.json()) as { task: { id: number } }).task.id;

  const realisasiResult = db
    .query(
      "INSERT INTO task_logs (task_id, user_id, tanggal, jenis, catatan) VALUES (?, ?, '2026-09-07', 'realisasi', 'Sudah dikerjakan')",
    )
    .run(taskId, tenagaId);
  realisasiLogId = Number(realisasiResult.lastInsertRowid);

  const rencanaResult = db
    .query("INSERT INTO task_logs (task_id, user_id, tanggal, jenis) VALUES (?, ?, '2026-09-08', 'rencana')")
    .run(taskId, tenagaId);
  rencanaLogId = Number(rencanaResult.lastInsertRowid);
});

describe("POST /api/attachments", () => {
  test("ditolak tanpa login", async () => {
    const file = new File([JPEG_BYTES], "foto.jpg", { type: "image/jpeg" });
    const res = await handleUploadAttachment(reqUpload(undefined, realisasiLogId, file));
    expect(res.status).toBe(401);
  });

  test("ditolak (404) task_log tidak ada", async () => {
    const file = new File([JPEG_BYTES], "foto.jpg", { type: "image/jpeg" });
    const res = await handleUploadAttachment(reqUpload(tenagaToken, 999999, file));
    expect(res.status).toBe(404);
  });

  test("ditolak (403) bukan pemilik log", async () => {
    const file = new File([JPEG_BYTES], "foto.jpg", { type: "image/jpeg" });
    const res = await handleUploadAttachment(reqUpload(luarToken, realisasiLogId, file));
    expect(res.status).toBe(403);
  });

  test("ditolak (400) log jenis rencana", async () => {
    const file = new File([JPEG_BYTES], "foto.jpg", { type: "image/jpeg" });
    const res = await handleUploadAttachment(reqUpload(tenagaToken, rencanaLogId, file));
    expect(res.status).toBe(400);
  });

  test("ditolak (400) bukan gambar walau diklaim image/jpeg (validasi signature asli)", async () => {
    const file = new File([NOT_IMAGE_BYTES], "menyamar.jpg", { type: "image/jpeg" });
    const res = await handleUploadAttachment(reqUpload(tenagaToken, realisasiLogId, file));
    expect(res.status).toBe(400);
  });

  test("ditolak (400) ukuran lebih dari 5 MB", async () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(JPEG_BYTES);
    const file = new File([big], "besar.jpg", { type: "image/jpeg" });
    const res = await handleUploadAttachment(reqUpload(tenagaToken, realisasiLogId, file));
    expect(res.status).toBe(400);
  });

  test("berhasil upload JPG valid", async () => {
    const file = new File([JPEG_BYTES], "bukti.jpg", { type: "image/jpeg" });
    const res = await handleUploadAttachment(reqUpload(tenagaToken, realisasiLogId, file));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { attachment: { id: number; namaAsli: string; fileType: string } };
    expect(body.attachment.namaAsli).toBe("bukti.jpg");
    expect(body.attachment.fileType).toBe("image/jpeg");

    const row = db.query("SELECT file_path FROM attachments WHERE id = ?").get(body.attachment.id) as {
      file_path: string;
    };
    expect(row.file_path).toStartWith("attachments/2026/09/07/");
    expect(existsSync(join(storageDir, row.file_path))).toBe(true);
  });

  test("berhasil upload PNG valid", async () => {
    const file = new File([PNG_BYTES], "bukti.png", { type: "image/png" });
    const res = await handleUploadAttachment(reqUpload(tenagaToken, realisasiLogId, file));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { attachment: { fileType: string } };
    expect(body.attachment.fileType).toBe("image/png");
  });

  test("ditolak (400) sudah 5 lampiran, upload ke-6 ditolak", async () => {
    // Sudah ada 2 dari test sebelumnya, tambah 3 lagi supaya pas 5.
    for (let i = 0; i < 3; i++) {
      const file = new File([JPEG_BYTES], `tambahan-${i}.jpg`, { type: "image/jpeg" });
      const res = await handleUploadAttachment(reqUpload(tenagaToken, realisasiLogId, file));
      expect(res.status).toBe(201);
    }
    const file = new File([JPEG_BYTES], "ke-enam.jpg", { type: "image/jpeg" });
    const res = await handleUploadAttachment(reqUpload(tenagaToken, realisasiLogId, file));
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/attachments/:id dan GET /api/attachments/:id/file", () => {
  let attachmentId: number;
  let filePath: string;

  beforeAll(async () => {
    const file = new File([JPEG_BYTES], "untuk-dihapus.jpg", { type: "image/jpeg" });
    const res = await handleUploadAttachment(reqUpload(tenagaToken, rencanaLogIdRealisasiBaru(), file));
    const body = (await res.json()) as { attachment: { id: number } };
    attachmentId = body.attachment.id;
    const row = db.query("SELECT file_path FROM attachments WHERE id = ?").get(attachmentId) as {
      file_path: string;
    };
    filePath = row.file_path;
  });

  // Butuh task_log realisasi baru (bukan realisasiLogId yang sudah penuh 5 lampiran).
  function rencanaLogIdRealisasiBaru(): number {
    const result = db
      .query(
        "INSERT INTO task_logs (task_id, user_id, tanggal, jenis, catatan) VALUES (?, ?, '2026-09-06', 'realisasi', 'Log lain')",
      )
      .run(taskId, tenagaId);
    return Number(result.lastInsertRowid);
  }

  test("lihat file ditolak tanpa login", async () => {
    const res = await handleGetAttachmentFile(req("GET", `/api/attachments/${attachmentId}/file`), attachmentId);
    expect(res.status).toBe(401);
  });

  test("lihat file ditolak (403) bukan pemilik", async () => {
    const res = await handleGetAttachmentFile(
      req("GET", `/api/attachments/${attachmentId}/file`, luarToken),
      attachmentId,
    );
    expect(res.status).toBe(403);
  });

  test("lihat file berhasil, Content-Type sesuai", async () => {
    const res = await handleGetAttachmentFile(
      req("GET", `/api/attachments/${attachmentId}/file`, tenagaToken),
      attachmentId,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
  });

  test("hapus ditolak (403) bukan pemilik", async () => {
    const res = await handleDeleteAttachment(
      req("DELETE", `/api/attachments/${attachmentId}`, luarToken),
      attachmentId,
    );
    expect(res.status).toBe(403);
  });

  test("hapus berhasil (204), hilang dari DB dan disk", async () => {
    const res = await handleDeleteAttachment(
      req("DELETE", `/api/attachments/${attachmentId}`, tenagaToken),
      attachmentId,
    );
    expect(res.status).toBe(204);
    const row = db.query("SELECT id FROM attachments WHERE id = ?").get(attachmentId);
    expect(row).toBeNull();
    expect(existsSync(join(storageDir, filePath))).toBe(false);
  });

  test("hapus ditolak (404) lampiran tidak ada", async () => {
    const res = await handleDeleteAttachment(
      req("DELETE", `/api/attachments/${attachmentId}`, tenagaToken),
      attachmentId,
    );
    expect(res.status).toBe(404);
  });
});

describe("Efek uncheck checklist ikut membersihkan attachment (bukan FK sungguhan, ADR-0016)", () => {
  test("uncheck checklist yang punya attachment, simpan ulang -> attachment ikut terhapus", async () => {
    // Rencana kemarin (tanggal khusus, belum dipakai test lain di file ini).
    const tanggalRencana = "2026-09-10";
    const tanggalLaporan = "2026-09-11"; // previousWorkday-nya = tanggalRencana (asumsi hari kerja)
    db.query("INSERT INTO task_logs (task_id, user_id, tanggal, jenis) VALUES (?, ?, ?, 'rencana')").run(
      taskId,
      tenagaId,
      tanggalRencana,
    );
    const realisasiBaru = db
      .query(
        "INSERT INTO task_logs (task_id, user_id, tanggal, jenis, catatan) VALUES (?, ?, ?, 'realisasi', 'Ada isinya')",
      )
      .run(taskId, tenagaId, tanggalRencana);
    const taskLogIdBaru = Number(realisasiBaru.lastInsertRowid);

    const file = new File([JPEG_BYTES], "bakal-hilang.jpg", { type: "image/jpeg" });
    const uploadRes = await handleUploadAttachment(reqUpload(tenagaToken, taskLogIdBaru, file));
    expect(uploadRes.status).toBe(201);
    const uploadBody = (await uploadRes.json()) as { attachment: { id: number } };
    const attachmentRow = db
      .query("SELECT file_path FROM attachments WHERE id = ?")
      .get(uploadBody.attachment.id) as { file_path: string };

    // Simpan ulang TANPA item realisasi untuk task ini -> efek uncheck menghapus task_log-nya.
    const saveRes = await handleSaveDailyInput(
      req("POST", "/api/task-logs", tenagaToken, {
        tanggal: tanggalLaporan,
        items: [{ taskId, jenis: "rencana" }],
      }),
      tanggalLaporan,
    );
    expect(saveRes.status).toBe(200);

    const remainingAttachment = db.query("SELECT id FROM attachments WHERE id = ?").get(uploadBody.attachment.id);
    expect(remainingAttachment).toBeNull();
    expect(existsSync(join(storageDir, attachmentRow.file_path))).toBe(false);
  });
});

import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "laporan-harian-test-")), "test.db");

const { db, runMigrations } = await import("../src/db");
const { login } = await import("../src/auth");
const { handleCreateProject, handleAddMember } = await import("../src/routes/projects");
const { handleCreateTask } = await import("../src/routes/tasks");
const { handleGetDailyInput, handleSaveDailyInput } = await import("../src/routes/task-logs");

const TENAGA_EMAIL = "tenaga.logs@example.test";
const REKAN_EMAIL = "rekan.logs@example.test";
const PASSWORD = "kata-sandi-aman";

// Dipilih di Oktober 2026 (Kamis, tidak beririsan dengan tanggal libur yang di-insert file
// test lain — db dibagi lintas file dalam satu proses "bun test") supaya simulasi murni
// berdasarkan aturan Senin-Jumat, tanpa bergantung isi tabel holidays.
const HARI_A = "2026-10-08"; // Kamis
const HARI_B = "2026-10-09"; // Jumat — previousWorkday = Kamis (Hari A)
const HARI_C = "2026-10-12"; // Senin — previousWorkday = Jumat (Hari B), melompati akhir pekan

let tenagaId: number;
let rekanId: number;
let tenagaToken: string;
let rekanToken: string;
let projectId: number;
let taskXId: number;
let taskYId: number;

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

beforeAll(async () => {
  runMigrations();
  const hash = await Bun.password.hash(PASSWORD);

  const tenagaResult = db
    .query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)")
    .run("Tenaga Logs", TENAGA_EMAIL, hash);
  tenagaId = Number(tenagaResult.lastInsertRowid);
  db.query("INSERT INTO user_roles (user_id, role) VALUES (?, 'tenaga_ahli')").run(tenagaId);

  const rekanResult = db
    .query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)")
    .run("Rekan Logs", REKAN_EMAIL, hash);
  rekanId = Number(rekanResult.lastInsertRowid);
  db.query("INSERT INTO user_roles (user_id, role) VALUES (?, 'tenaga_ahli')").run(rekanId);

  db.query("INSERT INTO users (nama, email, password_hash) VALUES (?, ?, ?)").run(
    "Admin Logs",
    "admin.logs@example.test",
    hash,
  );
  db.query("INSERT INTO user_roles (user_id, role) SELECT id, 'admin' FROM users WHERE email = ?").run(
    "admin.logs@example.test",
  );
  const adminToken = (await login("admin.logs@example.test", PASSWORD))!.token;

  const projectRes = await handleCreateProject(
    req("POST", "/api/projects", adminToken, { nama: "Project Logs", isActive: true }),
  );
  const projectBody = (await projectRes.json()) as { project: { id: number } };
  projectId = projectBody.project.id;
  await handleAddMember(req("POST", `/api/projects/${projectId}/members`, adminToken, { userId: tenagaId }), projectId);
  await handleAddMember(req("POST", `/api/projects/${projectId}/members`, adminToken, { userId: rekanId }), projectId);

  tenagaToken = (await login(TENAGA_EMAIL, PASSWORD))!.token;
  rekanToken = (await login(REKAN_EMAIL, PASSWORD))!.token;

  const taskXRes = await handleCreateTask(
    req("POST", "/api/tasks", tenagaToken, { projectId, deskripsi: "Task X" }),
  );
  taskXId = ((await taskXRes.json()) as { task: { id: number } }).task.id;
  const taskYRes = await handleCreateTask(
    req("POST", "/api/tasks", tenagaToken, { projectId, deskripsi: "Task Y" }),
  );
  taskYId = ((await taskYRes.json()) as { task: { id: number } }).task.id;
});

describe("Hari A — cold start, tanpa rencana sebelumnya", () => {
  test("checklist kosong karena belum pernah ada rencana", () => {
    const res = handleGetDailyInput(req("GET", "/api/task-logs/today", tenagaToken), HARI_A);
    expect(res.status).toBe(200);
    return res.json().then((body: { checklist: unknown[]; hariKerjaSebelumnya: string }) => {
      expect(body.checklist).toEqual([]);
      expect(body.hariKerjaSebelumnya).toBe("2026-10-07"); // Rabu, hari kerja biasa sebelum Kamis
    });
  });

  test("catatan realisasi kosong ditolak", async () => {
    const res = await handleSaveDailyInput(
      req("POST", "/api/task-logs", tenagaToken, {
        items: [{ taskId: taskXId, jenis: "realisasi", catatan: "   ", isExtra: true }],
      }),
      HARI_A,
    );
    expect(res.status).toBe(400);
  });

  test("kegagalan satu item tidak menyisakan simpan parsial", async () => {
    const res = await handleSaveDailyInput(
      req("POST", "/api/task-logs", tenagaToken, {
        items: [
          { taskId: taskXId, jenis: "realisasi", catatan: "Valid", isExtra: true },
          { taskId: taskYId, jenis: "realisasi", catatan: "", isExtra: true },
        ],
      }),
      HARI_A,
    );
    expect(res.status).toBe(400);
    const row = db
      .query("SELECT id FROM task_logs WHERE user_id = ? AND task_id = ?")
      .get(tenagaId, taskXId);
    expect(row).toBeNull();
  });

  test("kerjaan tambahan (cold start) berhasil, plus rencana hari ini", async () => {
    const res = await handleSaveDailyInput(
      req("POST", "/api/task-logs", tenagaToken, {
        items: [
          { taskId: taskXId, jenis: "realisasi", catatan: "Kerjaan kemarin manual", isExtra: true },
          { taskId: taskXId, jenis: "rencana" },
          { taskId: taskYId, jenis: "rencana" },
        ],
      }),
      HARI_A,
    );
    expect(res.status).toBe(200);
  });

  // ADR-0043: catatan rencana boleh berisi checkbox markdown, dibaca balik apa adanya lewat
  // GET /task-logs/today — todo-list opsional ini bukan data terstruktur.
  test("catatan rencana dengan checkbox markdown tersimpan dan terbaca balik", async () => {
    const catatan = "- [ ] siapkan draft\n- [x] baca dokumen";
    const saveRes = await handleSaveDailyInput(
      req("POST", "/api/task-logs", tenagaToken, {
        items: [{ taskId: taskXId, jenis: "rencana", catatan }],
      }),
      HARI_A,
    );
    expect(saveRes.status).toBe(200);

    const getRes = handleGetDailyInput(req("GET", "/api/task-logs/today", tenagaToken), HARI_A);
    const body = (await getRes.json()) as { rencanaHariIni: { taskId: number; catatan: string | null }[] };
    expect(body.rencanaHariIni.find((r) => r.taskId === taskXId)?.catatan).toBe(catatan);
  });
});

describe("Hari B — realisasi sebagian dari rencana Hari A", () => {
  test("checklist berisi Task X dan Task Y dari rencana Hari A", async () => {
    const res = handleGetDailyInput(req("GET", "/api/task-logs/today", tenagaToken), HARI_B);
    const body = (await res.json()) as {
      checklist: { taskId: number; realisasiCatatan: string | null; rencanaCatatan: string | null }[];
    };
    expect(body.checklist.map((c) => c.taskId).sort()).toEqual([taskXId, taskYId].sort());
    expect(body.checklist.every((c) => c.realisasiCatatan === null)).toBe(true);

    // ADR-0043/review user: catatan rencana (termasuk checklist markdown) harus tetap terlihat
    // di checklist realisasi besoknya, bukan hilang begitu rencana jadi item checklist.
    const taskX = body.checklist.find((c) => c.taskId === taskXId);
    expect(taskX?.rencanaCatatan).toBe("- [ ] siapkan draft\n- [x] baca dokumen");
  });

  test("centang Task X saja (realisasi sebagian) + tambahan + rencana baru", async () => {
    const res = await handleSaveDailyInput(
      req("POST", "/api/task-logs", tenagaToken, {
        items: [
          { taskId: taskXId, jenis: "realisasi", catatan: "Task X beres" },
          { newTask: { projectId, deskripsi: "Task tambahan hari B" }, jenis: "realisasi", catatan: "Kerjaan ekstra", isExtra: true },
          { taskId: taskXId, jenis: "rencana" },
        ],
      }),
      HARI_B,
    );
    expect(res.status).toBe(200);
  });

  test("Task Y yang tidak dicentang tidak menghasilkan realisasi", () => {
    const row = db
      .query("SELECT id FROM task_logs WHERE user_id = ? AND task_id = ? AND tanggal = ? AND jenis = 'realisasi'")
      .get(tenagaId, taskYId, HARI_A);
    expect(row).toBeNull();
  });

  test("GET ulang menunjukkan Task X sudah terisi, tambahan muncul terpisah", async () => {
    const res = handleGetDailyInput(req("GET", "/api/task-logs/today", tenagaToken), HARI_B);
    const body = (await res.json()) as {
      checklist: { taskId: number; realisasiCatatan: string | null }[];
      tambahan: { deskripsi: string }[];
    };
    const taskX = body.checklist.find((c) => c.taskId === taskXId);
    expect(taskX?.realisasiCatatan).toBe("Task X beres");
    expect(body.tambahan.some((t) => t.deskripsi === "Task tambahan hari B")).toBe(true);
  });

  test("submit ulang hari yang sama meng-update, bukan menggandakan baris", async () => {
    await handleSaveDailyInput(
      req("POST", "/api/task-logs", tenagaToken, {
        items: [{ taskId: taskXId, jenis: "realisasi", catatan: "Task X beres (revisi)" }],
      }),
      HARI_B,
    );
    const rows = db
      .query("SELECT catatan FROM task_logs WHERE user_id = ? AND task_id = ? AND tanggal = ? AND jenis = 'realisasi'")
      .all(tenagaId, taskXId, HARI_A) as { catatan: string }[];
    expect(rows.length).toBe(1);
    expect(rows[0]!.catatan).toBe("Task X beres (revisi)");
  });

  test("dua user beda bisa realisasi task+tanggal yang sama, catatan terpisah", async () => {
    const res = await handleSaveDailyInput(
      req("POST", "/api/task-logs", rekanToken, {
        items: [{ taskId: taskXId, jenis: "realisasi", catatan: "Catatan rekan", isExtra: true }],
      }),
      HARI_B,
    );
    expect(res.status).toBe(200);

    const tenagaRow = db
      .query("SELECT catatan FROM task_logs WHERE user_id = ? AND task_id = ? AND tanggal = ? AND jenis = 'realisasi'")
      .get(tenagaId, taskXId, HARI_A) as { catatan: string };
    const rekanRow = db
      .query("SELECT catatan FROM task_logs WHERE user_id = ? AND task_id = ? AND tanggal = ? AND jenis = 'realisasi'")
      .get(rekanId, taskXId, HARI_A) as { catatan: string };
    expect(tenagaRow.catatan).toBe("Task X beres (revisi)");
    expect(rekanRow.catatan).toBe("Catatan rekan");
  });
});

// ADR-0044: uncheck item checklist realisasi yang sudah tersimpan lalu simpan ulang tanpa
// item itu harus menghapus barisnya, bukan membiarkannya nyangkut (Q-05).
describe("Efek uncheck (ADR-0044)", () => {
  test("submit ulang Hari B tanpa realisasi Task X menghapus baris lamanya", async () => {
    const before = db
      .query("SELECT id FROM task_logs WHERE user_id = ? AND task_id = ? AND tanggal = ? AND jenis = 'realisasi'")
      .get(tenagaId, taskXId, HARI_A);
    expect(before).not.toBeNull();

    // Cuma kirim ulang rencana yang sudah ada (no-op upsert) — tidak ada item realisasi sama
    // sekali, jadi checklist Task X (dan Task Y) di Hari A dianggap di-uncheck semua.
    const res = await handleSaveDailyInput(
      req("POST", "/api/task-logs", tenagaToken, { items: [{ taskId: taskXId, jenis: "rencana" }] }),
      HARI_B,
    );
    expect(res.status).toBe(200);

    const after = db
      .query("SELECT id FROM task_logs WHERE user_id = ? AND task_id = ? AND tanggal = ? AND jenis = 'realisasi'")
      .get(tenagaId, taskXId, HARI_A);
    expect(after).toBeNull();
  });
});

describe("Hari C — melompati akhir pekan, memakai rencana baru dari Hari B", () => {
  test("checklist berisi rencana baru (Task X) yang dibuat di Hari B", async () => {
    const res = handleGetDailyInput(req("GET", "/api/task-logs/today", tenagaToken), HARI_C);
    const body = (await res.json()) as { checklist: { taskId: number }[]; hariKerjaSebelumnya: string };
    expect(body.hariKerjaSebelumnya).toBe(HARI_B);
    expect(body.checklist.map((c) => c.taskId)).toEqual([taskXId]);
  });
});

// ADR-0042: opsi "Lainnya" — project usulan dibuat dalam transaksi simpan yang sama dengan
// task & catatannya, bukan lebih dulu secara terpisah, supaya tidak ada project nyantol tanpa
// task/catatan kalau submit gagal atau dibatalkan (bug yang sempat ditemukan: project keburu
// dibuat begitu klik "Tambahkan ke draft", padahal draft itu sendiri belum tentu jadi "Simpan").
describe("newTask.projectBaru — usulan project 'Lainnya'", () => {
  test("berhasil: project baru, keanggotaan, task, dan log semuanya tercipta sekaligus", async () => {
    const res = await handleSaveDailyInput(
      req("POST", "/api/task-logs", tenagaToken, {
        items: [
          {
            newTask: { projectBaru: "SI-Uji ProjectBaru", deskripsi: "Setup awal" },
            jenis: "realisasi",
            catatan: "mulai setup",
            isExtra: true,
          },
        ],
      }),
      HARI_A,
    );
    expect(res.status).toBe(200);

    const project = db
      .query<{ id: number; belum_direkonsiliasi: number }, [string]>(
        "SELECT id, belum_direkonsiliasi FROM projects WHERE nama = ?",
      )
      .get("SI-Uji ProjectBaru");
    expect(project?.belum_direkonsiliasi).toBe(1);

    const membership = db
      .query("SELECT ended_at FROM user_project WHERE user_id = ? AND project_id = ?")
      .get(tenagaId, project!.id) as { ended_at: string | null };
    expect(membership?.ended_at).toBeNull();

    const task = db
      .query("SELECT id FROM tasks WHERE project_id = ? AND deskripsi = ?")
      .get(project!.id, "Setup awal") as { id: number };
    const log = db
      .query("SELECT catatan FROM task_logs WHERE task_id = ? AND user_id = ?")
      .get(task.id, tenagaId) as { catatan: string };
    expect(log.catatan).toBe("mulai setup");
  });

  test("gagal validasi (catatan kosong) tidak menyisakan project nyantol tanpa task", async () => {
    const res = await handleSaveDailyInput(
      req("POST", "/api/task-logs", tenagaToken, {
        items: [
          {
            newTask: { projectBaru: "SI-Uji Batal", deskripsi: "Tidak jadi" },
            jenis: "realisasi",
            catatan: "   ",
            isExtra: true,
          },
        ],
      }),
      HARI_A,
    );
    expect(res.status).toBe(400);

    const project = db.query("SELECT id FROM projects WHERE nama = ?").get("SI-Uji Batal");
    expect(project).toBeNull();
  });

  test("satu item gagal dalam submit gabungan membatalkan seluruhnya, termasuk project baru", async () => {
    const res = await handleSaveDailyInput(
      req("POST", "/api/task-logs", tenagaToken, {
        items: [
          {
            newTask: { projectBaru: "SI-Uji Gabungan", deskripsi: "Task sah" },
            jenis: "realisasi",
            catatan: "Catatan sah",
            isExtra: true,
          },
          { taskId: taskXId, jenis: "realisasi", catatan: "" },
        ],
      }),
      HARI_A,
    );
    expect(res.status).toBe(400);

    const project = db.query("SELECT id FROM projects WHERE nama = ?").get("SI-Uji Gabungan");
    expect(project).toBeNull();
  });
});

describe("Otorisasi", () => {
  test("GET tanpa login ditolak", () => {
    const res = handleGetDailyInput(req("GET", "/api/task-logs/today"), HARI_A);
    expect(res.status).toBe(401);
  });

  test("POST realisasi pada task di project yang bukan keanggotaannya ditolak (403)", async () => {
    const res = await handleSaveDailyInput(
      req("POST", "/api/task-logs", tenagaToken, {
        items: [{ taskId: 999999, jenis: "realisasi", catatan: "Percobaan" }],
      }),
      HARI_A,
    );
    expect(res.status).toBe(404);
  });
});

// ADR-0008/0009: tanggal laporan cuma boleh dalam bulan berjalan (relatif hari ini sungguhan).
describe("Bulan berjalan (ADR-0008/0009)", () => {
  test("GET dengan tanggal di bulan lalu ditolak (400)", () => {
    const res = handleGetDailyInput(req("GET", "/api/task-logs/daily?tanggal=2026-09-30", tenagaToken), HARI_A);
    expect(res.status).toBe(400);
  });

  test("POST dengan tanggal di bulan lalu ditolak (400)", async () => {
    const res = await handleSaveDailyInput(
      req("POST", "/api/task-logs", tenagaToken, {
        tanggal: "2026-09-30",
        items: [{ taskId: taskXId, jenis: "rencana" }],
      }),
      HARI_A,
    );
    expect(res.status).toBe(400);
  });

  test("GET/POST tanggal backdate dalam bulan berjalan yang sama diterima", async () => {
    const getRes = handleGetDailyInput(req("GET", `/api/task-logs/daily?tanggal=${HARI_B}`, tenagaToken), HARI_C);
    expect(getRes.status).toBe(200);

    const postRes = await handleSaveDailyInput(
      req("POST", "/api/task-logs", tenagaToken, { tanggal: HARI_B, items: [{ taskId: taskXId, jenis: "rencana" }] }),
      HARI_C,
    );
    expect(postRes.status).toBe(200);
  });
});

// ADR-0030: pengecualian realisasi lintas-bulan cuma berlaku persis saat tanggal laporan =
// hari ini sungguhan (hari kerja pertama bulan baru), tidak terbuka lagi keesokan harinya.
describe("Pengecualian lintas-bulan (ADR-0030)", () => {
  const AWAL_NOVEMBER = "2026-11-02"; // Senin, hari kerja pertama November (1 Nov = Minggu)
  const SEHARI_SETELAHNYA = "2026-11-03"; // Selasa — pengecualian sudah tidak berlaku lagi

  test("realisasi hari kerja terakhir Oktober diterima persis di hari kerja pertama November", async () => {
    const res = await handleSaveDailyInput(
      req("POST", "/api/task-logs", tenagaToken, {
        items: [{ taskId: taskXId, jenis: "realisasi", catatan: "Realisasi akhir Oktober", isExtra: true }],
      }),
      AWAL_NOVEMBER,
    );
    expect(res.status).toBe(200);
  });

  test("backdate ke tanggal itu di hari berikutnya ditolak, pengecualian tidak terbuka lagi", async () => {
    const res = await handleSaveDailyInput(
      req("POST", "/api/task-logs", tenagaToken, {
        tanggal: AWAL_NOVEMBER,
        items: [{ taskId: taskXId, jenis: "realisasi", catatan: "Percobaan telat", isExtra: true }],
      }),
      SEHARI_SETELAHNYA,
    );
    expect(res.status).toBe(400);
  });
});

// ADR-0014: realisasi tidak boleh bentrok dengan izin/cuti/sakit pada tanggal yang sama.
describe("Konflik dengan izin (ADR-0014)", () => {
  const HARI_IZIN = "2026-10-12"; // Senin — dipakai sebagai hariKerjaSebelumnya di test ini
  const HARI_LAPORAN = "2026-10-13"; // Selasa, previousWorkday = HARI_IZIN

  test("realisasi ditolak (409) kalau hari kerja sebelumnya sudah tercatat izin", async () => {
    db.query("INSERT INTO leaves (user_id, tanggal, jenis) VALUES (?, ?, 'sakit')").run(tenagaId, HARI_IZIN);

    const res = await handleSaveDailyInput(
      req("POST", "/api/task-logs", tenagaToken, {
        items: [{ taskId: taskXId, jenis: "realisasi", catatan: "Tetap coba isi", isExtra: true }],
      }),
      HARI_LAPORAN,
    );
    expect(res.status).toBe(409);
  });
});

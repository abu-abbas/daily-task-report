import { requireLogin } from "../authz";
import { z } from "zod/v4";
import { db } from "../db";
import { errorResponse, json } from "../http";
import { dalamBulanBerjalan, previousWorkday, realisasiTanggalDiizinkan, todayJakarta } from "../kalender";
import { isActiveProjectMember } from "./projects";
import { deleteAttachmentsByTaskLogIds } from "./attachments";

interface ChecklistRow {
  taskId: number;
  deskripsi: string;
  tag: string | null;
  projectId: number;
  projectNama: string;
  taskStatus: "open" | "closed";
}

export interface KendalaPublic {
  id: number;
  taskLogId: number;
  deskripsi: string;
  status: "open" | "resolved";
}

// Kendala cuma untuk log realisasi (ADR-0015) — dipanggil sekali per taskLogId yang relevan
// (checklist + tambahan hari ini), bukan query N+1 per item.
export function kendalaByTaskLogId(taskLogIds: number[]): Map<number, KendalaPublic[]> {
  const map = new Map<number, KendalaPublic[]>();
  if (taskLogIds.length === 0) return map;
  const placeholders = taskLogIds.map(() => "?").join(",");
  const rows = db
    .query<{ id: number; taskLogId: number; deskripsi: string; status: "open" | "resolved" }, number[]>(
      `SELECT id, task_log_id AS taskLogId, deskripsi, status FROM kendala WHERE task_log_id IN (${placeholders})`,
    )
    .all(...taskLogIds);
  for (const row of rows) {
    const list = map.get(row.taskLogId) ?? [];
    list.push(row);
    map.set(row.taskLogId, list);
  }
  return map;
}

export interface AttachmentPublic {
  id: number;
  namaAsli: string;
  fileType: string | null;
  ukuranBytes: number;
  uploadedAt: string;
}

// Attachment cuma untuk log realisasi (ADR-0016) — pola sama kendalaByTaskLogId, sekali jalan
// per taskLogId yang relevan, bukan N+1.
export function attachmentsByTaskLogId(taskLogIds: number[]): Map<number, AttachmentPublic[]> {
  const map = new Map<number, AttachmentPublic[]>();
  if (taskLogIds.length === 0) return map;
  const placeholders = taskLogIds.map(() => "?").join(",");
  const rows = db
    .query<AttachmentPublic & { taskLogId: number }, number[]>(
      `SELECT id, attachable_id AS taskLogId, nama_asli AS namaAsli, file_type AS fileType, ukuran_bytes AS ukuranBytes, uploaded_at AS uploadedAt
       FROM attachments WHERE attachable_type = 'task_log' AND attachable_id IN (${placeholders})`,
    )
    .all(...taskLogIds);
  for (const row of rows) {
    const list = map.get(row.taskLogId) ?? [];
    list.push(row);
    map.set(row.taskLogId, list);
  }
  return map;
}

interface RencanaChecklistRow extends ChecklistRow {
  rencanaCatatan: string | null;
}

const TANGGAL_RE = /^\d{4}-\d{2}-\d{2}$/;

// Checklist realisasi hari ini = rencana milik user pada hari kerja sebelumnya (ADR-0006).
// Rencana yang diisi hari ini bertanggal hari ini juga (tanggal laporan), bukan besok — satu
// submit boleh berisi realisasi kemarin dan rencana hari ini sekaligus (ADR-0007). Kerjaan
// tambahan/rencana memakai tabel yang sama, dibedakan lewat jenis/is_extra.
// hariIniOverride: hanya dipakai test untuk mensimulasikan "hari ini" tertentu tanpa
// bergantung pada tanggal asli saat test dijalankan. Route asli (index.ts) memanggil tanpa
// argumen ini, selalu memakai todayJakarta() sungguhan. tanggal (laporan yang dilihat/diisi)
// datang dari klien lewat query string — bisa backdate dalam bulan berjalan (ADR-0008/0009).
export function handleGetDailyInput(req: Request, hariIniOverride?: string): Response {
  const ctx = requireLogin(req);
  if (ctx instanceof Response) return ctx;

  const hariIni = hariIniOverride ?? todayJakarta();
  const tanggalParam = new URL(req.url).searchParams.get("tanggal");
  if (tanggalParam !== null && !TANGGAL_RE.test(tanggalParam)) {
    return errorResponse(400, "Format tanggal tidak valid.");
  }
  const tanggal = tanggalParam ?? hariIni;
  if (!dalamBulanBerjalan(tanggal, hariIni)) {
    return errorResponse(400, "Tanggal laporan di luar bulan berjalan.");
  }
  const hariKerjaSebelumnya = previousWorkday(tanggal);

  // rencanaCatatan (bukan cuma deskripsi/badge) ikut dikirim supaya checklist-di-dalam-catatan
  // rencana (ADR-0043) tetap terlihat sebagai referensi saat mengisi realisasi besok — sebelumnya
  // hilang total begitu rencana jadi item checklist, user tidak bisa lihat lagi apa yang direncanakan.
  const checklistRows = db
    .query<RencanaChecklistRow, [number, string]>(
      `SELECT tl.task_id AS taskId, tl.catatan AS rencanaCatatan, t.deskripsi, t.tag, t.status AS taskStatus, t.project_id AS projectId, p.nama AS projectNama
       FROM task_logs tl
       JOIN tasks t ON t.id = tl.task_id
       JOIN projects p ON p.id = t.project_id
       WHERE tl.user_id = ? AND tl.tanggal = ? AND tl.jenis = 'rencana'
       ORDER BY t.deskripsi`,
    )
    .all(ctx.user.id, hariKerjaSebelumnya);

  const realisasiRows = db
    .query<{ id: number; taskId: number; catatan: string | null; isExtra: number }, [number, string]>(
      `SELECT id, task_id AS taskId, catatan, is_extra AS isExtra FROM task_logs
       WHERE user_id = ? AND tanggal = ? AND jenis = 'realisasi'`,
    )
    .all(ctx.user.id, hariKerjaSebelumnya);
  const realisasiByTask = new Map(
    realisasiRows.filter((r) => r.isExtra === 0).map((r) => [r.taskId, { taskLogId: r.id, catatan: r.catatan }]),
  );

  const tambahan = db
    .query<ChecklistRow & { taskLogId: number; catatan: string | null }, [number, string]>(
      `SELECT tl.id AS taskLogId, tl.task_id AS taskId, tl.catatan, t.deskripsi, t.tag, t.status AS taskStatus, t.project_id AS projectId, p.nama AS projectNama
       FROM task_logs tl
       JOIN tasks t ON t.id = tl.task_id
       JOIN projects p ON p.id = t.project_id
       WHERE tl.user_id = ? AND tl.tanggal = ? AND tl.jenis = 'realisasi' AND tl.is_extra = 1
       ORDER BY t.deskripsi`,
    )
    .all(ctx.user.id, hariKerjaSebelumnya);

  // Kendala + attachment cuma untuk log realisasi (ADR-0015/ADR-0016): checklist yang sudah
  // pernah direalisasi + kerjaan tambahan hari ini, diambil sekali jalan lalu ditempel per
  // taskLogId.
  const relevantTaskLogIds = [
    ...realisasiRows.filter((r) => r.isExtra === 0).map((r) => r.id),
    ...tambahan.map((r) => r.taskLogId),
  ];
  const kendalaMap = kendalaByTaskLogId(relevantTaskLogIds);
  const attachmentMap = attachmentsByTaskLogId(relevantTaskLogIds);

  const checklist = checklistRows.map((r) => {
    const realisasi = realisasiByTask.get(r.taskId);
    return {
      ...r,
      realisasiCatatan: realisasi?.catatan ?? null,
      taskLogId: realisasi?.taskLogId ?? null,
      kendala: realisasi ? (kendalaMap.get(realisasi.taskLogId) ?? []) : [],
      attachments: realisasi ? (attachmentMap.get(realisasi.taskLogId) ?? []) : [],
    };
  });

  const tambahanFinal = tambahan.map((r) => ({
    ...r,
    kendala: kendalaMap.get(r.taskLogId) ?? [],
    attachments: attachmentMap.get(r.taskLogId) ?? [],
  }));

  const rencanaHariIni = db
    .query<ChecklistRow & { catatan: string | null }, [number, string]>(
      `SELECT tl.task_id AS taskId, tl.catatan, t.deskripsi, t.tag, t.status AS taskStatus, t.project_id AS projectId, p.nama AS projectNama
       FROM task_logs tl
       JOIN tasks t ON t.id = tl.task_id
       JOIN projects p ON p.id = t.project_id
       WHERE tl.user_id = ? AND tl.tanggal = ? AND tl.jenis = 'rencana'
       ORDER BY t.deskripsi`,
    )
    .all(ctx.user.id, tanggal);

  const izin = db
    .query<{ jenis: "cuti" | "sakit" | "izin"; alasan: string | null }, [number, string]>(
      "SELECT jenis, alasan FROM leaves WHERE user_id = ? AND tanggal = ?",
    )
    .get(ctx.user.id, tanggal);

  return json({
    tanggal,
    hariIni,
    hariKerjaSebelumnya,
    checklist,
    tambahan: tambahanFinal,
    rencanaHariIni,
    izin: izin ?? null,
  });
}

// projectBaru (bukan projectId): usulan project "Lainnya" (ADR-0042) dibuat di saveItem()
// dalam transaksi yang sama dengan task-nya, bukan lebih dulu secara terpisah lewat
// /projects/usulan — supaya draft yang batal/di-refresh sebelum "Simpan" tidak menyisakan
// project nyantol tanpa task/catatan apa pun (simpan tetap semua-atau-tidak-sama-sekali).
const newTaskSchema = z
  .object({
    projectId: z.number().int().positive().optional(),
    projectBaru: z.string().min(1).optional(),
    deskripsi: z.string().min(1, "Deskripsi task wajib diisi."),
    tag: z.string().optional(),
    // Task dari commit GitLab (ADR-0047) sudah pasti pekerjaan yang sudah kelar saat dicommit —
    // langsung dibuat status 'closed', bukan 'open' menunggu ditandai selesai manual.
    tutupLangsung: z.boolean().optional(),
  })
  .refine((v) => (v.projectId !== undefined) !== (v.projectBaru !== undefined), {
    message: "Isi salah satu: projectId atau projectBaru pada newTask.",
  });

// Referensi commit GitLab (ADR-0039/0047) — dikirim bareng item saat commit diimpor jadi task,
// ditulis ke task_log_commits SETELAH task_log-nya benar-benar ada (bukan di sini), sekaligus
// jadi penanda "sudah diimpor" buat GET /api/gitlab/commits berikutnya.
const gitlabCommitSchema = z.object({
  sha: z.string().min(1),
  commitUrl: z.string().min(1),
  pesan: z.string(),
  authoredAt: z.string(),
});

const logItemSchema = z
  .object({
    taskId: z.number().int().positive().optional(),
    newTask: newTaskSchema.optional(),
    jenis: z.enum(["rencana", "realisasi"]),
    catatan: z.string().optional(),
    isExtra: z.boolean().optional(),
    gitlabCommit: gitlabCommitSchema.optional(),
  })
  .refine((v) => (v.taskId !== undefined) !== (v.newTask !== undefined), {
    message: "Isi salah satu: taskId atau newTask.",
  });

const saveInputSchema = z.object({
  tanggal: z.string().regex(TANGGAL_RE).optional(),
  items: z.array(logItemSchema).min(1, "Minimal satu item."),
});

type LogItem = z.infer<typeof logItemSchema>;

function getTaskProjectId(taskId: number): number | null {
  const row = db.query<{ project_id: number }, [number]>("SELECT project_id FROM tasks WHERE id = ?").get(taskId);
  return row?.project_id ?? null;
}

function upsertTaskLog(
  userId: number,
  taskId: number,
  tanggal: string,
  jenis: "rencana" | "realisasi",
  catatan: string | null,
  isExtra: boolean,
): number {
  // ADR-0041: satu baris per (user_id, task_id, tanggal, jenis) — submit ulang meng-update,
  // bukan menggandakan.
  const existing = db
    .query<{ id: number }, [number, number, string, string]>(
      "SELECT id FROM task_logs WHERE user_id = ? AND task_id = ? AND tanggal = ? AND jenis = ?",
    )
    .get(userId, taskId, tanggal, jenis);

  if (existing) {
    db.query("UPDATE task_logs SET catatan = ?, is_extra = ? WHERE id = ?").run(
      catatan,
      isExtra ? 1 : 0,
      existing.id,
    );
    return existing.id;
  }
  const result = db
    .query(
      "INSERT INTO task_logs (task_id, user_id, tanggal, jenis, catatan, is_extra) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(taskId, userId, tanggal, jenis, catatan, isExtra ? 1 : 0);
  return Number(result.lastInsertRowid);
}

// ADR-0030 + ADR-0014: null kalau boleh lanjut, Response kalau harus ditolak.
function validasiRealisasiDiizinkan(
  userId: number,
  tanggal: string,
  hariIni: string,
  hariKerjaSebelumnya: string,
): Response | null {
  if (!realisasiTanggalDiizinkan(tanggal, hariIni)) {
    return errorResponse(400, "Realisasi hari kerja sebelumnya sudah di luar batas edit.");
  }
  const izinBentrok = db
    .query<{ id: number }, [number, string]>("SELECT id FROM leaves WHERE user_id = ? AND tanggal = ?")
    .get(userId, hariKerjaSebelumnya);
  if (izinBentrok) {
    return errorResponse(409, "Tanggal itu sudah tercatat sebagai izin/cuti/sakit, realisasi tidak bisa diisi.");
  }
  return null;
}

export async function handleSaveDailyInput(req: Request, hariIniOverride?: string): Promise<Response> {
  // Variabel terpisah supaya hasil narrowing tetap terbawa ke closure transaksi di bawah.
  const auth = requireLogin(req);
  if (auth instanceof Response) return auth;
  const ctx = auth;

  const body = await req.json().catch(() => null);
  const parsed = saveInputSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Data tidak valid.");

  const hariIni = hariIniOverride ?? todayJakarta();
  const tanggal = parsed.data.tanggal ?? hariIni;
  if (!dalamBulanBerjalan(tanggal, hariIni)) {
    return errorResponse(400, "Tanggal laporan di luar bulan berjalan.");
  }
  const hariKerjaSebelumnya = previousWorkday(tanggal);

  const adaRealisasi = parsed.data.items.some((item) => item.jenis === "realisasi");
  if (adaRealisasi) {
    const gagal = validasiRealisasiDiizinkan(ctx.user.id, tanggal, hariIni, hariKerjaSebelumnya);
    if (gagal) return gagal;
  }

  // Validasi seluruh item DULU sebelum menulis apa pun — kegagalan satu bagian tidak boleh
  // menyisakan simpan parsial (cakupan Stage 3). projectBaru dilewati di sini: project dan
  // keanggotaannya baru dibuat (dan otomatis sah) di saveItem(), belum ada project_id untuk dicek.
  for (const item of parsed.data.items) {
    if (item.jenis === "realisasi" && !item.catatan?.trim()) {
      return errorResponse(400, "Catatan hasil wajib diisi untuk realisasi.");
    }
    if (item.newTask?.projectBaru !== undefined) continue;
    const projectId = item.newTask?.projectId ?? getTaskProjectId(item.taskId!);
    if (projectId === null) return errorResponse(404, "Task tidak ditemukan.");
    if (!isActiveProjectMember(ctx.user.id, projectId)) {
      return errorResponse(403, "Bukan anggota aktif project ini.");
    }
  }

  // Efek uncheck (ADR-0044): item checklist realisasi yang tadinya tersimpan tapi sekarang
  // tidak lagi ada di items (di-uncheck) dihapus, bukan dibiarkan nyangkut. Cuma untuk item
  // checklist (is_extra=0) — kerjaan tambahan/rencana lain di luar cakupan ini.
  const checklistTaskIds = db
    .query<{ taskId: number }, [number, string]>(
      "SELECT task_id AS taskId FROM task_logs WHERE user_id = ? AND tanggal = ? AND jenis = 'rencana'",
    )
    .all(ctx.user.id, hariKerjaSebelumnya)
    .map((r) => r.taskId);
  const checkedTaskIds = new Set(
    parsed.data.items
      .filter((item) => item.jenis === "realisasi" && !item.isExtra && item.taskId !== undefined)
      .map((item) => item.taskId!),
  );
  const uncheckedTaskIds = checklistTaskIds.filter((id) => !checkedTaskIds.has(id));

  // ADR-0042: usulan "Lainnya" dibuat di sini, dalam transaksi yang sama dengan task & log-nya
  // (bukan lebih dulu lewat endpoint terpisah) — supaya project baru tidak pernah nyantol tanpa
  // task/catatan kalau submit ini gagal atau dibatalkan.
  // projectBaruCache: beberapa item di satu kali simpan (mis. impor banyak commit GitLab
  // sekaligus ke "Lainnya" yang sama) bisa punya projectBaru dengan nama IDENTIK — tanpa cache
  // ini tiap item bikin baris projects sendiri-sendiri, jadi N project "Lainnya" duplikat
  // padahal user cuma mau satu.
  const projectBaruCache = new Map<string, number>();
  function resolveProjectId(newTask: NonNullable<LogItem["newTask"]>): number {
    if (newTask.projectId !== undefined) return newTask.projectId;
    const nama = newTask.projectBaru!;
    const cached = projectBaruCache.get(nama);
    if (cached !== undefined) return cached;
    const result = db
      .query("INSERT INTO projects (nama, is_active, belum_direkonsiliasi) VALUES (?, 1, 1)")
      .run(nama);
    const projectId = Number(result.lastInsertRowid);
    db.query("INSERT INTO user_project (user_id, project_id, ended_at) VALUES (?, ?, NULL)").run(
      ctx!.user.id,
      projectId,
    );
    projectBaruCache.set(nama, projectId);
    return projectId;
  }

  function saveItem(item: LogItem) {
    let taskId = item.taskId;
    if (taskId === undefined && item.newTask) {
      const projectId = resolveProjectId(item.newTask);
      const status = item.newTask.tutupLangsung ? "closed" : "open";
      const result = db
        .query("INSERT INTO tasks (project_id, deskripsi, tag, status) VALUES (?, ?, ?, ?)")
        .run(projectId, item.newTask.deskripsi, item.newTask.tag ?? null, status);
      taskId = Number(result.lastInsertRowid);
    }
    const tanggalItem = item.jenis === "realisasi" ? hariKerjaSebelumnya : tanggal;
    const taskLogId = upsertTaskLog(
      ctx!.user.id,
      taskId!,
      tanggalItem,
      item.jenis,
      item.catatan?.trim() || null,
      item.isExtra ?? false,
    );

    // Ditulis di sini (transaksi "Simpan" yang sama), bukan saat commit dicentang di modal —
    // draft yang batal/di-refresh sebelum "Simpan" tidak boleh menyisakan data nyantol (ADR-0047,
    // sama prinsip project "Lainnya"). INSERT OR IGNORE: UNIQUE(ditambahkan_oleh, commit_sha)
    // jadi jaring pengaman kalau ada race (mis. dua tab) — gagal diam-diam, bukan error simpan.
    if (item.gitlabCommit) {
      db.query(
        `INSERT OR IGNORE INTO task_log_commits
         (task_log_id, commit_sha, commit_url, pesan, authored_at, ditambahkan_oleh)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        taskLogId,
        item.gitlabCommit.sha,
        item.gitlabCommit.commitUrl,
        item.gitlabCommit.pesan,
        item.gitlabCommit.authoredAt,
        ctx!.user.id,
      );
    }
  }

  db.transaction(() => {
    for (const item of parsed.data.items) saveItem(item);
    if (uncheckedTaskIds.length > 0) {
      const placeholders = uncheckedTaskIds.map(() => "?").join(",");
      // Attachment polymorphic TIDAK auto-cascade seperti kendala (bukan FK sungguhan) — ambil
      // id task_log yang mau dihapus DULU, bersihkan attachment-nya (baris DB + file disk)
      // SEBELUM baris task_logs-nya sendiri dihapus, supaya tidak jadi file/baris yatim.
      const rowsToDelete = db
        .query<{ id: number }, [number, string, ...number[]]>(
          `SELECT id FROM task_logs WHERE user_id = ? AND tanggal = ? AND jenis = 'realisasi' AND is_extra = 0 AND task_id IN (${placeholders})`,
        )
        .all(ctx!.user.id, hariKerjaSebelumnya, ...uncheckedTaskIds);
      deleteAttachmentsByTaskLogIds(rowsToDelete.map((r) => r.id));
      db.query(
        `DELETE FROM task_logs WHERE user_id = ? AND tanggal = ? AND jenis = 'realisasi' AND is_extra = 0 AND task_id IN (${placeholders})`,
      ).run(ctx!.user.id, hariKerjaSebelumnya, ...uncheckedTaskIds);
    }
  })();

  return json({ tanggal, hariKerjaSebelumnya });
}

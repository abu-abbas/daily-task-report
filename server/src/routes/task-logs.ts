import { requireLogin } from "../authz";
import { z } from "zod/v4";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, type Tx, first } from "../db";
import { attachments, kendala, leaves, projects, taskLogCommits, taskLogs, tasks, userProject } from "../schema";
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
export async function kendalaByTaskLogId(taskLogIds: number[]): Promise<Map<number, KendalaPublic[]>> {
  const map = new Map<number, KendalaPublic[]>();
  if (taskLogIds.length === 0) return map;
  const rows = await db
    .select({ id: kendala.id, taskLogId: kendala.task_log_id, deskripsi: kendala.deskripsi, status: kendala.status })
    .from(kendala)
    .where(inArray(kendala.task_log_id, taskLogIds));
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
export async function attachmentsByTaskLogId(taskLogIds: number[]): Promise<Map<number, AttachmentPublic[]>> {
  const map = new Map<number, AttachmentPublic[]>();
  if (taskLogIds.length === 0) return map;
  const rows = await db
    .select({
      id: attachments.id,
      taskLogId: attachments.attachable_id,
      namaAsli: attachments.nama_asli,
      fileType: attachments.file_type,
      ukuranBytes: attachments.ukuran_bytes,
      uploadedAt: attachments.uploaded_at,
    })
    .from(attachments)
    .where(and(eq(attachments.attachable_type, "task_log"), inArray(attachments.attachable_id, taskLogIds)));
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

// Kolom task + project yang ditampilkan bersama setiap log di input harian.
const taskInfoColumns = {
  taskId: taskLogs.task_id,
  deskripsi: tasks.deskripsi,
  tag: tasks.tag,
  taskStatus: tasks.status,
  projectId: tasks.project_id,
  projectNama: projects.nama,
};

// Filter task_logs milik user pada satu tanggal + jenis (opsional cuma kerjaan tambahan).
function logFilter(userId: number, tanggal: string, jenis: "rencana" | "realisasi", extraOnly = false) {
  return and(
    eq(taskLogs.user_id, userId),
    eq(taskLogs.tanggal, tanggal),
    eq(taskLogs.jenis, jenis),
    extraOnly ? eq(taskLogs.is_extra, 1) : undefined,
  );
}

// Checklist realisasi hari ini = rencana milik user pada hari kerja sebelumnya (ADR-0006).
// Rencana yang diisi hari ini bertanggal hari ini juga (tanggal laporan), bukan besok — satu
// submit boleh berisi realisasi kemarin dan rencana hari ini sekaligus (ADR-0007). Kerjaan
// tambahan/rencana memakai tabel yang sama, dibedakan lewat jenis/is_extra.
// hariIniOverride: hanya dipakai test untuk mensimulasikan "hari ini" tertentu tanpa
// bergantung pada tanggal asli saat test dijalankan. Route asli (index.ts) memanggil tanpa
// argumen ini, selalu memakai todayJakarta() sungguhan. tanggal (laporan yang dilihat/diisi)
// datang dari klien lewat query string — bisa backdate dalam bulan berjalan (ADR-0008/0009).
export async function handleGetDailyInput(req: Request, hariIniOverride?: string): Promise<Response> {
  const ctx = await requireLogin(req);
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
  const hariKerjaSebelumnya = await previousWorkday(tanggal);

  // rencanaCatatan (bukan cuma deskripsi/badge) ikut dikirim supaya checklist-di-dalam-catatan
  // rencana (ADR-0043) tetap terlihat sebagai referensi saat mengisi realisasi besok — sebelumnya
  // hilang total begitu rencana jadi item checklist, user tidak bisa lihat lagi apa yang direncanakan.
  const checklistRows: RencanaChecklistRow[] = await db
    .select({ ...taskInfoColumns, rencanaCatatan: taskLogs.catatan })
    .from(taskLogs)
    .innerJoin(tasks, eq(tasks.id, taskLogs.task_id))
    .innerJoin(projects, eq(projects.id, tasks.project_id))
    .where(logFilter(ctx.user.id, hariKerjaSebelumnya, "rencana"))
    .orderBy(asc(tasks.deskripsi));

  const realisasiRows = await db
    .select({ id: taskLogs.id, taskId: taskLogs.task_id, catatan: taskLogs.catatan, isExtra: taskLogs.is_extra })
    .from(taskLogs)
    .where(logFilter(ctx.user.id, hariKerjaSebelumnya, "realisasi"));
  const realisasiByTask = new Map(
    realisasiRows.filter((r) => r.isExtra === 0).map((r) => [r.taskId, { taskLogId: r.id, catatan: r.catatan }]),
  );

  const tambahan = await db
    .select({ taskLogId: taskLogs.id, ...taskInfoColumns, catatan: taskLogs.catatan })
    .from(taskLogs)
    .innerJoin(tasks, eq(tasks.id, taskLogs.task_id))
    .innerJoin(projects, eq(projects.id, tasks.project_id))
    .where(logFilter(ctx.user.id, hariKerjaSebelumnya, "realisasi", true))
    .orderBy(asc(tasks.deskripsi));

  // Kendala + attachment cuma untuk log realisasi (ADR-0015/ADR-0016): checklist yang sudah
  // pernah direalisasi + kerjaan tambahan hari ini, diambil sekali jalan lalu ditempel per
  // taskLogId.
  const relevantTaskLogIds = [
    ...realisasiRows.filter((r) => r.isExtra === 0).map((r) => r.id),
    ...tambahan.map((r) => r.taskLogId),
  ];
  const kendalaMap = await kendalaByTaskLogId(relevantTaskLogIds);
  const attachmentMap = await attachmentsByTaskLogId(relevantTaskLogIds);

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

  const rencanaHariIni = await db
    .select({ ...taskInfoColumns, catatan: taskLogs.catatan })
    .from(taskLogs)
    .innerJoin(tasks, eq(tasks.id, taskLogs.task_id))
    .innerJoin(projects, eq(projects.id, tasks.project_id))
    .where(logFilter(ctx.user.id, tanggal, "rencana"))
    .orderBy(asc(tasks.deskripsi));

  const izin = await db
    .select({ jenis: leaves.jenis, alasan: leaves.alasan })
    .from(leaves)
    .where(and(eq(leaves.user_id, ctx.user.id), eq(leaves.tanggal, tanggal)))
    .then(first);

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

async function getTaskProjectId(taskId: number): Promise<number | null> {
  const row = await db.select({ project_id: tasks.project_id }).from(tasks).where(eq(tasks.id, taskId)).then(first);
  return row?.project_id ?? null;
}

// Dipanggil dari dalam transaksi simpan.
async function upsertTaskLog(
  tx: Tx,
  userId: number,
  taskId: number,
  tanggal: string,
  jenis: "rencana" | "realisasi",
  catatan: string | null,
  isExtra: boolean,
): Promise<number> {
  // ADR-0041: satu baris per (user_id, task_id, tanggal, jenis) — submit ulang meng-update,
  // bukan menggandakan.
  const existing = await tx
    .select({ id: taskLogs.id })
    .from(taskLogs)
    .where(
      and(
        eq(taskLogs.user_id, userId),
        eq(taskLogs.task_id, taskId),
        eq(taskLogs.tanggal, tanggal),
        eq(taskLogs.jenis, jenis),
      ),
    )
    .then(first);

  if (existing) {
    await tx.update(taskLogs).set({ catatan, is_extra: isExtra ? 1 : 0 }).where(eq(taskLogs.id, existing.id));
    return existing.id;
  }
  const [inserted] = await tx
    .insert(taskLogs)
    .values({ task_id: taskId, user_id: userId, tanggal, jenis, catatan, is_extra: isExtra ? 1 : 0 })
    .returning({ id: taskLogs.id });
  return inserted!.id;
}

// ADR-0030 + ADR-0014: null kalau boleh lanjut, Response kalau harus ditolak.
async function validasiRealisasiDiizinkan(
  userId: number,
  tanggal: string,
  hariIni: string,
  hariKerjaSebelumnya: string,
): Promise<Response | null> {
  if (!(await realisasiTanggalDiizinkan(tanggal, hariIni))) {
    return errorResponse(400, "Realisasi hari kerja sebelumnya sudah di luar batas edit.");
  }
  const izinBentrok = await db
    .select({ id: leaves.id })
    .from(leaves)
    .where(and(eq(leaves.user_id, userId), eq(leaves.tanggal, hariKerjaSebelumnya)))
    .then(first);
  if (izinBentrok) {
    return errorResponse(409, "Tanggal itu sudah tercatat sebagai izin/cuti/sakit, realisasi tidak bisa diisi.");
  }
  return null;
}

export async function handleSaveDailyInput(req: Request, hariIniOverride?: string): Promise<Response> {
  // Variabel terpisah supaya hasil narrowing tetap terbawa ke closure transaksi di bawah.
  const auth = await requireLogin(req);
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
  const hariKerjaSebelumnya = await previousWorkday(tanggal);

  const adaRealisasi = parsed.data.items.some((item) => item.jenis === "realisasi");
  if (adaRealisasi) {
    const gagal = await validasiRealisasiDiizinkan(ctx.user.id, tanggal, hariIni, hariKerjaSebelumnya);
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
    const projectId = item.newTask?.projectId ?? (await getTaskProjectId(item.taskId!));
    if (projectId === null) return errorResponse(404, "Task tidak ditemukan.");
    if (!(await isActiveProjectMember(ctx.user.id, projectId))) {
      return errorResponse(403, "Bukan anggota aktif project ini.");
    }
  }

  // Efek uncheck (ADR-0044): item checklist realisasi yang tadinya tersimpan tapi sekarang
  // tidak lagi ada di items (di-uncheck) dihapus, bukan dibiarkan nyangkut. Cuma untuk item
  // checklist (is_extra=0) — kerjaan tambahan/rencana lain di luar cakupan ini.
  const checklistTaskIds = (
    await db
      .select({ taskId: taskLogs.task_id })
      .from(taskLogs)
      .where(logFilter(ctx.user.id, hariKerjaSebelumnya, "rencana"))
  ).map((r) => r.taskId);
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
  async function resolveProjectId(tx: Tx, newTask: NonNullable<LogItem["newTask"]>): Promise<number> {
    if (newTask.projectId !== undefined) return newTask.projectId;
    const nama = newTask.projectBaru!;
    const cached = projectBaruCache.get(nama);
    if (cached !== undefined) return cached;
    const [{ id: projectId }] = await tx
      .insert(projects)
      .values({ nama, is_active: 1, belum_direkonsiliasi: 1 })
      .returning({ id: projects.id });
    await tx.insert(userProject).values({ user_id: ctx.user.id, project_id: projectId, ended_at: null });
    projectBaruCache.set(nama, projectId);
    return projectId;
  }

  async function saveItem(tx: Tx, item: LogItem) {
    let taskId = item.taskId;
    if (taskId === undefined && item.newTask) {
      const projectId = await resolveProjectId(tx, item.newTask);
      const status = item.newTask.tutupLangsung ? "closed" : "open";
      const [inserted] = await tx
        .insert(tasks)
        .values({ project_id: projectId, deskripsi: item.newTask.deskripsi, tag: item.newTask.tag ?? null, status })
        .returning({ id: tasks.id });
      taskId = inserted!.id;
    }
    const tanggalItem = item.jenis === "realisasi" ? hariKerjaSebelumnya : tanggal;
    const taskLogId = await upsertTaskLog(
      tx,
      ctx.user.id,
      taskId!,
      tanggalItem,
      item.jenis,
      item.catatan?.trim() || null,
      item.isExtra ?? false,
    );

    // Ditulis di sini (transaksi "Simpan" yang sama), bukan saat commit dicentang di modal —
    // draft yang batal/di-refresh sebelum "Simpan" tidak boleh menyisakan data nyantol (ADR-0047,
    // sama prinsip project "Lainnya"). ON CONFLICT DO NOTHING: UNIQUE(ditambahkan_oleh, commit_sha)
    // jadi jaring pengaman kalau ada race (mis. dua tab) — gagal diam-diam, bukan error simpan.
    if (item.gitlabCommit) {
      await tx
        .insert(taskLogCommits)
        .values({
          task_log_id: taskLogId,
          commit_sha: item.gitlabCommit.sha,
          commit_url: item.gitlabCommit.commitUrl,
          pesan: item.gitlabCommit.pesan,
          authored_at: item.gitlabCommit.authoredAt,
          ditambahkan_oleh: ctx.user.id,
        })
        .onConflictDoNothing();
    }
  }

  await db.transaction(async (tx) => {
    for (const item of parsed.data.items) await saveItem(tx, item);
    if (uncheckedTaskIds.length > 0) {
      const uncheckedWhere = and(
        eq(taskLogs.user_id, ctx.user.id),
        eq(taskLogs.tanggal, hariKerjaSebelumnya),
        eq(taskLogs.jenis, "realisasi"),
        eq(taskLogs.is_extra, 0),
        inArray(taskLogs.task_id, uncheckedTaskIds),
      );
      // Attachment polymorphic TIDAK auto-cascade seperti kendala (bukan FK sungguhan) — ambil
      // id task_log yang mau dihapus DULU, bersihkan attachment-nya (baris DB + file disk)
      // SEBELUM baris task_logs-nya sendiri dihapus, supaya tidak jadi file/baris yatim.
      const rowsToDelete = await tx.select({ id: taskLogs.id }).from(taskLogs).where(uncheckedWhere);
      await deleteAttachmentsByTaskLogIds(
        tx,
        rowsToDelete.map((r) => r.id),
      );
      await tx.delete(taskLogs).where(uncheckedWhere);
    }
  });

  return json({ tanggal, hariKerjaSebelumnya });
}

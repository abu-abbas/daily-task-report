export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.error ?? "Terjadi kesalahan.", res.status);
  }
  return body as T;
}

export interface CurrentUser {
  id: number;
  nama: string;
  email: string | null;
  roles: string[];
  gitlabUsername: string | null;
  gitlabAvatarUrl: string | null;
  hasGitlabToken: boolean;
}

export const fetchMe = () => api<{ user: CurrentUser }>("/me");

export const postLogin = (email: string, password: string) =>
  api<{ user: CurrentUser }>("/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const postLogout = () => api<void>("/logout", { method: "POST" });

export type Role = "tenaga_ahli" | "supervisi" | "atasan" | "admin";

export interface AdminUser {
  id: number;
  nama: string;
  email: string;
  roles: Role[];
  atasanId: number | null;
  supervisiId: number | null;
}

export interface UserPayload {
  nama: string;
  email: string;
  password?: string;
  roles: Role[];
  atasanId: number | null;
  supervisiId: number | null;
}

export const fetchUsers = () => api<{ users: AdminUser[] }>("/users");

export const createUser = (payload: UserPayload) =>
  api<{ user: AdminUser }>("/users", { method: "POST", body: JSON.stringify(payload) });

export const updateUser = (id: number, payload: UserPayload) =>
  api<{ user: AdminUser }>(`/users/${id}`, { method: "PUT", body: JSON.stringify(payload) });

export interface Holiday {
  id: number;
  nama: string;
  tanggalMulai: string;
  tanggalAkhir: string;
}

export interface HolidayPayload {
  nama: string;
  tanggalMulai: string;
  tanggalAkhir: string;
}

export const fetchHolidays = () => api<{ holidays: Holiday[] }>("/holidays");

export const createHoliday = (payload: HolidayPayload) =>
  api<{ holiday: Holiday }>("/holidays", { method: "POST", body: JSON.stringify(payload) });

export const deleteHoliday = (id: number) => api<void>(`/holidays/${id}`, { method: "DELETE" });

export interface ProjectMember {
  id: number;
  nama: string;
}

export interface Project {
  id: number;
  nama: string;
  isActive: boolean;
  belumDirekonsiliasi: boolean;
  members: ProjectMember[];
}

export interface ProjectPayload {
  nama: string;
  isActive: boolean;
}

export const fetchProjects = () => api<{ projects: Project[] }>("/projects");

export const fetchMyProjects = () => api<{ projects: Project[] }>("/projects/mine");

export const createProject = (payload: ProjectPayload) =>
  api<{ project: Project }>("/projects", { method: "POST", body: JSON.stringify(payload) });

export const updateProject = (id: number, payload: ProjectPayload) =>
  api<{ project: Project }>(`/projects/${id}`, { method: "PUT", body: JSON.stringify(payload) });

// ADR-0042: usulan "Lainnya" dibuat lewat POST /task-logs (lihat NewTaskLogPayload di bawah),
// bukan endpoint terpisah di sini — supaya draft yang batal/di-refresh sebelum "Simpan" tidak
// menyisakan project nyantol tanpa task/catatan apa pun.

export const confirmProject = (id: number) =>
  api<{ project: Project }>(`/projects/${id}/konfirmasi`, { method: "POST" });

export const mergeProject = (id: number, targetProjectId: number) =>
  api<{ project: Project }>(`/projects/${id}/gabung`, {
    method: "POST",
    body: JSON.stringify({ targetProjectId }),
  });

export const addProjectMember = (projectId: number, userId: number) =>
  api<{ project: Project }>(`/projects/${projectId}/members`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });

export const endProjectMembership = (projectId: number, userId: number) =>
  api<{ project: Project }>(`/projects/${projectId}/members/${userId}`, { method: "DELETE" });

export interface Task {
  id: number;
  projectId: number;
  deskripsi: string;
  tag: string | null;
  status: "open" | "closed";
  deskripsiPenutupan: string | null;
}

export const fetchTasks = (projectId: number) => api<{ tasks: Task[] }>(`/tasks?projectId=${projectId}`);

export interface NewTaskPayload {
  projectId: number;
  deskripsi: string;
  tag?: string;
}

export const createTask = (payload: NewTaskPayload) =>
  api<{ task: Task }>("/tasks", { method: "POST", body: JSON.stringify(payload) });

// ADR-0012/Q-04: task tanpa pemilik tetap — siapa pun anggota aktif project-nya boleh menutup.
// Tidak ada endpoint buka-lagi (reopen) sengaja, belum dibutuhkan (YAGNI).
export const closeTask = (taskId: number, deskripsiPenutupan?: string) =>
  api<{ task: Task }>(`/tasks/${taskId}/tutup`, {
    method: "POST",
    body: JSON.stringify({ deskripsiPenutupan }),
  });

export interface KendalaItem {
  id: number;
  taskLogId: number;
  deskripsi: string;
  status: "open" | "resolved";
}

export interface AttachmentItem {
  id: number;
  namaAsli: string;
  fileType: string | null;
  ukuranBytes: number;
  uploadedAt: string;
}

export interface ChecklistItem {
  taskId: number;
  deskripsi: string;
  tag: string | null;
  taskStatus: "open" | "closed";
  projectId: number;
  projectNama: string;
  rencanaCatatan: string | null;
  realisasiCatatan: string | null;
  taskLogId: number | null;
  kendala: KendalaItem[];
  attachments: AttachmentItem[];
}

export interface TambahanItem {
  taskId: number;
  taskLogId: number;
  catatan: string | null;
  deskripsi: string;
  tag: string | null;
  taskStatus: "open" | "closed";
  projectId: number;
  projectNama: string;
  kendala: KendalaItem[];
  attachments: AttachmentItem[];
}

export interface RencanaHariIniItem {
  taskId: number;
  catatan: string | null;
  deskripsi: string;
  tag: string | null;
  taskStatus: "open" | "closed";
  projectId: number;
  projectNama: string;
}

export type IzinJenis = "cuti" | "sakit" | "izin";

export interface Izin {
  jenis: IzinJenis;
  alasan: string | null;
}

export interface DailyInput {
  tanggal: string;
  hariIni: string;
  hariKerjaSebelumnya: string;
  checklist: ChecklistItem[];
  tambahan: TambahanItem[];
  rencanaHariIni: RencanaHariIniItem[];
  izin: Izin | null;
}

// tanggal kosong = hari ini (server yang tentukan, ADR-0032) — dipakai buat muat awal
// sebelum date-picker tahu batas bulan berjalan (data.hariIni).
export const fetchDailyInput = (tanggal?: string) => {
  const query = tanggal ? `?tanggal=${tanggal}` : "";
  return api<DailyInput>(`/task-logs/daily${query}`);
};

// projectBaru (bukan projectId): project usulan "Lainnya" dibuat dalam transaksi simpan yang
// sama dengan task-nya (ADR-0042) — bukan lebih dulu secara terpisah, supaya draft yang belum
// sempat "Simpan" tidak menyisakan project nyantol tanpa task/catatan apa pun kalau batal/refresh.
export interface NewTaskLogPayload {
  projectId?: number;
  projectBaru?: string;
  deskripsi: string;
  tag?: string;
  // Task dari commit GitLab (ADR-0047) sudah pasti kelar saat dicommit — dibuat langsung
  // status 'closed', bukan 'open' menunggu ditandai selesai manual.
  tutupLangsung?: boolean;
}

// Referensi commit GitLab (ADR-0039/0047) — ditulis ke task_log_commits SETELAH task_log-nya
// benar-benar tersimpan, dipakai server buat menandai "sudah diimpor" ke GET /api/gitlab/commits
// berikutnya (cegah commit yang sama diimpor dua kali jadi task duplikat).
export interface GitlabCommitRef {
  sha: string;
  commitUrl: string;
  pesan: string;
  authoredAt: string;
}

export interface SaveTaskLogItem {
  taskId?: number;
  newTask?: NewTaskLogPayload;
  jenis: "rencana" | "realisasi";
  catatan?: string;
  isExtra?: boolean;
  gitlabCommit?: GitlabCommitRef;
}

export const saveDailyInput = (tanggal: string, items: SaveTaskLogItem[]) =>
  api<{ tanggal: string; hariKerjaSebelumnya: string }>("/task-logs", {
    method: "POST",
    body: JSON.stringify({ tanggal, items }),
  });

// ADR-0044: izin/cuti/sakit per tanggal, endpoint terpisah dari task-logs (leaves punya siklus
// hidup sendiri — bukan bagian dari itemsToSave harian).
export const saveLeave = (payload: { tanggal: string; jenis: IzinJenis; alasan?: string }) =>
  api<{ tanggal: string; jenis: IzinJenis; alasan: string | null }>("/leaves", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const cancelLeave = (tanggal: string) =>
  api<{ tanggal: string }>(`/leaves/${tanggal}`, { method: "DELETE" });

// ADR-0015: kendala cuma untuk log realisasi yang sudah tersimpan, endpoint berdiri sendiri
// (bukan bagian dari saveDailyInput) — aksi kecil independen, sama seperti closeTask/saveLeave.
export const createKendala = (taskLogId: number, deskripsi: string) =>
  api<{ kendala: KendalaItem }>("/bottlenecks", {
    method: "POST",
    body: JSON.stringify({ taskLogId, deskripsi }),
  });

export const deleteKendala = (id: number) => api<void>(`/bottlenecks/${id}`, { method: "DELETE" });

export const resolveKendala = (id: number) =>
  api<{ kendala: KendalaItem }>(`/bottlenecks/${id}/resolve`, { method: "POST" });

// ADR-0016: lampiran cuma untuk log realisasi yang sudah tersimpan, sama scope kendala. Upload
// pakai FormData — TIDAK lewat helper api() di atas karena itu selalu paksa
// Content-Type: application/json, tidak cocok untuk multipart.
export async function uploadAttachment(taskLogId: number, file: File): Promise<{ attachment: AttachmentItem }> {
  const form = new FormData();
  form.set("taskLogId", String(taskLogId));
  form.set("file", file);
  const res = await fetch("/api/attachments", { method: "POST", credentials: "same-origin", body: form });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body?.error ?? "Terjadi kesalahan.", res.status);
  return body;
}

export const deleteAttachment = (id: number) => api<void>(`/attachments/${id}`, { method: "DELETE" });

// Dipakai langsung sebagai src/href — cookie sesi ikut otomatis (same-origin).
export const attachmentFileUrl = (id: number) => `/api/attachments/${id}/file`;

// Heatmap aktivitas (gaya GitHub) 12 bulan terakhir — warna murni dari jumlah realisasi per
// tanggal, dihitung server (bukan rencana/izin). Menggantikan daftar-per-bulan lama.
export interface ActivityHeatmapHari {
  tanggal: string;
  realisasiCount: number;
}

export const fetchActivityHeatmap = (projectId?: number) => {
  const query = projectId ? `?projectId=${projectId}` : "";
  return api<{ dari: string; sampai: string; hari: ActivityHeatmapHari[] }>(`/activity-heatmap${query}`);
};

// Daftar realisasi lintas waktu (tidak dibatasi rentang heatmap), terbaru dulu, dipaginasi lazy
// pakai cursor "tanggal|taskLogId" — pelengkap heatmap di bawahnya.
export interface ActivityLogItem {
  taskLogId: number;
  tanggal: string;
  deskripsi: string;
  tag: string | null;
  projectNama: string;
}

// `tanggal` (dari klik heatmap) memfilter feed ke satu tanggal itu saja, tidak dipaginasi —
// `cursor` diabaikan server kalau `tanggal` dikirim.
export const fetchActivityLog = (params: { projectId?: number; cursor?: string | null; tanggal?: string | null }) => {
  const query = new URLSearchParams();
  if (params.projectId) query.set("projectId", String(params.projectId));
  if (params.tanggal) query.set("tanggal", params.tanggal);
  else if (params.cursor) query.set("cursor", params.cursor);
  const qs = query.toString();
  const path = qs ? `/activity-log?${qs}` : "/activity-log";
  return api<{ items: ActivityLogItem[]; nextCursor: string | null }>(path);
};

// ADR-0034: baca histori sendiri tidak terikat bulan berjalan (beda dari Input Harian) — cuma
// dipakai buat tentukan tautan "Edit" (bolehEdit) di detail, bukan gate baca.

export interface RiwayatLogItem {
  taskLogId: number;
  taskId: number;
  deskripsi: string;
  tag: string | null;
  taskStatus: "open" | "closed";
  projectId: number;
  projectNama: string;
  jenis: "realisasi" | "rencana";
  isExtra: boolean;
  catatan: string | null;
  kendala: KendalaItem[];
  attachments: AttachmentItem[];
}

export interface RiwayatDetail {
  tanggal: string;
  bolehEdit: boolean;
  izin: Izin | null;
  items: RiwayatLogItem[];
}

export const fetchRiwayatDetail = (tanggal: string) => api<RiwayatDetail>(`/history/${tanggal}`);

// Cicilan awal Stage 7 (ADR-0019) — laporan PDF generik per bulan, dipakai langsung sebagai
// href (bukan fetch+blob) — cookie sesi ikut otomatis, sama pola attachmentFileUrl.
export const monthlyReportPdfUrl = (bulan: string) => `/api/reports/monthly?bulan=${bulan}`;

// Pratinjau di layar sebelum cetak — supaya user bisa cek dulu ada tidaknya hari kerja yang
// masih kosong (belum ada realisasi) sebelum benar-benar unduh PDF.
export interface ReportPreviewItem {
  no: number;
  tanggal: string;
  tanggalLabel: string;
  projectNama: string;
  kegiatan: string;
  catatan: string | null;
  status: string;
  lampiranCount: number;
}
// Data timesheet (task x hari) buat tab pratinjau Gantt di layar — bentuknya sama dengan yang
// dipakai buildMonthlyReportPdf di server, cuma taskDatesWorked jadi object (bukan Map/Set, JSON).
export interface ReportPreviewTask {
  taskId: number;
  no: number;
  label: string;
}
export interface ReportPreviewHari {
  tanggal: string;
  isWorkday: boolean;
  isIzin: boolean;
}
export interface ReportPreviewTimesheet {
  tasks: ReportPreviewTask[];
  hari: ReportPreviewHari[];
  taskDatesWorked: Record<string, string[]>;
}
export interface ReportPreview {
  bulan: string;
  bulanLabel: string;
  items: ReportPreviewItem[];
  tanggalKosong: string[];
  timesheet: ReportPreviewTimesheet;
}
export const fetchMonthlyReportPreview = (bulan: string) =>
  api<ReportPreview>(`/reports/monthly-preview?bulan=${bulan}`);

// Saran & Rekomendasi per bulan — opsional (kosong = tidak ditampilkan di laporan Word),
// TIDAK prefill dari bulan lain.
export const fetchSaran = (bulan: string) => api<{ isi: string }>(`/saran?bulan=${bulan}`);

export const saveSaran = (bulan: string, isi: string) =>
  api<{ isi: string }>(`/saran?bulan=${bulan}`, { method: "PUT", body: JSON.stringify({ isi }) });

// ADR-0019 revisi 2026-09-11: laporan diunduh sebagai Word hasil mail-merge ke template MILIK
// TENAGA AHLI SENDIRI (bukan admin/per-jabatan) — PDF (di atas) tidak lagi dipakai di UI.
export interface LaporanTemplate {
  namaAsli: string;
  uploadedAt: string;
}

export const fetchMyLaporanTemplate = () => api<{ template: LaporanTemplate | null }>("/laporan-template");

// Upload pakai FormData — TIDAK lewat helper api() (selalu paksa Content-Type: application/json),
// sama pola uploadAttachment.
export async function uploadLaporanTemplate(file: File): Promise<{ template: LaporanTemplate }> {
  const form = new FormData();
  form.set("file", file);
  const res = await fetch("/api/laporan-template", { method: "POST", credentials: "same-origin", body: form });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body?.error ?? "Terjadi kesalahan.", res.status);
  return body;
}

export const deleteLaporanTemplate = () => api<void>("/laporan-template", { method: "DELETE" });

// Dipakai langsung sebagai href (cookie sesi ikut otomatis), sama pola monthlyReportPdfUrl.
export const monthlyReportWordUrl = (bulan: string) => `/api/reports/monthly-word?bulan=${bulan}`;

// Impor commit GitLab jadi draft task realisasi (ADR-0047) — user pilih repo GitLab dulu
// (daftar cepat, satu panggilan), baru commit di-fetch dari repo itu saja, bukan nge-loop
// semua repo yang bisa diakses (lambat/gampang timeout).
export interface GitlabProjectItem {
  id: number;
  name: string;
}

export const fetchGitlabProjects = () => api<{ projects: GitlabProjectItem[] }>("/gitlab/projects");

export interface GitlabCommitItem {
  sha: string;
  shortSha: string;
  title: string;
  body: string;
  tag: string | null;
  authoredAt: string;
  webUrl: string;
  // Sudah pernah diimpor jadi task sebelumnya (dicek task_log_commits per commit_sha) — ADR-0047.
  alreadyImported: boolean;
}

export const fetchGitlabCommits = (gitlabProjectId: number, tanggal: string) =>
  api<{ commits: GitlabCommitItem[] }>(`/gitlab/commits?projectId=${gitlabProjectId}&tanggal=${tanggal}`);

// Backend verifikasi token ke GitLab (GET /api/v4/user) dulu sebelum disimpan — token yang
// gagal/invalid tidak pernah ditulis ke DB (ADR-0047). Token itu sendiri tidak pernah dikirim
// balik oleh server, cuma username/avatar hasil verifikasi.
export const saveGitlabToken = (token: string) =>
  api<{ gitlabUsername: string; gitlabAvatarUrl: string | null }>("/me/gitlab-token", {
    method: "PUT",
    body: JSON.stringify({ token }),
  });

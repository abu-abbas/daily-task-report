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
}

export interface SaveTaskLogItem {
  taskId?: number;
  newTask?: NewTaskLogPayload;
  jenis: "rencana" | "realisasi";
  catatan?: string;
  isExtra?: boolean;
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

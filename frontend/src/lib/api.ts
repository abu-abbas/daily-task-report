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
}

export const fetchTasks = (projectId: number) => api<{ tasks: Task[] }>(`/tasks?projectId=${projectId}`);

export interface NewTaskPayload {
  projectId: number;
  deskripsi: string;
  tag?: string;
}

export const createTask = (payload: NewTaskPayload) =>
  api<{ task: Task }>("/tasks", { method: "POST", body: JSON.stringify(payload) });

export interface ChecklistItem {
  taskId: number;
  deskripsi: string;
  tag: string | null;
  projectId: number;
  projectNama: string;
  realisasiCatatan: string | null;
}

export interface TambahanItem {
  taskId: number;
  catatan: string | null;
  deskripsi: string;
  tag: string | null;
  projectId: number;
  projectNama: string;
}

export interface RencanaHariIniItem {
  taskId: number;
  deskripsi: string;
  tag: string | null;
  projectId: number;
  projectNama: string;
}

export interface TodayInput {
  tanggal: string;
  hariKerjaSebelumnya: string;
  checklist: ChecklistItem[];
  tambahan: TambahanItem[];
  rencanaHariIni: RencanaHariIniItem[];
}

export const fetchTodayInput = () => api<TodayInput>("/task-logs/today");

export interface SaveTaskLogItem {
  taskId?: number;
  newTask?: NewTaskPayload;
  jenis: "rencana" | "realisasi";
  catatan?: string;
  isExtra?: boolean;
}

export const saveTodayInput = (items: SaveTaskLogItem[]) =>
  api<{ tanggal: string; hariKerjaSebelumnya: string }>("/task-logs", {
    method: "POST",
    body: JSON.stringify({ items }),
  });

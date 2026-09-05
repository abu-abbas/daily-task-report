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

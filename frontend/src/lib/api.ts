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

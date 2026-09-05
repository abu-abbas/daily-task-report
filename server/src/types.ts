export type Role = "tenaga_ahli" | "supervisi" | "atasan" | "admin";

export interface User {
  id: number;
  nama: string;
  email: string | null;
  password_hash: string | null;
  atasan_id: number | null;
  supervisi_id: number | null;
}

export interface AuthContext {
  user: User;
  roles: Role[];
}

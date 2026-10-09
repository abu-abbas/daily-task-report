// Pembatas percobaan login gagal, disimpan di memori proses (cukup untuk satu instance server).
// Jendela tetap: setiap kunci (email atau IP) boleh gagal sekian kali per jendela, lalu ditolak
// sampai jendelanya habis. Login berhasil menghapus hitungan email itu.

interface Entry {
  count: number;
  resetAt: number;
}

export class FailureLimiter {
  private entries = new Map<string, Entry>();

  constructor(
    private readonly maxFailures: number,
    private readonly windowMs: number,
  ) {}

  // Sisa detik sampai boleh mencoba lagi, atau 0 kalau belum diblokir.
  retryAfterSeconds(key: string, now = Date.now()): number {
    const entry = this.entries.get(key);
    if (!entry || entry.resetAt <= now) return 0;
    return entry.count >= this.maxFailures ? Math.ceil((entry.resetAt - now) / 1000) : 0;
  }

  recordFailure(key: string, now = Date.now()): void {
    const entry = this.entries.get(key);
    if (!entry || entry.resetAt <= now) {
      this.entries.set(key, { count: 1, resetAt: now + this.windowMs });
      if (this.entries.size > 10_000) this.prune(now);
    } else {
      entry.count++;
    }
  }

  reset(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  private prune(now: number): void {
    for (const [key, entry] of this.entries) if (entry.resetAt <= now) this.entries.delete(key);
  }
}

const windowMs = Number(process.env.LOGIN_WINDOW_MS ?? 15 * 60 * 1000);

// Per email: menahan tebak password untuk satu akun.
export const loginEmailLimiter = new FailureLimiter(Number(process.env.LOGIN_MAX_FAILURES_PER_EMAIL ?? 10), windowMs);

// Per IP: menahan satu sumber yang mencoba banyak email. Dibuat lebih longgar karena satu kantor
// bisa keluar lewat satu IP yang sama.
export const loginIpLimiter = new FailureLimiter(Number(process.env.LOGIN_MAX_FAILURES_PER_IP ?? 50), windowMs);

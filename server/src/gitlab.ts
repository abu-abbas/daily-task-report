// Integrasi GitLab CE self-hosted (ADR-0047). Host instance dibaca dari server/.env (satu
// GitLab buat semua user), tapi token PRIVATE-TOKEN per pemanggilan: diprioritaskan token
// pribadi user (users.gitlab_private_token), fallback ke GITLAB_SELFHOSTED_PRIVATE_TOKEN di
// .env selama belum semua user isi token sendiri (status token, ADR-0047). Cuma dipanggil
// on-demand lewat tombol "Impor commit GitLab" (lazy, tidak prefetch), sesuai ponytail (ADR-0025).

const GITLAB_URL = process.env.GITLAB_SELFHOSTED_URL?.replace(/\/$/, "");

export function gitlabHostConfigured(): boolean {
  return Boolean(GITLAB_URL);
}

// Fallback token .env hanya untuk development. Di produksi semua user akan ikut memakai token
// pemiliknya dan bisa melihat repo milik orang itu, jadi tiap user wajib mengisi token sendiri.
export function resolveGitlabToken(userToken: string | null): string | null {
  if (userToken) return userToken;
  if (process.env.NODE_ENV === "production") return null;
  return process.env.GITLAB_SELFHOSTED_PRIVATE_TOKEN || null;
}

interface GitlabProject {
  id: number;
  path_with_namespace: string;
}

interface GitlabCommit {
  id: string;
  short_id: string;
  title: string;
  message: string;
  author_email: string;
  authored_date: string;
  web_url: string;
  parent_ids: string[];
}

export interface GitlabIdentity {
  username: string;
  email: string | null;
  avatarUrl: string | null;
}

// Timeout per call (bukan cuma andalkan network) — satu project yang lambat/nyangkut di
// jaringan (VPN ke instance internal) tidak boleh menahan seluruh batch mapWithConcurrency
// tanpa batas, karena itu bikin request keseluruhan lama dan gampang kena timeout di lapisan
// lain (mis. dev proxy Vite) padahal project lainnya sudah selesai.
const GITLAB_TIMEOUT_MS = 8000;

async function gitlabGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${GITLAB_URL}${path}`, {
    headers: { "PRIVATE-TOKEN": token },
    signal: AbortSignal.timeout(GITLAB_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`GitLab API ${path} gagal (${res.status}).`);
  return res.json() as Promise<T>;
}

// Dipakai saat user menempelkan token barunya sendiri — verifikasi token valid sekaligus
// ambil username/avatar buat ditampilkan (tanpa user perlu isi manual), sejalan ADR-0047.
export async function fetchGitlabIdentity(token: string): Promise<GitlabIdentity> {
  const me = await gitlabGet<{ username: string; email: string | null; avatar_url: string | null }>(
    token,
    "/api/v4/user",
  );
  return { username: me.username, email: me.email, avatarUrl: me.avatar_url };
}

export interface GitlabProjectItem {
  id: number;
  name: string;
}

// membership=true: batasi ke project yang akun pemilik token ini jadi anggotanya, bukan semua
// project di instance (bisa admin-level dan jauh lebih besar/berat buat di-scan tiap impor) —
// per_page dimaksimalkan (100) lalu di-loop lewat header X-Total-Pages, bukan pakai satu
// endpoint pencarian yang belum tentu tersedia di semua versi GitLab CE. Dipakai user buat
// pilih repo sumber commit LEBIH DULU — commit baru di-fetch dari satu repo terpilih, bukan
// nge-loop semua repo tiap kali (lambat & gampang timeout di jaringan VPN ke instance internal).
// order_by/sort: repo yang paling baru aktif duluan — biasanya itu yang paling relevan dicari
// user buat impor commit, dibanding urutan alfabet.
export async function fetchGitlabProjects(token: string): Promise<GitlabProjectItem[]> {
  const projects: GitlabProject[] = [];
  let page = 1;
  for (;;) {
    const res = await fetch(
      `${GITLAB_URL}/api/v4/projects?per_page=100&page=${page}&simple=true&archived=false&membership=true&order_by=last_activity_at&sort=desc`,
      { headers: { "PRIVATE-TOKEN": token }, signal: AbortSignal.timeout(GITLAB_TIMEOUT_MS) },
    );
    if (!res.ok) throw new Error(`GitLab API /projects gagal (${res.status}).`);
    const body = (await res.json()) as GitlabProject[];
    projects.push(...body);
    const totalPages = Number(res.headers.get("X-Total-Pages") ?? "1");
    if (page >= totalPages || body.length === 0) break;
    page += 1;
  }
  return projects.map((p) => ({ id: p.id, name: p.path_with_namespace }));
}

// since/until dihitung dari batas hari kalender Asia/Jakarta (konsisten timezone bisnis
// ADR-0032), bukan timezone proses — supaya "tanggal" yang dikirim frontend selalu berarti
// hari kalender yang sama walau server dijalankan dengan TZ berbeda.
function dayRangeJakarta(tanggal: string): { since: string; until: string } {
  return {
    since: new Date(`${tanggal}T00:00:00+07:00`).toISOString(),
    until: new Date(`${tanggal}T23:59:59+07:00`).toISOString(),
  };
}

// Tipe conventional commit dari baris judul (mis. "feat(x): ..." -> "feat"), dipakai sebagai
// usulan tag task — kosong kalau judulnya tidak mengikuti pola itu (bukan dipaksakan).
function parseConventionalTag(title: string): string | null {
  const match = /^([a-zA-Z]+)(\([^)]*\))?!?:\s/.exec(title);
  return match ? match[1]!.toLowerCase() : null;
}

export interface GitlabCommitItem {
  sha: string;
  shortSha: string;
  title: string;
  body: string;
  tag: string | null;
  authoredAt: string;
  webUrl: string;
}

// Difilter ke commit milik email user yang login (ADR-0039/ADR-0047: bukti/draft kerja sendiri,
// bukan punya orang lain) — dicocokkan manual ke author_email, bukan diandalkan dari scope
// token. Satu project GitLab per panggilan (dipilih user lebih dulu lewat fetchGitlabProjects)
// — bukan nge-loop semua project, supaya request-nya cepat & tidak gampang timeout.
export async function fetchCommitsForDate(
  gitlabProjectId: number,
  tanggal: string,
  authorEmail: string,
  token: string,
): Promise<GitlabCommitItem[]> {
  const { since, until } = dayRangeJakarta(tanggal);
  const authorEmailLower = authorEmail.toLowerCase();

  const commits = await gitlabGet<GitlabCommit[]>(
    token,
    `/api/v4/projects/${gitlabProjectId}/repository/commits?since=${since}&until=${until}&all=true&per_page=100`,
  );

  return commits
    // parent_ids.length > 1 = merge commit (>1 induk) — bukan kerjaan yang mau dijadikan
    // task/catatan realisasi, cuma noise hasil "Merge branch ... into ...". Dicek dari
    // parent_ids, bukan tebak-tebak dari judul, supaya tidak bergantung format pesan merge.
    .filter((c) => c.author_email?.toLowerCase() === authorEmailLower && c.parent_ids.length <= 1)
    .map((c): GitlabCommitItem => {
      const body = c.message.slice(c.title.length).replace(/^\s+/, "").trimEnd();
      return {
        sha: c.id,
        shortSha: c.short_id,
        title: c.title,
        body,
        tag: parseConventionalTag(c.title),
        authoredAt: c.authored_date,
        webUrl: c.web_url,
      };
    })
    .sort((a, b) => b.authoredAt.localeCompare(a.authoredAt));
}

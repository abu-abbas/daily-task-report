<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronsUpDown } from "@lucide/vue";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import MiniMarkdownEditor from "@/components/input-harian/MiniMarkdownEditor.vue";
import { useMyProjectsQuery } from "@/composables/useProjects";
import { useGitlabCommitsQuery, useGitlabProjectsQuery } from "@/composables/useGitlabCommits";
import { useMe, useSaveGitlabToken } from "@/composables/useAuth";
import { formatTanggalPanjang } from "@/lib/locale";
import { ApiError, type GitlabCommitRef } from "@/lib/api";

// Status token GitLab akun ini — token sendiri TIDAK PERNAH dikirim balik server (ADR-0047),
// jadi field-nya cuma bisa "diisi ulang", bukan ditampilkan lalu diedit.
const meQuery = useMe();
const me = computed(() => meQuery.data.value?.user ?? null);
const saveTokenMutation = useSaveGitlabToken();
const editingToken = ref(false);
const tokenInput = ref("");
const tokenError = ref("");

function startEditToken() {
  tokenInput.value = "";
  tokenError.value = "";
  editingToken.value = true;
}

async function submitToken() {
  if (!tokenInput.value.trim()) {
    tokenError.value = "Token wajib diisi.";
    return;
  }
  tokenError.value = "";
  try {
    await saveTokenMutation.mutateAsync(tokenInput.value.trim());
    toast.success("Token GitLab tersambung.");
    editingToken.value = false;
    tokenInput.value = "";
  } catch (err) {
    tokenError.value = err instanceof ApiError ? err.message : "Gagal menyimpan token, coba lagi.";
  }
}

// Impor commit GitLab jadi draft "kerjaan tambahan" (ADR-0047 revisi 2026-09-19) — satu task
// per commit yang dicentang, project tujuan dipilih sekali di sini (berlaku untuk semua commit
// yang dicentang), bukan pemetaan otomatis dari repo asal.
const props = defineProps<{ open: boolean; tanggal: string }>();
const emit = defineEmits<{
  "update:open": [value: boolean];
  add: [
    payload: {
      newTask: { projectId?: number; projectBaru?: string; deskripsi: string; tag?: string; tutupLangsung?: boolean };
      catatan?: string;
      gitlabCommit: GitlabCommitRef;
    },
  ];
}>();

const openRef = computed(() => props.open);
const tanggalRef = computed(() => props.tanggal);

// Sama seperti TaskPickerForm (ADR-0042): project belum ada di daftar bisa diusulkan lewat
// "Lainnya…". Semua commit yang dicentang di satu sesi impor ini berbagi SATU projectBaru yang
// sama — backend (task-logs.ts) dedupe nama identik dalam satu simpan supaya tidak jadi
// beberapa project "Lainnya" duplikat.
const LAINNYA = "__lainnya__";
const projectsQuery = useMyProjectsQuery();
const activeProjects = computed(() => (projectsQuery.data.value?.projects ?? []).filter((p) => p.isActive));
const projectId = ref<string>("");
const isLainnya = computed(() => projectId.value === LAINNYA);
const namaProjectBaru = ref("");

const hasToken = computed(() => me.value?.hasGitlabToken ?? false);

// Repo GitLab dipilih dulu (daftar cepat, satu panggilan) — commit baru di-fetch dari repo
// itu saja, bukan nge-loop semua repo yang bisa diakses token (lambat/gampang timeout).
const projectsEnabled = computed(() => openRef.value && hasToken.value);
const gitlabProjectsQuery = useGitlabProjectsQuery(projectsEnabled);
const gitlabProjects = computed(() => gitlabProjectsQuery.data.value?.projects ?? []);
const gitlabProjectId = ref<string>("");
const gitlabProjectSearch = ref("");
const gitlabProjectPopoverOpen = ref(false);
const gitlabProjectSelected = computed(() =>
  gitlabProjects.value.find((p) => String(p.id) === gitlabProjectId.value),
);
const gitlabProjectsFiltered = computed(() => {
  const q = gitlabProjectSearch.value.trim().toLowerCase();
  if (!q) return gitlabProjects.value;
  return gitlabProjects.value.filter((p) => p.name.toLowerCase().includes(q));
});
function pickGitlabProject(id: number) {
  gitlabProjectId.value = String(id);
  gitlabProjectSearch.value = "";
  gitlabProjectPopoverOpen.value = false;
}

const commitsEnabled = computed(() => openRef.value && hasToken.value && !!gitlabProjectId.value);
const commitsQuery = useGitlabCommitsQuery(
  computed(() => (gitlabProjectId.value ? Number(gitlabProjectId.value) : null)),
  tanggalRef,
  commitsEnabled,
);
const commits = computed(() => commitsQuery.data.value?.commits ?? []);

const checked = reactive<Record<string, boolean>>({});
const catatanDraft = reactive<Record<string, string>>({});

// Reset draft tiap modal dibuka ulang — prefill catatan dari body commit (masih bisa diedit
// sebelum "Impor"). Tag dari dugaan conventional commit ditampilkan read-only (label di
// samping hash), bukan field yang bisa diedit — commit sudah pasti tipenya, tidak perlu diubah.
watch(commits, (list) => {
  for (const key of Object.keys(checked)) delete checked[key];
  for (const key of Object.keys(catatanDraft)) delete catatanDraft[key];
  for (const c of list) catatanDraft[c.sha] = c.body;
});

const checkedCount = computed(() => Object.values(checked).filter(Boolean).length);
const canImport = computed(
  () =>
    (isLainnya.value ? !!namaProjectBaru.value.trim() : !!projectId.value) && checkedCount.value > 0,
);

function reset() {
  projectId.value = "";
  namaProjectBaru.value = "";
  gitlabProjectId.value = "";
  gitlabProjectSearch.value = "";
}

function submit() {
  if (!canImport.value) return;
  for (const c of commits.value) {
    if (!checked[c.sha]) continue;
    emit("add", {
      newTask: {
        projectId: isLainnya.value ? undefined : Number(projectId.value),
        projectBaru: isLainnya.value ? namaProjectBaru.value.trim() : undefined,
        deskripsi: c.title,
        tag: c.tag ?? undefined,
        // Commit sudah pasti kerjaan yang sudah kelar — task-nya langsung dibuat status
        // "closed", bukan "open" menunggu ditandai selesai manual (ADR-0047).
        tutupLangsung: true,
      },
      catatan: catatanDraft[c.sha]?.trim() || undefined,
      // Pesan ASLI commit (bukan catatan yang mungkin sudah diedit user) — ditulis ke
      // task_log_commits sekaligus jadi penanda "sudah diimpor" (ADR-0047).
      gitlabCommit: {
        sha: c.sha,
        commitUrl: c.webUrl,
        pesan: c.body ? `${c.title}\n\n${c.body}` : c.title,
        authoredAt: c.authoredAt,
      },
    });
  }
  reset();
  emit("update:open", false);
}
</script>

<template>
  <div class="grid gap-3">
    <div v-if="hasToken && !editingToken" class="flex items-center gap-2 rounded-md border p-2 text-sm">
      <Avatar size="sm">
        <AvatarImage v-if="me?.gitlabAvatarUrl" :src="me.gitlabAvatarUrl" :alt="me.gitlabUsername ?? ''" />
        <AvatarFallback>{{ (me?.gitlabUsername ?? "?").slice(0, 2).toUpperCase() }}</AvatarFallback>
      </Avatar>
      <span class="flex-1">Tersambung sebagai <span class="font-medium">@{{ me?.gitlabUsername }}</span></span>
      <Button type="button" size="sm" variant="ghost" @click="startEditToken">Ganti token</Button>
    </div>

    <div v-else class="grid gap-2 rounded-md border p-3 text-sm">
      <p v-if="!hasToken" class="text-muted-foreground">Belum ada token GitLab tersambung untuk akun ini.</p>
      <Input v-model="tokenInput" type="password" placeholder="Personal Access Token GitLab (scope read_api)" />
      <p v-if="tokenError" class="text-destructive">{{ tokenError }}</p>
      <div class="flex justify-end gap-2">
        <Button v-if="hasToken" type="button" size="sm" variant="outline" @click="editingToken = false">Batal</Button>
        <Button type="button" size="sm" :disabled="saveTokenMutation.isPending.value" @click="submitToken">
          {{ saveTokenMutation.isPending.value ? "Memeriksa..." : "Sambungkan" }}
        </Button>
      </div>
    </div>

    <template v-if="hasToken && !editingToken">
      <Popover v-model:open="gitlabProjectPopoverOpen">
        <PopoverTrigger as-child>
          <Button type="button" variant="outline" role="combobox" class="w-full justify-between font-normal">
            <span class="truncate">{{ gitlabProjectSelected?.name ?? "Pilih repo GitLab" }}</span>
            <ChevronsUpDown class="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-80 max-w-[90vw] p-2" align="start">
          <Input v-model="gitlabProjectSearch" placeholder="Cari repo..." autofocus />
          <div class="mt-2 grid max-h-64 gap-0.5 overflow-y-auto">
            <p v-if="gitlabProjectsQuery.isPending.value" class="px-2 py-1.5 text-sm text-muted-foreground">
              Memuat daftar repo...
            </p>
            <p v-else-if="gitlabProjectsFiltered.length === 0" class="px-2 py-1.5 text-sm text-muted-foreground">
              Repo tidak ditemukan.
            </p>
            <button
              v-for="p in gitlabProjectsFiltered"
              :key="p.id"
              type="button"
              class="rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              :class="{ 'bg-accent': String(p.id) === gitlabProjectId }"
              @click="pickGitlabProject(p.id)"
            >
              {{ p.name }}
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <template v-if="gitlabProjectId">
        <p class="text-sm text-muted-foreground">Commit tanggal {{ formatTanggalPanjang(tanggal) }}, milik akunmu sendiri.</p>

        <Select v-model="projectId">
          <SelectTrigger class="w-full">
            <SelectValue placeholder="Pilih project tujuan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="p in activeProjects" :key="p.id" :value="String(p.id)">{{ p.nama }}</SelectItem>
            <SelectItem :value="LAINNYA">Lainnya…</SelectItem>
          </SelectContent>
        </Select>

        <template v-if="isLainnya">
          <Input v-model="namaProjectBaru" placeholder="Nama project baru" />
          <p class="text-xs text-muted-foreground">
            Project baru dibuat saat "Simpan" di halaman utama diklik, lalu menunggu admin mengonfirmasi atau
            menggabungkannya.
          </p>
        </template>

        <p v-if="commitsQuery.isPending.value" class="text-sm text-muted-foreground">Memuat commit...</p>
        <div v-else-if="commitsQuery.isError.value" class="flex items-center justify-between gap-2 text-sm text-destructive">
          <span>{{ commitsQuery.error.value instanceof ApiError ? commitsQuery.error.value.message : "Gagal memuat commit, coba lagi." }}</span>
          <Button type="button" size="sm" variant="outline" @click="commitsQuery.refetch()">Coba lagi</Button>
        </div>
        <p v-else-if="commits.length === 0" class="text-sm text-muted-foreground">
          Tidak ada commit milikmu pada tanggal ini di repo ini.
        </p>

        <div v-else class="grid max-h-80 gap-2 overflow-y-auto">
          <div
            v-for="c in commits"
            :key="c.sha"
            class="grid gap-2 rounded-md border p-3 text-sm"
            :class="{ 'opacity-60': c.alreadyImported }"
          >
            <label class="flex items-start gap-2">
              <Checkbox
                :model-value="checked[c.sha] ?? false"
                :disabled="c.alreadyImported"
                @update:model-value="(v) => (checked[c.sha] = v === true)"
              />
              <span class="grid gap-0.5">
                <span class="font-medium">{{ c.title }}</span>
                <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {{ c.shortSha }}
                  <Badge v-if="c.tag" variant="secondary">{{ c.tag }}</Badge>
                  <Badge v-if="c.alreadyImported" variant="outline">Sudah diimpor</Badge>
                </span>
              </span>
            </label>

            <div v-if="checked[c.sha] && !c.alreadyImported" class="border-t pt-2">
              <MiniMarkdownEditor v-model="catatanDraft[c.sha]" placeholder="Catatan hasil" rows="2" />
            </div>
          </div>
        </div>
      </template>
    </template>

    <DialogFooter>
      <DialogClose as-child>
        <Button type="button" variant="outline">Batal</Button>
      </DialogClose>
      <Button v-if="hasToken && !editingToken" type="button" :disabled="!canImport" @click="submit">
        Impor {{ checkedCount || "" }} commit
      </Button>
    </DialogFooter>
  </div>
</template>

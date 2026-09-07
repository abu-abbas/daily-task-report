<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Plus } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MiniMarkdownEditor from "@/components/input-harian/MiniMarkdownEditor.vue";
import { useMyProjectsQuery } from "@/composables/useProjects";
import { useTasksQuery } from "@/composables/useTasks";

const props = withDefaults(
  defineProps<{
    requireCatatan?: boolean;
    submitLabel: string;
  }>(),
  { requireCatatan: false },
);

const emit = defineEmits<{
  add: [
    payload: {
      taskId?: number;
      newTask?: { projectId?: number; projectBaru?: string; deskripsi: string; tag?: string };
      catatan?: string;
    },
  ];
}>();

const LAINNYA = "__lainnya__";

const projectsQuery = useMyProjectsQuery();
const activeProjects = computed(() => (projectsQuery.data.value?.projects ?? []).filter((p) => p.isActive));

const projectSelection = ref<string>("");
const isLainnya = computed(() => projectSelection.value === LAINNYA);
const projectId = computed(() =>
  projectSelection.value && !isLainnya.value ? Number(projectSelection.value) : null,
);
const namaProjectBaru = ref("");

const tasksQuery = useTasksQuery(projectId);
const openTasks = computed(() => tasksQuery.data.value?.tasks ?? []);

const mode = ref<"existing" | "new">("existing");
const taskId = ref<string>("");
const deskripsiBaru = ref("");
const tag = ref("");
const catatan = ref("");
const error = ref("");

watch(projectSelection, () => {
  taskId.value = "";
});

// Project "Lainnya" belum punya task apa pun (baru mau dibuat) — paksa mode "Task baru",
// tidak ada "Task terbuka" untuk dipilih (ADR-0042).
watch(isLainnya, (v) => {
  if (v) mode.value = "new";
});

function reset() {
  mode.value = "existing";
  taskId.value = "";
  deskripsiBaru.value = "";
  tag.value = "";
  catatan.value = "";
  namaProjectBaru.value = "";
  error.value = "";
}

function validationError(): string | null {
  if (isLainnya.value && !namaProjectBaru.value.trim()) return "Nama project wajib diisi.";
  if (!isLainnya.value && !projectId.value) return "Pilih project dulu.";
  if (mode.value === "existing" && !taskId.value) return "Pilih task, atau ganti ke \"Task baru\".";
  if (mode.value === "new" && !deskripsiBaru.value.trim()) return "Deskripsi task baru wajib diisi.";
  if (props.requireCatatan && !catatan.value.trim()) return "Catatan hasil wajib diisi.";
  return null;
}

function submit() {
  const validation = validationError();
  if (validation) {
    error.value = validation;
    return;
  }

  // Project "Lainnya" belum dibuat di sini — cuma ikut dikirim sebagai bagian draft, baru
  // benar-benar tercipta di backend saat "Simpan" akhir menulis semuanya dalam satu transaksi
  // (ADR-0042). Jangan panggil API di sini; draft yang batal/di-refresh sebelum "Simpan" tidak
  // boleh menyisakan project nyantol tanpa task/catatan apa pun.
  emit("add", {
    taskId: mode.value === "existing" ? Number(taskId.value) : undefined,
    newTask:
      mode.value === "new"
        ? {
            projectId: isLainnya.value ? undefined : projectId.value!,
            projectBaru: isLainnya.value ? namaProjectBaru.value.trim() : undefined,
            deskripsi: deskripsiBaru.value.trim(),
            tag: tag.value.trim() || undefined,
          }
        : undefined,
    catatan: catatan.value.trim() || undefined,
  });

  const keepSelection = isLainnya.value ? "" : projectSelection.value;
  reset();
  projectSelection.value = keepSelection;
}
</script>

<template>
  <div class="grid gap-2 rounded-md border border-dashed p-3">
    <div class="grid gap-2 sm:grid-cols-2">
      <Select v-model="projectSelection">
        <SelectTrigger class="w-full">
          <SelectValue placeholder="Pilih project" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="p in activeProjects" :key="p.id" :value="String(p.id)">
            {{ p.nama }}{{ p.belumDirekonsiliasi ? " (belum direkonsiliasi)" : "" }}
          </SelectItem>
          <SelectItem :value="LAINNYA">Lainnya…</SelectItem>
        </SelectContent>
      </Select>

      <Input v-if="isLainnya" v-model="namaProjectBaru" placeholder="Nama project baru" />
      <div v-else class="flex rounded-lg bg-muted p-1 text-sm">
        <button
          type="button"
          class="flex-1 rounded-md px-3 py-1 font-medium transition-colors"
          :class="mode === 'existing' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'"
          @click="mode = 'existing'"
        >
          Task terbuka
        </button>
        <button
          type="button"
          class="flex-1 rounded-md px-3 py-1 font-medium transition-colors"
          :class="mode === 'new' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'"
          @click="mode = 'new'"
        >
          Task baru
        </button>
      </div>
    </div>

    <p v-if="isLainnya" class="text-xs text-muted-foreground">
      Project baru dibuat saat "Simpan" di bawah diklik, lalu menunggu admin mengonfirmasi atau menggabungkannya.
    </p>

    <Select v-if="mode === 'existing'" v-model="taskId" :disabled="!projectId">
      <SelectTrigger class="w-full">
        <SelectValue placeholder="Pilih task" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="t in openTasks" :key="t.id" :value="String(t.id)">{{ t.deskripsi }}</SelectItem>
        <div v-if="projectId && openTasks.length === 0" class="px-2 py-1.5 text-sm text-muted-foreground">
          Belum ada task terbuka.
        </div>
      </SelectContent>
    </Select>

    <div v-else class="grid gap-2 sm:grid-cols-2">
      <Input v-model="deskripsiBaru" placeholder="Deskripsi task baru" />
      <Input v-model="tag" placeholder="Tag (opsional)" />
    </div>

    <MiniMarkdownEditor
      v-model="catatan"
      :placeholder="requireCatatan ? 'Catatan hasil (wajib)' : 'Catatan (opsional)'"
      rows="2"
    />

    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

    <Button type="button" size="sm" class="justify-self-start" @click="submit">
      <Plus class="mr-1 size-4" />
      {{ submitLabel }}
    </Button>
  </div>
</template>

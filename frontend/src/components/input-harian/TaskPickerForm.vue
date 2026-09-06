<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Plus } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMyProjectsQuery } from "@/composables/useProjects";
import { useTasksQuery } from "@/composables/useTasks";

const props = defineProps<{
  requireCatatan: boolean;
  submitLabel: string;
}>();

const emit = defineEmits<{
  add: [
    payload: {
      taskId?: number;
      newTask?: { projectId: number; deskripsi: string; tag?: string };
      catatan?: string;
    },
  ];
}>();

const projectsQuery = useMyProjectsQuery();
const activeProjects = computed(() => (projectsQuery.data.value?.projects ?? []).filter((p) => p.isActive));

const projectId = ref<number | null>(null);
const projectIdRef = computed(() => projectId.value);
const tasksQuery = useTasksQuery(projectIdRef);
const openTasks = computed(() => tasksQuery.data.value?.tasks ?? []);

const mode = ref<"existing" | "new">("existing");
const taskId = ref<string>("");
const deskripsiBaru = ref("");
const tag = ref("");
const catatan = ref("");
const error = ref("");

watch(projectId, () => {
  taskId.value = "";
});

function reset() {
  mode.value = "existing";
  taskId.value = "";
  deskripsiBaru.value = "";
  tag.value = "";
  catatan.value = "";
  error.value = "";
}

function submit() {
  if (!projectId.value) {
    error.value = "Pilih project dulu.";
    return;
  }
  if (mode.value === "existing" && !taskId.value) {
    error.value = "Pilih task, atau ganti ke \"Task baru\".";
    return;
  }
  if (mode.value === "new" && !deskripsiBaru.value.trim()) {
    error.value = "Deskripsi task baru wajib diisi.";
    return;
  }
  if (props.requireCatatan && !catatan.value.trim()) {
    error.value = "Catatan hasil wajib diisi.";
    return;
  }

  emit("add", {
    taskId: mode.value === "existing" ? Number(taskId.value) : undefined,
    newTask:
      mode.value === "new"
        ? { projectId: projectId.value, deskripsi: deskripsiBaru.value.trim(), tag: tag.value.trim() || undefined }
        : undefined,
    catatan: catatan.value.trim() || undefined,
  });

  const keepProjectId = projectId.value;
  reset();
  projectId.value = keepProjectId;
}
</script>

<template>
  <div class="grid gap-2 rounded-md border border-dashed p-3">
    <div class="grid gap-2 sm:grid-cols-2">
      <Select :model-value="projectId ? String(projectId) : undefined" @update:model-value="(v) => (projectId = v ? Number(v) : null)">
        <SelectTrigger class="w-full">
          <SelectValue placeholder="Pilih project" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="p in activeProjects" :key="p.id" :value="String(p.id)">{{ p.nama }}</SelectItem>
        </SelectContent>
      </Select>

      <div class="flex rounded-full bg-muted p-1 text-sm">
        <button
          type="button"
          class="flex-1 rounded-full px-3 py-1 font-medium transition-colors"
          :class="mode === 'existing' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'"
          @click="mode = 'existing'"
        >
          Task terbuka
        </button>
        <button
          type="button"
          class="flex-1 rounded-full px-3 py-1 font-medium transition-colors"
          :class="mode === 'new' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'"
          @click="mode = 'new'"
        >
          Task baru
        </button>
      </div>
    </div>

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

    <Textarea
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

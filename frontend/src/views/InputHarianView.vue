<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import TaskPickerForm from "@/components/input-harian/TaskPickerForm.vue";
import { ApiError, type SaveTaskLogItem } from "@/lib/api";
import { formatTanggalPanjang } from "@/lib/locale";
import { useSaveTodayInput, useTodayInputQuery } from "@/composables/useTaskLogs";

const query = useTodayInputQuery();
const saveMutation = useSaveTodayInput();
const data = computed(() => query.data.value);

interface ChecklistDraft {
  checked: boolean;
  catatan: string;
}
const checklistDrafts = ref<Record<number, ChecklistDraft>>({});

watch(
  data,
  (d) => {
    if (!d) return;
    const drafts: Record<number, ChecklistDraft> = {};
    for (const item of d.checklist) {
      drafts[item.taskId] = { checked: item.realisasiCatatan !== null, catatan: item.realisasiCatatan ?? "" };
    }
    checklistDrafts.value = drafts;
  },
  { immediate: true },
);

const checklistEmpty = computed(() => (data.value?.checklist.length ?? 0) === 0);

interface DraftItem {
  key: number;
  taskId?: number;
  newTask?: { projectId: number; deskripsi: string; tag?: string };
  catatan?: string;
}
let draftKeySeq = 0;
const tambahanDrafts = ref<DraftItem[]>([]);
const rencanaDrafts = ref<DraftItem[]>([]);

function draftLabel(d: DraftItem): string {
  return d.newTask ? d.newTask.deskripsi : `Task #${d.taskId}`;
}

function addTambahan(payload: Omit<DraftItem, "key">) {
  tambahanDrafts.value.push({ ...payload, key: draftKeySeq++ });
}
function addRencana(payload: Omit<DraftItem, "key">) {
  rencanaDrafts.value.push({ ...payload, key: draftKeySeq++ });
}
function removeTambahan(key: number) {
  tambahanDrafts.value = tambahanDrafts.value.filter((d) => d.key !== key);
}
function removeRencana(key: number) {
  rencanaDrafts.value = rencanaDrafts.value.filter((d) => d.key !== key);
}

const tambahanSection = ref<HTMLElement | null>(null);
function scrollToTambahan() {
  tambahanSection.value?.scrollIntoView({ behavior: "smooth", block: "center" });
}

const checklistInvalid = computed(() =>
  (data.value?.checklist ?? []).some((item) => {
    const draft = checklistDrafts.value[item.taskId];
    return draft?.checked && !draft.catatan.trim();
  }),
);

const itemsToSave = computed<SaveTaskLogItem[]>(() => {
  const items: SaveTaskLogItem[] = [];
  for (const item of data.value?.checklist ?? []) {
    const draft = checklistDrafts.value[item.taskId];
    if (draft?.checked && draft.catatan.trim()) {
      items.push({ taskId: item.taskId, jenis: "realisasi", catatan: draft.catatan.trim() });
    }
  }
  for (const d of tambahanDrafts.value) {
    items.push({ taskId: d.taskId, newTask: d.newTask, jenis: "realisasi", catatan: d.catatan, isExtra: true });
  }
  for (const d of rencanaDrafts.value) {
    items.push({ taskId: d.taskId, newTask: d.newTask, jenis: "rencana" });
  }
  return items;
});

const canSave = computed(() => itemsToSave.value.length > 0 && !checklistInvalid.value);

const confirmOpen = ref(false);

async function confirmSave() {
  try {
    await saveMutation.mutateAsync(itemsToSave.value);
    toast.success("Input harian tersimpan.");
    tambahanDrafts.value = [];
    rencanaDrafts.value = [];
    confirmOpen.value = false;
  } catch (err) {
    confirmOpen.value = false;
    toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan, coba lagi.");
  }
}

const ringkasan = computed(() => {
  const realisasiCount = (data.value?.checklist ?? []).filter((item) => checklistDrafts.value[item.taskId]?.checked)
    .length;
  return {
    realisasi: realisasiCount,
    tambahan: tambahanDrafts.value.length,
    rencana: rencanaDrafts.value.length,
  };
});
</script>

<template>
  <div class="grid gap-4 pb-24">
    <div>
      <h1 class="text-lg font-semibold">Input Harian</h1>
    </div>

    <p v-if="query.isPending.value" class="text-sm text-muted-foreground">Memuat data...</p>
    <p v-else-if="query.isError.value" class="text-sm text-destructive">Gagal memuat data, coba muat ulang.</p>

    <template v-else-if="data">
      <Card>
        <CardHeader>
          <CardTitle class="text-base">Realisasi</CardTitle>
          <CardDescription>{{ formatTanggalPanjang(data.hariKerjaSebelumnya) }}</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-4">
          <div v-if="checklistEmpty" class="grid gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            <p>Tidak ada rencana tercatat untuk hari kerja sebelumnya.</p>
            <Button type="button" size="sm" variant="outline" class="justify-self-start" @click="scrollToTambahan">
              Tambah kerjaan kemarin (manual)
            </Button>
          </div>

          <div v-else class="grid gap-3">
            <div v-for="item in data.checklist" :key="item.taskId" class="grid gap-2 rounded-md border p-3">
              <label :for="`realisasi-${item.taskId}`" class="flex items-start gap-2 text-sm">
                <Checkbox
                  :id="`realisasi-${item.taskId}`"
                  :model-value="checklistDrafts[item.taskId]?.checked ?? false"
                  @update:model-value="(v) => (checklistDrafts[item.taskId]!.checked = v === true)"
                />
                <span class="grid gap-1">
                  <span class="font-medium">{{ item.deskripsi }}</span>
                  <span class="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <Badge variant="outline">{{ item.projectNama }}</Badge>
                    <Badge v-if="item.tag" variant="secondary">{{ item.tag }}</Badge>
                  </span>
                </span>
              </label>
              <Textarea
                v-if="checklistDrafts[item.taskId]?.checked"
                v-model="checklistDrafts[item.taskId]!.catatan"
                aria-label="Catatan hasil"
                placeholder="Catatan hasil (wajib)"
                rows="2"
              />
              <p
                v-if="checklistDrafts[item.taskId]?.checked && !checklistDrafts[item.taskId]!.catatan.trim()"
                class="text-sm text-destructive"
              >
                Catatan hasil wajib diisi.
              </p>
            </div>
          </div>

          <Separator />

          <div ref="tambahanSection" class="grid gap-3">
            <h3 class="text-sm font-medium">Kerjaan tambahan</h3>

            <div v-if="data.tambahan.length > 0" class="grid gap-2">
              <div v-for="t in data.tambahan" :key="t.taskId" class="rounded-md border p-3 text-sm">
                <p class="font-medium">{{ t.deskripsi }}</p>
                <p class="text-xs text-muted-foreground">{{ t.projectNama }} — {{ t.catatan }}</p>
              </div>
            </div>

            <div v-if="tambahanDrafts.length > 0" class="grid gap-2">
              <div v-for="d in tambahanDrafts" :key="d.key" class="flex items-center justify-between rounded-md border p-3 text-sm">
                <span>{{ draftLabel(d) }} — {{ d.catatan }}</span>
                <Button variant="ghost" size="sm" @click="removeTambahan(d.key)">Hapus</Button>
              </div>
            </div>

            <TaskPickerForm
              require-catatan
              submit-label="Tambahkan ke draft"
              @add="addTambahan"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="text-base">Rencana</CardTitle>
          <CardDescription>{{ formatTanggalPanjang(data.tanggal) }}</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-3">
          <div v-if="data.rencanaHariIni.length > 0" class="grid gap-2">
            <div v-for="r in data.rencanaHariIni" :key="r.taskId" class="rounded-md border p-3 text-sm">
              <p class="font-medium">{{ r.deskripsi }}</p>
              <p class="text-xs text-muted-foreground">{{ r.projectNama }}</p>
            </div>
          </div>

          <div v-if="rencanaDrafts.length > 0" class="grid gap-2">
            <div v-for="d in rencanaDrafts" :key="d.key" class="flex items-center justify-between rounded-md border p-3 text-sm">
              <span>{{ draftLabel(d) }}</span>
              <Button variant="ghost" size="sm" @click="removeRencana(d.key)">Hapus</Button>
            </div>
          </div>

          <TaskPickerForm submit-label="Tambahkan rencana" @add="addRencana" />
        </CardContent>
      </Card>

      <div class="flex justify-end border-t pt-4">
        <Button size="lg" :disabled="!canSave" @click="confirmOpen = true">Simpan</Button>
      </div>

      <AlertDialog v-model:open="confirmOpen">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Simpan input harian ini?</AlertDialogTitle>
            <AlertDialogDescription>
              {{ ringkasan.realisasi }} realisasi, {{ ringkasan.tambahan }} kerjaan tambahan,
              {{ ringkasan.rencana }} rencana hari ini akan disimpan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel :disabled="saveMutation.isPending.value">Batal</AlertDialogCancel>
            <AlertDialogAction :disabled="saveMutation.isPending.value" @click="confirmSave">
              {{ saveMutation.isPending.value ? "Menyimpan..." : "Ya, simpan" }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </template>
  </div>
</template>

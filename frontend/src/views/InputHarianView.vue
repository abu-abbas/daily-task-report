<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { parseDate } from "@internationalized/date";
import { CalendarIcon, CircleCheck, Clock, Plus, Send } from "@lucide/vue";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import TaskPickerForm from "@/components/input-harian/TaskPickerForm.vue";
import KendalaList from "@/components/input-harian/KendalaList.vue";
import AttachmentList from "@/components/input-harian/AttachmentList.vue";
import ProjectBadge from "@/components/input-harian/ProjectBadge.vue";
import MiniMarkdownEditor from "@/components/input-harian/MiniMarkdownEditor.vue";
import MiniMarkdownText from "@/components/input-harian/MiniMarkdownText.vue";
import { ApiError, type IzinJenis, type SaveTaskLogItem } from "@/lib/api";
import { groupByProject } from "@/lib/groupByProject";
import { formatTanggalPanjang } from "@/lib/locale";
import { useCancelLeave, useDailyInputQuery, useSaveDailyInput, useSaveLeave } from "@/composables/useTaskLogs";
import { useCloseTask } from "@/composables/useTasks";

const route = useRoute();
const router = useRouter();

// Tanggal laporan (ADR-0044) — dibaca dari query string supaya linkable, sinkron dua arah
// lewat router.replace saat date-input berubah. null = biarkan server tentukan "hari ini".
const selectedTanggal = ref<string | null>(typeof route.query.tanggal === "string" ? route.query.tanggal : null);

// Sinkron balik dari route ke state lokal — perlu kalau navigasi ?tanggal= datang dari LUAR
// komponen ini (mis. klik kalender di sidebar kanan lewat router.push), bukan cuma dari
// date-input sendiri; tanpa ini query tetap pakai tanggal lama walau URL sudah berubah.
watch(
  () => route.query.tanggal,
  (v) => {
    selectedTanggal.value = typeof v === "string" ? v : null;
  },
);

const query = useDailyInputQuery(selectedTanggal);
const saveMutation = useSaveDailyInput();
const saveLeaveMutation = useSaveLeave();
const cancelLeaveMutation = useCancelLeave();
const data = computed(() => query.data.value);
const isSaving = computed(
  () => saveMutation.isPending.value || saveLeaveMutation.isPending.value || cancelLeaveMutation.isPending.value,
);

const tanggalDisplay = computed({
  get: () => selectedTanggal.value ?? data.value?.tanggal ?? "",
  set: (v: string) => {
    if (!v) return;
    selectedTanggal.value = v;
    router.replace({ query: { ...route.query, tanggal: v } });
  },
});
const minTanggal = computed(() => (data.value ? `${data.value.hariIni.slice(0, 7)}-01` : undefined));
const maxTanggal = computed(() => data.value?.hariIni);

// Calendar shadcn-vue (bukan <input type="date"> native) — konsisten dengan pola date-picker
// lain di app ini (form tanggal libur admin, kalender sidebar kanan).
const tanggalCalendarValue = computed(() => (tanggalDisplay.value ? parseDate(tanggalDisplay.value) : undefined));
const minTanggalValue = computed(() => (minTanggal.value ? parseDate(minTanggal.value) : undefined));
const maxTanggalValue = computed(() => (maxTanggal.value ? parseDate(maxTanggal.value) : undefined));

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
      // Belum pernah realisasi? Mulai dari catatan rencananya (mis. checklist markdown yang
      // sudah ditulis kemarin) alih-alih kosong — tinggal dicentang/dilengkapi, bukan nulis ulang.
      drafts[item.taskId] = {
        checked: item.realisasiCatatan !== null,
        catatan: item.realisasiCatatan ?? item.rencanaCatatan ?? "",
      };
    }
    checklistDrafts.value = drafts;
  },
  { immediate: true },
);

const checklistEmpty = computed(() => (data.value?.checklist.length ?? 0) === 0);
const checklistGroups = computed(() => groupByProject(data.value?.checklist ?? []));
const tambahanGroups = computed(() => groupByProject(data.value?.tambahan ?? []));
const rencanaGroups = computed(() => groupByProject(data.value?.rencanaHariIni ?? []));

// Dipakai TaskPickerForm buat isi ulang catatan saat task yang sudah tersimpan hari ini dipilih
// lagi lewat "Task terbuka" — cegah submit ulang menimpa catatan lama (mis. checklist todo-list)
// jadi hilang, karena simpan itu replace, bukan gabung (ADR-0043).
function catatanByTaskId(items: { taskId: number; catatan: string | null }[] | undefined): Record<number, string> {
  const map: Record<number, string> = {};
  for (const item of items ?? []) map[item.taskId] = item.catatan ?? "";
  return map;
}
const tambahanCatatanByTaskId = computed(() => catatanByTaskId(data.value?.tambahan));
const rencanaCatatanByTaskId = computed(() => catatanByTaskId(data.value?.rencanaHariIni));

interface DraftItem {
  key: number;
  taskId?: number;
  newTask?: { projectId?: number; projectBaru?: string; deskripsi: string; tag?: string };
  catatan?: string;
}
let draftKeySeq = 0;
const tambahanDrafts = ref<DraftItem[]>([]);
const rencanaDrafts = ref<DraftItem[]>([]);

// Ganti tanggal laporan = draft yang sedang disusun tidak lagi relevan (ditujukan buat tanggal
// sebelumnya) — dibuang alih-alih ikut nyantol ke tanggal baru saat simpan.
watch(selectedTanggal, () => {
  tambahanDrafts.value = [];
  rencanaDrafts.value = [];
});

function draftLabel(d: DraftItem): string {
  return d.newTask ? d.newTask.deskripsi : `Task #${d.taskId}`;
}

const tambahanDialogOpen = ref(false);
const rencanaDialogOpen = ref(false);

function addTambahan(payload: Omit<DraftItem, "key">) {
  tambahanDrafts.value.push({ ...payload, key: draftKeySeq++ });
  tambahanDialogOpen.value = false;
}
function addRencana(payload: Omit<DraftItem, "key">) {
  rencanaDrafts.value.push({ ...payload, key: draftKeySeq++ });
  rencanaDialogOpen.value = false;
}
function removeTambahan(key: number) {
  tambahanDrafts.value = tambahanDrafts.value.filter((d) => d.key !== key);
}
function removeRencana(key: number) {
  rencanaDrafts.value = rencanaDrafts.value.filter((d) => d.key !== key);
}

// Menutup task (ADR-0012/Q-04) — dialog tunggal dipakai ulang buat task mana pun yang diklik
// "Tandai selesai", plain textarea (bukan MiniMarkdownEditor) buat deskripsi penutupan opsional.
const closeTaskMutation = useCloseTask();
const closeDialogOpen = ref(false);
const closingTask = ref<{ id: number; deskripsi: string } | null>(null);
const closeDeskripsi = ref("");

function openCloseDialog(task: { taskId: number; deskripsi: string }) {
  closingTask.value = { id: task.taskId, deskripsi: task.deskripsi };
  closeDeskripsi.value = "";
  closeDialogOpen.value = true;
}

async function confirmCloseTask() {
  if (!closingTask.value) return;
  try {
    await closeTaskMutation.mutateAsync({
      taskId: closingTask.value.id,
      deskripsiPenutupan: closeDeskripsi.value.trim() || undefined,
    });
    toast.success(`Task "${closingTask.value.deskripsi}" ditutup.`);
    closeDialogOpen.value = false;
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : "Gagal menutup task, coba lagi.");
  }
}

// Izin/cuti/sakit (ADR-0013/0044) — toggle menyembunyikan form rencana tanggal ini, diganti
// form izin. Realisasi & kerjaan tambahan hari kerja sebelumnya (card "Realisasi") tetap tampil
// apa adanya, tidak terpengaruh toggle ini.
const izinAktif = ref(false);
const izinJenis = ref<IzinJenis>("cuti");
const izinAlasan = ref("");

watch(
  data,
  (d) => {
    izinAktif.value = d?.izin != null;
    izinJenis.value = d?.izin?.jenis ?? "cuti";
    izinAlasan.value = d?.izin?.alasan ?? "";
  },
  { immediate: true },
);

watch(izinAktif, (aktif) => {
  if (aktif) rencanaDrafts.value = [];
});

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
    items.push({ taskId: d.taskId, newTask: d.newTask, jenis: "rencana", catatan: d.catatan });
  }
  return items;
});

const izinSebelumnya = computed(() => data.value?.izin != null);
const canSave = computed(
  () => (itemsToSave.value.length > 0 || izinAktif.value || izinSebelumnya.value) && !checklistInvalid.value,
);

const confirmOpen = ref(false);

async function confirmSave() {
  const tanggal = data.value!.tanggal;
  try {
    if (izinAktif.value) {
      await saveLeaveMutation.mutateAsync({ tanggal, jenis: izinJenis.value, alasan: izinAlasan.value.trim() || undefined });
    } else if (izinSebelumnya.value) {
      await cancelLeaveMutation.mutateAsync(tanggal);
    }
    if (itemsToSave.value.length > 0) {
      await saveMutation.mutateAsync({ tanggal, items: itemsToSave.value });
    }
    toast.success("Input harian tersimpan.");
    tambahanDrafts.value = [];
    rencanaDrafts.value = [];
    confirmOpen.value = false;
    router.push("/");
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

// Simpan izin menghapus rencana yang sudah tersimpan di tanggal ini (ADR-0044) — user perlu
// lihat peringatan ini dulu di dialog konfirmasi, jangan sampai kaget rencananya hilang diam-diam.
const rencanaTersimpanAkanDihapus = computed(() =>
  izinAktif.value ? (data.value?.rencanaHariIni.length ?? 0) : 0,
);

// Efek uncheck checklist realisasi (ADR-0044) menghapus baris realisasi tersimpan — dan karena
// kendala (FK CASCADE, ADR-0015) dan attachment (dibersihkan manual, ADR-0016 — polymorphic,
// bukan FK sungguhan) menempel ke baris itu, ikut terhapus diam-diam kalau tidak diperingatkan
// dulu di sini.
const checklistDataAkanHilang = computed(() =>
  (data.value?.checklist ?? []).filter((item) => {
    const draft = checklistDrafts.value[item.taskId];
    const akanDiuncheck = item.realisasiCatatan !== null && !draft?.checked;
    return akanDiuncheck && (item.kendala.length > 0 || item.attachments.length > 0);
  }),
);
const totalKendalaAkanHilang = computed(() =>
  checklistDataAkanHilang.value.reduce((total, item) => total + item.kendala.length, 0),
);
const totalAttachmentAkanHilang = computed(() =>
  checklistDataAkanHilang.value.reduce((total, item) => total + item.attachments.length, 0),
);
</script>

<template>
  <div class="grid gap-4 pb-24">
    <div>
      <h1 class="text-lg font-semibold">Input Harian</h1>
    </div>

    <p v-if="query.isPending.value" class="text-sm text-muted-foreground">Memuat data...</p>
    <p v-else-if="query.isError.value" class="text-sm text-destructive">Gagal memuat data, coba muat ulang.</p>

    <template v-else-if="data">
      <!-- lg:hidden: di layar besar kalender sidebar kanan (AppSidebarRight, "hidden lg:flex")
           sudah jadi cara pilih tanggal laporan, field ini jadi ganda. Di mobile sidebar itu
           disembunyikan, jadi field ini tetap satu-satunya cara pilih tanggal di sana. -->
      <div class="grid w-fit gap-1.5 lg:hidden">
        <label for="tanggal-laporan" class="text-xs font-medium text-muted-foreground">Tanggal laporan</label>
        <Popover v-slot="{ close }">
          <PopoverTrigger as-child>
            <Button id="tanggal-laporan" variant="outline" class="justify-start text-left font-normal">
              <CalendarIcon aria-hidden="true" />
              {{ formatTanggalPanjang(tanggalDisplay) }}
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-auto p-0" align="start">
            <Calendar
              :model-value="tanggalCalendarValue"
              :min-value="minTanggalValue"
              :max-value="maxTanggalValue"
              initial-focus
              @update:model-value="(value) => { if (value) tanggalDisplay = value.toString(); close(); }"
            />
          </PopoverContent>
        </Popover>
      </div>

      <div class="grid gap-4 lg:grid-cols-2 lg:items-start">
      <Card>
        <CardHeader class="flex-row items-center gap-3 space-y-0">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <CircleCheck class="size-5" aria-hidden="true" />
          </div>
          <div class="grid gap-0.5">
            <CardTitle class="text-base">Realisasi</CardTitle>
            <CardDescription>{{ formatTanggalPanjang(data.hariKerjaSebelumnya) }}</CardDescription>
          </div>
          <Badge variant="secondary" class="ml-auto shrink-0">
            {{ data.checklist.length + data.tambahan.length }} pekerjaan
          </Badge>
        </CardHeader>
        <CardContent class="grid gap-4">
          <div v-if="checklistEmpty" class="grid gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            <p>Tidak ada rencana tercatat untuk hari kerja sebelumnya.</p>
            <Button type="button" size="sm" variant="outline" class="justify-self-start" @click="tambahanDialogOpen = true">
              Tambah kerjaan kemarin (manual)
            </Button>
          </div>

          <div v-else class="grid gap-2">
            <div v-for="group in checklistGroups" :key="group.projectId" class="grid gap-2 rounded-md border p-3">
              <ProjectBadge :nama="group.projectNama" class="justify-self-start" />
              <div
                v-for="item in group.items"
                :key="item.taskId"
                class="grid gap-2 border-t pt-2 first:border-t-0 first:pt-0"
              >
                <label :for="`realisasi-${item.taskId}`" class="flex items-start gap-2 text-sm">
                  <Checkbox
                    :id="`realisasi-${item.taskId}`"
                    :model-value="checklistDrafts[item.taskId]?.checked ?? false"
                    @update:model-value="(v) => (checklistDrafts[item.taskId]!.checked = v === true)"
                  />
                  <span class="grid gap-1">
                    <span class="flex flex-wrap items-center gap-1">
                      <span class="font-medium">{{ item.deskripsi }}</span>
                      <Badge v-if="item.taskStatus === 'closed'" variant="secondary">Ditutup</Badge>
                    </span>
                    <Badge v-if="item.tag" variant="secondary" class="w-fit">{{ item.tag }}</Badge>
                  </span>
                </label>
                <MiniMarkdownEditor
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
                <KendalaList
                  v-if="checklistDrafts[item.taskId]?.checked"
                  :task-log-id="item.taskLogId"
                  :items="item.kendala"
                />
                <AttachmentList
                  v-if="checklistDrafts[item.taskId]?.checked"
                  :task-log-id="item.taskLogId"
                  :items="item.attachments"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div class="grid gap-3">
            <h3 class="text-sm font-medium">Kerjaan diluar rencana</h3>

            <div v-if="data.tambahan.length > 0" class="grid gap-2">
              <div v-for="group in tambahanGroups" :key="group.projectId" class="grid gap-2 rounded-md border p-3 text-sm">
                <ProjectBadge :nama="group.projectNama" class="justify-self-start" />
                <div v-for="t in group.items" :key="t.taskId" class="grid gap-1 border-t pt-2 first:border-t-0 first:pt-0">
                  <div class="flex items-start justify-between gap-2">
                    <p class="font-medium">{{ t.deskripsi }}</p>
                    <div class="flex shrink-0 items-center gap-1">
                      <Badge v-if="t.taskStatus === 'closed'" variant="secondary">Ditutup</Badge>
                      <Tooltip v-else>
                        <TooltipTrigger as-child>
                          <Button variant="ghost" size="icon-sm" aria-label="Tandai selesai" @click="openCloseDialog(t)">
                            <CircleCheck class="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Tandai selesai</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <MiniMarkdownText :text="t.catatan ?? ''" class="text-xs text-muted-foreground" />
                  <KendalaList :task-log-id="t.taskLogId" :items="t.kendala" />
                  <AttachmentList :task-log-id="t.taskLogId" :items="t.attachments" />
                </div>
              </div>
            </div>

            <div v-if="tambahanDrafts.length > 0" class="grid gap-2">
              <div v-for="d in tambahanDrafts" :key="d.key" class="flex items-start justify-between gap-2 rounded-md border p-3 text-sm">
                <div class="grid gap-1">
                  <span class="font-medium">{{ draftLabel(d) }}</span>
                  <MiniMarkdownText v-if="d.catatan" :text="d.catatan" class="text-muted-foreground" />
                </div>
                <Button variant="ghost" size="sm" @click="removeTambahan(d.key)">Hapus</Button>
              </div>
            </div>

            <Dialog v-model:open="tambahanDialogOpen">
              <DialogTrigger as-child>
                <Button type="button" size="sm" variant="outline" class="justify-self-start">
                  <Plus class="mr-1 size-4" />
                  Tambah kerjaan
                </Button>
              </DialogTrigger>
              <DialogContent class="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Tambah kerjaan</DialogTitle>
                </DialogHeader>
                <TaskPickerForm
                  require-catatan
                  :existing-catatan-by-task-id="tambahanCatatanByTaskId"
                  @add="addTambahan"
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex-row items-center gap-3 space-y-0">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-500">
            <Clock class="size-5" aria-hidden="true" />
          </div>
          <div class="grid gap-0.5">
            <CardTitle class="text-base">{{ izinAktif ? "Izin" : "Rencana" }}</CardTitle>
            <CardDescription>{{ formatTanggalPanjang(data.tanggal) }}</CardDescription>
          </div>
          <Badge v-if="!izinAktif" variant="secondary" class="ml-auto shrink-0">
            {{ data.rencanaHariIni.length }} rencana
          </Badge>
        </CardHeader>
        <CardContent class="grid gap-3">
          <label class="flex items-start gap-2 text-sm">
            <Checkbox :model-value="izinAktif" @update:model-value="(v) => (izinAktif = v === true)" />
            <span class="grid gap-0.5">
              <span class="font-medium">Izin/ tidak masuk</span>
              <span class="text-xs text-muted-foreground">Realisasi hari kerja sebelumnya tetap bisa diisi.</span>
            </span>
          </label>

          <div v-if="izinAktif" class="grid gap-2">
            <Select v-model="izinJenis">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Jenis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cuti">Cuti</SelectItem>
                <SelectItem value="sakit">Sakit</SelectItem>
                <SelectItem value="izin">Izin</SelectItem>
              </SelectContent>
            </Select>
            <Textarea v-model="izinAlasan" placeholder="Alasan (opsional)" rows="2" />
          </div>

          <template v-else>
            <div v-if="data.rencanaHariIni.length > 0" class="grid gap-2">
              <div v-for="group in rencanaGroups" :key="group.projectId" class="grid gap-2 rounded-md border p-3 text-sm">
                <ProjectBadge :nama="group.projectNama" class="justify-self-start" />
                <div v-for="r in group.items" :key="r.taskId" class="grid gap-1 border-t pt-2 first:border-t-0 first:pt-0">
                  <div class="flex items-start justify-between gap-2">
                    <p class="font-medium">{{ r.deskripsi }}</p>
                    <div class="flex shrink-0 items-center gap-1">
                      <Badge v-if="r.taskStatus === 'closed'" variant="secondary">Ditutup</Badge>
                      <Tooltip v-else>
                        <TooltipTrigger as-child>
                          <Button variant="ghost" size="icon-sm" aria-label="Tandai selesai" @click="openCloseDialog(r)">
                            <CircleCheck class="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Tandai selesai</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <MiniMarkdownText v-if="r.catatan" :text="r.catatan" class="text-xs text-muted-foreground" />
                </div>
              </div>
            </div>

            <div v-if="rencanaDrafts.length > 0" class="grid gap-2">
              <div v-for="d in rencanaDrafts" :key="d.key" class="flex items-center justify-between rounded-md border p-3 text-sm">
                <span>{{ draftLabel(d) }}</span>
                <Button variant="ghost" size="sm" @click="removeRencana(d.key)">Hapus</Button>
              </div>
            </div>

            <Dialog v-model:open="rencanaDialogOpen">
              <DialogTrigger as-child>
                <Button type="button" size="sm" variant="outline" class="justify-self-start">
                  <Plus class="mr-1 size-4" />
                  Tambah rencana
                </Button>
              </DialogTrigger>
              <DialogContent class="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Tambah rencana</DialogTitle>
                </DialogHeader>
                <TaskPickerForm
                  :existing-catatan-by-task-id="rencanaCatatanByTaskId"
                  @add="addRencana"
                />
              </DialogContent>
            </Dialog>
          </template>
        </CardContent>
      </Card>
      </div>

      <div class="flex justify-end">
        <Button size="lg" :disabled="!canSave" @click="confirmOpen = true">
          Simpan
          <Send class="size-4" />
        </Button>
      </div>

      <AlertDialog v-model:open="confirmOpen">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Simpan input harian ini?</AlertDialogTitle>
            <AlertDialogDescription>
              {{ ringkasan.realisasi }} realisasi dicentang, {{ ringkasan.tambahan }} kerjaan diluar rencana baru,
              {{ ringkasan.rencana }} rencana baru hari ini<span v-if="izinAktif">, ditambah status izin</span>
              akan disimpan. Item yang sudah tersimpan sebelumnya tidak dihitung ulang di sini.
            </AlertDialogDescription>
            <p v-if="rencanaTersimpanAkanDihapus > 0" class="text-sm text-destructive">
              {{ rencanaTersimpanAkanDihapus }} rencana yang sudah tersimpan di tanggal ini akan terhapus karena izin
              diaktifkan.
            </p>
            <p v-if="checklistDataAkanHilang.length > 0" class="text-sm text-destructive">
              {{ checklistDataAkanHilang.length }} checklist yang di-uncheck sudah punya
              <template v-if="totalKendalaAkanHilang > 0">{{ totalKendalaAkanHilang }} kendala</template>
              <template v-if="totalKendalaAkanHilang > 0 && totalAttachmentAkanHilang > 0"> dan </template>
              <template v-if="totalAttachmentAkanHilang > 0">{{ totalAttachmentAkanHilang }} lampiran</template>
              tercatat — realisasi beserta itu semua akan ikut terhapus kalau disimpan.
            </p>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel :disabled="isSaving">Batal</AlertDialogCancel>
            <AlertDialogAction :disabled="isSaving" @click="confirmSave">
              {{ isSaving ? "Menyimpan..." : "Ya, simpan" }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog v-model:open="closeDialogOpen">
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tandai "{{ closingTask?.deskripsi }}" selesai?</DialogTitle>
          </DialogHeader>
          <Textarea v-model="closeDeskripsi" placeholder="Deskripsi penutupan (opsional)" rows="3" />
          <DialogFooter>
            <DialogClose as-child>
              <Button type="button" variant="outline" :disabled="closeTaskMutation.isPending.value">Batal</Button>
            </DialogClose>
            <Button :disabled="closeTaskMutation.isPending.value" @click="confirmCloseTask">
              {{ closeTaskMutation.isPending.value ? "Menutup..." : "Ya, tutup task" }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>

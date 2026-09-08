<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronLeft, ChevronRight, FileDown } from "@lucide/vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogHeader, DialogScrollContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ActivityHeatmap from "@/components/input-harian/ActivityHeatmap.vue";
import ActivityLogList from "@/components/input-harian/ActivityLogList.vue";
import KendalaList from "@/components/input-harian/KendalaList.vue";
import AttachmentList from "@/components/input-harian/AttachmentList.vue";
import ProjectBadge from "@/components/input-harian/ProjectBadge.vue";
import MiniMarkdownText from "@/components/input-harian/MiniMarkdownText.vue";
import { groupByProject } from "@/lib/groupByProject";
import { formatTanggalPanjang, LOCALE } from "@/lib/locale";
import { monthlyReportPdfUrl } from "@/lib/api";
import { useMyProjectsQuery } from "@/composables/useProjects";
import { useActivityHeatmapQuery, useRiwayatDetailQuery } from "@/composables/useRiwayat";

const IZIN_LABEL: Record<string, string> = { cuti: "Cuti", sakit: "Sakit", izin: "Izin" };

const projectsQuery = useMyProjectsQuery();
const projects = computed(() => projectsQuery.data.value?.projects ?? []);
const projectFilter = ref<string>("all");
const projectIdFilter = computed(() => (projectFilter.value === "all" ? undefined : Number(projectFilter.value)));

// Widget kecil khusus ekspor laporan (Stage 7 cicilan awal, ADR-0019) — Riwayat sendiri tidak
// lagi punya picker bulan (diganti heatmap+daftar Realisasi). Satu Popover dengan dua "tampilan"
// internal (daftar 3 bulan terbaru, lalu grid bulan/tahun kalau "Bulan lainnya" diklik) — SENGAJA
// bukan dua overlay terpisah (DropdownMenu lalu Popover): menutup DropdownMenu mengembalikan
// focus ke tombol trigger, yang oleh Popover manapun yang baru dibuka dianggap "focus di luar"
// dan langsung membatalkannya (dicoba, direproduksi lewat Playwright, terkonfirmasi via watcher
// state — bukan tebakan). Toggle tampilan di dalam SATU overlay yang sama menghindari race itu.
const laporanPopoverOpen = ref(false);
const tampilkanPemilihBulan = ref(false);
function tutupLaporanPopover(open: boolean) {
  laporanPopoverOpen.value = open;
  if (!open) tampilkanPemilihBulan.value = false;
}

const bulanTerbaruFormatter = new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric" });
interface BulanOpsi {
  bulan: string;
  label: string;
}
const bulanTerbaruOptions = computed<BulanOpsi[]>(() => {
  const now = new Date();
  return Array.from({ length: 3 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const bulan = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { bulan, label: bulanTerbaruFormatter.format(d) };
  });
});

const bulanLainnyaTahun = ref(new Date().getFullYear());
const NAMA_BULAN_PENDEK_FMT = new Intl.DateTimeFormat(LOCALE, { month: "short" });
const namaBulanPendek = Array.from({ length: 12 }, (_, i) => NAMA_BULAN_PENDEK_FMT.format(new Date(2000, i, 1)));
function bulanLainnyaUrl(bulanIndex: number): string {
  return monthlyReportPdfUrl(`${bulanLainnyaTahun.value}-${String(bulanIndex + 1).padStart(2, "0")}`);
}

const heatmapQuery = useActivityHeatmapQuery(projectIdFilter);

// Klik kotak heatmap memfilter daftar Realisasi di bawahnya ke tanggal itu (bukan langsung buka
// Dialog) — hindari dua jalur "lihat detail" yang tumpang tindih (heatmap dan daftar sama-sama
// bisa buka Dialog). Klik kotak yang sama lagi membatalkan filter.
const tanggalFilterHeatmap = ref<string | null>(null);
function pilihTanggalHeatmap(tanggal: string) {
  tanggalFilterHeatmap.value = tanggalFilterHeatmap.value === tanggal ? null : tanggal;
}

// Satu tanggal terbuka dalam satu waktu — detail baru di-fetch (lazy) begitu baris daftar
// Realisasi diklik.
const tanggalTerpilih = ref<string | null>(null);
function bukaTanggal(tanggal: string) {
  tanggalTerpilih.value = tanggal;
}
function tutupDialog(open: boolean) {
  if (!open) tanggalTerpilih.value = null;
}
const detailQuery = useRiwayatDetailQuery(tanggalTerpilih);
const detail = computed(() => detailQuery.data.value);

const detailRealisasi = computed(() =>
  groupByProject((detail.value?.items ?? []).filter((i) => i.jenis === "realisasi")),
);
const detailRencana = computed(() =>
  groupByProject((detail.value?.items ?? []).filter((i) => i.jenis === "rencana")),
);
</script>

<template>
  <div class="grid gap-4 pb-24">
    <div class="flex items-center justify-between">
      <div class="flex-1">
        <h1 class="text-lg font-semibold">Riwayat</h1>
        <p class="text-sm text-muted-foreground">Aktivitas realisasi 12 bulan terakhir.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Select v-model="projectFilter">
          <SelectTrigger class="w-full sm:w-56">
            <SelectValue placeholder="Semua project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua project</SelectItem>
            <SelectItem v-for="p in projects" :key="p.id" :value="String(p.id)">{{ p.nama }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <p v-if="heatmapQuery.isPending.value" class="text-sm text-muted-foreground">Memuat...</p>
    <p v-else-if="heatmapQuery.isError.value" class="text-sm text-destructive">Gagal memuat, coba muat ulang.</p>
    <ActivityHeatmap
      v-else-if="heatmapQuery.data.value"
      :hari="heatmapQuery.data.value.hari"
      :dari="heatmapQuery.data.value.dari"
      :sampai="heatmapQuery.data.value.sampai"
      @select-tanggal="pilihTanggalHeatmap"
    />

    <div class="flex items-center gap-2">
      <Popover :open="laporanPopoverOpen" @update:open="tutupLaporanPopover">
          <PopoverTrigger as-child>
            <Button>
              <FileDown class="size-4" />
              Unduh laporan (PDF)
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" class="w-56 p-1">
            <div v-if="!tampilkanPemilihBulan" class="grid gap-0.5">
              <a
                v-for="opt in bulanTerbaruOptions"
                :key="opt.bulan"
                :href="monthlyReportPdfUrl(opt.bulan)"
                target="_blank"
                class="rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                @click="laporanPopoverOpen = false"
              >
                {{ opt.label }}
              </a>
              <div class="my-1 border-t" />
              <button
                type="button"
                class="rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                @click="tampilkanPemilihBulan = true"
              >
                Bulan lainnya…
              </button>
            </div>
            <div v-else class="grid gap-1 p-1">
              <div class="flex items-center justify-between pb-1">
                <Button variant="ghost" size="icon" aria-label="Tahun sebelumnya" @click="bulanLainnyaTahun--">
                  <ChevronLeft class="size-4" />
                </Button>
                <span class="text-sm font-medium">{{ bulanLainnyaTahun }}</span>
                <Button variant="ghost" size="icon" aria-label="Tahun berikutnya" @click="bulanLainnyaTahun++">
                  <ChevronRight class="size-4" />
                </Button>
              </div>
              <div class="grid grid-cols-3 gap-1">
                <a
                  v-for="(nama, i) in namaBulanPendek"
                  :key="i"
                  :href="bulanLainnyaUrl(i)"
                  target="_blank"
                  class="rounded-md border px-2 py-1.5 text-center text-sm hover:bg-accent"
                  @click="laporanPopoverOpen = false"
                >
                  {{ nama }}
                </a>
              </div>
            </div>
          </PopoverContent>
        </Popover>
    </div>

    <ActivityLogList
      :project-id="projectIdFilter"
      :tanggal-filter="tanggalFilterHeatmap"
      @select-tanggal="bukaTanggal"
      @clear-filter="tanggalFilterHeatmap = null"
    />

    <Dialog :open="tanggalTerpilih !== null" @update:open="tutupDialog">
      <DialogScrollContent v-if="tanggalTerpilih">
        <DialogHeader>
          <DialogTitle>{{ formatTanggalPanjang(tanggalTerpilih) }}</DialogTitle>
        </DialogHeader>

        <p v-if="detailQuery.isPending.value" class="text-sm text-muted-foreground">Memuat detail...</p>
        <template v-else-if="detail && detail.tanggal === tanggalTerpilih">
          <div class="grid gap-4">
            <div v-if="detail.izin" class="rounded-md border p-3 text-sm">
              <p class="font-medium">{{ IZIN_LABEL[detail.izin.jenis] }}</p>
              <p v-if="detail.izin.alasan" class="text-muted-foreground">{{ detail.izin.alasan }}</p>
            </div>

            <div v-if="detailRealisasi.length > 0" class="grid gap-3">
              <h3 class="text-sm font-medium">Realisasi</h3>
              <div
                v-for="group in detailRealisasi"
                :key="group.projectId"
                class="grid gap-2 rounded-md border p-3 text-sm"
              >
                <ProjectBadge :nama="group.projectNama" class="justify-self-start" />
                <div
                  v-for="item in group.items"
                  :key="item.taskLogId"
                  class="grid gap-2 border-t pt-2 first:border-t-0 first:pt-0"
                >
                  <div class="flex flex-wrap items-center gap-1">
                    <span class="font-medium">{{ item.deskripsi }}</span>
                    <Badge v-if="item.taskStatus === 'closed'" variant="secondary">Ditutup</Badge>
                    <Badge v-if="item.tag" variant="secondary">{{ item.tag }}</Badge>
                  </div>
                  <MiniMarkdownText
                    v-if="item.catatan"
                    :text="item.catatan"
                    class="text-xs text-muted-foreground"
                  />
                  <KendalaList :task-log-id="item.taskLogId" :items="item.kendala" />
                  <AttachmentList :task-log-id="item.taskLogId" :items="item.attachments" />
                </div>
              </div>
            </div>

            <div v-if="detailRencana.length > 0" class="grid gap-3">
              <h3 class="text-sm font-medium">Rencana</h3>
              <div
                v-for="group in detailRencana"
                :key="group.projectId"
                class="grid gap-2 rounded-md border p-3 text-sm"
              >
                <ProjectBadge :nama="group.projectNama" class="justify-self-start" />
                <div
                  v-for="item in group.items"
                  :key="item.taskLogId"
                  class="grid gap-1 border-t pt-2 first:border-t-0 first:pt-0"
                >
                  <div class="flex flex-wrap items-center gap-1">
                    <span class="font-medium">{{ item.deskripsi }}</span>
                    <Badge v-if="item.taskStatus === 'closed'" variant="secondary">Ditutup</Badge>
                  </div>
                  <MiniMarkdownText
                    v-if="item.catatan"
                    :text="item.catatan"
                    class="text-xs text-muted-foreground"
                  />
                </div>
              </div>
            </div>

            <p
              v-if="detail.items.length === 0 && !detail.izin"
              class="text-sm text-muted-foreground"
            >
              Tidak ada log tersimpan untuk tanggal ini.
            </p>

            <div v-if="detail.bolehEdit" class="flex justify-end">
              <Button as-child variant="outline" size="sm">
                <RouterLink :to="{ path: '/input', query: { tanggal: tanggalTerpilih } }">Edit laporan ini</RouterLink>
              </Button>
            </div>
          </div>
        </template>
      </DialogScrollContent>
    </Dialog>
  </div>
</template>

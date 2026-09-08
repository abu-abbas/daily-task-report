<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronLeft, ChevronRight } from "@lucide/vue";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import KendalaList from "@/components/input-harian/KendalaList.vue";
import AttachmentList from "@/components/input-harian/AttachmentList.vue";
import ProjectBadge from "@/components/input-harian/ProjectBadge.vue";
import MiniMarkdownText from "@/components/input-harian/MiniMarkdownText.vue";
import { groupByProject } from "@/lib/groupByProject";
import { formatTanggalPanjang, LOCALE } from "@/lib/locale";
import { useMyProjectsQuery } from "@/composables/useProjects";
import { useRiwayatBulanQuery, useRiwayatDetailQuery } from "@/composables/useRiwayat";

const IZIN_LABEL: Record<string, string> = { cuti: "Cuti", sakit: "Sakit", izin: "Izin" };

function bulanSekarang(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const bulan = ref(bulanSekarang());
function geserBulan(delta: number) {
  const [y, m] = bulan.value.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  bulan.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const bulanFormatter = new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric" });
const bulanLabel = computed(() => {
  const [y, m] = bulan.value.split("-").map(Number);
  return bulanFormatter.format(new Date(y, m - 1, 1));
});

const projectsQuery = useMyProjectsQuery();
const projects = computed(() => projectsQuery.data.value?.projects ?? []);
const projectFilter = ref<string>("all");
const projectIdFilter = computed(() => (projectFilter.value === "all" ? undefined : Number(projectFilter.value)));

const bulanQuery = useRiwayatBulanQuery(bulan, projectIdFilter);
const hari = computed(() => bulanQuery.data.value?.hari ?? []);

// Satu tanggal terbuka dalam satu waktu — detail baru di-fetch (lazy) begitu kartunya dibuka.
const tanggalTerbuka = ref<string | null>(null);
function toggleTanggal(tanggal: string) {
  tanggalTerbuka.value = tanggalTerbuka.value === tanggal ? null : tanggal;
}
const detailQuery = useRiwayatDetailQuery(tanggalTerbuka);
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
    <div>
      <h1 class="text-lg font-semibold">Riwayat</h1>
      <p class="text-sm text-muted-foreground">Laporan yang sudah tersimpan, per tanggal.</p>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <div class="flex items-center gap-1">
        <Button variant="outline" size="icon" aria-label="Bulan sebelumnya" @click="geserBulan(-1)">
          <ChevronLeft class="size-4" />
        </Button>
        <span class="w-36 text-center text-sm font-medium">{{ bulanLabel }}</span>
        <Button variant="outline" size="icon" aria-label="Bulan berikutnya" @click="geserBulan(1)">
          <ChevronRight class="size-4" />
        </Button>
      </div>
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

    <p v-if="bulanQuery.isPending.value" class="text-sm text-muted-foreground">Memuat...</p>
    <p v-else-if="bulanQuery.isError.value" class="text-sm text-destructive">Gagal memuat, coba muat ulang.</p>
    <p
      v-else-if="hari.length === 0"
      class="rounded-md border border-dashed p-4 text-sm text-muted-foreground"
    >
      Tidak ada laporan tersimpan di bulan ini.
    </p>

    <div v-else class="grid gap-3">
      <Collapsible
        v-for="h in hari"
        :key="h.tanggal"
        :open="tanggalTerbuka === h.tanggal"
        @update:open="toggleTanggal(h.tanggal)"
      >
        <Card class="py-0">
          <CollapsibleTrigger as-child>
            <button type="button" class="flex w-full items-center justify-between gap-2 p-4 text-left">
              <div>
                <p class="font-medium">{{ formatTanggalPanjang(h.tanggal) }}</p>
                <p class="text-sm text-muted-foreground">
                  {{ h.realisasiCount }} realisasi · {{ h.rencanaCount }} rencana
                </p>
              </div>
              <Badge v-if="h.izin" variant="secondary" class="shrink-0">{{ IZIN_LABEL[h.izin.jenis] }}</Badge>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent class="grid gap-4 border-t pt-4 pb-4">
              <template v-if="tanggalTerbuka === h.tanggal">
                <p v-if="detailQuery.isPending.value" class="text-sm text-muted-foreground">Memuat detail...</p>
                <template v-else-if="detail && detail.tanggal === h.tanggal">
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
                      <RouterLink :to="{ path: '/input', query: { tanggal: h.tanggal } }">Edit laporan ini</RouterLink>
                    </Button>
                  </div>
                </template>
              </template>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  </div>
</template>

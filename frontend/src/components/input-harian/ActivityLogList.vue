<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ProjectBadge from "@/components/input-harian/ProjectBadge.vue";
import { formatTanggalPanjang, LOCALE } from "@/lib/locale";
import { useActivityLogByTanggalQuery, useActivityLogQuery } from "@/composables/useRiwayat";
import type { ActivityLogItem } from "@/lib/api";

const props = defineProps<{ projectId: number | undefined; tanggalFilter: string | null }>();
const emit = defineEmits<{ "select-tanggal": [tanggal: string]; "clear-filter": [] }>();

const projectIdRef = computed(() => props.projectId);
const query = useActivityLogQuery(projectIdRef);

const tanggalFilterRef = computed(() => props.tanggalFilter);
const filterQuery = useActivityLogByTanggalQuery(tanggalFilterRef, projectIdRef);

const bulanFormatter = new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric", timeZone: "UTC" });
const tanggalRingkas = new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric", timeZone: "UTC" });

function toUtcDate(tanggal: string): Date {
  const [y, m, d] = tanggal.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

interface GrupProject {
  projectNama: string;
  items: ActivityLogItem[];
}

// Urutan asli by id (bukan by project) dalam satu tanggal bisa berselang-seling project, jadi
// dicari lewat .find() — jumlah project per tanggal kecil, tidak masalah performa.
function grupPerProject(items: ActivityLogItem[]): GrupProject[] {
  const hasil: GrupProject[] = [];
  for (const item of items) {
    let grupProject = hasil.find((g) => g.projectNama === item.projectNama);
    if (!grupProject) {
      grupProject = { projectNama: item.projectNama, items: [] };
      hasil.push(grupProject);
    }
    grupProject.items.push(item);
  }
  return hasil;
}

interface GrupTanggal {
  tanggal: string;
  label: string;
  projectGrup: GrupProject[];
}
interface GrupBulan {
  bulan: string;
  label: string;
  tanggalGrup: GrupTanggal[];
}

// Item sudah terurut tanggal terbaru dulu dari server — grouping bulan lalu tanggal cukup jalan
// sekali lurus (grup baru cuma dimulai saat nilainya beda dari grup sebelumnya).
const grup = computed<GrupBulan[]>(() => {
  const items = query.data.value?.pages.flatMap((p) => p.items) ?? [];
  const hasil: GrupBulan[] = [];
  for (const item of items) {
    const bulan = item.tanggal.slice(0, 7);
    let grupBulan = hasil[hasil.length - 1];
    if (!grupBulan || grupBulan.bulan !== bulan) {
      grupBulan = { bulan, label: bulanFormatter.format(toUtcDate(item.tanggal)), tanggalGrup: [] };
      hasil.push(grupBulan);
    }

    let grupTanggal = grupBulan.tanggalGrup[grupBulan.tanggalGrup.length - 1];
    if (!grupTanggal || grupTanggal.tanggal !== item.tanggal) {
      grupTanggal = { tanggal: item.tanggal, label: tanggalRingkas.format(toUtcDate(item.tanggal)), projectGrup: [] };
      grupBulan.tanggalGrup.push(grupTanggal);
    }
  }
  // Isi projectGrup di pass kedua supaya sederhana — jumlah tanggal per bulan kecil, tidak masalah performa.
  for (const item of items) {
    const grupBulan = hasil.find((g) => g.bulan === item.tanggal.slice(0, 7))!;
    const grupTanggal = grupBulan.tanggalGrup.find((g) => g.tanggal === item.tanggal)!;
    let grupProject = grupTanggal.projectGrup.find((g) => g.projectNama === item.projectNama);
    if (!grupProject) {
      grupProject = { projectNama: item.projectNama, items: [] };
      grupTanggal.projectGrup.push(grupProject);
    }
    grupProject.items.push(item);
  }
  return hasil;
});

const grupFilter = computed<GrupProject[]>(() => grupPerProject(filterQuery.data.value?.items ?? []));

const sentinel = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (
        entries[0]?.isIntersecting &&
        !props.tanggalFilter &&
        query.hasNextPage.value &&
        !query.isFetchingNextPage.value
      ) {
        query.fetchNextPage();
      }
    },
    { rootMargin: "200px" },
  );
  if (sentinel.value) observer.observe(sentinel.value);
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <Card>
    <CardHeader class="flex flex-row items-center justify-between space-y-0">
      <CardTitle>Realisasi</CardTitle>
      <div v-if="tanggalFilter" class="flex items-center gap-2">
        <span class="text-xs text-muted-foreground">{{ formatTanggalPanjang(tanggalFilter) }}</span>
        <Button variant="ghost" size="sm" @click="emit('clear-filter')">Tampilkan semua</Button>
      </div>
    </CardHeader>
    <CardContent class="grid gap-1 px-5">
      <template v-if="tanggalFilter">
        <p v-if="filterQuery.isPending.value" class="text-sm text-muted-foreground">Memuat...</p>
        <p v-else-if="filterQuery.isError.value" class="text-sm text-destructive">Gagal memuat, coba muat ulang.</p>
        <p v-else-if="grupFilter.length === 0" class="text-sm text-muted-foreground">
          Tidak ada realisasi tersimpan di tanggal ini.
        </p>
        <button
          v-else
          type="button"
          class="-mx-2 grid gap-3 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
          @click="emit('select-tanggal', tanggalFilter)"
        >
          <div v-for="pg in grupFilter" :key="pg.projectNama" class="grid gap-1">
            <ProjectBadge :nama="pg.projectNama" class="justify-self-start" />
            <p v-for="item in pg.items" :key="item.taskLogId" class="font-extralight text-muted-foreground">
              {{ item.tag ? `${item.tag}: ${item.deskripsi}` : item.deskripsi }}
            </p>
          </div>
        </button>
      </template>

      <template v-else>
        <p v-if="query.isPending.value" class="text-sm text-muted-foreground">Memuat...</p>
        <p v-else-if="query.isError.value" class="text-sm text-destructive">Gagal memuat, coba muat ulang.</p>
        <p v-else-if="grup.length === 0" class="text-sm text-muted-foreground">Belum ada realisasi tersimpan.</p>
        <template v-else>
          <div v-for="g in grup" :key="g.bulan" class="grid gap-1">
            <h3 class="pt-2 text-sm font-medium text-muted-foreground first:pt-0">{{ g.label }}</h3>
            <button
              v-for="dg in g.tanggalGrup"
              :key="dg.tanggal"
              type="button"
              class="-mx-2 flex gap-3 rounded-sm border-b px-2 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
              @click="emit('select-tanggal', dg.tanggal)"
            >
              <span class="w-14 shrink-0 pt-0.5 text-2sm text-muted-foreground">{{ dg.label }}</span>
              <div class="grid flex-1 gap-3">
                <div v-for="pg in dg.projectGrup" :key="pg.projectNama" class="grid gap-1">
                  <ProjectBadge :nama="pg.projectNama" class="justify-self-start" />
                  <p v-for="item in pg.items" :key="item.taskLogId" class="font-extralight text-muted-foreground">
                    {{ item.tag ? `${item.tag}: ${item.deskripsi}` : item.deskripsi }}
                  </p>
                </div>
              </div>
            </button>
          </div>
        </template>
      </template>

      <div ref="sentinel" class="h-1" />
      <p v-if="!tanggalFilter && query.isFetchingNextPage.value" class="py-2 text-center text-xs text-muted-foreground">
        Memuat lagi...
      </p>
    </CardContent>
  </Card>
</template>

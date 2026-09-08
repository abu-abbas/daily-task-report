<script setup lang="ts">
import { computed, nextTick, ref, watchEffect } from "vue";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatTanggalPanjang, LOCALE } from "@/lib/locale";
import type { ActivityHeatmapHari } from "@/lib/api";

const props = defineProps<{
  hari: ActivityHeatmapHari[];
  dari: string;
  sampai: string;
}>();

const emit = defineEmits<{ "select-tanggal": [tanggal: string] }>();

// Warna kotak murni dari jumlah realisasi (bukan rencana/izin) — 0 = kosong, 1-4 naik sesuai
// posisi relatif terhadap hari paling padat pada rentang yang sedang ditampilkan.
const BUCKET_CLASS = ["bg-muted", "bg-primary/25", "bg-primary/50", "bg-primary/75", "bg-primary"];

const monthShort = new Intl.DateTimeFormat(LOCALE, { month: "short", timeZone: "UTC" });

function addDaysStr(tanggal: string, delta: number): string {
  const [y, m, d] = tanggal.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

// 0 = Senin ... 6 = Minggu (minggu kerja ADR-0026 mulai Senin, beda dari GitHub yang mulai Minggu).
function weekdayMon0(tanggal: string): number {
  const [y, m, d] = tanggal.split("-").map(Number);
  const hari = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return (hari + 6) % 7;
}

interface Sel {
  tanggal: string;
  inRange: boolean;
  count: number;
  isAwalBulan: boolean;
}

const countMap = computed(() => new Map(props.hari.map((h) => [h.tanggal, h.realisasiCount])));
const maxCount = computed(() => props.hari.reduce((max, h) => Math.max(max, h.realisasiCount), 0));

// Grid selalu kelipatan 7 hari persis (gridStart = Senin pertama <= dari, gridEnd = Minggu
// terakhir >= sampai) — tanggal di luar [dari, sampai] tetap dirender sebagai kotak kosong
// non-interaktif, cuma buat perataan kolom minggu pertama/terakhir.
const weeks = computed<Sel[][]>(() => {
  const gridStart = addDaysStr(props.dari, -weekdayMon0(props.dari));
  const gridEnd = addDaysStr(props.sampai, 6 - weekdayMon0(props.sampai));
  const result: Sel[][] = [];
  let minggu: Sel[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    minggu.push({
      tanggal: cursor,
      inRange: cursor >= props.dari && cursor <= props.sampai,
      count: countMap.value.get(cursor) ?? 0,
      isAwalBulan: cursor.endsWith("-01"),
    });
    if (minggu.length === 7) {
      result.push(minggu);
      minggu = [];
    }
    cursor = addDaysStr(cursor, 1);
  }
  return result;
});

function labelBulan(minggu: Sel[]): string | null {
  const awal = minggu.find((s) => s.inRange && s.isAwalBulan);
  if (!awal) return null;
  const [y, m] = awal.tanggal.split("-").map(Number);
  return monthShort.format(new Date(Date.UTC(y, m - 1, 1)));
}

function bucket(count: number): number {
  if (count === 0) return 0;
  const max = maxCount.value || 1;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

// Grid 12 bulan biasanya lebih lebar dari lebar konten default (max-w-3xl), apalagi di mobile —
// tanpa ini defaultnya nge-scroll ke kiri (bulan paling lama), menyembunyikan bulan berjalan yang
// justru paling relevan. Scroll ke ujung kanan tiap kali grid berubah (mis. ganti filter project)
// — lebar gridnya konstan (rentang selalu 12 bulan sama), jadi aman diulang. ScrollArea (reka-ui)
// tidak mengekspos viewport-nya lewat prop/emit, jadi diambil manual lewat data-slot bawaannya.
const scrollAreaRef = ref<InstanceType<typeof ScrollArea> | null>(null);
watchEffect(() => {
  if (weeks.value.length > 0) {
    nextTick(() => {
      const rootEl = scrollAreaRef.value?.$el as HTMLElement | undefined;
      const viewport = rootEl?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
      if (viewport) viewport.scrollLeft = viewport.scrollWidth;
    });
  }
});
</script>

<template>
  <ScrollArea ref="scrollAreaRef" class="w-full min-w-0 pb-2">
    <div class="p-2.5 flex w-max gap-0.75">
      <div v-for="(minggu, i) in weeks" :key="i" class="grid gap-0.75">
        <div class="relative mb-3 h-2">
          <div class="absolute left-0 top-0 text-sm leading-3 text-muted-foreground">{{ labelBulan(minggu) }}</div>
        </div>
        <template v-for="sel in minggu" :key="sel.tanggal">
          <Tooltip v-if="sel.inRange">
            <TooltipTrigger as-child>
              <button
                type="button"
                :data-tanggal="sel.tanggal"
                class="size-3 rounded-[0.165rem] transition-colors hover:ring-1 hover:ring-ring"
                :class="BUCKET_CLASS[bucket(sel.count)]"
                @click="emit('select-tanggal', sel.tanggal)"
              />
            </TooltipTrigger>
            <TooltipContent>
              <div class="flex flex-col items-center">
                <span class="text-2sm font-semibold">{{ sel.count }} realisasi</span>
                <span class="text-xs">{{ formatTanggalPanjang(sel.tanggal) }}</span>
              </div>
            </TooltipContent>
          </Tooltip>
          <div v-else class="size-3" />
        </template>
      </div>
    </div>
    <ScrollBar orientation="horizontal" />
  </ScrollArea>
</template>

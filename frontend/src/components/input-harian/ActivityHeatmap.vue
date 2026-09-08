<script setup lang="ts">
import { computed } from "vue";
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
</script>

<template>
  <div class="overflow-x-auto pb-2">
    <div class="flex w-max gap-0.75">
      <div v-for="(minggu, i) in weeks" :key="i" class="grid gap-0.75">
        <div class="h-3 text-[10px] leading-3 text-muted-foreground">{{ labelBulan(minggu) }}</div>
        <template v-for="sel in minggu" :key="sel.tanggal">
          <Tooltip v-if="sel.inRange">
            <TooltipTrigger as-child>
              <button
                type="button"
                :data-tanggal="sel.tanggal"
                class="size-3 rounded-sm transition-colors hover:ring-1 hover:ring-ring"
                :class="BUCKET_CLASS[bucket(sel.count)]"
                @click="emit('select-tanggal', sel.tanggal)"
              />
            </TooltipTrigger>
            <TooltipContent>
              {{ formatTanggalPanjang(sel.tanggal) }} — {{ sel.count }} realisasi
            </TooltipContent>
          </Tooltip>
          <div v-else class="size-3" />
        </template>
      </div>
    </div>
  </div>
</template>

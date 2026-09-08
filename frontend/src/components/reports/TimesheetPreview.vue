<script setup lang="ts">
import { computed } from "vue";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatTanggalPanjang } from "@/lib/locale";
import type { ReportPreviewTimesheet } from "@/lib/api";

const props = defineProps<{ timesheet: ReportPreviewTimesheet }>();

// Warna cell mengikuti persis drawTimesheetPages di server/src/report-pdf.ts — merah=libur,
// kuning=izin, abu=ada realisasi, putih/kosong=belum ada apa-apa.
const workedByTask = computed(() => {
  const map = new Map<number, Set<string>>();
  for (const task of props.timesheet.tasks) {
    map.set(task.taskId, new Set(props.timesheet.taskDatesWorked[String(task.taskId)] ?? []));
  }
  return map;
});

function cellClass(taskId: number, h: { tanggal: string; isWorkday: boolean; isIzin: boolean }): string {
  if (h.isIzin) return "bg-amber-400/70 dark:bg-amber-500/60";
  if (!h.isWorkday) return "bg-red-400/70 dark:bg-red-500/60";
  if (workedByTask.value.get(taskId)?.has(h.tanggal)) return "bg-foreground/40";
  return "bg-transparent";
}

function dayNum(tanggal: string): string {
  return String(Number(tanggal.slice(8, 10)));
}

const gridTemplateColumns = computed(() => `160px repeat(${props.timesheet.hari.length}, 22px)`);
</script>

<template>
  <div class="grid gap-2">
    <div class="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span class="inline-flex items-center gap-1"><span class="size-3 rounded-sm bg-red-400/70 dark:bg-red-500/60" /> Libur</span>
      <span class="inline-flex items-center gap-1"><span class="size-3 rounded-sm bg-amber-400/70 dark:bg-amber-500/60" /> Izin</span>
      <span class="inline-flex items-center gap-1"><span class="size-3 rounded-sm bg-foreground/40" /> Ada realisasi</span>
      <span class="inline-flex items-center gap-1"><span class="size-3 rounded-sm border" /> Kosong</span>
    </div>

    <ScrollArea class="w-full min-w-0 rounded-md border">
      <div class="grid w-max" :style="{ gridTemplateColumns }">
        <div class="sticky left-0 z-10 border-b border-r bg-background px-2 py-1 text-xs font-medium">Kegiatan</div>
        <div
          v-for="h in timesheet.hari"
          :key="h.tanggal"
          class="border-b px-1 py-1 text-center text-[10px] text-muted-foreground"
        >
          {{ dayNum(h.tanggal) }}
        </div>

        <template v-for="task in timesheet.tasks" :key="task.taskId">
          <div class="sticky left-0 z-10 truncate border-r border-b bg-background px-2 py-1 text-xs" :title="task.label">
            {{ task.no }}. {{ task.label }}
          </div>
          <Tooltip v-for="h in timesheet.hari" :key="h.tanggal">
            <TooltipTrigger as-child>
              <div class="h-6 border-b border-r border-border/40" :class="cellClass(task.taskId, h)" />
            </TooltipTrigger>
            <TooltipContent>{{ formatTanggalPanjang(h.tanggal) }}</TooltipContent>
          </Tooltip>
        </template>

        <div
          v-if="timesheet.tasks.length === 0"
          class="col-span-full px-2 py-3 text-center text-sm text-muted-foreground"
          :style="{ gridColumn: `1 / span ${timesheet.hari.length + 1}` }"
        >
          Belum ada realisasi buat ditampilkan sebagai timesheet.
        </div>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { toast } from "vue-sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import MiniMarkdownText from "@/components/input-harian/MiniMarkdownText.vue";
import ProjectBadge from "@/components/input-harian/ProjectBadge.vue";
import { ApiError, type RencanaHariIniItem } from "@/lib/api";
import { toggleCheckboxLine } from "@/lib/markdown";
import { formatTanggalPanjang } from "@/lib/locale";
import { useSaveTodayInput, useTodayInputQuery } from "@/composables/useTaskLogs";

// Beranda (ADR-0043): preview read-only rencana hari ini, bukan form. Isi/edit tetap di /input;
// centang checkbox di catatan cuma memanggil ulang endpoint simpan yang sama (upsert per task).
const query = useTodayInputQuery();
const saveMutation = useSaveTodayInput();
const data = computed(() => query.data.value);

async function onToggleCheckbox(item: RencanaHariIniItem, lineIndex: number) {
  const nextCatatan = toggleCheckboxLine(item.catatan ?? "", lineIndex);
  try {
    await saveMutation.mutateAsync([{ taskId: item.taskId, jenis: "rencana", catatan: nextCatatan }]);
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan, coba lagi.");
  }
}
</script>

<template>
  <div class="grid gap-4">
    <h1 class="text-lg font-semibold">Beranda</h1>

    <p v-if="query.isPending.value" class="text-sm text-muted-foreground">Memuat data...</p>
    <p v-else-if="query.isError.value" class="text-sm text-destructive">Gagal memuat data, coba muat ulang.</p>

    <Card v-else-if="data">
      <CardHeader>
        <CardTitle class="text-base">Rencana hari ini</CardTitle>
        <CardDescription>{{ formatTanggalPanjang(data.tanggal) }}</CardDescription>
        <CardAction>
          <Button as-child size="sm" variant="outline">
            <RouterLink to="/input">Buka Input Harian</RouterLink>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent class="grid gap-3">
        <div v-if="data.rencanaHariIni.length === 0" class="grid gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          <p>Belum ada rencana untuk hari ini.</p>
        </div>

        <div v-else class="grid gap-2">
          <div v-for="item in data.rencanaHariIni" :key="item.taskId" class="grid gap-1 rounded-md border p-3 text-sm">
            <span class="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <ProjectBadge :nama="item.projectNama" />
              <Badge v-if="item.tag" variant="secondary">{{ item.tag }}</Badge>
            </span>
            <p class="font-medium">{{ item.deskripsi }}</p>
            <MiniMarkdownText
              v-if="item.catatan"
              :text="item.catatan"
              interactive
              class="text-muted-foreground"
              @toggle-checkbox="(lineIndex) => onToggleCheckbox(item, lineIndex)"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

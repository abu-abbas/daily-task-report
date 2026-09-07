<script setup lang="ts">
import { computed, ref } from "vue";
import { toast } from "vue-sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import MiniMarkdownText from "@/components/input-harian/MiniMarkdownText.vue";
import ProjectBadge from "@/components/input-harian/ProjectBadge.vue";
import { ApiError, type RencanaHariIniItem } from "@/lib/api";
import { toggleCheckboxLine } from "@/lib/markdown";
import { groupByProject } from "@/lib/groupByProject";
import { formatTanggalPanjang } from "@/lib/locale";
import { useDailyInputQuery, useSaveDailyInput } from "@/composables/useTaskLogs";

// Beranda (ADR-0043): preview read-only rencana hari ini, bukan form. Isi/edit tetap di /input;
// centang checkbox di catatan cuma memanggil ulang endpoint simpan yang sama (upsert per task).
// tanggal null = server yang tentukan "hari ini" (Beranda selalu tentang hari ini, bukan tanggal
// laporan lain — pilih tanggal cuma ada di /input, ADR-0044).
const query = useDailyInputQuery(ref(null));
const saveMutation = useSaveDailyInput();
const data = computed(() => query.data.value);
const rencanaGroups = computed(() => groupByProject(data.value?.rencanaHariIni ?? []));

const IZIN_LABEL: Record<string, string> = { cuti: "Cuti", sakit: "Sakit", izin: "Izin" };

async function onToggleCheckbox(item: RencanaHariIniItem, lineIndex: number) {
  const nextCatatan = toggleCheckboxLine(item.catatan ?? "", lineIndex);
  try {
    await saveMutation.mutateAsync({
      tanggal: data.value!.tanggal,
      items: [{ taskId: item.taskId, jenis: "rencana", catatan: nextCatatan }],
    });
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

    <Card v-else-if="data && data.izin">
      <CardHeader>
        <CardTitle class="text-base">{{ IZIN_LABEL[data.izin.jenis] }} hari ini</CardTitle>
        <CardDescription>{{ formatTanggalPanjang(data.tanggal) }}</CardDescription>
        <CardAction>
          <Button as-child size="sm" variant="outline">
            <RouterLink to="/input">Buka Input Harian</RouterLink>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent class="grid gap-1 text-sm">
        <p v-if="data.izin.alasan" class="text-muted-foreground">{{ data.izin.alasan }}</p>
        <p v-else class="text-muted-foreground">Tanpa alasan tercatat.</p>
      </CardContent>
    </Card>

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
          <div v-for="group in rencanaGroups" :key="group.projectId" class="grid gap-2 rounded-md border p-3 text-sm">
            <ProjectBadge :nama="group.projectNama" class="justify-self-start" />
            <div
              v-for="item in group.items"
              :key="item.taskId"
              class="grid gap-1 border-t pt-2 first:border-t-0 first:pt-0"
            >
              <span class="flex flex-wrap items-center gap-1">
                <span class="font-medium">{{ item.deskripsi }}</span>
                <Badge v-if="item.tag" variant="secondary">{{ item.tag }}</Badge>
              </span>
              <MiniMarkdownText
                v-if="item.catatan"
                :text="item.catatan"
                interactive
                class="text-muted-foreground"
                @toggle-checkbox="(lineIndex) => onToggleCheckbox(item, lineIndex)"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

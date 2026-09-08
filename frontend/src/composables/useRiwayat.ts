import { computed, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { fetchActivityHeatmap, fetchRiwayatDetail } from "@/lib/api";

// Prefix umum buat query riwayat (heatmap + detail) — diekspor supaya mutasi kendala/attachment
// di useTaskLogs.ts bisa ikut invalidate cache riwayat juga (dua halaman berbagi data yang sama:
// task_logs/kendala/attachments), tanpa KendalaList/AttachmentList perlu tahu halaman mana yang
// memanggilnya.
export const RIWAYAT_QUERY_PREFIX = ["riwayat"];

export function useActivityHeatmapQuery(projectId: Ref<number | undefined>) {
  return useQuery({
    queryKey: computed(() => [...RIWAYAT_QUERY_PREFIX, "heatmap", projectId.value]),
    queryFn: () => fetchActivityHeatmap(projectId.value),
  });
}

// tanggal null = belum ada kartu yang dibuka — query lazy, baru jalan saat tanggal diisi.
export function useRiwayatDetailQuery(tanggal: Ref<string | null>) {
  return useQuery({
    queryKey: computed(() => [...RIWAYAT_QUERY_PREFIX, "detail", tanggal.value]),
    queryFn: () => fetchRiwayatDetail(tanggal.value!),
    enabled: computed(() => tanggal.value !== null),
  });
}

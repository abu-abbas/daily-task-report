import { computed, type Ref } from "vue";
import { useInfiniteQuery, useQuery } from "@tanstack/vue-query";
import { fetchActivityHeatmap, fetchActivityLog, fetchRiwayatDetail } from "@/lib/api";

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

// Daftar realisasi terbaru-dulu, dipaginasi lazy (scroll) — pelengkap heatmap di atasnya, tidak
// dibatasi rentang 12 bulan.
export function useActivityLogQuery(projectId: Ref<number | undefined>) {
  return useInfiniteQuery({
    queryKey: computed(() => [...RIWAYAT_QUERY_PREFIX, "log", projectId.value]),
    queryFn: ({ pageParam }) => fetchActivityLog({ projectId: projectId.value, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

// Klik kotak heatmap memfilter feed activity-log ke satu tanggal itu (bukan buka Dialog
// langsung) — tidak dipaginasi, cukup query biasa. tanggal null = filter tidak aktif.
export function useActivityLogByTanggalQuery(tanggal: Ref<string | null>, projectId: Ref<number | undefined>) {
  return useQuery({
    queryKey: computed(() => [...RIWAYAT_QUERY_PREFIX, "log-tanggal", tanggal.value, projectId.value]),
    queryFn: () => fetchActivityLog({ projectId: projectId.value, tanggal: tanggal.value }),
    enabled: computed(() => tanggal.value !== null),
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

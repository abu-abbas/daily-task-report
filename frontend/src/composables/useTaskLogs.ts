import { computed, type Ref } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  cancelLeave,
  createKendala,
  deleteAttachment,
  deleteKendala,
  fetchDailyInput,
  resolveKendala,
  saveDailyInput,
  saveLeave,
  uploadAttachment,
  type IzinJenis,
  type SaveTaskLogItem,
} from "@/lib/api";
import { RIWAYAT_QUERY_PREFIX } from "@/composables/useRiwayat";

export const DAILY_INPUT_QUERY_PREFIX = ["task-logs", "daily"];

// tanggal null = biarkan server tentukan "hari ini" (ADR-0032) — dipakai sebelum date-picker
// tahu batas bulan berjalan dari respons pertama.
export function useDailyInputQuery(tanggal: Ref<string | null>) {
  return useQuery({
    queryKey: computed(() => [...DAILY_INPUT_QUERY_PREFIX, tanggal.value]),
    queryFn: () => fetchDailyInput(tanggal.value ?? undefined),
  });
}

function invalidateDailyInput(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: DAILY_INPUT_QUERY_PREFIX, exact: false });
}

// Kendala/attachment ditampilkan di Input Harian DAN Riwayat lewat komponen yang sama
// (KendalaList/AttachmentList) — mutasinya harus ikut invalidate cache riwayat juga, supaya
// halaman mana pun yang lagi dibuka tetap sinkron tanpa komponen itu perlu tahu halaman mana
// yang memanggilnya.
function invalidateDailyInputDanRiwayat(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: DAILY_INPUT_QUERY_PREFIX, exact: false }),
    queryClient.invalidateQueries({ queryKey: RIWAYAT_QUERY_PREFIX, exact: false }),
  ]);
}

export function useSaveDailyInput() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tanggal, items }: { tanggal: string; items: SaveTaskLogItem[] }) => saveDailyInput(tanggal, items),
    onSuccess: () => invalidateDailyInput(queryClient),
  });
}

export function useSaveLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { tanggal: string; jenis: IzinJenis; alasan?: string }) => saveLeave(payload),
    onSuccess: () => invalidateDailyInput(queryClient),
  });
}

export function useCancelLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tanggal: string) => cancelLeave(tanggal),
    onSuccess: () => invalidateDailyInput(queryClient),
  });
}

export function useCreateKendala() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskLogId, deskripsi }: { taskLogId: number; deskripsi: string }) =>
      createKendala(taskLogId, deskripsi),
    onSuccess: () => invalidateDailyInputDanRiwayat(queryClient),
  });
}

export function useDeleteKendala() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteKendala(id),
    onSuccess: () => invalidateDailyInputDanRiwayat(queryClient),
  });
}

export function useResolveKendala() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => resolveKendala(id),
    onSuccess: () => invalidateDailyInputDanRiwayat(queryClient),
  });
}

export function useUploadAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskLogId, file }: { taskLogId: number; file: File }) => uploadAttachment(taskLogId, file),
    onSuccess: () => invalidateDailyInputDanRiwayat(queryClient),
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteAttachment(id),
    onSuccess: () => invalidateDailyInputDanRiwayat(queryClient),
  });
}

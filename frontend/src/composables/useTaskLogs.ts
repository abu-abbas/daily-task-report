import { computed, type Ref } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  cancelLeave,
  createKendala,
  deleteKendala,
  fetchDailyInput,
  resolveKendala,
  saveDailyInput,
  saveLeave,
  type IzinJenis,
  type SaveTaskLogItem,
} from "@/lib/api";

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
    onSuccess: () => invalidateDailyInput(queryClient),
  });
}

export function useDeleteKendala() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteKendala(id),
    onSuccess: () => invalidateDailyInput(queryClient),
  });
}

export function useResolveKendala() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => resolveKendala(id),
    onSuccess: () => invalidateDailyInput(queryClient),
  });
}

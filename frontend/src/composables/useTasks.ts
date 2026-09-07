import { computed, type Ref } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { closeTask, createTask, fetchTasks, type NewTaskPayload } from "@/lib/api";
import { DAILY_INPUT_QUERY_PREFIX } from "./useTaskLogs";

export function useTasksQuery(projectId: Ref<number | null>) {
  return useQuery({
    queryKey: computed(() => ["tasks", projectId.value]),
    queryFn: () => fetchTasks(projectId.value!),
    enabled: computed(() => projectId.value !== null),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: NewTaskPayload) => createTask(payload),
    onSuccess: (_data, payload) => queryClient.invalidateQueries({ queryKey: ["tasks", payload.projectId] }),
  });
}

// Menutup task bisa menghapus rencana yang belum direalisasi (ADR-0012), jadi ikut invalidate
// query harian, bukan cuma daftar task.
export function useCloseTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, deskripsiPenutupan }: { taskId: number; deskripsiPenutupan?: string }) =>
      closeTask(taskId, deskripsiPenutupan),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"], exact: false });
      queryClient.invalidateQueries({ queryKey: DAILY_INPUT_QUERY_PREFIX, exact: false });
    },
  });
}

import { computed, type Ref } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { createTask, fetchTasks, type NewTaskPayload } from "@/lib/api";

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

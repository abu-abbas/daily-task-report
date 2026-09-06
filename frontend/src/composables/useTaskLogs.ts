import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { fetchTodayInput, saveTodayInput, type SaveTaskLogItem } from "@/lib/api";

export const TODAY_INPUT_QUERY_KEY = ["task-logs", "today"];

export function useTodayInputQuery() {
  return useQuery({ queryKey: TODAY_INPUT_QUERY_KEY, queryFn: fetchTodayInput });
}

export function useSaveTodayInput() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: SaveTaskLogItem[]) => saveTodayInput(items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TODAY_INPUT_QUERY_KEY }),
  });
}

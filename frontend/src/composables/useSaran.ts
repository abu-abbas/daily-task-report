import { computed, type Ref } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { fetchSaran, saveSaran } from "@/lib/api";

export function useSaranQuery(bulan: Ref<string>) {
  return useQuery({
    queryKey: computed(() => ["saran", bulan.value]),
    queryFn: () => fetchSaran(bulan.value),
  });
}

export function useSaveSaran(bulan: Ref<string>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (isi: string) => saveSaran(bulan.value, isi),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saran", bulan.value] }),
  });
}

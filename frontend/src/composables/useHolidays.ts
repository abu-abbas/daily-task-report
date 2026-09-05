import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { createHoliday, deleteHoliday, fetchHolidays, type HolidayPayload } from "@/lib/api";

export const HOLIDAYS_QUERY_KEY = ["holidays"];

export function useHolidaysQuery() {
  return useQuery({ queryKey: HOLIDAYS_QUERY_KEY, queryFn: fetchHolidays });
}

export function useCreateHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: HolidayPayload) => createHoliday(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: HOLIDAYS_QUERY_KEY }),
  });
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteHoliday(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: HOLIDAYS_QUERY_KEY }),
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { deleteLaporanTemplate, fetchMyLaporanTemplate, uploadLaporanTemplate } from "@/lib/api";

export const LAPORAN_TEMPLATE_QUERY_KEY = ["laporan-template", "mine"];

export function useLaporanTemplateQuery() {
  return useQuery({ queryKey: LAPORAN_TEMPLATE_QUERY_KEY, queryFn: fetchMyLaporanTemplate });
}

function useInvalidateLaporanTemplate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: LAPORAN_TEMPLATE_QUERY_KEY });
}

export function useUploadLaporanTemplate() {
  const invalidate = useInvalidateLaporanTemplate();
  return useMutation({
    mutationFn: (file: File) => uploadLaporanTemplate(file),
    onSuccess: invalidate,
  });
}

export function useDeleteLaporanTemplate() {
  const invalidate = useInvalidateLaporanTemplate();
  return useMutation({
    mutationFn: () => deleteLaporanTemplate(),
    onSuccess: invalidate,
  });
}

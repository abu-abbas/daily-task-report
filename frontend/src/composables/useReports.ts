import { computed, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { fetchMonthlyReportPreview } from "@/lib/api";

// Lazy — cuma jalan begitu tombol "Tampilkan" diklik (enabled), lalu otomatis refetch kalau
// bulan yang dipilih berubah setelahnya (tidak perlu klik "Tampilkan" ulang tiap ganti bulan).
export function useMonthlyReportPreviewQuery(bulan: Ref<string>, enabled: Ref<boolean>) {
  return useQuery({
    queryKey: computed(() => ["reports", "monthly-preview", bulan.value]),
    queryFn: () => fetchMonthlyReportPreview(bulan.value),
    enabled,
  });
}

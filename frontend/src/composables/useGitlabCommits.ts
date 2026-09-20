import { computed, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { fetchGitlabCommits, fetchGitlabProjects } from "@/lib/api";

// Lazy — daftar repo cuma di-fetch saat modal dibuka & token sudah ada, bukan prefetch tiap
// render InputHarianView.
export function useGitlabProjectsQuery(enabled: Ref<boolean>) {
  return useQuery({
    queryKey: ["gitlab-projects"],
    queryFn: fetchGitlabProjects,
    enabled,
  });
}

// Commit baru di-fetch setelah user pilih repo GitLab (ADR-0047) — bukan nge-loop semua repo.
export function useGitlabCommitsQuery(gitlabProjectId: Ref<number | null>, tanggal: Ref<string | null>, enabled: Ref<boolean>) {
  return useQuery({
    queryKey: computed(() => ["gitlab-commits", gitlabProjectId.value, tanggal.value]),
    queryFn: () => fetchGitlabCommits(gitlabProjectId.value!, tanggal.value!),
    enabled: computed(() => enabled.value && !!gitlabProjectId.value && !!tanggal.value),
  });
}

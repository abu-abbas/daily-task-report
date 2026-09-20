import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { fetchMe, postLogin, postLogout, saveGitlabToken } from "@/lib/api";

export const ME_QUERY_KEY = ["me"];

export function useMe() {
  return useQuery({ queryKey: ME_QUERY_KEY, queryFn: fetchMe, retry: false });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      postLogin(email, password),
    onSuccess: (data) => queryClient.setQueryData(ME_QUERY_KEY, data),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postLogout,
    onSuccess: () => queryClient.setQueryData(ME_QUERY_KEY, null),
  });
}

export function useSaveGitlabToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => saveGitlabToken(token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY }),
  });
}

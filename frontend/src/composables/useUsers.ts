import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { createUser, fetchUsers, updateUser, type UserPayload } from "@/lib/api";

export const USERS_QUERY_KEY = ["users"];

export function useUsersQuery() {
  return useQuery({ queryKey: USERS_QUERY_KEY, queryFn: fetchUsers });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UserPayload) => createUser(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UserPayload }) => updateUser(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
  });
}

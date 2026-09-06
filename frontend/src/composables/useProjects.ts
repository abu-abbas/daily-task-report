import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  addProjectMember,
  createProject,
  endProjectMembership,
  fetchMyProjects,
  fetchProjects,
  updateProject,
  type ProjectPayload,
} from "@/lib/api";

export const PROJECTS_QUERY_KEY = ["projects"];
export const MY_PROJECTS_QUERY_KEY = ["projects", "mine"];

export function useProjectsQuery() {
  return useQuery({ queryKey: PROJECTS_QUERY_KEY, queryFn: fetchProjects });
}

export function useMyProjectsQuery() {
  return useQuery({ queryKey: MY_PROJECTS_QUERY_KEY, queryFn: fetchMyProjects });
}

function useInvalidateProjects() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: MY_PROJECTS_QUERY_KEY });
  };
}

export function useCreateProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (payload: ProjectPayload) => createProject(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ProjectPayload }) => updateProject(id, payload),
    onSuccess: invalidate,
  });
}

export function useAddProjectMember() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: ({ projectId, userId }: { projectId: number; userId: number }) =>
      addProjectMember(projectId, userId),
    onSuccess: invalidate,
  });
}

export function useEndProjectMembership() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: ({ projectId, userId }: { projectId: number; userId: number }) =>
      endProjectMembership(projectId, userId),
    onSuccess: invalidate,
  });
}

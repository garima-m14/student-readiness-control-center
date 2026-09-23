import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/context";
import { api } from "../api/client";
import { detailSchema, listSchema } from "../schemas/api";
export function useStudents(query: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [user?.tenantId, user?.id, user?.sessionId, "students", query],
    queryFn: ({ signal }) => api(`/students?${query}`, listSchema, { signal }),
  });
}
export function useStudent(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [user?.tenantId, user?.id, user?.sessionId, "student", id],
    queryFn: ({ signal }) => api(`/students/${id}`, detailSchema, { signal }),
  });
}

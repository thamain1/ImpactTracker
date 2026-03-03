import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useSurveyResponses(programId: number, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ["/api/survey-responses", programId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/survey-responses?programId=${programId}`);
      return res.json();
    },
    enabled: !!programId && !isNaN(programId),
    ...options,
  });
}

export function useUpdateSurveyResponse(programId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Record<string, unknown>) => {
      const res = await apiRequest("PUT", `/api/survey-responses/${id}`, data);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Update failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/survey-responses", programId] });
      toast({ title: "Saved", description: "Survey response updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteSurveyResponse(programId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/survey-responses/${id}`);
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/survey-responses", programId] });
      toast({ title: "Deleted", description: "Survey response removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

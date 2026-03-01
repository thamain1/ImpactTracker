import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

export function useImpactStats(programId: number) {
  return useQuery({
    queryKey: [api.impact.stats.path, programId],
    queryFn: async () => {
      const res = await apiRequest("GET", `${api.impact.stats.path}?programId=${programId}`);
      return api.impact.stats.responses[200].parse(await res.json());
    },
    enabled: !!programId,
  });
}

export function useImpactEntries(programId: number) {
  return useQuery({
    queryKey: [api.impact.list.path, programId],
    queryFn: async () => {
      const res = await apiRequest("GET", `${api.impact.list.path}?programId=${programId}`);
      return api.impact.list.responses[200].parse(await res.json());
    },
    enabled: !!programId,
  });
}

export function useUpdateImpactEntry() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, programId, ...data }: { id: number; programId: number } & Record<string, unknown>) => {
      const res = await apiRequest("PUT", `/api/impact/${id}`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.impact.list.path, variables.programId] });
      queryClient.invalidateQueries({ queryKey: [api.impact.stats.path, variables.programId] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/charts"] });
      toast({
        title: "Entry Updated",
        description: "Your impact entry has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useCreateImpactEntry() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: z.infer<typeof api.impact.create.input>) => {
      const res = await apiRequest("POST", api.impact.create.path, data);
      return api.impact.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.impact.list.path, variables.programId] });
      queryClient.invalidateQueries({ queryKey: [api.impact.stats.path, variables.programId] });
      toast({
        title: "Impact Recorded",
        description: "Your impact data has been successfully logged.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

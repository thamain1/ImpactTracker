import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

export function useImpactStats(programId: number) {
  return useQuery({
    queryKey: [api.impact.stats.path, programId],
    queryFn: async () => {
      const url = `${api.impact.stats.path}?programId=${programId}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch impact stats");
      return api.impact.stats.responses[200].parse(await res.json());
    },
    enabled: !!programId,
  });
}

export function useImpactEntries(programId: number) {
  return useQuery({
    queryKey: [api.impact.list.path, programId],
    queryFn: async () => {
      const url = `${api.impact.list.path}?programId=${programId}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch impact entries");
      return api.impact.list.responses[200].parse(await res.json());
    },
    enabled: !!programId,
  });
}

export function useUpdateImpactEntry() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, programId, ...data }: { id: number; programId: number } & Record<string, any>) => {
      const res = await fetch(`/api/impact/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update impact entry");
      }

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
      const res = await fetch(api.impact.create.path, {
        method: api.impact.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to log impact");
      }
      
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

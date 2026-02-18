import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UpdateProgram } from "@shared/schema";
import { z } from "zod";

export function usePrograms(orgId?: number) {
  return useQuery({
    queryKey: [api.programs.list.path, orgId],
    queryFn: async () => {
      const url = orgId 
        ? `${api.programs.list.path}?orgId=${orgId}` 
        : api.programs.list.path;
      
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch programs");
      return api.programs.list.responses[200].parse(await res.json());
    },
  });
}

export function useProgram(id: number) {
  return useQuery({
    queryKey: [api.programs.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.programs.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch program details");
      return api.programs.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateProgram() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: z.infer<typeof api.programs.create.input>) => {
      const res = await fetch(api.programs.create.path, {
        method: api.programs.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create program");
      }
      
      return api.programs.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.programs.list.path] });
      toast({
        title: "Success",
        description: "Program created successfully",
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

export function useCreateMetric(programId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { name: string; unit: string; countsAsParticipant?: boolean }) => {
      const res = await apiRequest("POST", `/api/programs/${programId}/metrics`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.programs.get.path, programId] });
      queryClient.invalidateQueries({ queryKey: [api.programs.list.path] });
      toast({ title: "Success", description: "Metric added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateMetric(programId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ metricId, data }: { metricId: number; data: { countsAsParticipant: boolean } }) => {
      const res = await apiRequest("PATCH", `/api/programs/${programId}/metrics/${metricId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.programs.get.path, programId] });
      queryClient.invalidateQueries({ queryKey: [api.programs.list.path] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteMetric(programId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (metricId: number) => {
      await apiRequest("DELETE", `/api/programs/${programId}/metrics/${metricId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.programs.get.path, programId] });
      queryClient.invalidateQueries({ queryKey: [api.programs.list.path] });
      toast({ title: "Success", description: "Metric removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateProgram(id: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: UpdateProgram) => {
      const url = buildUrl(api.programs.update.path, { id });
      const res = await fetch(url, {
        method: api.programs.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update program");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.programs.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.programs.get.path, id] });
      toast({
        title: "Success",
        description: "Program updated successfully",
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

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

export function useOrganizations() {
  return useQuery({
    queryKey: [api.organizations.list.path],
    queryFn: async () => {
      const res = await fetch(api.organizations.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch organizations");
      return api.organizations.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: z.infer<typeof api.organizations.create.input>) => {
      const res = await fetch(api.organizations.create.path, {
        method: api.organizations.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create organization");
      }
      return api.organizations.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.organizations.list.path] });
      toast({
        title: "Success",
        description: "Organization created successfully",
      });
    },
  });
}

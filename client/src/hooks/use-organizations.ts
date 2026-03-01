import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

export function useOrganizations() {
  return useQuery({
    queryKey: [api.organizations.list.path],
    queryFn: async () => {
      const res = await apiRequest("GET", api.organizations.list.path);
      return api.organizations.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: z.infer<typeof api.organizations.create.input>) => {
      const res = await apiRequest("POST", api.organizations.create.path, data);
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

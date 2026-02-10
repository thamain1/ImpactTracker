import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useUserRoles(orgId: number) {
  return useQuery({
    queryKey: ["/api/organizations/roles", orgId],
    queryFn: async () => {
      const url = buildUrl(api.userRoles.list.path, { orgId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch user roles");
      return res.json();
    },
    enabled: !!orgId,
  });
}

export function useAddUserRole(orgId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const url = buildUrl(api.userRoles.create.path, { orgId });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to add user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/roles", orgId] });
      toast({ title: "Success", description: "User role added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteUserRole(orgId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (roleId: number) => {
      const url = buildUrl(api.userRoles.delete.path, { orgId, id: roleId });
      const res = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove user");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/roles", orgId] });
      toast({ title: "Success", description: "User removed successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

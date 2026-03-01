import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useUserRoles(orgId: number) {
  return useQuery({
    queryKey: ["/api/organizations/roles", orgId],
    queryFn: async () => {
      const url = buildUrl(api.userRoles.list.path, { orgId });
      const res = await apiRequest("GET", url);
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
      const res = await apiRequest("POST", url, data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/roles", orgId] });
      if (data?.inviteUrl) {
        navigator.clipboard.writeText(data.inviteUrl).catch(() => {});
        toast({
          title: "Invite link copied!",
          description: "The invite link has been copied to your clipboard. Share it with the new team member.",
          duration: 8000,
        });
      } else {
        toast({ title: "Success", description: "Team member added successfully." });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateUserRole(orgId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ roleId, role }: { roleId: number; role: string }) => {
      const url = buildUrl(api.userRoles.update.path, { orgId, id: roleId });
      const res = await apiRequest("PUT", url, { role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/roles", orgId] });
      toast({ title: "Success", description: "Permission updated successfully" });
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
      await apiRequest("DELETE", url);
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

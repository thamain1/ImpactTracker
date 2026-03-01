import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface ServiceArea {
  id: number;
  orgId: number;
  name: string;
  lat: number;
  lng: number;
  description: string | null;
  createdAt: string;
}

const QUERY_KEY = (orgId: number) => [`/api/organizations/${orgId}/service-areas`];

export function useServiceAreas(orgId?: number) {
  return useQuery<ServiceArea[]>({
    queryKey: QUERY_KEY(orgId ?? 0),
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizations/${orgId}/service-areas`);
      return res.json();
    },
    enabled: !!orgId,
  });
}

export function useCreateServiceArea(orgId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { name: string; lat: number; lng: number; description?: string }) => {
      const res = await apiRequest("POST", `/api/organizations/${orgId}/service-areas`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY(orgId) });
      toast({ title: "Service area added" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateServiceArea(orgId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number; name?: string; lat?: number; lng?: number; description?: string }) => {
      const res = await apiRequest("PUT", `/api/organizations/${orgId}/service-areas/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY(orgId) });
      toast({ title: "Service area updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteServiceArea(orgId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/organizations/${orgId}/service-areas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY(orgId) });
      toast({ title: "Service area removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

// LA County SPAs — used for the seed button in Settings
export const LA_COUNTY_SPAS = [
  { name: "SPA 1", lat: 34.4917, lng: -118.1114, description: "Antelope Valley" },
  { name: "SPA 2", lat: 34.2688, lng: -118.5132, description: "San Fernando Valley" },
  { name: "SPA 3", lat: 34.0731, lng: -117.9187, description: "San Gabriel Valley" },
  { name: "SPA 4", lat: 34.0549, lng: -118.2578, description: "Metro LA" },
  { name: "SPA 5", lat: 34.0368, lng: -118.4478, description: "West" },
  { name: "SPA 6", lat: 33.9700, lng: -118.2437, description: "South (Watts)" },
  { name: "SPA 7", lat: 34.0099, lng: -118.0134, description: "East" },
  { name: "SPA 8", lat: 33.8536, lng: -118.3906, description: "South Bay" },
];

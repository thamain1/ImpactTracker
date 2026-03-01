import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";

export function useDashboardCharts(orgId?: number) {
  return useQuery({
    queryKey: [api.dashboard.charts.path, orgId],
    queryFn: async () => {
      const url = orgId
        ? `${api.dashboard.charts.path}?orgId=${orgId}`
        : api.dashboard.charts.path;
      const res = await apiRequest("GET", url);
      return res.json();
    },
    enabled: !!orgId,
  });
}

import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useDashboardCharts(orgId?: number) {
  return useQuery({
    queryKey: [api.dashboard.charts.path, orgId],
    queryFn: async () => {
      const url = orgId
        ? `${api.dashboard.charts.path}?orgId=${orgId}`
        : api.dashboard.charts.path;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch dashboard charts");
      return res.json();
    },
  });
}

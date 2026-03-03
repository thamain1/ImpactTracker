import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function useSurveyResponses(programId: number, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ["/api/survey-responses", programId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/survey-responses?programId=${programId}`);
      return res.json();
    },
    enabled: !!programId && !isNaN(programId),
    ...options,
  });
}

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface CensusComparison {
  geographyLevel: string;
  geographyValue: string;
  totalPopulation: number | null;
  povertyRate: number | null;
  medianIncome: number | null;
  isApproximate: boolean;
  approximateNote?: string;
  dataYear: number;
}

export function useCensusLookup(level: string, value: string) {
  return useQuery<CensusComparison>({
    queryKey: ["/api/census", level, value],
    queryFn: async () => {
      const res = await fetch(`/api/census?level=${encodeURIComponent(level)}&value=${encodeURIComponent(value)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Census lookup failed");
      return res.json();
    },
    enabled: !!level && !!value,
    staleTime: 1000 * 60 * 60,
  });
}

export interface CensusComparisonWithImpact extends CensusComparison {
  impactCount: number;
  reachPercent: number | null;
}

export function useCensusComparison() {
  return useQuery<CensusComparisonWithImpact[]>({
    queryKey: ["/api/census/comparison"],
    staleTime: 1000 * 60 * 60,
  });
}

export function useCensusBatch(geographies: { level: string; value: string }[]) {
  return useQuery<CensusComparison[]>({
    queryKey: ["/api/census/batch", JSON.stringify(geographies)],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/census/batch", { geographies });
      return res.json();
    },
    enabled: geographies.length > 0,
    staleTime: 1000 * 60 * 60,
  });
}

export interface AgeGroupResult {
  geographyLevel: string;
  geographyValue: string;
  totalPopulation: number | null;
  targetAgePopulation: number | null;
  ageGroups: { label: string; minAge: number; maxAge: number; population: number }[];
  isApproximate: boolean;
  dataYear: number;
}

export function useCensusAgeGroups(
  geographies: { level: string; value: string }[],
  ageMin?: number | null,
  ageMax?: number | null,
) {
  return useQuery<AgeGroupResult[]>({
    queryKey: ["/api/census/age-groups", JSON.stringify(geographies), ageMin, ageMax],
    queryFn: async () => {
      const body: any = { geographies };
      if (ageMin != null) body.ageMin = ageMin;
      if (ageMax != null) body.ageMax = ageMax;
      const res = await apiRequest("POST", "/api/census/age-groups", body);
      return res.json();
    },
    enabled: geographies.length > 0,
    staleTime: 1000 * 60 * 60,
  });
}

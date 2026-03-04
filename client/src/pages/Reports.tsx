import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, Area, AreaChart } from "recharts";
import { useOrganizations } from "@/hooks/use-organizations";
import { usePrograms } from "@/hooks/use-programs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useMemo, useRef } from "react";
import { useImpactStats, useImpactEntries } from "@/hooks/use-impact";
import { useSurveyResponses } from "@/hooks/use-survey";
import { useCensusBatch, useCensusAgeGroups } from "@/hooks/use-census";
import { getParentGeographies } from "@shared/geography";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, FileBarChart, FileText, Table2, TrendingUp, DollarSign, AlertTriangle, Info, Users, MapPin, Target, Calendar, ClipboardList, Loader2, ChevronDown, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { api } from "@shared/routes";
import { generateImpactStudyPdf } from "@/lib/generateImpactStudyPdf";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useServiceAreas, type ServiceArea } from "@/hooks/use-service-areas";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function buildGeocodeQuery(loc: string): string {
  if (/^\d{5}$/.test(loc.trim())) return `${loc.trim()}, USA`;
  return `${loc.trim()}, USA`;
}

function useGeocode(locations: string[], serviceAreaList: ServiceArea[]) {
  const [coords, setCoords] = useState<Record<string, [number, number]>>({});
  const fetched = useRef(new Set<string>());

  // Build a normalised lookup from DB service areas (case-insensitive)
  const serviceAreaMap = useMemo(() => {
    const map: Record<string, [number, number]> = {};
    serviceAreaList.forEach(sa => {
      map[sa.name.trim().toLowerCase()] = [sa.lat, sa.lng];
    });
    return map;
  }, [serviceAreaList]);

  useEffect(() => {
    // Resolve from DB service areas immediately — no network call needed
    const resolved: Record<string, [number, number]> = {};
    locations.forEach(loc => {
      const key = loc.trim().toLowerCase();
      if (serviceAreaMap[key]) resolved[loc] = serviceAreaMap[key];
    });
    if (Object.keys(resolved).length > 0) {
      setCoords(prev => ({ ...prev, ...resolved }));
    }

    // Geocode remaining via Nominatim
    locations.forEach(async (loc) => {
      if (fetched.current.has(loc) || coords[loc] || resolved[loc]) return;
      fetched.current.add(loc);
      const query = buildGeocodeQuery(loc);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
        );
        const data = await res.json();
        if (data?.[0]) {
          setCoords(prev => ({ ...prev, [loc]: [parseFloat(data[0].lat), parseFloat(data[0].lon)] }));
        }
      } catch {}
    });
  }, [locations, serviceAreaMap]);

  return coords;
}

// CDPs / unincorporated areas → nearest major city (used to normalise census lookups)
const CITY_CANONICAL_MAP: Record<string, string> = {
  "willowbrook":      "Los Angeles",
  "east los angeles": "Los Angeles",
  "florence":         "Los Angeles",
  "florence-graham":  "Los Angeles",
};

export default function Reports() {
  const { toast } = useToast();
  const { data: orgs } = useOrganizations();
  const orgId = orgs?.[0]?.id;
  const { data: programs } = usePrograms(orgId);
  const { data: serviceAreaList = [] } = useServiceAreas(orgId);
  
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"charts" | "data" | "report">("charts");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  
  useEffect(() => {
    if (programs && programs.length > 0 && !selectedProgramId) {
      setSelectedProgramId(programs[0].id.toString());
    }
  }, [programs, selectedProgramId]);

  useEffect(() => {
    setAiReport(null);
  }, [selectedProgramId, selectedYear]);

  const programId = parseInt(selectedProgramId);
  const { data: stats, isLoading: statsLoading } = useImpactStats(programId);
  const { data: allEntries } = useImpactEntries(programId);
  const { data: surveyResponses } = useSurveyResponses(programId);
  const selectedProgram = programs?.find(p => p.id === programId);

  // Resolve the effective zip (program zip > org zip) so entries without a
  // stored geoContext can still be assigned to the correct SPA.
  const [orgGeoContext, setOrgGeoContext] = useState<{ spa?: string; city?: string; county?: string; state?: string } | null>(null);
  useEffect(() => {
    const rawOrg = orgs?.[0] as any;
    const zip = (
      (selectedProgram as any)?.zipCode ||
      rawOrg?.addressZip ||
      rawOrg?.address?.match(/\b(\d{5})\b/)?.[1] ||
      ""
    ).replace(/\D/g, "");
    if (zip.length !== 5) { setOrgGeoContext(null); return; }
    apiRequest("GET", `/api/zipcode/${zip}`)
      .then(r => r.ok ? r.json() : null)
      .then(ctx => setOrgGeoContext(ctx))
      .catch(() => setOrgGeoContext(null));
  }, [selectedProgram?.id, (orgs?.[0] as any)?.addressZip, (orgs?.[0] as any)?.address]);

  const availableYears = useMemo(() => {
    if (!allEntries) return [];
    const years = new Set<number>();
    allEntries.forEach(entry => {
      const year = new Date(entry.date + "T00:00:00").getFullYear();
      years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [allEntries]);

  const entries = useMemo(() => {
    if (!allEntries) return allEntries;
    if (selectedYear === "all") return allEntries;
    const yr = parseInt(selectedYear);
    return allEntries.filter(entry => {
      const entryYear = new Date(entry.date + "T00:00:00").getFullYear();
      return entryYear === yr;
    });
  }, [allEntries, selectedYear]);

  const participantMetricNames = useMemo(() => {
    if (!selectedProgram) return new Set<string>();
    const participant = selectedProgram.metrics.filter((m: any) => m.countsAsParticipant !== false);
    if (participant.length > 0) return new Set(participant.map((m: any) => m.name));
    return selectedProgram.metrics.length > 0 ? new Set([selectedProgram.metrics[0].name]) : new Set<string>();
  }, [selectedProgram]);

  const participantMetricIds = useMemo(() => {
    if (!selectedProgram) return new Set<number>();
    const participant = selectedProgram.metrics.filter((m: any) => m.countsAsParticipant !== false);
    if (participant.length > 0) return new Set(participant.map((m: any) => m.id as number));
    return selectedProgram.metrics.length > 0 ? new Set([selectedProgram.metrics[0].id as number]) : new Set<number>();
  }, [selectedProgram]);

  const filteredStats = useMemo(() => {
    if (selectedYear === "all") return stats;
    // Don't short-circuit when entries is empty — surveys still need to be counted below.
    const aggregation: Record<string, { geographyLevel: string; geographyValue: string; metrics: Record<string, number> }> = {};

    function addToAgg(level: string, value: string, mv: Record<string, number>) {
      const key = `${level}:${value}`;
      if (!aggregation[key]) {
        aggregation[key] = { geographyLevel: level, geographyValue: value, metrics: {} };
      }
      Object.entries(mv).forEach(([metric, val]) => {
        aggregation[key].metrics[metric] = (aggregation[key].metrics[metric] || 0) + Number(val);
      });
    }

    entries.forEach(entry => {
      const mv = entry.metricValues as Record<string, number>;
      const ctx = entry.geoContext as { spa?: string; city?: string; county?: string; state?: string } | null;
      if (ctx && Object.keys(ctx).length > 0) {
        // Zip-resolved: show the same participants at every derived geographic level
        if (ctx.spa)    addToAgg("SPA",    ctx.spa,    mv);
        if (ctx.city)   addToAgg("City",   ctx.city,   mv);
        if (ctx.county) addToAgg("County", ctx.county, mv);
        if (ctx.state)  addToAgg("State",  ctx.state,  mv);
      } else {
        // No zip on entry — roll up to County/State only (skip multi-SPA guessing).
        addToAgg(entry.geographyLevel, entry.geographyValue, mv);
        getParentGeographies(entry.geographyLevel, entry.geographyValue)
          .filter(p => p.level !== "SPA")
          .forEach(parent => { addToAgg(parent.level, parent.value, mv); });
        // If the org/program zip resolves to a specific SPA, assign City-level
        // entries there — it's a single known SPA, not a multi-SPA guess.
        if (entry.geographyLevel === "City" && orgGeoContext?.spa) {
          addToAgg("SPA", orgGeoContext.spa, mv);
        }
      }
    });
    // Only add survey counts in the year-filtered path; the server already
    // includes them when selectedYear === "all" (via /api/impact/stats).
    const filteredSurveys = surveyResponses?.filter((r: any) => {
      const yr = new Date(r.createdAt + 'Z').getFullYear();
      return yr === parseInt(selectedYear);
    });
    const primaryMetric =
      selectedProgram?.metrics.find((m: any) => m.countsAsParticipant !== false)?.name ||
      selectedProgram?.metrics[0]?.name;

    if (primaryMetric) {
      filteredSurveys?.forEach((resp: any) => {
        if (resp.respondentType !== "participant") return;
        if (resp.metricId != null && !participantMetricIds.has(resp.metricId)) return;
        const mv = { [primaryMetric]: 1 };
        if (orgGeoContext?.spa)    addToAgg("SPA",    orgGeoContext.spa,    mv);
        if (orgGeoContext?.city)   addToAgg("City",   orgGeoContext.city,   mv);
        if (orgGeoContext?.county) addToAgg("County", orgGeoContext.county, mv);
        if (orgGeoContext?.state)  addToAgg("State",  orgGeoContext.state,  mv);
      });
    }

    return Object.values(aggregation);
  }, [stats, entries, selectedYear, orgGeoContext, surveyResponses, selectedProgram, participantMetricIds]);

  const primaryMetric = selectedProgram?.metrics.find((m: any) => m.countsAsParticipant !== false)?.name || selectedProgram?.metrics[0]?.name || "";

  const geoList = useMemo(() => {
    if (!filteredStats) return [];
    const unique = new Map<string, { level: string; value: string }>();
    filteredStats.forEach(s => unique.set(`${s.geographyLevel}:${s.geographyValue}`, { level: s.geographyLevel, value: s.geographyValue }));
    return Array.from(unique.values());
  }, [filteredStats]);

  // Normalised list for census lookups:
  // - CDPs collapsed to their major city
  // - Every entry expanded to its parent geographies for census fetching
  // - SPA is only added when it already exists in geoList (zip-resolved entries).
  //   We do NOT expand City→SPA because that would create SPA census cards with
  //   0 participants — SPAs must come from actual zip-resolved SPA stats.
  const censusGeoList = useMemo(() => {
    const unique = new Map<string, { level: string; value: string }>();
    const addGeo = (level: string, value: string) => {
      unique.set(`${level}:${value}`, { level, value });
    };
    geoList.forEach(g => {
      const canonical = g.level === "City"
        ? (CITY_CANONICAL_MAP[g.value.toLowerCase()] ?? g.value)
        : g.value;
      addGeo(g.level, canonical);
      // Expand to parents but skip SPA when the source is not already SPA-level.
      // City→SPA expansion would fetch SPA census data but show 0 participants.
      getParentGeographies(g.level, canonical)
        .filter(p => !(p.level === "SPA" && g.level !== "SPA"))
        .forEach(p => addGeo(p.level, p.value));
    });
    return Array.from(unique.values());
  }, [geoList]);

  const { data: censusData } = useCensusBatch(censusGeoList);

  const hasAgeTarget = !!(selectedProgram?.targetAgeMin != null || selectedProgram?.targetAgeMax != null);
  const { data: ageGroupData } = useCensusAgeGroups(
    censusGeoList,
    selectedProgram?.targetAgeMin,
    selectedProgram?.targetAgeMax,
  );

  const serviceAreaLocations = useMemo(() => {
    const locs: string[] = [];
    if (selectedProgram?.locations) {
      selectedProgram.locations.split(/[,;\n]/).map(s => s.trim()).filter(Boolean).forEach(l => locs.push(l));
    }
    if (entries && entries.length > 0) {
      const directLocations = new Set<string>();
      entries.forEach(e => {
        directLocations.add(`${e.geographyValue}, ${e.geographyLevel === "State" ? "USA" : "California"}`);
      });
      directLocations.forEach(label => {
        if (!locs.some(l => label.includes(l) || l.includes(label.split(",")[0].trim()))) {
          locs.push(label);
        }
      });
    }
    return locs;
  }, [selectedProgram, entries]);

  const geoCoords = useGeocode(serviceAreaLocations, serviceAreaList);

  const participantsByMonth = useMemo(() => {
    if (participantMetricNames.size === 0) return [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthCounts: Record<number, number> = {};
    (entries || []).forEach(entry => {
      const month = new Date(entry.date + "T00:00:00").getMonth();
      const mv = entry.metricValues as Record<string, number>;
      let total = 0;
      participantMetricNames.forEach(name => { total += Number(mv[name] || 0); });
      monthCounts[month] = (monthCounts[month] || 0) + total;
    });
    // Survey responses — 1 per check-in for participant metrics only
    (surveyResponses || []).forEach((r: any) => {
      if (r.respondentType !== "participant") return;
      if (r.metricId != null && !participantMetricIds.has(r.metricId)) return;
      if (selectedYear !== "all") {
        const yr = new Date(r.createdAt + 'Z').getFullYear();
        if (yr !== parseInt(selectedYear)) return;
      }
      const month = new Date(r.createdAt + 'Z').getMonth();
      monthCounts[month] = (monthCounts[month] || 0) + 1;
    });
    return monthNames.map((name, i) => ({ month: name, count: monthCounts[i] || 0 }));
  }, [entries, participantMetricNames, surveyResponses, participantMetricIds, selectedYear]);

  const goalData = useMemo(() => {
    if (!selectedProgram) return null;
    let goalTarget: number | null = null;
    if (selectedProgram.goals) {
      const match = selectedProgram.goals.match(/(\d[\d,]*)/);
      if (match) goalTarget = parseInt(match[1].replace(/,/g, ''), 10);
    }
    const entryActual = (entries || []).reduce((sum, entry) => {
      const mv = entry.metricValues as Record<string, number>;
      let total = 0;
      participantMetricNames.forEach(name => { total += Number(mv[name] || 0); });
      return sum + total;
    }, 0);
    const surveyActual = (surveyResponses || []).filter((r: any) => {
      if (r.respondentType !== "participant") return false;
      if (r.metricId != null && !participantMetricIds.has(r.metricId)) return false;
      if (selectedYear !== "all") {
        const yr = new Date(r.createdAt + 'Z').getFullYear();
        if (yr !== parseInt(selectedYear)) return false;
      }
      return true;
    }).length;
    return { goalTarget, actual: entryActual + surveyActual, goals: selectedProgram.goals };
  }, [selectedProgram, entries, participantMetricNames, surveyResponses, participantMetricIds, selectedYear]);

  const totalCensusPop = useMemo(() => {
    if (!censusData) return 0;
    return censusData.reduce((sum, c) => sum + (c.totalPopulation || 0), 0);
  }, [censusData]);

  const totalAgePop = useMemo(() => {
    if (!ageGroupData) return 0;
    return ageGroupData.reduce((sum, g) => sum + (g.targetAgePopulation || 0), 0);
  }, [ageGroupData]);

  const totalImpact = useMemo(() => {
    const entryTotal = (entries || []).reduce((sum, entry) => {
      const mv = entry.metricValues as Record<string, number>;
      let total = 0;
      participantMetricNames.forEach(name => { total += Number(mv[name] || 0); });
      return sum + total;
    }, 0);
    const surveyTotal = (surveyResponses || []).filter((r: any) =>
      r.respondentType === "participant" &&
      (r.metricId == null || participantMetricIds.has(r.metricId))
    ).length;
    return entryTotal + surveyTotal;
  }, [entries, participantMetricNames, surveyResponses, participantMetricIds]);

  // Survey check-ins for the Raw Data tab — one row per unique check-in (grouped by createdAt),
  // with all metric quantities aggregated and demographics captured from the first row.
  const surveyCheckIns = useMemo(() => {
    if (!surveyResponses || !selectedProgram) return [];
    const metricIdToName: Record<number, string> = {};
    selectedProgram.metrics.forEach((m: any) => { metricIdToName[m.id] = m.name; });
    const primaryMetricName =
      selectedProgram.metrics.find((m: any) => m.countsAsParticipant !== false)?.name ||
      selectedProgram.metrics[0]?.name || "";

    const participantRows = (surveyResponses as any[]).filter((r: any) => r.respondentType === "participant");
    const yearFiltered = selectedYear === "all" ? participantRows : participantRows.filter((r: any) =>
      new Date(r.createdAt + 'Z').getFullYear() === parseInt(selectedYear)
    );

    const groups = new Map<string, { metricValues: Record<string, number>; date: string; demographics: string }>();
    yearFiltered.forEach((r: any) => {
      const key = r.createdAt as string;
      if (!groups.has(key)) {
        const _d = new Date(r.createdAt + 'Z');
        const date = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;
        const demoParts: string[] = [];
        if (r.sex) demoParts.push(r.sex);
        if (r.ageRange) demoParts.push(r.ageRange);
        if (r.householdIncome) demoParts.push(r.householdIncome);
        if (r.familySize) demoParts.push(`Fam: ${r.familySize}`);
        groups.set(key, { metricValues: {}, date, demographics: demoParts.join(", ") || "-" });
      }
      const group = groups.get(key)!;
      if (r.metricId && metricIdToName[r.metricId]) {
        const name = metricIdToName[r.metricId];
        group.metricValues[name] = (group.metricValues[name] || 0) + (r.quantityDelivered ?? 1);
      } else if (!r.metricId && primaryMetricName) {
        group.metricValues[primaryMetricName] = (group.metricValues[primaryMetricName] || 0) + 1;
      }
    });
    return Array.from(groups.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [surveyResponses, selectedProgram, selectedYear]);

  const handleCsvDownload = async () => {
    const res = await apiRequest("GET", `${api.impact.exportCsv.path}?programId=${programId}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `impact_report_${programId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pdfReady = !!(selectedProgram && orgs?.[0] && filteredStats && entries && !statsLoading);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfPersonaLabel, setPdfPersonaLabel] = useState<string>("");

  type PersonaKey = "general";
  type AiNarrativeResult = {
    executiveSummary: string;
    communityNeed: string;
    programDesign: string;
    outcomesImpact: string;
    lessonsLearned: string;
    callToAction: string;
  };

  const [aiReport, setAiReport] = useState<AiNarrativeResult | null>(null);
  const [aiReportGenerating, setAiReportGenerating] = useState(false);
  const aiReportPersona: PersonaKey = "general";
  const PERSONA_LABELS: Record<PersonaKey, string> = {
    general: "General",
  };

  const handlePdfDownload = async (persona: PersonaKey) => {
    if (!selectedProgram || !orgs?.[0] || !filteredStats || !entries) {
      toast({ title: "Not Ready", description: "Please wait for data to finish loading before downloading.", variant: "destructive" });
      return;
    }
    setPdfGenerating(true);
    setPdfPersonaLabel(PERSONA_LABELS[persona]);
    let aiNarrative = undefined;
    let metricTotals: Record<string, number> = {};
    try {
      const pdfParticipantNames = participantMetricNames;
      const totalPrimary = (entries || []).reduce((sum: number, e: any) => {
        const vals = e.metricValues as Record<string, number> | null;
        if (!vals) return sum;
        let t = 0;
        pdfParticipantNames.forEach(name => { t += Number(vals[name] || 0); });
        return sum + t;
      }, 0);
      const participantLabel = Array.from(pdfParticipantNames).join(", ") || "Participants";

      // Build geography list and per-geo breakdown for structured persona input
      const geoList = (filteredStats || []).map((s: any) => `${s.geographyValue} (${s.geographyLevel})`).slice(0, 15);
      const geoSummary = geoList.join(", ");
      const statsByGeo = (filteredStats || []).map((s: any) => {
        let total = 0;
        pdfParticipantNames.forEach((name: string) => { total += Number(s.metrics[name] || 0); });
        return { geography: `${s.geographyValue} (${s.geographyLevel})`, value: total };
      }).filter((g: any) => g.value > 0).slice(0, 15);

      // Compute reach percent from census data if available
      const totalCensusPop = (censusData || []).reduce((sum: number, c: any) => sum + (c.totalPopulation || 0), 0);
      const reachPercent = totalCensusPop > 0 && totalPrimary > 0
        ? Math.round((totalPrimary / totalCensusPop) * 10000) / 100
        : null;

      // Extract numeric goal target
      let goalTarget: number | null = null;
      if (selectedProgram.goals) {
        const match = selectedProgram.goals.match(/(\d[\d,]*)/);
        if (match) goalTarget = parseInt(match[1].replace(/,/g, ""), 10);
      }

      selectedProgram.metrics.forEach((m: any) => {
        const entryTotal = (entries || []).reduce((sum: number, e: any) =>
          sum + Number((e.metricValues as any)?.[m.name] || 0), 0);
        const surveyTotal = surveyCheckIns.reduce((sum, ci) =>
          sum + (ci.metricValues[m.name] || 0), 0);
        metricTotals[m.name] = entryTotal + surveyTotal;
      });
      const res = await apiRequest("POST", "/api/report/ai-narrative", {
        persona,
        programName:        selectedProgram.name,
        programDescription: selectedProgram.description || "",
        programType:        selectedProgram.type || "",
        programStatus:      selectedProgram.status || "active",
        startDate:          selectedProgram.startDate || null,
        endDate:            selectedProgram.endDate || null,
        orgName:            orgs[0].name,
        orgMission:         (orgs[0] as any).mission || "",
        orgVision:          (orgs[0] as any).vision || "",
        targetPopulation:   selectedProgram.targetPopulation || "",
        goals:              selectedProgram.goals || "",
        goalTarget,
        totalParticipants:  goalData?.actual ?? totalPrimary,
        primaryMetricName:  participantLabel,
        geographies:        geoSummary,
        geographyList:      geoList,
        statsByGeo,
        reachPercent,
        totalCost:          (selectedProgram as any).budget || 0,
        program:            selectedProgram,
        metricTotals,
      });
      aiNarrative = await res.json();
    } catch (err) {
      console.warn("AI narrative generation failed, proceeding without AI content", err);
    }
    try {
      generateImpactStudyPdf({
        program: selectedProgram,
        org: orgs[0] as any,
        stats: filteredStats || [],
        censusData: (censusData || []) as any,
        ageGroupData: (ageGroupData || []) as any,
        entries: (entries || []) as any,
        aiNarrative,
        totalParticipants: goalData?.actual,
        metricTotals,
      });
      const personaLabel = PERSONA_LABELS[persona];
      toast({ title: "PDF Generated", description: aiNarrative ? `${personaLabel} Impact Study PDF with AI narrative downloaded.` : "Impact Study PDF downloaded." });
    } catch (err) {
      toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" });
    }
    setPdfGenerating(false);
    setPdfPersonaLabel("");
  };

  const handleGenerateReport = async () => {
    if (!selectedProgram || !orgs?.[0] || !filteredStats || !entries) {
      toast({ title: "Not Ready", description: "Please wait for data to finish loading.", variant: "destructive" });
      return;
    }
    setAiReportGenerating(true);
    setAiReport(null);
    try {
      const reportParticipantNames = participantMetricNames;
      const totalPrimary = (entries || []).reduce((sum: number, e: any) => {
        const vals = e.metricValues as Record<string, number> | null;
        if (!vals) return sum;
        let t = 0;
        reportParticipantNames.forEach(name => { t += Number(vals[name] || 0); });
        return sum + t;
      }, 0);
      const participantLabel = Array.from(reportParticipantNames).join(", ") || "Participants";
      const geoListStr = (filteredStats || []).map((s: any) => `${s.geographyValue} (${s.geographyLevel})`).slice(0, 15);
      const statsByGeo = (filteredStats || []).map((s: any) => {
        let total = 0;
        reportParticipantNames.forEach((name: string) => { total += Number(s.metrics[name] || 0); });
        return { geography: `${s.geographyValue} (${s.geographyLevel})`, value: total };
      }).filter((g: any) => g.value > 0).slice(0, 15);
      const totalCensusPop = (censusData || []).reduce((sum: number, c: any) => sum + (c.totalPopulation || 0), 0);
      const reachPercent = totalCensusPop > 0 && totalPrimary > 0
        ? Math.round((totalPrimary / totalCensusPop) * 10000) / 100
        : null;
      let goalTarget: number | null = null;
      if (selectedProgram.goals) {
        const match = selectedProgram.goals.match(/(\d[\d,]*)/);
        if (match) goalTarget = parseInt(match[1].replace(/,/g, ""), 10);
      }
      const metricTotals: Record<string, number> = {};
      selectedProgram.metrics.forEach((m: any) => {
        const entryTotal = (entries || []).reduce((sum: number, e: any) =>
          sum + Number((e.metricValues as any)?.[m.name] || 0), 0);
        const surveyTotal = surveyCheckIns.reduce((sum, ci) =>
          sum + (ci.metricValues[m.name] || 0), 0);
        metricTotals[m.name] = entryTotal + surveyTotal;
      });
      const res = await apiRequest("POST", "/api/report/ai-narrative", {
        persona: aiReportPersona,
        programName:        selectedProgram.name,
        programDescription: selectedProgram.description || "",
        programType:        selectedProgram.type || "",
        programStatus:      selectedProgram.status || "active",
        startDate:          selectedProgram.startDate || null,
        endDate:            selectedProgram.endDate || null,
        orgName:            orgs[0].name,
        orgMission:         (orgs[0] as any).mission || "",
        orgVision:          (orgs[0] as any).vision || "",
        targetPopulation:   selectedProgram.targetPopulation || "",
        goals:              selectedProgram.goals || "",
        goalTarget,
        totalParticipants:  goalData?.actual ?? totalPrimary,
        primaryMetricName:  participantLabel,
        geographies:        geoListStr.join(", "),
        geographyList:      geoListStr,
        statsByGeo,
        reachPercent,
        totalCost:          (selectedProgram as any).budget || 0,
        program:            selectedProgram,
        metricTotals,
      });
      const narrative = await res.json();
      setAiReport(narrative);
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      // rawMsg is "500: {\"message\":\"...\"}"; try to extract inner message
      let displayMsg = rawMsg;
      try {
        const jsonStart = rawMsg.indexOf("{");
        if (jsonStart !== -1) {
          const inner = JSON.parse(rawMsg.slice(jsonStart)) as { message?: string };
          if (inner.message) displayMsg = inner.message;
        }
      } catch {}
      toast({ title: "Report Generation Failed", description: displayMsg, variant: "destructive" });
    }
    setAiReportGenerating(false);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-slate-900" data-testid="text-reports-title">Reports</h1>
          <p className="text-muted-foreground mt-1">Visualize and export your impact data.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedProgramId} onValueChange={(v) => { setSelectedProgramId(v); setSelectedYear("all"); }}>
            <SelectTrigger className="w-[240px]" data-testid="select-report-program">
              <SelectValue placeholder="Select Program" />
            </SelectTrigger>
            <SelectContent>
              {programs?.map(p => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedProgramId && availableYears.length > 0 && (
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[140px]" data-testid="select-report-year">
                <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {availableYears.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {selectedProgramId && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="default" disabled={!pdfReady || pdfGenerating} data-testid="button-download-pdf">
                    {pdfGenerating
                      ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      : <FileText className="w-4 h-4 mr-2" />}
                    {pdfGenerating
                      ? `Generating ${pdfPersonaLabel} Report...`
                      : "Impact Study PDF"}
                    {!pdfGenerating && <ChevronDown className="w-3.5 h-3.5 ml-1.5 opacity-60" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => handlePdfDownload("general")} data-testid="pdf-persona-general">
                    <FileText className="w-4 h-4 mr-2 text-slate-500" />
                    <div>
                      <p className="font-medium text-sm">General</p>
                      <p className="text-xs text-muted-foreground">Public-facing, warm &amp; data-driven</p>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" onClick={handleCsvDownload} data-testid="button-download-csv">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tab Controls */}
      {selectedProgramId && (
        <div className="flex gap-2">
          <Button
            variant={activeTab === "charts" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("charts")}
            data-testid="tab-charts"
          >
            <FileBarChart className="w-4 h-4 mr-2" /> Charts
          </Button>
          <Button
            variant={activeTab === "data" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("data")}
            data-testid="tab-data"
          >
            <Table2 className="w-4 h-4 mr-2" /> Raw Data
          </Button>
          <Button
            variant={activeTab === "report" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("report")}
            data-testid="tab-report"
          >
            <Sparkles className="w-4 h-4 mr-2" /> Preview
          </Button>
        </div>
      )}

      {!selectedProgramId ? (
        <div className="h-[400px] flex items-center justify-center bg-muted/50 rounded-2xl border border-dashed text-muted-foreground">
          Select a program to view reports
        </div>
      ) : statsLoading ? (
        <div className="grid md:grid-cols-2 gap-8">
          <Skeleton className="h-[400px] rounded-2xl" />
          <Skeleton className="h-[400px] rounded-2xl" />
        </div>
      ) : activeTab === "charts" ? (
        <>
          {/* Summary Cards */}
          {filteredStats && filteredStats.length > 0 && (() => {
            // Helper: sum participant metrics for a single stat entry
            const entryTotal = (s: typeof filteredStats[0]) => {
              let t = 0;
              participantMetricNames.forEach(name => { t += Number(s.metrics[name] || 0); });
              return t;
            };

            // One reusable card for any named geographic value (SPA, City, County, State)
            const GeoValueCard = ({ stat }: { stat: typeof filteredStats[0] }) => {
              const total = entryTotal(stat);
              const census = censusData?.find(
                c => c.geographyLevel === stat.geographyLevel && c.geographyValue === stat.geographyValue
              );
              const pop = census?.totalPopulation || 0;
              const reachPct = pop > 0 && total > 0
                ? Math.round((total / pop) * 10000) / 100 : null;
              return (
                <Card data-testid={`geo-card-${stat.geographyLevel.toLowerCase()}-${stat.geographyValue.replace(/\s+/g, "-").toLowerCase()}`}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground font-medium uppercase">{stat.geographyLevel}</p>
                    <p className="text-sm font-semibold text-slate-700 mt-0.5 leading-tight truncate" title={stat.geographyValue}>
                      {stat.geographyValue}
                    </p>
                    <p className="text-2xl font-heading font-bold text-slate-900 mt-1">{total.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Participants</p>
                    {pop > 0 && (
                      <div className="mt-2 pt-2 border-t space-y-1">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-muted-foreground">Population</span>
                          <span className="font-semibold text-slate-700">{pop.toLocaleString()}</span>
                        </div>
                        {reachPct !== null && (
                          <div>
                            <div className="flex items-center justify-between gap-2 text-xs mb-1">
                              <span className="text-muted-foreground">Reach</span>
                              <span className="font-semibold text-emerald-600">{reachPct}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                              <div className="bg-primary rounded-full h-1.5 transition-all"
                                style={{ width: `${Math.min(reachPct, 100)}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            };

            // Merge CDP/small-city entries into their major city
            const cityMap = new Map<string, { geographyLevel: string; geographyValue: string; metrics: Record<string, number> }>();
            filteredStats
              .filter(s => s.geographyLevel === "City")
              .forEach(s => {
                const canonical = CITY_CANONICAL_MAP[s.geographyValue.toLowerCase()] ?? s.geographyValue;
                const existing = cityMap.get(canonical);
                if (existing) {
                  Object.keys(s.metrics).forEach(k => {
                    existing.metrics[k] = (existing.metrics[k] || 0) + Number(s.metrics[k]);
                  });
                } else {
                  cityMap.set(canonical, { ...s, geographyValue: canonical });
                }
              });

            // Pick the city entry with the highest census population
            const cityEntries = Array.from(cityMap.values());
            const primaryCity = cityEntries.reduce<typeof cityEntries[0] | null>((best, cur) => {
              const bestPop = censusData?.find(c => c.geographyLevel === "City" && c.geographyValue === best?.geographyValue)?.totalPopulation ?? 0;
              const curPop  = censusData?.find(c => c.geographyLevel === "City" && c.geographyValue === cur.geographyValue)?.totalPopulation ?? 0;
              return (!best || curPop > bestPop) ? cur : best;
            }, null);

            const countyEntries = filteredStats.filter(s => s.geographyLevel === "County");
            const stateEntries  = filteredStats.filter(s => s.geographyLevel === "State");

            // Always show City · County · State — synthesize from program total when absent
            const makeSyntheticMetrics = () => {
              const m: Record<string, number> = {};
              participantMetricNames.forEach(name => {
                m[name] = (entries || []).reduce(
                  (sum: number, e: any) => sum + Number((e.metricValues as any)[name] || 0), 0
                );
              });
              return m;
            };
            // Derive fallback names by walking parent geographies of whatever is present
            const anyEntry = filteredStats[0];
            const inferredParents = anyEntry
              ? getParentGeographies(anyEntry.geographyLevel, anyEntry.geographyValue)
              : [];
            const knownCounty = countyEntries[0]?.geographyValue
              ?? inferredParents.find(p => p.level === "County")?.value
              ?? "Los Angeles County";
            const knownState  = stateEntries[0]?.geographyValue
              ?? inferredParents.find(p => p.level === "State")?.value
              ?? "California";
            const knownCity   = primaryCity?.geographyValue
              ?? inferredParents.find(p => p.level === "City")?.value
              ?? "Los Angeles";
            const synMetrics    = makeSyntheticMetrics();
            const effectiveCity   = primaryCity      ?? { geographyLevel: "City",   geographyValue: knownCity,   metrics: synMetrics };
            const effectiveCounty = countyEntries[0] ?? { geographyLevel: "County", geographyValue: knownCounty, metrics: synMetrics };
            const effectiveState  = stateEntries[0]  ?? { geographyLevel: "State",  geographyValue: knownState,  metrics: synMetrics };
            const topCards = [effectiveCity, effectiveCounty, effectiveState];

            return (
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
                <Card data-testid="geo-card-total" className="border-primary/30 bg-primary/5">
                  <CardContent className="p-4">
                    <p className="text-xs text-primary font-medium uppercase">Total</p>
                    <p className="text-2xl font-heading font-bold text-slate-900 mt-1">
                      {(goalData?.actual ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Participants Served</p>
                  </CardContent>
                </Card>
                {topCards.map(s => <GeoValueCard key={`${s.geographyLevel}:${s.geographyValue}`} stat={s} />)}
              </div>
            );
          })()}

          {/* Program Overview */}
          {selectedProgram && (
            <Card data-testid="card-program-overview">
              <CardHeader>
                <CardTitle className="font-heading text-lg flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-primary" />
                  {selectedProgram.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedProgram.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{selectedProgram.description}</p>
                )}
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> Target Population
                    </p>
                    <p className="text-sm font-medium text-slate-800" data-testid="text-target-population">
                      {selectedProgram.targetPopulation || "Not specified"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
                      <Target className="w-3.5 h-3.5" /> Program Goal
                    </p>
                    <p className="text-sm font-medium text-slate-800" data-testid="text-program-goal">
                      {selectedProgram.goals || "Not specified"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Age Range
                    </p>
                    <p className="text-sm font-medium text-slate-800" data-testid="text-age-range">
                      {selectedProgram.targetAgeMin != null || selectedProgram.targetAgeMax != null
                        ? `${selectedProgram.targetAgeMin ?? 0}${selectedProgram.targetAgeMax ? `\u2013${selectedProgram.targetAgeMax}` : "+"} years`
                        : "All ages"}
                    </p>
                  </div>
                </div>
                {(selectedProgram.startDate || selectedProgram.endDate) && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      {selectedProgram.startDate && `Start: ${format(new Date(selectedProgram.startDate + 'T00:00:00'), 'MMM d, yyyy')}`}
                      {selectedProgram.startDate && selectedProgram.endDate && " \u2014 "}
                      {selectedProgram.endDate && `End: ${format(new Date(selectedProgram.endDate + 'T00:00:00'), 'MMM d, yyyy')}`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Cost Summary */}
          {selectedProgram && (() => {
            const budgetNum = (selectedProgram as any).budget as number | null;
            const cppRaw = selectedProgram.costPerParticipant;
            const cppNum = cppRaw ? parseFloat(cppRaw.replace(/[$,\s]/g, "")) : NaN;
            const hasCpp = !isNaN(cppNum) && cppNum > 0;
            const hasBudget = !!budgetNum && budgetNum > 0;
            if (!hasBudget && !cppRaw) return null;

            const effectiveCpp = hasBudget && totalImpact > 0 ? budgetNum! / totalImpact : null;
            const estimatedTotal = hasCpp && totalImpact > 0 ? cppNum * totalImpact : null;

            return (
              <Card data-testid="card-cost-summary">
                <CardHeader>
                  <CardTitle className="font-heading text-lg flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-primary" />
                    Cost Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-3 gap-6">
                    {hasBudget && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Program Budget</p>
                        <p className="text-2xl font-heading font-bold text-slate-900">${budgetNum!.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Total allocation</p>
                      </div>
                    )}
                    {cppRaw && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Cost Per Participant</p>
                        <p className="text-2xl font-heading font-bold text-slate-900">{cppRaw}</p>
                        <p className="text-xs text-muted-foreground">Stated rate</p>
                      </div>
                    )}
                    {effectiveCpp !== null && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Effective CPP</p>
                        <p className="text-2xl font-heading font-bold text-emerald-600">
                          ${effectiveCpp.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-muted-foreground">Budget ÷ {totalImpact.toLocaleString()} served</p>
                      </div>
                    )}
                    {effectiveCpp === null && estimatedTotal !== null && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Cost to Serve</p>
                        <p className="text-2xl font-heading font-bold text-emerald-600">${estimatedTotal.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{totalImpact.toLocaleString()} participants × {cppRaw}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Service Area Map */}
          {Object.keys(geoCoords).length > 0 && (
            <Card data-testid="card-service-area-map">
              <CardHeader>
                <CardTitle className="font-heading text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  Area of Service
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] rounded-md overflow-hidden">
                  <MapContainer
                    center={Object.values(geoCoords)[0]}
                    zoom={8}
                    style={{ height: "100%", width: "100%" }}
                    scrollWheelZoom={false}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {Object.entries(geoCoords).map(([name, pos]) => (
                      <Marker key={name} position={pos}>
                        <Popup>
                          <span className="font-medium">{name}</span>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Participants by Month */}
          <Card data-testid="card-participants-by-month">
            <CardHeader>
              <CardTitle className="font-heading text-lg">Participants by Month</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {participantsByMonth.some(m => m.count > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={participantsByMonth} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Area type="monotone" dataKey="count" stroke="#0d9488" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">No monthly data available</div>
              )}
            </CardContent>
          </Card>

          {/* Goal vs. Actual */}
          {goalData && goalData.goalTarget !== null && (
            <Card data-testid="card-goal-vs-actual">
              <CardHeader>
                <CardTitle className="font-heading text-lg flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Goal vs. Actual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[{ name: selectedProgram?.name || "Program", goal: goalData.goalTarget, actual: goalData.actual }]} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                        <Legend />
                        <Bar dataKey="goal" name="Goal" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="actual" name="Actual" fill="#0d9488" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col justify-center space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase">Goal</p>
                      <p className="text-3xl font-heading font-bold text-slate-900" data-testid="text-goal-target">{goalData.goalTarget!.toLocaleString()}</p>
                      {goalData.goals && <p className="text-sm text-muted-foreground mt-1">{goalData.goals}</p>}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase">Actual</p>
                      <p className="text-3xl font-heading font-bold text-primary" data-testid="text-goal-actual">{goalData.actual.toLocaleString()}</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-2 text-sm mb-1">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-bold text-emerald-600">{goalData.goalTarget! > 0 ? Math.round((goalData.actual / goalData.goalTarget!) * 100) : 0}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3">
                        <div
                          className="bg-primary rounded-full h-3 transition-all"
                          style={{ width: `${goalData.goalTarget! > 0 ? Math.min(Math.round((goalData.actual / goalData.goalTarget!) * 100), 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Program Target & Populations / Progress */}
          <Card data-testid="card-program-progress">
            <CardHeader>
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Program Target & Populations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {totalCensusPop > 0 && (
                <div>
                  <div className="flex items-center justify-between gap-2 text-sm mb-1">
                    <span className="text-muted-foreground">Total Census Population (Service Area)</span>
                    <span className="font-bold text-slate-900">{totalCensusPop.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm mb-1">
                    <span className="text-muted-foreground">Total Impact</span>
                    <span className="font-bold text-primary">{totalImpact.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm mb-1">
                    <span className="text-muted-foreground">Population Reached</span>
                    <span className="font-bold text-emerald-600">
                      {totalImpact > 0 ? `${(Math.round((totalImpact / totalCensusPop) * 10000) / 100)}%` : "0%"}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 mt-2">
                    <div
                      className="bg-primary rounded-full h-2.5 transition-all"
                      style={{ width: `${Math.min(totalImpact > 0 ? (totalImpact / totalCensusPop) * 100 : 0, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {hasAgeTarget && totalAgePop > 0 && (
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between gap-2 text-sm mb-1">
                    <span className="text-muted-foreground">
                      Target Age Population ({selectedProgram?.targetAgeMin ?? 0}{selectedProgram?.targetAgeMax ? `\u2013${selectedProgram.targetAgeMax}` : "+"})
                    </span>
                    <span className="font-bold text-slate-900">{totalAgePop.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm mb-1">
                    <span className="text-muted-foreground">Target Age Reached</span>
                    <span className="font-bold text-emerald-600">
                      {totalImpact > 0 ? `${(Math.round((totalImpact / totalAgePop) * 10000) / 100)}%` : "0%"}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 mt-2">
                    <div
                      className="bg-emerald-500 rounded-full h-2.5 transition-all"
                      style={{ width: `${Math.min(totalImpact > 0 ? (totalImpact / totalAgePop) * 100 : 0, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {goalData && goalData.goalTarget !== null && goalData.goalTarget > 0 && (
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between gap-2 text-sm mb-1">
                    <span className="text-muted-foreground">Goal Target</span>
                    <span className="font-bold text-slate-900">{goalData.goalTarget.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm mb-1">
                    <span className="text-muted-foreground">Goal Progress</span>
                    <span className="font-bold text-emerald-600">
                      {Math.round((goalData.actual / goalData.goalTarget) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 mt-2">
                    <div
                      className="bg-amber-500 rounded-full h-2.5 transition-all"
                      style={{ width: `${Math.min(Math.round((goalData.actual / goalData.goalTarget) * 100), 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {!totalCensusPop && !totalAgePop && (!goalData || goalData.goalTarget === null) && (
                <p className="text-sm text-muted-foreground italic">No population or goal data available for this program</p>
              )}
            </CardContent>
          </Card>

          {/* Census Comparison */}
          {censusData && censusData.length > 0 && (
            <div>
              <h2 className="text-lg font-heading font-semibold text-slate-900 mb-1 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Census Comparison
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                How this program's impact compares to census population data{censusData?.[0]?.dataYear ? ` (${censusData[0].dataYear} ACS)` : ""} across all geographic levels
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...censusData]
                  .sort((a, b) => {
                    const order = ["SPA", "City", "County", "State"];
                    return order.indexOf(a.geographyLevel) - order.indexOf(b.geographyLevel);
                  })
                  .map((census, i) => {
                  let impactTotal = 0;
                  filteredStats?.forEach(s => {
                    if (s.geographyLevel !== census.geographyLevel) return;
                    const canonical = census.geographyLevel === "City"
                      ? (CITY_CANONICAL_MAP[s.geographyValue.toLowerCase()] ?? s.geographyValue)
                      : s.geographyValue;
                    if (canonical === census.geographyValue) {
                      participantMetricNames.forEach(name => { impactTotal += Number(s.metrics[name] || 0); });
                    }
                  });
                  const reachPercent = census.totalPopulation && impactTotal > 0
                    ? Math.round((impactTotal / census.totalPopulation) * 10000) / 100
                    : null;

                  return (
                    <Card key={`census-${i}`} data-testid={`census-report-card-${i}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <Badge variant="outline" className="text-xs">{census.geographyLevel}</Badge>
                          <span className="font-semibold text-sm text-slate-800">{census.geographyValue}</span>
                          {census.isApproximate && (
                            <span title={census.approximateNote}>
                              <Info className="w-3.5 h-3.5 text-amber-500" />
                            </span>
                          )}
                        </div>

                        {census.totalPopulation ? (
                          <div className="space-y-3">
                            <div>
                              <div className="flex items-center justify-between gap-2 text-sm mb-1">
                                <span className="text-muted-foreground">Census Population</span>
                                <span className="font-bold text-slate-900">{census.totalPopulation.toLocaleString()}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2 text-sm mb-1">
                                <span className="text-muted-foreground">Program Impact</span>
                                <span className="font-bold text-primary">{impactTotal.toLocaleString()}</span>
                              </div>
                              {reachPercent !== null && (
                                <div className="mt-2">
                                  <div className="flex items-center justify-between gap-2 text-sm mb-1">
                                    <span className="text-muted-foreground">Population Reached</span>
                                    <span className="font-bold text-emerald-600">{reachPercent}%</span>
                                  </div>
                                  <div className="w-full bg-slate-100 rounded-full h-2">
                                    <div
                                      className="bg-primary rounded-full h-2 transition-all"
                                      style={{ width: `${Math.min(reachPercent, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="pt-2 border-t flex items-center justify-between gap-2 flex-wrap">
                              {census.povertyRate !== null && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">Poverty Rate</span>
                                  <div className="font-bold text-slate-700 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                                    {census.povertyRate}%
                                  </div>
                                </div>
                              )}
                              {census.medianIncome !== null && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground">Median Income</span>
                                  <div className="font-bold text-slate-700 flex items-center gap-1">
                                    <DollarSign className="w-3 h-3 text-emerald-500" />
                                    ${census.medianIncome.toLocaleString()}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Census data not available for this area</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Age Demographics */}
          {hasAgeTarget && ageGroupData && ageGroupData.length > 0 && (
            <div>
              <h2 className="text-lg font-heading font-semibold text-slate-900 mb-1 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Age Demographics
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Census age group data for target demographic: ages {selectedProgram?.targetAgeMin ?? 0}{selectedProgram?.targetAgeMax ? `\u2013${selectedProgram.targetAgeMax}` : "+"}
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ageGroupData.map((geo, i) => {
                  let impactTotal = 0;
                  filteredStats?.forEach(s => {
                    if (s.geographyLevel !== geo.geographyLevel) return;
                    const canonical = geo.geographyLevel === "City"
                      ? (CITY_CANONICAL_MAP[s.geographyValue.toLowerCase()] ?? s.geographyValue)
                      : s.geographyValue;
                    if (canonical === geo.geographyValue) {
                      participantMetricNames.forEach(name => { impactTotal += Number(s.metrics[name] || 0); });
                    }
                  });
                  const targetPop = geo.targetAgePopulation;
                  const ageReachPercent = targetPop && impactTotal > 0
                    ? Math.round((impactTotal / targetPop) * 10000) / 100
                    : null;

                  const minAge = selectedProgram?.targetAgeMin ?? 0;
                  const maxAge = selectedProgram?.targetAgeMax ?? 120;
                  const relevantGroups = geo.ageGroups.filter(
                    ag => ag.maxAge >= minAge && ag.minAge <= maxAge
                  );

                  return (
                    <Card key={`age-${i}`} data-testid={`age-census-card-${i}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <Badge variant="outline" className="text-xs">{geo.geographyLevel}</Badge>
                          <span className="font-semibold text-sm text-slate-800">{geo.geographyValue}</span>
                          {geo.isApproximate && (
                            <span title="Approximate data based on LA County estimates">
                              <Info className="w-3.5 h-3.5 text-amber-500" />
                            </span>
                          )}
                        </div>

                        {targetPop ? (
                          <div className="space-y-3">
                            <div>
                              <div className="flex items-center justify-between gap-2 text-sm mb-1">
                                <span className="text-muted-foreground">Target Age Population</span>
                                <span className="font-bold text-slate-900">{targetPop.toLocaleString()}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2 text-sm mb-1">
                                <span className="text-muted-foreground">Program Impact</span>
                                <span className="font-bold text-primary">{impactTotal.toLocaleString()}</span>
                              </div>
                              {ageReachPercent !== null && (
                                <div className="mt-2">
                                  <div className="flex items-center justify-between gap-2 text-sm mb-1">
                                    <span className="text-muted-foreground">Target Age Reached</span>
                                    <span className="font-bold text-emerald-600">{ageReachPercent}%</span>
                                  </div>
                                  <div className="w-full bg-slate-100 rounded-full h-2">
                                    <div
                                      className="bg-emerald-500 rounded-full h-2 transition-all"
                                      style={{ width: `${Math.min(ageReachPercent, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="pt-2 border-t">
                              <p className="text-xs text-muted-foreground mb-2">Age Breakdown (target range)</p>
                              <div className="space-y-1.5">
                                {relevantGroups.map(ag => {
                                  const pct = targetPop > 0 ? Math.round((ag.population / targetPop) * 100) : 0;
                                  return (
                                    <div key={ag.label} className="flex items-center gap-2 text-xs">
                                      <span className="w-14 text-muted-foreground shrink-0">{ag.label}</span>
                                      <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                                        <div
                                          className="bg-primary/70 rounded-full h-1.5 transition-all"
                                          style={{ width: `${Math.min(pct, 100)}%` }}
                                        />
                                      </div>
                                      <span className="w-16 text-right text-slate-600 shrink-0">{ag.population.toLocaleString()}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Age group data not available for this area</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : activeTab === "data" ? (
        /* Raw Data Tab */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Table2 className="w-5 h-5" />
              Impact Data Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left font-medium text-muted-foreground p-3">Date</th>
                    <th className="text-left font-medium text-muted-foreground p-3">Level</th>
                    <th className="text-left font-medium text-muted-foreground p-3">Location</th>
                    <th className="text-left font-medium text-muted-foreground p-3">ZIP</th>
                    {selectedProgram?.metrics.map(m => (
                      <th key={m.id} className="text-right font-medium text-muted-foreground p-3">{m.name}</th>
                    ))}
                    <th className="text-left font-medium text-muted-foreground p-3">Demographics</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    type EntryRow  = { kind: "entry";  entry: NonNullable<typeof entries>[number] };
                    type SurveyRow = { kind: "survey"; checkIn: typeof surveyCheckIns[number] };
                    const merged: (EntryRow | SurveyRow)[] = [
                      ...(entries || []).map(e  => ({ kind: "entry"  as const, entry: e })),
                      ...surveyCheckIns.map(ci  => ({ kind: "survey" as const, checkIn: ci })),
                    ];
                    merged.sort((a, b) => {
                      const da = a.kind === "entry" ? a.entry.date : a.checkIn.date;
                      const db = b.kind === "entry" ? b.entry.date : b.checkIn.date;
                      return db.localeCompare(da);
                    });
                    if (merged.length === 0) return (
                      <tr><td colSpan={99} className="p-8 text-center text-muted-foreground">No data recorded yet</td></tr>
                    );
                    return merged.map((row, idx) => {
                      if (row.kind === "survey") {
                        const ci = row.checkIn;
                        return (
                          <tr key={`survey-${idx}`} className="border-b last:border-0 bg-teal-50/40">
                            <td className="p-3">{format(new Date(ci.date + 'T00:00:00'), 'MMM d, yyyy')}</td>
                            <td className="p-3">
                              <Badge className="bg-teal-100 text-teal-700 border-teal-200 font-normal text-xs">Survey</Badge>
                            </td>
                            <td className="p-3 font-medium text-slate-700">Kiosk Check-in</td>
                            <td className="p-3 text-muted-foreground">-</td>
                            {selectedProgram?.metrics.map(m => (
                              <td key={m.id} className="p-3 text-right font-medium">{(ci.metricValues[m.name] || 0).toLocaleString()}</td>
                            ))}
                            <td className="p-3 text-muted-foreground text-xs max-w-[200px] truncate">{ci.demographics}</td>
                          </tr>
                        );
                      }
                      const entry = row.entry;
                      const mv = entry.metricValues as Record<string, number>;
                      return (
                        <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="p-3">{format(new Date(entry.date + 'T00:00:00'), 'MMM d, yyyy')}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-xs">{entry.geographyLevel}</Badge>
                          </td>
                          <td className="p-3 font-medium">{entry.geographyValue}</td>
                          <td className="p-3 text-muted-foreground">{entry.zipCode || "-"}</td>
                          {selectedProgram?.metrics.map(m => (
                            <td key={m.id} className="p-3 text-right font-medium">{(mv[m.name] || 0).toLocaleString()}</td>
                          ))}
                          <td className="p-3 text-muted-foreground text-xs max-w-[200px] truncate">{entry.demographics || "-"}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : activeTab === "report" ? (
        <div className="space-y-6">
          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-slate-600 px-3 py-1.5 rounded-md border border-slate-200 bg-slate-50">
              General
            </span>
            <Button onClick={handleGenerateReport} disabled={aiReportGenerating || !pdfReady} data-testid="button-generate-report">
              {aiReportGenerating
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Sparkles className="w-4 h-4 mr-2" />}
              {aiReportGenerating ? "Generating…" : "Generate Report"}
            </Button>
          </div>

          {/* Charts — always visible */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card data-testid="report-chart-participation">
              <CardHeader>
                <CardTitle className="font-heading text-lg">Participants by Month</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                {participantsByMonth.some(m => m.count > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={participantsByMonth} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorCountReport" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Area type="monotone" dataKey="count" name={primaryMetric || "Participants"} stroke="#0d9488" strokeWidth={2} fillOpacity={1} fill="url(#colorCountReport)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">No monthly data available</div>
                )}
              </CardContent>
            </Card>

            {goalData && goalData.goalTarget !== null ? (
              <Card data-testid="report-chart-goal">
                <CardHeader>
                  <CardTitle className="font-heading text-lg flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Goal vs. Actual
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[{ name: selectedProgram?.name || "Program", goal: goalData.goalTarget, actual: goalData.actual }]}
                      margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Legend />
                      <Bar dataKey="goal" name="Goal" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="actual" name="Actual" fill="#0d9488" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : (
              <Card data-testid="report-chart-populations">
                <CardHeader>
                  <CardTitle className="font-heading text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Program Target &amp; Populations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {totalCensusPop > 0 && (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Census Population</span>
                        <span className="font-bold text-slate-900">{totalCensusPop.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Total Impact</span>
                        <span className="font-bold text-primary">{totalImpact.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Population Reached</span>
                        <span className="font-bold text-emerald-600">
                          {totalImpact > 0 ? `${(Math.round((totalImpact / totalCensusPop) * 10000) / 100)}%` : "0%"}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 mt-2">
                        <div className="bg-primary rounded-full h-2.5 transition-all"
                          style={{ width: `${Math.min(totalImpact > 0 ? (totalImpact / totalCensusPop) * 100 : 0, 100)}%` }} />
                      </div>
                    </div>
                  )}
                  {!totalCensusPop && <p className="text-sm text-muted-foreground italic">No population data available</p>}
                </CardContent>
              </Card>
            )}
          </div>

          {/* AI Narrative — shown after generation */}
          {!aiReport && !aiReportGenerating && (
            <div className="h-[120px] flex flex-col items-center justify-center bg-muted/50 rounded-2xl border border-dashed gap-2 text-muted-foreground">
              <Sparkles className="w-6 h-6 opacity-30" />
              <p className="text-sm">Select an audience and click Generate Report to add AI narrative below the charts.</p>
            </div>
          )}

          {aiReportGenerating && (
            <div className="h-[120px] flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <p className="text-sm">Generating narrative…</p>
            </div>
          )}

          {aiReport && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pt-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h2 className="text-lg font-heading font-semibold text-slate-900">
                  AI Narrative — {PERSONA_LABELS[aiReportPersona]}
                </h2>
              </div>

              <Card data-testid="report-executive-summary">
                <CardHeader><CardTitle className="font-heading text-lg">Executive Summary</CardTitle></CardHeader>
                <CardContent><p className="text-sm leading-relaxed text-slate-700">{aiReport.executiveSummary}</p></CardContent>
              </Card>

              <Card data-testid="report-outcomes-impact">
                <CardHeader>
                  <CardTitle className="font-heading text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />Outcomes &amp; Impact
                  </CardTitle>
                </CardHeader>
                <CardContent><p className="text-sm leading-relaxed text-slate-700">{aiReport.outcomesImpact}</p></CardContent>
              </Card>

              <Card data-testid="report-community-need">
                <CardHeader>
                  <CardTitle className="font-heading text-lg flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />Community Need
                  </CardTitle>
                </CardHeader>
                <CardContent><p className="text-sm leading-relaxed text-slate-700">{aiReport.communityNeed}</p></CardContent>
              </Card>

              <Card data-testid="report-program-design">
                <CardHeader>
                  <CardTitle className="font-heading text-lg flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-primary" />Program Design
                  </CardTitle>
                </CardHeader>
                <CardContent><p className="text-sm leading-relaxed text-slate-700">{aiReport.programDesign}</p></CardContent>
              </Card>

              <Card data-testid="report-lessons-learned">
                <CardHeader><CardTitle className="font-heading text-lg">Lessons Learned</CardTitle></CardHeader>
                <CardContent><p className="text-sm leading-relaxed text-slate-700">{aiReport.lessonsLearned}</p></CardContent>
              </Card>

              <Card className="border-primary/30 bg-primary/5" data-testid="report-call-to-action">
                <CardHeader><CardTitle className="font-heading text-lg text-primary">Call to Action</CardTitle></CardHeader>
                <CardContent><p className="text-sm leading-relaxed text-slate-700">{aiReport.callToAction}</p></CardContent>
              </Card>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

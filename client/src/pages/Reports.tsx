import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, Area, AreaChart } from "recharts";
import { useOrganizations } from "@/hooks/use-organizations";
import { usePrograms } from "@/hooks/use-programs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useMemo, useRef } from "react";
import { useImpactStats, useImpactEntries } from "@/hooks/use-impact";
import { useCensusBatch, useCensusAgeGroups } from "@/hooks/use-census";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, FileBarChart, FileText, Table2, TrendingUp, DollarSign, AlertTriangle, Info, Users, MapPin, Target, Calendar, ClipboardList, Loader2 } from "lucide-react";
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

export default function Reports() {
  const { toast } = useToast();
  const { data: orgs } = useOrganizations();
  const orgId = orgs?.[0]?.id;
  const { data: programs } = usePrograms(orgId);
  const { data: serviceAreaList = [] } = useServiceAreas(orgId);
  
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"charts" | "data">("charts");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  
  useEffect(() => {
    if (programs && programs.length > 0 && !selectedProgramId) {
      setSelectedProgramId(programs[0].id.toString());
    }
  }, [programs, selectedProgramId]);

  const programId = parseInt(selectedProgramId);
  const { data: stats, isLoading: statsLoading } = useImpactStats(programId);
  const { data: allEntries } = useImpactEntries(programId);
  const selectedProgram = programs?.find(p => p.id === programId);

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

  const filteredStats = useMemo(() => {
    if (selectedYear === "all") return stats;
    if (!entries || entries.length === 0) return [];
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
        // No zip resolution — count only at the manually selected level
        addToAgg(entry.geographyLevel, entry.geographyValue, mv);
      }
    });
    return Object.values(aggregation);
  }, [stats, entries, selectedYear]);

  const participantMetricNames = useMemo(() => {
    if (!selectedProgram) return new Set<string>();
    const participant = selectedProgram.metrics.filter((m: any) => m.countsAsParticipant !== false);
    if (participant.length > 0) return new Set(participant.map((m: any) => m.name));
    return selectedProgram.metrics.length > 0 ? new Set([selectedProgram.metrics[0].name]) : new Set<string>();
  }, [selectedProgram]);

  const primaryMetric = selectedProgram?.metrics.find((m: any) => m.countsAsParticipant !== false)?.name || selectedProgram?.metrics[0]?.name || "";

  const geoList = useMemo(() => {
    if (!filteredStats) return [];
    const unique = new Map<string, { level: string; value: string }>();
    filteredStats.forEach(s => unique.set(`${s.geographyLevel}:${s.geographyValue}`, { level: s.geographyLevel, value: s.geographyValue }));
    return Array.from(unique.values());
  }, [filteredStats]);

  const { data: censusData } = useCensusBatch(geoList);

  const hasAgeTarget = !!(selectedProgram?.targetAgeMin != null || selectedProgram?.targetAgeMax != null);
  const { data: ageGroupData } = useCensusAgeGroups(
    geoList,
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
    if (!entries || participantMetricNames.size === 0) return [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthCounts: Record<number, number> = {};
    entries.forEach(entry => {
      const month = new Date(entry.date + "T00:00:00").getMonth();
      const mv = entry.metricValues as Record<string, number>;
      let total = 0;
      participantMetricNames.forEach(name => { total += Number(mv[name] || 0); });
      monthCounts[month] = (monthCounts[month] || 0) + total;
    });
    return monthNames.map((name, i) => ({ month: name, count: monthCounts[i] || 0 }));
  }, [entries, participantMetricNames]);

  const goalData = useMemo(() => {
    if (!selectedProgram || !entries || participantMetricNames.size === 0) return null;
    let goalTarget: number | null = null;
    if (selectedProgram.goals) {
      const match = selectedProgram.goals.match(/(\d[\d,]*)/);
      if (match) goalTarget = parseInt(match[1].replace(/,/g, ''), 10);
    }
    const actual = entries.reduce((sum, entry) => {
      const mv = entry.metricValues as Record<string, number>;
      let total = 0;
      participantMetricNames.forEach(name => { total += Number(mv[name] || 0); });
      return sum + total;
    }, 0);
    return { goalTarget, actual, goals: selectedProgram.goals };
  }, [selectedProgram, entries, participantMetricNames]);

  const totalCensusPop = useMemo(() => {
    if (!censusData) return 0;
    return censusData.reduce((sum, c) => sum + (c.totalPopulation || 0), 0);
  }, [censusData]);

  const totalAgePop = useMemo(() => {
    if (!ageGroupData) return 0;
    return ageGroupData.reduce((sum, g) => sum + (g.targetAgePopulation || 0), 0);
  }, [ageGroupData]);

  const totalImpact = useMemo(() => {
    if (!entries || participantMetricNames.size === 0) return 0;
    return entries.reduce((sum, entry) => {
      const mv = entry.metricValues as Record<string, number>;
      let total = 0;
      participantMetricNames.forEach(name => { total += Number(mv[name] || 0); });
      return sum + total;
    }, 0);
  }, [entries, participantMetricNames]);

  const handleCsvDownload = () => {
    window.open(`${api.impact.exportCsv.path}?programId=${programId}`, "_blank");
  };

  const pdfReady = !!(selectedProgram && orgs?.[0] && filteredStats && entries && !statsLoading);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const handlePdfDownload = async () => {
    if (!selectedProgram || !orgs?.[0] || !filteredStats || !entries) {
      toast({ title: "Not Ready", description: "Please wait for data to finish loading before downloading.", variant: "destructive" });
      return;
    }
    setPdfGenerating(true);
    let aiNarrative = undefined;
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
      const geoSummary = (filteredStats || []).map((s: any) => `${s.geographyValue} (${s.geographyLevel})`).slice(0, 10).join(", ");
      const res = await apiRequest("POST", "/api/report/ai-narrative", {
        programName: selectedProgram.name,
        programDescription: selectedProgram.description || "",
        programType: selectedProgram.type || "",
        orgName: orgs[0].name,
        orgMission: (orgs[0] as any).mission || "",
        orgVision: (orgs[0] as any).vision || "",
        targetPopulation: selectedProgram.targetPopulation || "",
        goals: selectedProgram.goals || "",
        totalParticipants: totalPrimary,
        primaryMetricName: participantLabel,
        geographies: geoSummary,
        program: selectedProgram,
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
      });
      toast({ title: "PDF Generated", description: aiNarrative ? "Impact Study PDF with AI narrative has been downloaded." : "Impact Study PDF has been downloaded." });
    } catch (err) {
      toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" });
    }
    setPdfGenerating(false);
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
              <Button variant="outline" onClick={handlePdfDownload} disabled={!pdfReady || pdfGenerating} data-testid="button-download-pdf">
                {pdfGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                {pdfGenerating ? "Generating AI Report..." : "Impact Study PDF"}
              </Button>
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
          {/* Summary Row */}
          {filteredStats && filteredStats.length > 0 && (
            <div className="grid sm:grid-cols-4 gap-4">
              {["SPA", "City", "County", "State"].map(level => {
                const levelStats = filteredStats.filter(s => s.geographyLevel === level);
                const total = levelStats.reduce((sum, s) => {
                  let t = 0;
                  participantMetricNames.forEach(name => { t += Number(s.metrics[name] || 0); });
                  return sum + t;
                }, 0);
                const levelCensus = censusData?.filter(c => c.geographyLevel === level) || [];
                const levelPop = levelCensus.reduce((sum, c) => sum + (c.totalPopulation || 0), 0);
                const reachPct = levelPop > 0 && total > 0
                  ? Math.round((total / levelPop) * 10000) / 100
                  : null;
                return (
                  <Card key={level} data-testid={`geo-card-${level.toLowerCase()}`}>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground font-medium uppercase">{level}</p>
                      <p className="text-2xl font-heading font-bold text-slate-900 mt-1">{total.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Participants</p>
                      {levelPop > 0 && (
                        <div className="mt-2 pt-2 border-t space-y-1">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-muted-foreground">Population</span>
                            <span className="font-semibold text-slate-700">{levelPop.toLocaleString()}</span>
                          </div>
                          {reachPct !== null && (
                            <div>
                              <div className="flex items-center justify-between gap-2 text-xs mb-1">
                                <span className="text-muted-foreground">Reach</span>
                                <span className="font-semibold text-emerald-600">{reachPct}%</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-1.5">
                                <div
                                  className="bg-primary rounded-full h-1.5 transition-all"
                                  style={{ width: `${Math.min(reachPct, 100)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

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
                  const matchingStat = filteredStats?.find(
                    s => s.geographyLevel === census.geographyLevel && s.geographyValue === census.geographyValue
                  );
                  let impactTotal = 0;
                  if (matchingStat) {
                    participantMetricNames.forEach(name => { impactTotal += Number(matchingStat.metrics[name] || 0); });
                  }
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
                  const matchingStat = filteredStats?.find(
                    s => s.geographyLevel === geo.geographyLevel && s.geographyValue === geo.geographyValue
                  );
                  let impactTotal = 0;
                  if (matchingStat) {
                    participantMetricNames.forEach(name => { impactTotal += Number(matchingStat.metrics[name] || 0); });
                  }
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
                  {entries?.map((entry) => {
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
                  })}
                  {(!entries || entries.length === 0) && (
                    <tr>
                      <td colSpan={99} className="p-8 text-center text-muted-foreground">No data recorded yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

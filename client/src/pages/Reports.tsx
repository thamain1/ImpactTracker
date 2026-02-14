import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { useOrganizations } from "@/hooks/use-organizations";
import { usePrograms } from "@/hooks/use-programs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useMemo } from "react";
import { useImpactStats, useImpactEntries } from "@/hooks/use-impact";
import { useCensusBatch, useCensusAgeGroups } from "@/hooks/use-census";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, FileBarChart, Table2, TrendingUp, DollarSign, AlertTriangle, Info, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { api } from "@shared/routes";

const COLORS = ["#0d9488", "#f97316", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#ef4444"];

export default function Reports() {
  const { data: orgs } = useOrganizations();
  const orgId = orgs?.[0]?.id;
  const { data: programs } = usePrograms(orgId);
  
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"charts" | "data" | "census" | "demographics">("charts");
  
  useEffect(() => {
    if (programs && programs.length > 0 && !selectedProgramId) {
      setSelectedProgramId(programs[0].id.toString());
    }
  }, [programs, selectedProgramId]);

  const programId = parseInt(selectedProgramId);
  const { data: stats, isLoading: statsLoading } = useImpactStats(programId);
  const { data: entries } = useImpactEntries(programId);
  const selectedProgram = programs?.find(p => p.id === programId);

  const primaryMetric = selectedProgram?.metrics[0]?.name || "";

  const geoList = useMemo(() => {
    if (!stats) return [];
    const unique = new Map<string, { level: string; value: string }>();
    stats.forEach(s => unique.set(`${s.geographyLevel}:${s.geographyValue}`, { level: s.geographyLevel, value: s.geographyValue }));
    return Array.from(unique.values());
  }, [stats]);

  const { data: censusData } = useCensusBatch(geoList);

  const hasAgeTarget = !!(selectedProgram?.targetAgeMin != null || selectedProgram?.targetAgeMax != null);
  const { data: ageGroupData } = useCensusAgeGroups(
    geoList,
    selectedProgram?.targetAgeMin,
    selectedProgram?.targetAgeMax,
  );

  const geoLevelData = stats?.reduce((acc, curr) => {
    const existing = acc.find(item => item.name === curr.geographyLevel);
    if (existing) {
      existing.value += (curr.metrics[primaryMetric] || 0);
    } else {
      acc.push({ name: curr.geographyLevel, value: curr.metrics[primaryMetric] || 0 });
    }
    return acc;
  }, [] as any[]) || [];

  const topLocationsData = stats?.map(item => ({
    name: item.geographyValue,
    value: item.metrics[primaryMetric] || 0
  })).sort((a, b) => b.value - a.value).slice(0, 10) || [];

  const handleCsvDownload = () => {
    window.open(`${api.impact.exportCsv.path}?programId=${programId}`, "_blank");
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-slate-900" data-testid="text-reports-title">Reports</h1>
          <p className="text-muted-foreground mt-1">Visualize and export your impact data.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
            <SelectTrigger className="w-[240px]" data-testid="select-report-program">
              <SelectValue placeholder="Select Program" />
            </SelectTrigger>
            <SelectContent>
              {programs?.map(p => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedProgramId && (
            <Button variant="outline" onClick={handleCsvDownload} data-testid="button-download-csv">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
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
            variant={activeTab === "census" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("census")}
            data-testid="tab-census"
          >
            <TrendingUp className="w-4 h-4 mr-2" /> Census Comparison
          </Button>
          {hasAgeTarget && (
            <Button
              variant={activeTab === "demographics" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("demographics")}
              data-testid="tab-demographics"
            >
              <Users className="w-4 h-4 mr-2" /> Age Demographics
            </Button>
          )}
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
          {stats && stats.length > 0 && (
            <div className="grid sm:grid-cols-4 gap-4">
              {["SPA", "City", "County", "State"].map(level => {
                const levelStats = stats.filter(s => s.geographyLevel === level);
                const total = levelStats.reduce((sum, s) => sum + (s.metrics[primaryMetric] || 0), 0);
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
                      <p className="text-xs text-muted-foreground">{primaryMetric}</p>
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

          <div className="grid md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="font-heading">Distribution by Level ({primaryMetric})</CardTitle>
              </CardHeader>
              <CardContent className="h-[350px]">
                {geoLevelData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={geoLevelData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                        {geoLevelData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">No data available</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-heading">Top Locations ({primaryMetric})</CardTitle>
              </CardHeader>
              <CardContent className="h-[350px]">
                {topLocationsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={topLocationsData} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis dataKey="name" type="category" width={80} stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="value" fill="#0d9488" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">No data available</div>
                )}
              </CardContent>
            </Card>
          </div>
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
                        <td className="p-3">{format(new Date(entry.date), 'MMM d, yyyy')}</td>
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
      ) : activeTab === "census" ? (
        /* Census Comparison Tab */
        <div>
          <p className="text-sm text-muted-foreground mb-4">
            How this program's impact compares to census population data{censusData?.[0]?.dataYear ? ` (${censusData[0].dataYear} ACS)` : ""} across all geographic levels
          </p>

          {censusData && censusData.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...censusData]
                .sort((a, b) => {
                  const order = ["SPA", "City", "County", "State"];
                  return order.indexOf(a.geographyLevel) - order.indexOf(b.geographyLevel);
                })
                .map((census, i) => {
                const matchingStat = stats?.find(
                  s => s.geographyLevel === census.geographyLevel && s.geographyValue === census.geographyValue
                );
                const impactTotal = matchingStat
                  ? Object.values(matchingStat.metrics).reduce((sum, v) => sum + v, 0)
                  : 0;
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
          ) : (
            <div className="h-[300px] flex items-center justify-center bg-muted/50 rounded-2xl border border-dashed text-muted-foreground">
              No census comparison data available for this program's geographies
            </div>
          )}
        </div>
      ) : activeTab === "demographics" ? (
        /* Age Demographics Tab */
        <div>
          <p className="text-sm text-muted-foreground mb-4">
            Census age group data for target demographic: ages {selectedProgram?.targetAgeMin ?? 0}{selectedProgram?.targetAgeMax ? `\u2013${selectedProgram.targetAgeMax}` : "+"}
          </p>

          {ageGroupData && ageGroupData.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ageGroupData.map((geo, i) => {
                const matchingStat = stats?.find(
                  s => s.geographyLevel === geo.geographyLevel && s.geographyValue === geo.geographyValue
                );
                const impactTotal = matchingStat
                  ? Object.values(matchingStat.metrics).reduce((sum, v) => sum + v, 0)
                  : 0;
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
          ) : (
            <div className="h-[300px] flex items-center justify-center bg-muted/50 rounded-2xl border border-dashed text-muted-foreground">
              No age demographics data available for this program
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

import { useRoute } from "wouter";
import { useProgram } from "@/hooks/use-programs";
import { useImpactStats, useImpactEntries } from "@/hooks/use-impact";
import { useCensusBatch, useCensusAgeGroups, type CensusComparison } from "@/hooks/use-census";
import { AddImpactDialog } from "@/components/AddImpactDialog";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend
} from "recharts";
import { format } from "date-fns";
import { ArrowLeft, MapPin, Download, TrendingUp, DollarSign, AlertTriangle, Info, Pencil, Users } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { api } from "@shared/routes";

const COLORS = ["#0d9488", "#f97316", "#3b82f6", "#8b5cf6", "#ec4899"];

export default function ProgramDetails() {
  const [, params] = useRoute("/programs/:id");
  const programId = parseInt(params?.id || "0");

  const { data: program, isLoading: progLoading } = useProgram(programId);
  const { data: stats, isLoading: statsLoading } = useImpactStats(programId);
  const { data: entries, isLoading: entriesLoading } = useImpactEntries(programId);

  const geoList = useMemo(() => {
    if (!stats) return [];
    const unique = new Map<string, { level: string; value: string }>();
    stats.forEach(s => unique.set(`${s.geographyLevel}:${s.geographyValue}`, { level: s.geographyLevel, value: s.geographyValue }));
    return Array.from(unique.values());
  }, [stats]);

  const { data: censusData } = useCensusBatch(geoList);

  const hasAgeTarget = !!(program?.targetAgeMin != null || program?.targetAgeMax != null);
  const { data: ageGroupData } = useCensusAgeGroups(
    geoList,
    program?.targetAgeMin,
    program?.targetAgeMax,
  );

  if (progLoading || statsLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid md:grid-cols-3 gap-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!program) return <div>Program not found</div>;

  // Aggregate totals for the top cards
  const totalMetrics: Record<string, number> = {};
  program.metrics.forEach(m => totalMetrics[m.name] = 0);

  stats?.forEach(stat => {
    Object.entries(stat.metrics).forEach(([key, val]) => {
      if (totalMetrics[key] !== undefined) {
        totalMetrics[key] += val;
      }
    });
  });

  // Prepare chart data - Aggregate by geography for the first metric
  const primaryMetric = program.metrics[0]?.name;
  const chartData = stats?.reduce((acc, curr) => {
    const existing = acc.find(item => item.name === curr.geographyValue);
    if (existing) {
      existing.value += (curr.metrics[primaryMetric] || 0);
    } else {
      acc.push({ 
        name: curr.geographyValue, 
        value: curr.metrics[primaryMetric] || 0,
        level: curr.geographyLevel
      });
    }
    return acc;
  }, [] as any[]) || [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <Link href="/programs" className="inline-flex items-center text-sm text-slate-500 hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Programs
        </Link>
        
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-heading font-bold text-slate-900 mb-2">{program.name}</h1>
            <p className="text-lg text-slate-600 max-w-3xl">{program.description}</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Link href={`/programs/${programId}/edit`}>
              <Button variant="outline" data-testid="button-edit-program">
                <Pencil className="w-4 h-4 mr-2" />
                Edit Program
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => window.open(`${api.impact.exportCsv.path}?programId=${programId}`, "_blank")}
              data-testid="button-export-csv"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <AddImpactDialog program={program} />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {program.metrics.map((metric, i) => (
          <Card key={metric.id} className="border-slate-200 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <BarChart className="w-16 h-16 text-primary" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                Total {metric.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-heading text-slate-900">
                {(totalMetrics[metric.name] || 0).toLocaleString()}
              </div>
              <div className="text-sm text-slate-400 mt-1 font-medium">{metric.unit}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Chart Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading text-lg">Impact by Geography ({primaryMetric})</CardTitle>
            </CardHeader>
            <CardContent className="h-[350px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400">
                  No data to visualize yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Entries Table */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading text-lg">Recent Entries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left font-medium text-slate-500 pb-3 pl-2">Date</th>
                      <th className="text-left font-medium text-slate-500 pb-3">Location</th>
                      <th className="text-right font-medium text-slate-500 pb-3 pr-2">Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries?.slice(0, 5).map((entry) => (
                      <tr key={entry.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 pl-2 text-slate-600">
                          {format(new Date(entry.date), 'MMM d, yyyy')}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-slate-50 font-normal text-xs text-slate-500 border-slate-200">
                              {entry.geographyLevel}
                            </Badge>
                            <span className="font-medium text-slate-700">{entry.geographyValue}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-2 text-right">
                          <div className="flex flex-col items-end gap-1">
                            {Object.entries(entry.metricValues as Record<string, number>).slice(0, 2).map(([key, val]) => (
                              <span key={key} className="text-xs text-slate-600">
                                <span className="font-bold text-slate-900">{val.toLocaleString()}</span> {key}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!entries?.length && (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-slate-400">
                          No recent entries found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info Sidebar */}
        <div className="space-y-6">
          <Card className="bg-primary text-primary-foreground border-none shadow-lg shadow-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Program Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-sm opacity-80 mb-1">Last Updated</div>
                  <div className="font-bold text-xl">
                    {entries?.[0] ? format(new Date(entries[0].createdAt!), 'MMM d, yyyy') : 'Never'}
                  </div>
                </div>
                <div>
                  <div className="text-sm opacity-80 mb-1">Total Reports</div>
                  <div className="font-bold text-xl">{entries?.length || 0}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Metrics Definitions</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {program.metrics.map(m => (
                  <li key={m.id} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                    <span className="font-medium text-slate-700">{m.name}</span>
                    <span className="text-slate-400 bg-slate-50 px-2 py-0.5 rounded text-xs">{m.unit}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Census Comparison Section */}
      {censusData && censusData.length > 0 && (
        <div>
          <h2 className="text-xl font-heading font-bold text-slate-900 mb-2 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> Census Comparison
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            How this program's impact compares to census population data ({censusData[0]?.dataYear} ACS)
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {censusData.map((census, i) => {
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
                <Card key={`census-${i}`} data-testid={`census-program-card-${i}`}>
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

      {/* Age Demographics Census Section */}
      {hasAgeTarget && ageGroupData && ageGroupData.length > 0 && (
        <div>
          <h2 className="text-xl font-heading font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Age Demographics
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Census age group data for target demographic: ages {program.targetAgeMin ?? 0}{program.targetAgeMax ? `\u2013${program.targetAgeMax}` : "+"}
          </p>

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

              const minAge = program.targetAgeMin ?? 0;
              const maxAge = program.targetAgeMax ?? 120;
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
    </div>
  );
}

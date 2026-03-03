import { useRoute } from "wouter";
import { useProgram } from "@/hooks/use-programs";
import { useImpactStats, useImpactEntries } from "@/hooks/use-impact";
import { useSurveyResponses } from "@/hooks/use-survey";
import { AddImpactDialog } from "@/components/AddImpactDialog";
import { EditImpactDialog } from "@/components/EditImpactDialog";
import { ImportCsvDialog } from "@/components/ImportCsvDialog";
import { EditSurveyResponseDialog } from "@/components/EditSurveyResponseDialog";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from "react";
import type { ImpactEntry } from "@shared/schema";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from "recharts";
import { format } from "date-fns";
import { ArrowLeft, MapPin, Download, Pencil, Calendar, BarChart, Truck, Users, DollarSign, Activity, ClipboardList, QrCode } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import QRCode from "react-qr-code";
import { api } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useOrganizations } from "@/hooks/use-organizations";
import { usePrograms } from "@/hooks/use-programs";

export default function ProgramDetails() {
  const [, params] = useRoute("/programs/:id");
  const programId = parseInt(params?.id || "0");
  const [editingEntry, setEditingEntry] = useState<ImpactEntry | null>(null);
  const [editingSurveyResponse, setEditingSurveyResponse] = useState<any | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>("all");

  const { user } = useAuth();
  const { data: orgs } = useOrganizations();
  const { data: program, isLoading: progLoading } = useProgram(programId);
  const orgId = (orgs?.[0] as any)?.id;
  const { data: orgPrograms } = usePrograms(orgId);
  // Program zip takes priority; fall back to org zip
  const effectiveZip = (program as any)?.zipCode || (orgs?.[0] as any)?.addressZip || undefined;
  const { data: stats, isLoading: statsLoading } = useImpactStats(programId);
  const { data: allEntries, isLoading: entriesLoading } = useImpactEntries(programId);
  // Poll every 10 s so the KPI cards and entries update in real time as survey responses come in
  const { data: surveyResponses } = useSurveyResponses(programId, { refetchInterval: 10000 });

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
    if (!program) return new Set<string>();
    const participant = program.metrics.filter((m: any) => m.countsAsParticipant !== false);
    if (participant.length > 0) return new Set(participant.map((m: any) => m.name));
    return program.metrics.length > 0 ? new Set([program.metrics[0].name]) : new Set<string>();
  }, [program]);

  // IDs of metrics that count as participants — used to filter survey rows so multi-metric
  // programs don't inflate the check-in count (one check-in creates one row per metric).
  const participantMetricIds = useMemo(() => {
    if (!program) return new Set<number>();
    const participant = program.metrics.filter((m: any) => m.countsAsParticipant !== false);
    if (participant.length > 0) return new Set(participant.map((m: any) => m.id as number));
    return program.metrics.length > 0 ? new Set([program.metrics[0].id as number]) : new Set<number>();
  }, [program]);

  const primaryMetric = program?.metrics.find((m: any) => m.countsAsParticipant !== false)?.name || program?.metrics[0]?.name;

  // Year-filtered survey responses (mirrors the year filter applied to entries)
  const yearFilteredSurveys = useMemo(() => {
    if (!surveyResponses) return [];
    if (selectedYear === "all") return surveyResponses;
    const yr = parseInt(selectedYear);
    return surveyResponses.filter((r: any) => new Date(r.createdAt + 'Z').getFullYear() === yr);
  }, [surveyResponses, selectedYear]);

  // Deduplicated view of survey responses for the table — a single kiosk check-in creates
  // one row per metric allocation (same createdAt), so we show only the first row per
  // (createdAt, respondentType) group to avoid confusing duplicate display rows.
  const dedupedSurveyResponses = useMemo(() => {
    if (!surveyResponses) return [];
    const seen = new Set<string>();
    return surveyResponses.filter((r: any) => {
      const key = `${r.createdAt}|${r.respondentType}|${r.email ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [surveyResponses]);

  const participantsByMonth = useMemo(() => {
    if (participantMetricNames.size === 0) return [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthCounts: Record<number, number> = {};
    // Manual impact entries
    (entries || []).forEach(entry => {
      const month = new Date(entry.date + "T00:00:00").getMonth();
      const mv = entry.metricValues as Record<string, number>;
      let total = 0;
      participantMetricNames.forEach(name => { total += Number(mv[name] || 0); });
      monthCounts[month] = (monthCounts[month] || 0) + total;
    });
    // Survey responses — each check-in counts as 1 participant regardless of quantity delivered.
    // Only count the countsAsParticipant metric row (metricId in participantMetricIds) to avoid
    // inflating the count when a single check-in creates multiple rows (one per metric).
    yearFilteredSurveys.forEach((r: any) => {
      if (r.respondentType !== "participant") return;
      if (r.metricId != null && !participantMetricIds.has(r.metricId)) return;
      const month = new Date(r.createdAt + 'Z').getMonth();
      monthCounts[month] = (monthCounts[month] || 0) + 1;
    });
    return monthNames.map((name, i) => ({ month: name, count: monthCounts[i] || 0 }));
  }, [entries, participantMetricNames, participantMetricIds, yearFilteredSurveys]);

  // Group survey responses by date for the Recent Entries table — sum quantity for participant
  // metrics only so multi-metric programs don't show inflated counts.
  const surveyEntriesByDate = useMemo(() => {
    const groups: Record<string, number> = {};
    yearFilteredSurveys.forEach((r: any) => {
      if (r.respondentType !== "participant") return;
      if (r.metricId != null && !participantMetricIds.has(r.metricId)) return;
      const date = new Date(r.createdAt + 'Z').toISOString().split("T")[0];
      groups[date] = (groups[date] || 0) + (r.quantityDelivered ?? 1);
    });
    return groups;
  }, [yearFilteredSurveys, participantMetricIds]);

  // Total participants served: 1 per kiosk check-in + manual entry participant metric values.
  // Count only rows for countsAsParticipant metrics to avoid double-counting when a single
  // check-in creates multiple survey_responses rows (one per metric allocation).
  const totalParticipants = useMemo(() => {
    const surveyCount = yearFilteredSurveys.filter((r: any) =>
      r.respondentType === "participant" &&
      (r.metricId == null || participantMetricIds.has(r.metricId))
    ).length;
    const manualCount = (entries || []).reduce((sum, entry) => {
      const mv = entry.metricValues as Record<string, number>;
      let total = 0;
      participantMetricNames.forEach(name => { total += Number(mv[name] || 0); });
      return sum + total;
    }, 0);
    return surveyCount + manualCount;
  }, [yearFilteredSurveys, entries, participantMetricNames, participantMetricIds]);

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

  // Aggregate totals for the top cards from raw entries (avoids double-counting rolled-up parent geos)
  const totalMetrics: Record<string, number> = {};
  program.metrics.forEach(m => totalMetrics[m.name] = 0);

  entries?.forEach(entry => {
    const mv = entry.metricValues as Record<string, number>;
    Object.entries(mv).forEach(([key, val]) => {
      if (totalMetrics[key] !== undefined) {
        totalMetrics[key] += Number(val);
      }
    });
  });

  // Add survey quantities to matching metric KPI cards
  // Route by metricId when present (new allocations), fall back to primary metric for legacy rows
  const primaryMetricName = program.metrics.find((m: any) => m.countsAsParticipant !== false)?.name ?? program.metrics[0]?.name;
  program.metrics.forEach((m: any) => {
    const metricSurveyQty = yearFilteredSurveys
      .filter((r: any) => r.respondentType === "participant" && r.metricId === m.id)
      .reduce((sum: number, r: any) => sum + (r.quantityDelivered ?? 1), 0);
    if (totalMetrics[m.name] !== undefined) {
      totalMetrics[m.name] += metricSurveyQty;
    }
  });
  // Legacy rows with no metricId: add 1 per response to the primary metric
  const unlinkedCount = yearFilteredSurveys
    .filter((r: any) => r.respondentType === "participant" && !r.metricId).length;
  if (primaryMetricName && totalMetrics[primaryMetricName] !== undefined) {
    totalMetrics[primaryMetricName] += unlinkedCount;
  }

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
          <div className="flex gap-3 flex-wrap items-center">
            {availableYears.length > 0 && (
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[140px]" data-testid="select-year-filter">
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
            <Button
              variant="outline"
              onClick={() => window.open(`/survey/${programId}`, "_blank")}
            >
              <ClipboardList className="w-4 h-4 mr-2" />
              Launch Survey
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <QrCode className="w-4 h-4 mr-2" />
                  Survey QR
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4 text-center" align="end">
                <div id="survey-qr-printable">
                  <QRCode value={`${window.location.origin}/survey/${programId}`} size={180} />
                  <p className="text-xs mt-2 text-muted-foreground break-all">
                    {window.location.origin}/survey/{programId}
                  </p>
                  <p className="font-medium text-sm mt-1">{program.name}</p>
                </div>
                <Button
                  variant="outline" size="sm" className="mt-3 w-full"
                  onClick={() => {
                    const el = document.getElementById("survey-qr-printable");
                    const w = window.open("", "_blank");
                    w?.document.write(`<html><body style="text-align:center;font-family:sans-serif;padding:40px">${el?.innerHTML ?? ""}</body></html>`);
                    w?.document.close();
                    w?.print();
                  }}
                >
                  Print QR Code
                </Button>
              </PopoverContent>
            </Popover>
            <Link href={`/programs/${programId}/edit`}>
              <Button variant="outline" data-testid="button-edit-program">
                <Pencil className="w-4 h-4 mr-2" />
                Edit Program
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={async () => {
                const res = await apiRequest("GET", `${api.impact.exportCsv.path}?programId=${programId}`);
                if (!res.ok) return;
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `impact_report_${programId}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              data-testid="button-export-csv"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <ImportCsvDialog program={program} orgZip={effectiveZip} />
            <AddImpactDialog program={program} lastGeographyLevel={allEntries?.[0]?.geographyLevel} orgZip={effectiveZip} />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Participants Served — always first, counts 1 per kiosk check-in */}
        <Card className="border-slate-200 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <Users className="w-16 h-16 text-primary" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">
              Participants Served
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-heading text-slate-900">
              {totalParticipants.toLocaleString()}
            </div>
            <div className="text-sm text-slate-400 mt-1 font-medium">People served</div>
          </CardContent>
        </Card>

        {program.metrics.map((metric, i) => {
          let metricGoal: string | null = null;
          if (i === 0 && program.goals) {
            const match = program.goals.match(/(\d[\d,]*)/);
            if (match) metricGoal = match[1];
          }
          return (
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
                <div className="text-sm text-slate-400 mt-1 font-medium" data-testid={`text-metric-goal-${metric.id}`}>
                  {metricGoal ? `Goal: ${metricGoal}` : metric.unit}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Inventory Status */}
      {program.metrics.filter((m: any) => m.itemType === "physical_item" && m.inventoryTotal != null).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Inventory Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {program.metrics.filter((m: any) => m.itemType === "physical_item").map((m: any) => {
              const remaining = m.inventoryRemaining ?? m.inventoryTotal ?? 0;
              const total = m.inventoryTotal ?? 0;
              const pct = total > 0 ? Math.round((remaining / total) * 100) : null;
              return (
                <Card key={m.id} className="p-4">
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-2xl font-bold mt-1">{remaining.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">of {total.toLocaleString()} remaining</p>
                  {pct != null && <Progress value={pct} className="mt-2 h-1.5" />}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Budget Capacity */}
      {(program as any).budget && program.metrics.some((m: any) => m.unitCost && m.unitCost > 0) && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Budget Capacity</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {program.metrics.filter((m: any) => m.unitCost && m.unitCost > 0).map((m: any) => {
              const maxUnits = Math.floor((program as any).budget / m.unitCost);
              return (
                <Card key={m.id} className="p-4">
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-2xl font-bold mt-1">{maxUnits.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">
                    max units at ${m.unitCost}/unit from ${((program as any).budget as number).toLocaleString()} budget
                  </p>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Chart Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* 12-Month Participation Chart */}
          <Card className="border-slate-200 shadow-sm" data-testid="chart-participants-by-month">
            <CardHeader>
              <CardTitle className="font-heading text-lg">Participants by Month</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {participantsByMonth.some(m => m.count > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={participantsByMonth} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorParticipants" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Area type="monotone" dataKey="count" name={primaryMetric} stroke="#0d9488" strokeWidth={2} fillOpacity={1} fill="url(#colorParticipants)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400">
                  No monthly data available yet
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
                      <th className="text-left font-medium text-slate-500 pb-3 pl-2">Service Date</th>
                      <th className="text-left font-medium text-slate-500 pb-3">Location</th>
                      <th className="text-right font-medium text-slate-500 pb-3">Impact</th>
                      <th className="text-right font-medium text-slate-500 pb-3 pr-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Merge real entries with survey date-groups, sort by date desc, show top 5
                      type RealRow = { kind: "entry"; entry: typeof entries extends (infer T)[] | undefined ? T : never };
                      type SurveyRow = { kind: "survey"; date: string; count: number };
                      type Row = RealRow | SurveyRow;

                      const rows: Row[] = [
                        ...(entries || []).map(e => ({ kind: "entry" as const, entry: e })),
                        ...Object.entries(surveyEntriesByDate).map(([date, count]) => ({
                          kind: "survey" as const, date, count,
                        })),
                      ];
                      rows.sort((a, b) => {
                        const da = a.kind === "entry" ? a.entry.date : a.date;
                        const db = b.kind === "entry" ? b.entry.date : b.date;
                        return db.localeCompare(da);
                      });
                      const visible = rows.slice(0, 5);

                      if (visible.length === 0) {
                        return (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-400">
                              No recent entries found
                            </td>
                          </tr>
                        );
                      }

                      return visible.map((row, idx) => {
                        if (row.kind === "survey") {
                          return (
                            <tr key={`survey-${row.date}`} className="border-b border-slate-50 last:border-0 bg-teal-50/40">
                              <td className="py-3 pl-2 text-slate-600">
                                {format(new Date(row.date + "T00:00:00"), "MMM d, yyyy")}
                              </td>
                              <td className="py-3">
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-teal-100 text-teal-700 border-teal-200 font-normal text-xs">
                                    Survey
                                  </Badge>
                                  <span className="font-medium text-slate-700">Kiosk Check-in</span>
                                </div>
                              </td>
                              <td className="py-3 text-right">
                                <span className="text-xs text-slate-600">
                                  <span className="font-bold text-slate-900">{row.count.toLocaleString()}</span> {primaryMetricName || "Participants"}
                                </span>
                              </td>
                              <td className="py-3 pr-2" />
                            </tr>
                          );
                        }
                        const entry = row.entry;
                        return (
                          <tr key={entry.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 pl-2 text-slate-600">
                              {format(new Date(entry.date + "T00:00:00"), "MMM d, yyyy")}
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-slate-50 font-normal text-xs text-slate-500 border-slate-200">
                                  {entry.geographyLevel}
                                </Badge>
                                <span className="font-medium text-slate-700">{entry.geographyValue}</span>
                              </div>
                            </td>
                            <td className="py-3 text-right">
                              <div className="flex flex-col items-end gap-1">
                                {(() => {
                                  const mv = entry.metricValues as Record<string, number>;
                                  const sorted = Object.entries(mv).sort(([a], [b]) => {
                                    const aIsParticipant = participantMetricNames.has(a);
                                    const bIsParticipant = participantMetricNames.has(b);
                                    if (aIsParticipant && !bIsParticipant) return -1;
                                    if (!aIsParticipant && bIsParticipant) return 1;
                                    return 0;
                                  });
                                  const participantTotal = sorted
                                    .filter(([k]) => participantMetricNames.has(k))
                                    .reduce((sum, [, v]) => sum + Number(v || 0), 0);
                                  const hasMultipleParticipantMetrics = sorted.filter(([k]) => participantMetricNames.has(k)).length > 1;
                                  return (
                                    <>
                                      {hasMultipleParticipantMetrics && participantTotal > 0 && (
                                        <span className="text-xs font-semibold text-primary">
                                          <span className="font-bold">{participantTotal.toLocaleString()}</span> Total Participants
                                        </span>
                                      )}
                                      {sorted.map(([key, val]) => (
                                        <span key={key} className="text-xs text-slate-600">
                                          <span className="font-bold text-slate-900">{Number(val || 0).toLocaleString()}</span> {key}
                                        </span>
                                      ))}
                                    </>
                                  );
                                })()}
                              </div>
                            </td>
                            <td className="py-3 pr-2 text-right">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setEditingEntry(entry)}
                                data-testid={`button-edit-entry-${entry.id}`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      });
                    })()}
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
              <CardTitle className="text-lg">Program Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-sm opacity-80 mb-1">Last Updated</div>
                  <div className="font-bold text-xl" data-testid="text-last-updated">
                    {entries?.[0] ? format(new Date(entries[0].createdAt! + 'Z'), 'MMM d, yyyy') : 'Never'}
                  </div>
                </div>
                <div>
                  <div className="text-sm opacity-80 mb-1">Updated By</div>
                  <div className="font-bold text-xl" data-testid="text-updated-by">
                    {user ? `${(user.user_metadata?.first_name as string) || ''} ${(user.user_metadata?.last_name as string) || ''}`.trim() || user.email?.split("@")[0] || 'Unknown' : 'Unknown'}
                  </div>
                </div>
                {program.startDate && (
                  <div>
                    <div className="text-sm opacity-80 mb-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Start Date
                    </div>
                    <div className="font-bold text-xl" data-testid="text-start-date">
                      {format(new Date(program.startDate + 'T00:00:00'), 'MMM d, yyyy')}
                    </div>
                  </div>
                )}
                {program.endDate && (
                  <div>
                    <div className="text-sm opacity-80 mb-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> End Date
                    </div>
                    <div className="font-bold text-xl" data-testid="text-end-date">
                      {format(new Date(program.endDate + 'T00:00:00'), 'MMM d, yyyy')}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Operations card — only shown when at least one field is set */}
          {((program as any).deliveryType || (program as any).budget || (program as any).staffCount || (program as any).monthlyCapacity) && (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Operations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  {(program as any).deliveryType && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5" /> Delivery
                      </span>
                      <span className="font-medium text-slate-700">{(program as any).deliveryType}</span>
                    </div>
                  )}
                  {(program as any).staffCount != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" /> Staff
                      </span>
                      <span className="font-medium text-slate-700">{(program as any).staffCount}</span>
                    </div>
                  )}
                  {(program as any).monthlyCapacity != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5" /> Monthly Capacity
                      </span>
                      <span className="font-medium text-slate-700">{((program as any).monthlyCapacity as number).toLocaleString()}</span>
                    </div>
                  )}
                  {(program as any).budget != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5" /> Budget
                      </span>
                      <span className="font-medium text-slate-700">${((program as any).budget as number).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

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

      {/* Survey Responses Table */}
      {dedupedSurveyResponses.length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-teal-600" />
              Survey Responses
              <Badge className="bg-teal-100 text-teal-700 border-teal-200 font-normal ml-1">
                {dedupedSurveyResponses.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left font-medium text-slate-500 pb-3 pl-2">Date / Time</th>
                    <th className="text-left font-medium text-slate-500 pb-3">Type</th>
                    <th className="text-left font-medium text-slate-500 pb-3">Sex</th>
                    <th className="text-left font-medium text-slate-500 pb-3">Age</th>
                    <th className="text-left font-medium text-slate-500 pb-3">Family</th>
                    <th className="text-left font-medium text-slate-500 pb-3">Income</th>
                    <th className="text-left font-medium text-slate-500 pb-3">Email</th>
                    <th className="pb-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {dedupedSurveyResponses.map((r: any) => (
                    <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 pl-2 text-slate-500 text-xs whitespace-nowrap">
                        {format(new Date(r.createdAt + 'Z'), "MMM d, yyyy h:mm a")}
                      </td>
                      <td className="py-2.5">
                        <Badge
                          className={r.respondentType === "participant"
                            ? "bg-teal-100 text-teal-700 border-teal-200 font-normal text-xs"
                            : "bg-slate-100 text-slate-600 border-slate-200 font-normal text-xs"}
                        >
                          {r.respondentType}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-slate-600 capitalize">{r.sex?.replace(/-/g, " ") || "—"}</td>
                      <td className="py-2.5 text-slate-600">{r.ageRange || "—"}</td>
                      <td className="py-2.5 text-slate-600">{r.familySize ?? "—"}</td>
                      <td className="py-2.5 text-slate-600">{r.householdIncome || "—"}</td>
                      <td className="py-2.5 text-slate-500 text-xs">{r.email || "—"}</td>
                      <td className="py-2.5 pr-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => setEditingSurveyResponse(r)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {program && editingEntry && (
        <EditImpactDialog
          program={program}
          entry={editingEntry}
          open={!!editingEntry}
          onOpenChange={(open) => { if (!open) setEditingEntry(null); }}
        />
      )}

      <EditSurveyResponseDialog
        response={editingSurveyResponse}
        open={!!editingSurveyResponse}
        onOpenChange={(open) => { if (!open) setEditingSurveyResponse(null); }}
        orgPrograms={(orgPrograms || []).map((p: any) => ({ id: p.id, name: p.name }))}
        programId={programId}
      />
    </div>
  );
}

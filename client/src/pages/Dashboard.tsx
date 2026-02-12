import { useOrganizations } from "@/hooks/use-organizations";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Plus, Users, ArrowRight, Building2, BarChart3, MapPin, Globe2, FileBarChart, Target } from "lucide-react";
import { usePrograms } from "@/hooks/use-programs";
import { useAdminStats } from "@/hooks/use-admin";
import { useDashboardCharts } from "@/hooks/use-dashboard-charts";
import { CreateOrgDialog } from "@/components/CreateOrgDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  completed: "bg-blue-100 text-blue-800",
  draft: "bg-slate-100 text-slate-600",
};

const CHART_COLORS = ["#0d9488", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

export default function Dashboard() {
  const { user } = useAuth();
  const { data: orgs, isLoading: orgsLoading } = useOrganizations();
  
  const firstOrgId = orgs?.[0]?.id;
  const { data: programs, isLoading: progsLoading } = usePrograms(firstOrgId);
  const { data: adminStats } = useAdminStats();
  const { data: chartData, isLoading: chartsLoading } = useDashboardCharts(firstOrgId);

  const isLoading = orgsLoading || progsLoading;

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <Skeleton className="h-12 w-1/2 mb-8" />
        <div className="grid md:grid-cols-4 gap-6">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!orgs || orgs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-4 text-center">
        <div className="bg-primary/10 p-6 rounded-full mb-6 text-primary">
          <Building2 className="w-12 h-12" />
        </div>
        <h1 className="text-3xl font-heading font-bold text-slate-900 mb-3" data-testid="text-welcome">
          Welcome, {user?.firstName}!
        </h1>
        <p className="text-slate-600 max-w-md mb-8">
          You're just one step away from tracking your impact. Let's create your organization profile first.
        </p>
        <div className="w-full max-w-sm">
          <CreateOrgDialog />
        </div>
      </div>
    );
  }

  const activeCount = programs?.filter(p => p.status === "active").length || 0;
  const totalEntries = adminStats?.totalEntries || 0;
  const totalMetrics = programs?.reduce((sum, p) => sum + p.metrics.length, 0) || 0;

  const currentYear = new Date().getFullYear();

  const participantKeywords = ["participant", "enrolled", "people", "served", "attended", "members", "clients", "youth"];
  const isParticipantMetric = (name: string) =>
    participantKeywords.some(kw => name.toLowerCase().includes(kw));

  const allResourceMetrics: { name: string; total: number; programName: string }[] = [];
  if (chartData?.resourcesByProgram) {
    chartData.resourcesByProgram.forEach((prog: any) => {
      Object.entries(prog.metrics).forEach(([metricName, val]) => {
        if (!isParticipantMetric(metricName)) {
          allResourceMetrics.push({
            name: metricName,
            total: val as number,
            programName: prog.programName,
          });
        }
      });
    });
  }

  const resourceAggregated: Record<string, number> = {};
  allResourceMetrics.forEach(r => {
    resourceAggregated[r.name] = (resourceAggregated[r.name] || 0) + r.total;
  });
  const resourceChartData = Object.entries(resourceAggregated)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-slate-900" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-slate-500 mt-1">
            Overview for <span className="font-semibold text-slate-700">{orgs[0].name}</span>
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Link href="/programs/new">
            <Button data-testid="button-new-program-dashboard">
              <Plus className="w-4 h-4 mr-2" /> New Program
            </Button>
          </Link>
          <Link href="/reports">
            <Button variant="outline" data-testid="button-view-reports">
              <FileBarChart className="w-4 h-4 mr-2" /> Reports
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-primary to-emerald-600 text-white border-none shadow-xl shadow-primary/20">
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-primary-foreground/80 font-medium text-sm">Active Programs</CardTitle>
            <BarChart3 className="w-5 h-5 text-white/50" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-heading font-bold" data-testid="text-active-programs">{activeCount}</div>
            <p className="text-sm text-primary-foreground/70">of {programs?.length || 0} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-muted-foreground font-medium text-sm">Impact Reports</CardTitle>
            <FileBarChart className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-heading font-bold text-slate-900" data-testid="text-total-reports">{totalEntries}</div>
            <p className="text-xs text-muted-foreground">entries recorded</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-muted-foreground font-medium text-sm">Metrics Tracked</CardTitle>
            <MapPin className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-heading font-bold text-slate-900" data-testid="text-total-metrics">{totalMetrics}</div>
            <p className="text-xs text-muted-foreground">across all programs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-muted-foreground font-medium text-sm">Team Members</CardTitle>
            <Users className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Link href="/settings">
              <Button variant="secondary" className="w-full justify-between" data-testid="button-manage-team">
                Manage Team
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Geography Summary */}
      {adminStats?.byGeography && adminStats.byGeography.length > 0 && (
        <div>
          <h2 className="text-lg font-heading font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Globe2 className="w-5 h-5 text-primary" /> Impact by Geography
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {["SPA", "City", "County", "State"].map(level => {
              const geo = adminStats.byGeography.find((g: any) => g.geographyLevel === level);
              return (
                <Card key={level}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground font-medium uppercase mb-1">{level}</p>
                    <p className="text-2xl font-heading font-bold text-slate-900">{geo?.count || 0}</p>
                    <p className="text-xs text-muted-foreground">reports filed</p>
                    {geo && Object.entries(geo.totalMetrics || {}).length > 0 && (
                      <div className="mt-2 pt-2 border-t space-y-1">
                        {Object.entries(geo.totalMetrics).slice(0, 2).map(([k, v]) => (
                          <p key={k} className="text-xs text-muted-foreground">
                            <span className="font-medium text-slate-700">{(v as number).toLocaleString()}</span> {k}
                          </p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Dashboard Charts */}
      {chartsLoading && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Skeleton className="h-[350px] rounded-xl" />
          <Skeleton className="h-[350px] rounded-xl" />
          <Skeleton className="h-[350px] rounded-xl" />
          <Skeleton className="h-[350px] rounded-xl" />
        </div>
      )}

      {chartData && (
        <div className="space-y-6">
          <h2 className="text-lg font-heading font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" /> Performance Analytics ({currentYear})
          </h2>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Participants by Month */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading" data-testid="text-chart-monthly">Participants by Month</CardTitle>
                <p className="text-xs text-muted-foreground">Total participant count per month for {currentYear}</p>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData.participantsByMonth}
                    margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      formatter={(value: number) => [value.toLocaleString(), "Participants"]}
                    />
                    <Bar dataKey="count" name="Participants" radius={[4, 4, 0, 0]}>
                      {chartData.participantsByMonth.map((_: any, i: number) => (
                        <Cell key={`month-${i}`} fill={chartData.participantsByMonth[i].count > 0 ? "#0d9488" : "#e2e8f0"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Participants by Program */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading" data-testid="text-chart-by-program">Participants by Program</CardTitle>
                <p className="text-xs text-muted-foreground">Year-to-date participant totals per program</p>
              </CardHeader>
              <CardContent className="h-[300px]">
                {chartData.participantsByProgram.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData.participantsByProgram.map((p: any) => ({
                        ...p,
                        shortName: p.programName.length > 20 ? p.programName.slice(0, 18) + "..." : p.programName,
                      }))}
                      margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="shortName" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        cursor={{ fill: '#f1f5f9' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        formatter={(value: number) => [value.toLocaleString(), "Participants"]}
                        labelFormatter={(_: string, payload: any) => payload?.[0]?.payload?.programName || _}
                      />
                      <Bar dataKey="count" name="Participants" radius={[4, 4, 0, 0]}>
                        {chartData.participantsByProgram.map((_: any, i: number) => (
                          <Cell key={`prog-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    No participant data for {currentYear} yet
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resources Provided */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading" data-testid="text-chart-resources">Resources Provided</CardTitle>
                <p className="text-xs text-muted-foreground">Aggregate resources across all programs YTD</p>
              </CardHeader>
              <CardContent className="h-[300px]">
                {resourceChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={resourceChartData}
                      layout="vertical"
                      margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => v.toLocaleString()} />
                      <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} width={120} />
                      <Tooltip
                        cursor={{ fill: '#f1f5f9' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        formatter={(value: number) => [value.toLocaleString(), "Total"]}
                      />
                      <Bar dataKey="total" name="Total" radius={[0, 4, 4, 0]}>
                        {resourceChartData.map((_, i) => (
                          <Cell key={`res-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    No resource data for {currentYear} yet
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Goal vs. Actual */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading" data-testid="text-chart-goal-actual">Goal vs. Actual</CardTitle>
                <p className="text-xs text-muted-foreground">Target goals compared to actual participants per program</p>
              </CardHeader>
              <CardContent className="h-[300px]">
                {chartData.goalVsActual && chartData.goalVsActual.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData.goalVsActual.map((p: any) => ({
                        ...p,
                        shortName: p.programName.length > 20 ? p.programName.slice(0, 18) + "..." : p.programName,
                        goal: p.goalTarget || 0,
                      }))}
                      margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="shortName" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        cursor={{ fill: '#f1f5f9' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        labelFormatter={(_: string, payload: any) => {
                          const item = payload?.[0]?.payload;
                          if (!item) return _;
                          let label = item.programName;
                          if (item.targetPopulation) label += `\nTarget: ${item.targetPopulation}`;
                          return label;
                        }}
                        formatter={(value: number, name: string) => [
                          value.toLocaleString(),
                          name === "goal" ? "Goal" : "Actual"
                        ]}
                      />
                      <Legend />
                      <Bar dataKey="goal" name="Goal" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="actual" name="Actual" fill="#0d9488" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    No program data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Goal Details Table */}
          {chartData.goalVsActual && chartData.goalVsActual.some((p: any) => p.targetPopulation || p.goals) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" /> Program Targets & Populations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {chartData.goalVsActual.map((prog: any) => (
                    <div key={prog.programId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-md bg-muted/50" data-testid={`goal-detail-${prog.programId}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-slate-800 truncate">{prog.programName}</p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {prog.targetPopulation && (
                            <Badge variant="outline" className="text-xs">
                              {prog.targetPopulation}
                            </Badge>
                          )}
                          {prog.goals && (
                            <span className="text-xs text-muted-foreground truncate max-w-xs">{prog.goals}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Goal</p>
                          <p className="font-bold text-sm text-slate-700">{prog.goalTarget ? prog.goalTarget.toLocaleString() : "N/A"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Actual</p>
                          <p className="font-bold text-sm text-primary">{prog.actual.toLocaleString()}</p>
                        </div>
                        {prog.goalTarget && prog.goalTarget > 0 && (
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Progress</p>
                            <p className={`font-bold text-sm ${prog.actual >= prog.goalTarget ? "text-emerald-600" : "text-amber-600"}`}>
                              {Math.round((prog.actual / prog.goalTarget) * 100)}%
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Programs List */}
      <div className="pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-heading font-bold text-slate-900">Your Programs</h2>
          <Link href="/programs">
            <Button variant="ghost" size="sm" className="text-primary" data-testid="link-view-all-programs">
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
        {programs && programs.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {programs.slice(0, 3).map(prog => (
              <Link key={prog.id} href={`/programs/${prog.id}`}>
                <Card className="group cursor-pointer hover-elevate transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className={`text-xs ${STATUS_COLORS[prog.status] || ""}`}>
                        {prog.status}
                      </Badge>
                      {prog.type && (
                        <span className="text-xs text-muted-foreground">{prog.type}</span>
                      )}
                    </div>
                    <h3 className="font-heading font-bold text-lg text-slate-800 group-hover:text-primary transition-colors">{prog.name}</h3>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{prog.description || "No description"}</p>
                    {prog.startDate && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Started {format(new Date(prog.startDate), 'MMM yyyy')}
                      </p>
                    )}
                    <div className="mt-3 flex items-center text-xs font-medium text-primary">
                      View Details <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
            <Link href="/programs/new">
              <div className="cursor-pointer border border-dashed border-slate-300 rounded-xl p-5 flex flex-col items-center justify-center h-full hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-800">
                <Plus className="w-6 h-6 mb-2" />
                <span className="font-medium text-sm">Create New Program</span>
              </div>
            </Link>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl p-8 text-center border border-dashed border-slate-200">
            <p className="text-slate-500 mb-4">No programs found. Create one to get started.</p>
            <Link href="/programs/new">
              <Button data-testid="button-create-first-program">Create Program</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

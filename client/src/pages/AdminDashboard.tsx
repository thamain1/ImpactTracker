import { useAdminStats } from "@/hooks/use-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Building2, FolderOpen, FileBarChart, Globe2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { format } from "date-fns";

const COLORS = ["#0d9488", "#f97316", "#3b82f6", "#8b5cf6"];

export default function AdminDashboard() {
  const { data: stats, isLoading } = useAdminStats();

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid md:grid-cols-3 gap-6">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const geoChartData = stats?.byGeography?.map((g: any, i: number) => ({
    name: g.geographyLevel,
    entries: g.count,
    ...g.totalMetrics,
  })) || [];

  const metricNames = stats?.byGeography?.length > 0
    ? Object.keys(stats.byGeography[0].totalMetrics || {})
    : [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-heading font-bold text-slate-900" data-testid="text-admin-title">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">High-level overview across all organizations and programs.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-primary to-emerald-600 text-white border-none">
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium text-white/80">Organizations</CardTitle>
            <Building2 className="w-5 h-5 text-white/60" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-heading font-bold" data-testid="text-total-orgs">{stats?.totalOrganizations || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Programs</CardTitle>
            <FolderOpen className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-heading font-bold text-slate-900" data-testid="text-total-programs">{stats?.totalPrograms || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Impact Reports</CardTitle>
            <FileBarChart className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-heading font-bold text-slate-900" data-testid="text-total-entries">{stats?.totalEntries || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Geography Breakdown */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe2 className="w-5 h-5" /> Impact by Geography Level
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[350px]">
              {geoChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={geoChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="entries" name="Reports Filed" radius={[4, 4, 0, 0]}>
                      {geoChartData.map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No impact data recorded yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Programs */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Programs</CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.recentPrograms?.length > 0 ? (
                <ul className="space-y-3">
                  {stats.recentPrograms.map((prog: any) => (
                    <li key={prog.id} className="flex items-start justify-between text-sm border-b border-border pb-3 last:border-0 last:pb-0">
                      <div>
                        <p className="font-medium text-slate-800">{prog.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {prog.type || "General"} {prog.startDate ? `- Started ${format(new Date(prog.startDate), 'MMM yyyy')}` : ""}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0 ml-2">
                        {prog.status || "active"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No programs yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Aggregate Metric Totals */}
          {stats?.byGeography && stats.byGeography.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">Statewide Metric Totals</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const totals: Record<string, number> = {};
                  stats.byGeography.forEach((g: any) => {
                    Object.entries(g.totalMetrics || {}).forEach(([k, v]: [string, any]) => {
                      totals[k] = (totals[k] || 0) + Number(v);
                    });
                  });
                  return Object.entries(totals).length > 0 ? (
                    <ul className="space-y-2">
                      {Object.entries(totals).map(([name, value]) => (
                        <li key={name} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{name}</span>
                          <span className="font-bold text-slate-900">{value.toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No data yet.</p>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

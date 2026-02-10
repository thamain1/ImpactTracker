import { useOrganizations } from "@/hooks/use-organizations";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Plus, Users, ArrowRight, Building2, BarChart3, MapPin, Globe2, FileBarChart, TrendingUp, DollarSign, AlertTriangle, Info } from "lucide-react";
import { usePrograms } from "@/hooks/use-programs";
import { useAdminStats } from "@/hooks/use-admin";
import { useCensusComparison } from "@/hooks/use-census";
import { CreateOrgDialog } from "@/components/CreateOrgDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  completed: "bg-blue-100 text-blue-800",
  draft: "bg-slate-100 text-slate-600",
};

export default function Dashboard() {
  const { user } = useAuth();
  const { data: orgs, isLoading: orgsLoading } = useOrganizations();
  
  const firstOrgId = orgs?.[0]?.id;
  const { data: programs, isLoading: progsLoading } = usePrograms(firstOrgId);
  const { data: adminStats } = useAdminStats();
  const { data: censusData, isLoading: censusLoading } = useCensusComparison();

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

      {/* Census Comparison */}
      {censusData && censusData.length > 0 && (
        <div>
          <h2 className="text-lg font-heading font-bold text-slate-900 mb-2 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> Census Comparison
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Your impact data compared against U.S. Census population estimates ({censusData[0]?.dataYear} ACS)
          </p>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-heading">Population Reach by Area</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={censusData.filter(d => d.totalPopulation).map(d => ({
                        name: d.geographyValue.length > 15 ? d.geographyValue.slice(0, 14) + "..." : d.geographyValue,
                        fullName: d.geographyValue,
                        impact: d.impactCount,
                        population: d.totalPopulation,
                        reach: d.reachPercent,
                        level: d.geographyLevel,
                      }))}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        cursor={{ fill: '#f1f5f9' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        formatter={(value: number, name: string) => {
                          if (name === "impact") return [value.toLocaleString(), "Your Impact"];
                          return [value.toLocaleString(), "Census Population"];
                        }}
                        labelFormatter={(label: string, payload: any) => payload?.[0]?.payload?.fullName || label}
                      />
                      <Bar dataKey="impact" name="impact" fill="#0d9488" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              {censusData.map((item, i) => (
                <Card key={`${item.geographyLevel}-${item.geographyValue}`} data-testid={`census-card-${i}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">{item.geographyLevel}</Badge>
                      <span className="font-medium text-sm text-slate-800">{item.geographyValue}</span>
                      {item.isApproximate && (
                        <span title={item.approximateNote}>
                          <Info className="w-3.5 h-3.5 text-amber-500" />
                        </span>
                      )}
                    </div>

                    {item.totalPopulation && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-muted-foreground">Census Population</span>
                          <span className="font-bold text-slate-900">{item.totalPopulation.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-muted-foreground">Your Impact</span>
                          <span className="font-bold text-primary">{item.impactCount.toLocaleString()}</span>
                        </div>
                        {item.reachPercent !== null && (
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-muted-foreground">Population Reached</span>
                            <span className="font-bold text-emerald-600">{item.reachPercent}%</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-3 pt-3 border-t flex items-center justify-between gap-2 flex-wrap">
                      {item.povertyRate !== null && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Poverty Rate</span>
                          <div className="font-bold text-slate-700 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                            {item.povertyRate}%
                          </div>
                        </div>
                      )}
                      {item.medianIncome !== null && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Median Income</span>
                          <div className="font-bold text-slate-700 flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-emerald-500" />
                            ${item.medianIncome.toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>

                    {!item.totalPopulation && (
                      <p className="text-xs text-muted-foreground italic">Census data not available for this area</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {censusLoading && adminStats?.byGeography && adminStats.byGeography.length > 0 && (
        <div>
          <h2 className="text-lg font-heading font-bold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> Census Comparison
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
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

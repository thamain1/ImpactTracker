import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { useOrganizations } from "@/hooks/use-organizations";
import { usePrograms } from "@/hooks/use-programs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useImpactStats } from "@/hooks/use-impact";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = ["#0d9488", "#f97316", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#ef4444"];

export default function Reports() {
  const { data: orgs } = useOrganizations();
  const orgId = orgs?.[0]?.id; // Simplification for MVP
  const { data: programs } = usePrograms(orgId);
  
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  
  // Set default program ID once loaded
  if (programs && programs.length > 0 && !selectedProgramId) {
    setSelectedProgramId(programs[0].id.toString());
  }

  const { data: stats, isLoading: statsLoading } = useImpactStats(parseInt(selectedProgramId));

  const primaryMetric = programs?.find(p => p.id === parseInt(selectedProgramId))?.metrics[0]?.name || "";

  // Prepare data for Geo Level Pie Chart
  const geoLevelData = stats?.reduce((acc, curr) => {
    const existing = acc.find(item => item.name === curr.geographyLevel);
    if (existing) {
      existing.value += (curr.metrics[primaryMetric] || 0);
    } else {
      acc.push({ name: curr.geographyLevel, value: curr.metrics[primaryMetric] || 0 });
    }
    return acc;
  }, [] as any[]) || [];

  // Prepare data for Top Locations Bar Chart
  const topLocationsData = stats?.map(item => ({
    name: item.geographyValue,
    value: item.metrics[primaryMetric] || 0
  })).sort((a, b) => b.value - a.value).slice(0, 10) || [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-slate-900">Reports</h1>
          <p className="text-slate-500 mt-1">Visualize your impact across regions.</p>
        </div>
        <div className="w-full md:w-[300px]">
          <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
            <SelectTrigger>
              <SelectValue placeholder="Select Program" />
            </SelectTrigger>
            <SelectContent>
              {programs?.map(p => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedProgramId ? (
        <div className="h-[400px] flex items-center justify-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400">
          Select a program to view reports
        </div>
      ) : statsLoading ? (
        <div className="grid md:grid-cols-2 gap-8">
          <Skeleton className="h-[400px] rounded-2xl" />
          <Skeleton className="h-[400px] rounded-2xl" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-8">
          {/* Pie Chart: Impact by Geography Level */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading">Distribution by Level ({primaryMetric})</CardTitle>
            </CardHeader>
            <CardContent className="h-[350px]">
              {geoLevelData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={geoLevelData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {geoLevelData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400">No data available</div>
              )}
            </CardContent>
          </Card>

          {/* Bar Chart: Top Locations */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading">Top Locations ({primaryMetric})</CardTitle>
            </CardHeader>
            <CardContent className="h-[350px]">
               {topLocationsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    layout="vertical"
                    data={topLocationsData} 
                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" width={80} stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="value" fill="#0d9488" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
               ) : (
                <div className="h-full flex items-center justify-center text-slate-400">No data available</div>
               )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

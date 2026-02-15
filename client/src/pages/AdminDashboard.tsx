import { useAdminStats } from "@/hooks/use-admin";
import { useOrganizations } from "@/hooks/use-organizations";
import { useUserRoles, useUpdateUserRole, useDeleteUserRole } from "@/hooks/use-user-roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, FolderOpen, FileBarChart, Users, Trash2, Shield } from "lucide-react";
import { format } from "date-fns";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  can_edit: "Can Edit",
  can_view: "Can View",
  can_view_download: "Can View & Download",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-primary/10 text-primary",
  can_edit: "bg-amber-50 text-amber-700",
  can_view: "bg-slate-100 text-slate-600",
  can_view_download: "bg-blue-50 text-blue-700",
};

export default function AdminDashboard() {
  const { data: stats, isLoading } = useAdminStats();
  const { data: orgs } = useOrganizations();
  const orgId = orgs?.[0]?.id;

  const { data: roles, isLoading: rolesLoading } = useUserRoles(orgId || 0);
  const updateRole = useUpdateUserRole(orgId || 0);
  const deleteRole = useDeleteUserRole(orgId || 0);

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

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-heading font-bold text-slate-900" data-testid="text-admin-title">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">High-level overview across all organizations and programs.</p>
      </div>

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
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" /> Manage Users & Permissions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {rolesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-14" />
                  <Skeleton className="h-14" />
                </div>
              ) : roles && roles.length > 0 ? (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-3">User</th>
                        <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider p-3">Permission</th>
                        <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roles.map((r: any) => (
                        <tr key={r.id} className="border-b last:border-0" data-testid={`row-user-${r.id}`}>
                          <td className="p-3">
                            <div>
                              <p className="font-medium text-sm text-slate-800">
                                {r.user?.firstName || ""} {r.user?.lastName || ""}
                              </p>
                              <p className="text-xs text-muted-foreground">{r.user?.email || "Unknown"}</p>
                            </div>
                          </td>
                          <td className="p-3">
                            <Select
                              value={r.role}
                              onValueChange={(newRole) => updateRole.mutate({ roleId: r.id, role: newRole })}
                            >
                              <SelectTrigger className="w-44" data-testid={`select-role-${r.id}`}>
                                <SelectValue>
                                  <div className="flex items-center gap-2">
                                    <Shield className="w-3.5 h-3.5" />
                                    {ROLE_LABELS[r.role] || r.role}
                                  </div>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="can_edit">Can Edit</SelectItem>
                                <SelectItem value="can_view">Can View</SelectItem>
                                <SelectItem value="can_view_download">Can View & Download</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                if (confirm("Are you sure you want to remove this user?")) {
                                  deleteRole.mutate(r.id);
                                }
                              }}
                              data-testid={`button-delete-user-${r.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No team members yet. Add users by email above.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
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
                          {prog.type || "General"} {prog.startDate ? `- Started ${format(new Date(prog.startDate + 'T00:00:00'), 'MMM yyyy')}` : ""}
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

          {stats?.byGeography && stats.byGeography.length > 0 && (
            <Card>
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

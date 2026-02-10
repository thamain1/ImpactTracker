import { useOrganizations } from "@/hooks/use-organizations";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Plus, Users, ArrowRight, Building2, BarChart3 } from "lucide-react";
import { usePrograms } from "@/hooks/use-programs";
import { CreateOrgDialog } from "@/components/CreateOrgDialog";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: orgs, isLoading: orgsLoading } = useOrganizations();
  
  // Just grabbing the first org for dashboard summary for now
  const firstOrgId = orgs?.[0]?.id;
  const { data: programs, isLoading: progsLoading } = usePrograms(firstOrgId);

  const isLoading = orgsLoading || progsLoading;

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <Skeleton className="h-12 w-1/2 mb-8" />
        <div className="grid md:grid-cols-3 gap-6">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    );
  }

  // Welcome / Onboarding state
  if (!orgs || orgs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-4 text-center">
        <div className="bg-primary/10 p-6 rounded-full mb-6 text-primary">
          <Building2 className="w-12 h-12" />
        </div>
        <h1 className="text-3xl font-heading font-bold text-slate-900 mb-3">
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

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Overview for <span className="font-semibold text-slate-700">{orgs[0].name}</span></p>
        </div>
        <div className="flex gap-3">
          <Link href="/programs">
            <Button variant="outline" className="border-slate-300">View Programs</Button>
          </Link>
          <Link href="/reports">
            <Button className="bg-primary hover:bg-primary/90">View Reports</Button>
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-primary to-emerald-600 text-white border-none shadow-xl shadow-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-primary-foreground/80 font-medium text-sm">Active Programs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-heading font-bold mb-2">{programs?.length || 0}</div>
            <p className="text-sm text-primary-foreground/70">Initiatives being tracked</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-500 font-medium text-sm uppercase">Total Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="text-2xl font-heading font-bold text-slate-900">1</div>
                <p className="text-xs text-slate-500">Staff members</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-500 font-medium text-sm uppercase">Quick Action</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/programs">
              <Button variant="secondary" className="w-full justify-between group">
                Log New Impact
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Section could go here */}
      <div className="pt-8 border-t border-slate-100">
        <h2 className="text-xl font-heading font-bold text-slate-900 mb-6">Your Programs</h2>
        {programs && programs.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {programs.slice(0, 3).map(prog => (
              <Link key={prog.id} href={`/programs/${prog.id}`}>
                <div className="group cursor-pointer bg-white border border-slate-200 rounded-xl p-5 hover:border-primary hover:shadow-md transition-all">
                  <h3 className="font-heading font-bold text-lg text-slate-800 group-hover:text-primary transition-colors">{prog.name}</h3>
                  <p className="text-sm text-slate-500 mt-2 line-clamp-2">{prog.description || "No description"}</p>
                  <div className="mt-4 flex items-center text-xs font-medium text-primary">
                    View Details <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
            <Link href="/programs">
              <div className="cursor-pointer border border-dashed border-slate-300 rounded-xl p-5 flex flex-col items-center justify-center h-full hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-800">
                <Plus className="w-6 h-6 mb-2" />
                <span className="font-medium text-sm">Create New Program</span>
              </div>
            </Link>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl p-8 text-center border border-dashed border-slate-200">
            <p className="text-slate-500 mb-4">No programs found. Create one to get started.</p>
            <Link href="/programs">
              <Button>Create Program</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

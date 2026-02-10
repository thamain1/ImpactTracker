import { usePrograms } from "@/hooks/use-programs";
import { CreateProgramDialog } from "@/components/CreateProgramDialog";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { ArrowRight, BarChart2, Users, Calendar } from "lucide-react";
import { format } from "date-fns";
import { useOrganizations } from "@/hooks/use-organizations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { CreateOrgDialog } from "@/components/CreateOrgDialog";

export default function Programs() {
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const { data: orgs, isLoading: orgsLoading } = useOrganizations();
  
  // Default to first org if not selected, or handle multiple
  const currentOrgId = selectedOrgId ? parseInt(selectedOrgId) : orgs?.[0]?.id;
  const { data: programs, isLoading: programsLoading } = usePrograms(currentOrgId);

  if (orgsLoading) {
    return (
      <div className="p-8 grid gap-8">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state if no organizations exist
  if (!orgs || orgs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-center p-8">
        <div className="bg-slate-100 p-6 rounded-full mb-6">
          <Users className="w-12 h-12 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome to ImpactTracker</h2>
        <p className="text-slate-600 max-w-md mb-8">
          To get started, you need to register your nonprofit organization.
        </p>
        <div className="w-full max-w-xs">
          <CreateOrgDialog />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-slate-900">Programs</h1>
          <p className="text-slate-500 mt-1">Manage your initiatives and track their success.</p>
        </div>

        <div className="flex items-center gap-4">
          <Select 
            value={selectedOrgId || orgs[0].id.toString()} 
            onValueChange={setSelectedOrgId}
          >
            <SelectTrigger className="w-[200px] bg-white">
              <SelectValue placeholder="Select Organization" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map(org => (
                <SelectItem key={org.id} value={org.id.toString()}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {currentOrgId && <CreateProgramDialog orgId={currentOrgId} />}
        </div>
      </div>

      {programsLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        </div>
      ) : programs && programs.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {programs.map((program) => (
            <Card key={program.id} className="group hover:shadow-lg transition-all duration-300 border-slate-200">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary mb-3">
                    <BarChart2 className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-full">
                    {format(new Date(program.createdAt!), 'MMM yyyy')}
                  </span>
                </div>
                <CardTitle className="font-heading text-xl">{program.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 text-sm line-clamp-2 h-10">
                  {program.description || "No description provided."}
                </p>
                <div className="mt-6 flex gap-2 flex-wrap">
                  {program.metrics.slice(0, 3).map(m => (
                    <span key={m.id} className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-600 rounded-md border border-slate-200">
                      {m.name}
                    </span>
                  ))}
                  {program.metrics.length > 3 && (
                    <span className="text-xs font-medium px-2 py-1 bg-slate-50 text-slate-400 rounded-md">
                      +{program.metrics.length - 3} more
                    </span>
                  )}
                </div>
              </CardContent>
              <CardFooter className="pt-2">
                <Link href={`/programs/${program.id}`} className="w-full">
                  <Button variant="ghost" className="w-full justify-between group-hover:bg-primary group-hover:text-white transition-colors">
                    View Dashboard
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-300">
          <div className="bg-white p-4 rounded-full inline-block shadow-sm mb-4">
            <FolderOpen className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">No programs yet</h3>
          <p className="text-slate-500 mb-6">Create your first program to start tracking impact.</p>
          {currentOrgId && <CreateProgramDialog orgId={currentOrgId} />}
        </div>
      )}
    </div>
  );
}

// Icon helper
import { FolderOpen } from "lucide-react";

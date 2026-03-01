import { usePrograms } from "@/hooks/use-programs";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { ArrowRight, Plus, FolderOpen, Trash2, Search, LayoutGrid, List, Pencil } from "lucide-react";
import { format } from "date-fns";
import { useOrganizations } from "@/hooks/use-organizations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

import { useState } from "react";
import { CreateOrgDialog } from "@/components/CreateOrgDialog";
import { useToast } from "@/hooks/use-toast";
import { buildUrl, api } from "@shared/routes";
import { queryClient } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  completed: "bg-blue-100 text-blue-800",
  draft: "bg-slate-100 text-slate-600",
};

export default function Programs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const { data: orgs, isLoading: orgsLoading } = useOrganizations();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const currentOrgId = orgs?.[0]?.id;
  const { data: programs, isLoading: programsLoading } = usePrograms(currentOrgId);

  const filtered = programs?.filter(p => {
    const matchesSearch = !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (id: number) => {
    try {
      const url = buildUrl(api.programs.delete.path, { id });
      await apiRequest("DELETE", url);
      queryClient.invalidateQueries({ queryKey: [api.programs.list.path] });
      toast({ title: "Deleted", description: "Program removed." });
    } catch {
      toast({ title: "Error", description: "Failed to delete program.", variant: "destructive" });
    }
  };

  if (orgsLoading) {
    return (
      <div className="p-8 grid gap-8">
        <Skeleton className="h-8 w-48" />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!orgs || orgs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-center p-8">
        <div className="bg-muted p-6 rounded-full mb-6">
          <FolderOpen className="w-12 h-12 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome to ImpactTracker</h2>
        <p className="text-muted-foreground max-w-md mb-8">
          To get started, you need to register your nonprofit organization.
        </p>
        <CreateOrgDialog />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-slate-900" data-testid="text-programs-title">Programs</h1>
          <p className="text-muted-foreground mt-1">Manage your initiatives and track their success.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => navigate("/programs/new")} data-testid="button-new-program">
            <Plus className="w-4 h-4 mr-2" /> New Program
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search programs..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-programs"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("grid")}
            data-testid="button-grid-view"
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === "table" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("table")}
            data-testid="button-table-view"
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {programsLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        </div>
      ) : filtered && filtered.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((program) => (
              <Card key={program.id} className="group hover-elevate transition-all duration-200">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[program.status] || ""}`}>
                      {program.status}
                    </Badge>
                    {program.type && (
                      <span className="text-xs text-muted-foreground">{program.type}</span>
                    )}
                  </div>
                  <h3 className="font-heading font-bold text-lg text-slate-800 mb-1">{program.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4 h-10">
                    {program.description || "No description provided."}
                  </p>
                  {program.startDate && (
                    <p className="text-xs text-muted-foreground mb-3">
                      Started {format(new Date(program.startDate + 'T00:00:00'), 'MMM d, yyyy')}
                    </p>
                  )}
                  <div className="flex gap-1 flex-wrap mb-4">
                    {program.metrics.slice(0, 3).map(m => (
                      <Badge key={m.id} variant="outline" className="text-xs font-normal">
                        {m.name}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/programs/${program.id}`} className="flex-1">
                      <Button variant="outline" className="w-full justify-between" data-testid={`link-program-${program.id}`}>
                        View Details
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Link href={`/programs/${program.id}/edit`}>
                      <Button variant="ghost" size="icon" className="text-muted-foreground shrink-0" data-testid={`button-edit-program-${program.id}`}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </Link>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground shrink-0" data-testid={`button-delete-program-${program.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{program.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove this program and all its impact data. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(program.id)} className="bg-destructive text-destructive-foreground">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* Table View */
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left font-medium text-muted-foreground p-4">Program</th>
                      <th className="text-left font-medium text-muted-foreground p-4">Type</th>
                      <th className="text-left font-medium text-muted-foreground p-4">Status</th>
                      <th className="text-left font-medium text-muted-foreground p-4">Start Date</th>
                      <th className="text-left font-medium text-muted-foreground p-4">Metrics</th>
                      <th className="text-right font-medium text-muted-foreground p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(program => (
                      <tr key={program.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="p-4">
                          <div>
                            <p className="font-medium text-slate-800">{program.name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{program.description}</p>
                          </div>
                        </td>
                        <td className="p-4 text-muted-foreground">{program.type || "-"}</td>
                        <td className="p-4">
                          <Badge variant="outline" className={`text-xs ${STATUS_COLORS[program.status] || ""}`}>
                            {program.status}
                          </Badge>
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {program.startDate ? format(new Date(program.startDate + 'T00:00:00'), 'MMM d, yyyy') : "-"}
                        </td>
                        <td className="p-4">
                          <span className="text-muted-foreground">{program.metrics.length} metrics</span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/programs/${program.id}`}>
                              <Button variant="ghost" size="sm" data-testid={`link-view-program-${program.id}`}>View</Button>
                            </Link>
                            <Link href={`/programs/${program.id}/edit`}>
                              <Button variant="ghost" size="icon" className="text-muted-foreground" data-testid={`button-edit-tbl-${program.id}`}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </Link>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-muted-foreground" data-testid={`button-delete-tbl-${program.id}`}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete "{program.name}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently remove this program and all its impact data.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(program.id)} className="bg-destructive text-destructive-foreground">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      ) : (
        <div className="text-center py-20 bg-muted/50 rounded-3xl border border-dashed">
          <div className="bg-background p-4 rounded-full inline-block mb-4">
            <FolderOpen className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">
            {searchTerm || statusFilter !== "all" ? "No matching programs" : "No programs yet"}
          </h3>
          <p className="text-muted-foreground mb-6">
            {searchTerm || statusFilter !== "all"
              ? "Try adjusting your search or filters."
              : "Create your first program to start tracking impact."}
          </p>
          {!searchTerm && statusFilter === "all" && (
            <Button onClick={() => navigate("/programs/new")} data-testid="button-create-first-program">
              <Plus className="w-4 h-4 mr-2" /> Create Program
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

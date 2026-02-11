import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useRoute } from "wouter";
import { useProgram, useUpdateProgram, useCreateMetric, useDeleteMetric } from "@/hooks/use-programs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Loader2, ArrowLeft, Save, Clipboard, MapPin, Users, Target, Plus, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const formSchema = z.object({
  name: z.string().min(1, "Program name is required"),
  description: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  status: z.enum(["active", "completed", "draft"]).optional(),
  startDate: z.union([z.string().min(1), z.literal("")]).optional().nullable().transform(v => v || null),
  endDate: z.union([z.string().min(1), z.literal("")]).optional().nullable().transform(v => v || null),
  targetPopulation: z.string().optional().nullable(),
  targetAgeMin: z.coerce.number().min(0).optional().nullable().transform(v => v || null),
  targetAgeMax: z.coerce.number().max(120).optional().nullable().transform(v => v || null),
  goals: z.string().optional().nullable(),
  locations: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

export default function ProgramEdit() {
  const [, params] = useRoute("/programs/:id/edit");
  const programId = parseInt(params?.id || "0");
  const [, navigate] = useLocation();
  const { data: program, isLoading } = useProgram(programId);
  const updateProgram = useUpdateProgram(programId);
  const createMetric = useCreateMetric(programId);
  const deleteMetric = useDeleteMetric(programId);
  const [newMetricName, setNewMetricName] = useState("");
  const [newMetricUnit, setNewMetricUnit] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "",
      status: "active",
      startDate: "",
      endDate: "",
      targetPopulation: "",
      targetAgeMin: null,
      targetAgeMax: null,
      goals: "",
      locations: "",
    },
  });

  useEffect(() => {
    if (program) {
      form.reset({
        name: program.name,
        description: program.description || "",
        type: program.type || "",
        status: (program.status as "active" | "completed" | "draft") || "active",
        startDate: program.startDate || "",
        endDate: program.endDate || "",
        targetPopulation: program.targetPopulation || "",
        targetAgeMin: program.targetAgeMin ?? null,
        targetAgeMax: program.targetAgeMax ?? null,
        goals: program.goals || "",
        locations: program.locations || "",
      });
    }
  }, [program, form]);

  const onSubmit = (values: FormValues) => {
    updateProgram.mutate(values, {
      onSuccess: () => navigate(`/programs/${programId}`),
    });
  };

  const handleAddMetric = () => {
    if (!newMetricName.trim() || !newMetricUnit.trim()) return;
    createMetric.mutate(
      { name: newMetricName.trim(), unit: newMetricUnit.trim() },
      { onSuccess: () => { setNewMetricName(""); setNewMetricUnit(""); } }
    );
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Skeleton className="h-12 w-1/2 mb-8" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!program) return <div className="p-8">Program not found</div>;

  return (
    <div className="p-8 max-w-3xl mx-auto pb-20">
      <button
        onClick={() => navigate(`/programs/${programId}`)}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        data-testid="link-back-program"
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Program
      </button>

      <h1 className="text-3xl font-heading font-bold text-slate-900 mb-2" data-testid="text-edit-title">Edit Program</h1>
      <p className="text-muted-foreground mb-8">Update your program's details below.</p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="basics" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basics" data-testid="tab-basics" className="flex items-center gap-1.5">
                <Clipboard className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Basics</span>
              </TabsTrigger>
              <TabsTrigger value="details" data-testid="tab-details" className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Details</span>
              </TabsTrigger>
              <TabsTrigger value="population" data-testid="tab-population" className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Population</span>
              </TabsTrigger>
              <TabsTrigger value="metrics" data-testid="tab-metrics" className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Metrics</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basics">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clipboard className="w-5 h-5" />
                    Basics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Program Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-edit-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value || ""} data-testid="input-edit-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Program Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Food Security">Food Security</SelectItem>
                            <SelectItem value="Education">Education</SelectItem>
                            <SelectItem value="Healthcare">Healthcare</SelectItem>
                            <SelectItem value="Housing">Housing</SelectItem>
                            <SelectItem value="Youth Development">Youth Development</SelectItem>
                            <SelectItem value="Employment">Employment</SelectItem>
                            <SelectItem value="Community Development">Community Development</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value || ""} data-testid="input-edit-start-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date (optional)</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value || ""} data-testid="input-edit-end-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="locations"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Locations</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. SPA 6, Downtown LA, County-wide" {...field} value={field.value || ""} data-testid="input-edit-locations" />
                        </FormControl>
                        <FormDescription>Separate multiple locations with commas.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "active"}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="population">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Population & Goals
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="targetPopulation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Population</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g. Low-income families, seniors 65+, at-risk youth ages 14-21"
                            {...field}
                            value={field.value || ""}
                            data-testid="input-edit-target-population"
                          />
                        </FormControl>
                        <FormDescription>Describe who this program serves.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="targetAgeMin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Target Age Range (Min)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              max={120}
                              placeholder="e.g. 14"
                              {...field}
                              value={field.value ?? ""}
                              onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                              data-testid="input-edit-age-min"
                            />
                          </FormControl>
                          <FormDescription>Minimum age of target demographic.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="targetAgeMax"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Target Age Range (Max)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              max={120}
                              placeholder="e.g. 21"
                              {...field}
                              value={field.value ?? ""}
                              onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                              data-testid="input-edit-age-max"
                            />
                          </FormControl>
                          <FormDescription>Maximum age of target demographic.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="goals"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Program Goals</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g. Serve 10,000 meals per quarter"
                            {...field}
                            value={field.value || ""}
                            data-testid="input-edit-goals"
                          />
                        </FormControl>
                        <FormDescription>List the measurable outcomes you aim to achieve.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="metrics">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Manage the metrics tracked for this program. Add new metrics or remove existing ones.
                  </p>

                  <div className="space-y-2">
                    {program.metrics.map(m => (
                      <div key={m.id} className="flex items-center justify-between gap-2 border rounded-md p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-slate-700" data-testid={`text-metric-name-${m.id}`}>{m.name}</span>
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{m.unit}</span>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground shrink-0"
                              data-testid={`button-delete-metric-${m.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Metric</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove "{m.name}"? This won't delete existing impact data, but the metric will no longer appear in new entries.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMetric.mutate(m.id)}
                                data-testid={`button-confirm-delete-metric-${m.id}`}
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                    {program.metrics.length === 0 && (
                      <p className="text-sm text-muted-foreground italic">No metrics defined yet.</p>
                    )}
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <h4 className="text-sm font-medium mb-3">Add New Metric</h4>
                    <div className="flex gap-3 items-end">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground">Metric Name</label>
                        <Input
                          placeholder="e.g. Meals Served"
                          value={newMetricName}
                          onChange={e => setNewMetricName(e.target.value)}
                          data-testid="input-new-metric-name"
                        />
                      </div>
                      <div className="w-28">
                        <label className="text-xs text-muted-foreground">Unit</label>
                        <Input
                          placeholder="e.g. meals"
                          value={newMetricUnit}
                          onChange={e => setNewMetricUnit(e.target.value)}
                          data-testid="input-new-metric-unit"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddMetric}
                        disabled={createMetric.isPending || !newMetricName.trim() || !newMetricUnit.trim()}
                        data-testid="button-add-metric"
                      >
                        {createMetric.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4 mr-1" />
                        )}
                        Add
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/programs/${programId}`)}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateProgram.isPending} data-testid="button-save-program">
              {updateProgram.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

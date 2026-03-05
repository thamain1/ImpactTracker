import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useRoute } from "wouter";
import { useProgram, useUpdateProgram, useCreateMetric, useDeleteMetric, useUpdateMetric } from "@/hooks/use-programs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Loader2, ArrowLeft, Save, Clipboard, MapPin, Users, Target, Plus, Trash2, UserCheck } from "lucide-react";
import { MASTER_AGE_BANDS, DEFAULT_AGE_BANDS, AGE_BAND_PRESETS, type AgeBand } from "@/lib/ageBands";
import { Checkbox } from "@/components/ui/checkbox";
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
  costPerParticipant: z.string().optional().nullable(),
  locations: z.string().optional().nullable(),
  deliveryType: z.string().optional().nullable(),
  surveyLayout: z.string().optional().nullable(),
  ageBands: z.array(z.object({ value: z.string(), label: z.string() })).optional().nullable(),
  budget: z.coerce.number().int().min(0).optional().nullable().transform(v => v || null),
  staffCount: z.coerce.number().int().min(0).optional().nullable().transform(v => v || null),
  monthlyCapacity: z.coerce.number().int().min(0).optional().nullable().transform(v => v || null),
  zipCode: z.string().optional().nullable(),
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
  const updateMetric = useUpdateMetric(programId);
  const [newMetricName, setNewMetricName] = useState("");
  const [newMetricUnit, setNewMetricUnit] = useState("");
  const [newMetricType, setNewMetricType] = useState<"participant" | "service" | "physical_item">("participant");
  const [newMetricHourlyCost, setNewMetricHourlyCost] = useState<number | null>(null);
  const [newMetricHoursCount, setNewMetricHoursCount] = useState<number | null>(null);
  const [newMetricUnitCost, setNewMetricUnitCost] = useState<number | null>(null);
  const [newMetricInventoryTotal, setNewMetricInventoryTotal] = useState<number | null>(null);
  const [newMetricAllocationType, setNewMetricAllocationType] = useState("fixed");
  const [newMetricAllocationThreshold, setNewMetricAllocationThreshold] = useState<number | null>(null);
  const [newMetricAllocationBonusQty, setNewMetricAllocationBonusQty] = useState<number | null>(null);
  const [newMetricCustomQuestionPrompt, setNewMetricCustomQuestionPrompt] = useState<string | null>(null);

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
      costPerParticipant: "",
      locations: "",
      deliveryType: "",
      surveyLayout: "standard",
      ageBands: null,
      budget: null,
      staffCount: null,
      monthlyCapacity: null,
      zipCode: "",
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
        costPerParticipant: (program as any).costPerParticipant || "",
        locations: program.locations || "",
        deliveryType: (program as any).deliveryType || "",
        surveyLayout: (program as any).surveyLayout || "standard",
        ageBands: (program as any).ageBands ?? null,
        budget: (program as any).budget ?? null,
        staffCount: (program as any).staffCount ?? null,
        monthlyCapacity: (program as any).monthlyCapacity ?? null,
        zipCode: (program as any).zipCode || "",
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
      {
        name: newMetricName.trim(),
        unit: newMetricUnit.trim(),
        countsAsParticipant: newMetricType === "participant",
        itemType: newMetricType === "physical_item" ? "physical_item" : "service",
        hourlyCost: newMetricType === "service" ? newMetricHourlyCost : null,
        hoursCount: newMetricType === "service" ? newMetricHoursCount : null,
        unitCost: newMetricType === "physical_item" ? newMetricUnitCost : null,
        inventoryTotal: newMetricType === "physical_item" ? newMetricInventoryTotal : null,
        allocationType: newMetricType === "physical_item" ? newMetricAllocationType : "fixed",
        allocationThreshold: newMetricType === "physical_item" ? newMetricAllocationThreshold : null,
        allocationBonusQty: newMetricType === "physical_item" ? newMetricAllocationBonusQty : null,
        customQuestionPrompt: newMetricType === "physical_item" ? newMetricCustomQuestionPrompt : null,
      },
      {
        onSuccess: () => {
          setNewMetricName(""); setNewMetricUnit(""); setNewMetricType("participant");
          setNewMetricHourlyCost(null); setNewMetricHoursCount(null);
          setNewMetricUnitCost(null); setNewMetricInventoryTotal(null);
          setNewMetricAllocationType("fixed"); setNewMetricAllocationThreshold(null);
          setNewMetricAllocationBonusQty(null); setNewMetricCustomQuestionPrompt(null);
        }
      }
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

                  <FormField
                    control={form.control}
                    name="budget"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Program Budget ($)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            placeholder="e.g. 50000"
                            {...field}
                            value={field.value ?? ""}
                            onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                            data-testid="input-edit-budget"
                          />
                        </FormControl>
                        <FormDescription>Total program budget in dollars.</FormDescription>
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
                            <SelectItem value="Community Engagement">Community Engagement</SelectItem>
                            <SelectItem value="Reentry Program">Reentry Program</SelectItem>
                            <SelectItem value="System Impacted Program">System Impacted Program</SelectItem>
                            <SelectItem value="Mental Health">Mental Health</SelectItem>
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

                  <div className="grid sm:grid-cols-2 gap-4">
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
                      name="zipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Program ZIP Code</FormLabel>
                          <FormControl>
                            <Input placeholder="Leave blank to use org ZIP" {...field} value={field.value || ""} maxLength={5} data-testid="input-edit-zip-code" />
                          </FormControl>
                          <FormDescription>Overrides the org ZIP for new entries.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="deliveryType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-delivery-type">
                              <SelectValue placeholder="Select delivery type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="In-person">In-person</SelectItem>
                            <SelectItem value="Virtual">Virtual</SelectItem>
                            <SelectItem value="Hybrid">Hybrid</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="staffCount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Staff Count</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              placeholder="e.g. 5"
                              {...field}
                              value={field.value ?? ""}
                              onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                              data-testid="input-edit-staff-count"
                            />
                          </FormControl>
                          <FormDescription>Number of staff supporting this program.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="monthlyCapacity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Monthly Capacity</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              placeholder="e.g. 200"
                              {...field}
                              value={field.value ?? ""}
                              onChange={e => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                              data-testid="input-edit-monthly-capacity"
                            />
                          </FormControl>
                          <FormDescription>Max participants per month.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

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

                  {/* Age Bands */}
                  {(() => {
                    const currentBands: AgeBand[] = form.watch("ageBands") ?? DEFAULT_AGE_BANDS;
                    const isBandSelected = (v: string) => currentBands.some(b => b.value === v);
                    const toggleBand = (band: AgeBand, on: boolean) => {
                      if (on) {
                        const next = MASTER_AGE_BANDS.filter(b =>
                          isBandSelected(b.value) || b.value === band.value
                        );
                        form.setValue("ageBands", next);
                      } else {
                        form.setValue("ageBands", currentBands.filter(b => b.value !== band.value));
                      }
                    };
                    return (
                      <div className="space-y-3">
                        <div>
                          <Label>Age Bands (Survey)</Label>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Shown in the demographics step of the survey. Select a preset or customize.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {AGE_BAND_PRESETS.map(preset => (
                            <Button
                              key={preset.label}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => form.setValue("ageBands", preset.bands)}
                            >
                              {preset.label}
                            </Button>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 border rounded-md p-3 bg-slate-50">
                          {MASTER_AGE_BANDS.map(band => (
                            <label key={band.value} className="flex items-center gap-2 cursor-pointer text-sm">
                              <Checkbox
                                checked={isBandSelected(band.value)}
                                onCheckedChange={checked => toggleBand(band, !!checked)}
                              />
                              <span className="text-slate-600">{band.label}</span>
                            </label>
                          ))}
                        </div>
                        {currentBands.length === 0 && (
                          <p className="text-xs text-amber-600">Select at least one band — or choose a preset above.</p>
                        )}
                      </div>
                    );
                  })()}

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

                  <FormField
                    control={form.control}
                    name="costPerParticipant"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cost Per Participant ($)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. 25.00"
                            {...field}
                            value={field.value || ""}
                            data-testid="input-edit-cost-per-participant"
                          />
                        </FormControl>
                        <FormDescription>Average cost per participant served.</FormDescription>
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
                      <div key={m.id} className="border rounded-md p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
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
                        {/* Metric Type — three mutually exclusive checkboxes */}
                        <div className="ml-1 space-y-1">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Metric Type</p>
                          {(["participant", "service", "physical_item"] as const).map((type) => {
                            const currentType = (m as any).itemType === "physical_item"
                              ? "physical_item"
                              : (m as any).countsAsParticipant === false
                                ? "service"
                                : "participant";
                            const labels: Record<string, string> = {
                              participant: "Participant — counts as a person served",
                              service: "Service Provided — a session, visit, or hour of service",
                              physical_item: "Physical Item Provided — a good distributed to participants",
                            };
                            return (
                              <label key={type} className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                  checked={currentType === type}
                                  onCheckedChange={(checked) => {
                                    if (!checked) return;
                                    updateMetric.mutate({
                                      metricId: m.id,
                                      data: {
                                        countsAsParticipant: type === "participant",
                                        itemType: type === "physical_item" ? "physical_item" : "service",
                                      },
                                    });
                                  }}
                                  data-testid={`checkbox-metric-type-${type}-${m.id}`}
                                />
                                <span className="text-xs text-muted-foreground">{labels[type]}</span>
                              </label>
                            );
                          })}
                        </div>

                        {/* Optional toggle — only for non-participant metrics */}
                        {(m as any).countsAsParticipant === false && (
                          <div className="flex items-center gap-2 ml-1 mt-2">
                            <Checkbox
                              checked={!!(m as any).optional}
                              onCheckedChange={(checked) => {
                                updateMetric.mutate({
                                  metricId: m.id,
                                  data: { optional: !!checked },
                                });
                              }}
                            />
                            <Label className="text-xs font-normal text-muted-foreground">
                              Optional — show as checkbox in kiosk survey (can be unchecked by participant)
                            </Label>
                          </div>
                        )}

                        {/* Service fields */}
                        {(m as any).itemType !== "physical_item" && (m as any).countsAsParticipant === false && (
                          <div className="ml-1 space-y-2 border-l-2 border-primary/20 pl-3">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-muted-foreground">Hourly Cost ($)</label>
                                <Input
                                  type="number" min="0" step="0.01" placeholder="0.00"
                                  className="h-8 text-xs mt-1"
                                  defaultValue={(m as any).hourlyCost ?? ""}
                                  onBlur={e => updateMetric.mutate({ metricId: m.id, data: { hourlyCost: parseFloat(e.target.value) || null } })}
                                />
                                <p className="text-xs text-muted-foreground mt-0.5">Cost per hour of service delivery.</p>
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground">Number of Hours</label>
                                <Input
                                  type="number" min="0" placeholder="e.g. 2"
                                  className="h-8 text-xs mt-1"
                                  defaultValue={(m as any).hoursCount ?? ""}
                                  onBlur={e => updateMetric.mutate({ metricId: m.id, data: { hoursCount: parseInt(e.target.value) || null } })}
                                />
                                <p className="text-xs text-muted-foreground mt-0.5">Typical hours per session or service unit.</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {(m as any).itemType === "physical_item" && (
                          <div className="ml-1 space-y-2 border-l-2 border-primary/20 pl-3">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-muted-foreground">Unit Cost ($)</label>
                                <Input
                                  type="number" min="0" step="0.01" placeholder="0.00"
                                  className="h-8 text-xs mt-1"
                                  defaultValue={(m as any).unitCost ?? ""}
                                  onBlur={e => updateMetric.mutate({ metricId: m.id, data: { unitCost: parseFloat(e.target.value) || null } })}
                                />
                                <p className="text-xs text-muted-foreground mt-0.5">Market value per unit. Used to calculate budget coverage.</p>
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground">Inventory</label>
                                <Input
                                  type="number" min="0" placeholder="e.g. 500"
                                  className="h-8 text-xs mt-1"
                                  defaultValue={(m as any).inventoryTotal ?? ""}
                                  onBlur={e => updateMetric.mutate({ metricId: m.id, data: { inventoryTotal: parseInt(e.target.value) || null } })}
                                />
                                <p className="text-xs text-muted-foreground mt-0.5">Current stock on hand. Decrements with each check-in.</p>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Allocation Rule</label>
                              <Select
                                value={(m as any).allocationType ?? "fixed"}
                                onValueChange={v => updateMetric.mutate({ metricId: m.id, data: { allocationType: v } })}
                              >
                                <SelectTrigger className="h-8 text-xs mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="fixed">Fixed (always 1)</SelectItem>
                                  <SelectItem value="family_size_scaled">Family Size Threshold</SelectItem>
                                  <SelectItem value="custom_question">Custom Question</SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground mt-0.5">Fixed: 1 unit per check-in. Family Size: base + bonus by household size. Custom: ask participant a number.</p>
                            </div>
                            {(m as any).allocationType === "family_size_scaled" && (
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-xs text-muted-foreground">Family Size Threshold</label>
                                  <Input
                                    type="number" min="1" placeholder="e.g. 5"
                                    className="h-8 text-xs mt-1"
                                    defaultValue={(m as any).allocationThreshold ?? ""}
                                    onBlur={e => updateMetric.mutate({ metricId: m.id, data: { allocationThreshold: parseInt(e.target.value) || null } })}
                                  />
                                  <p className="text-xs text-muted-foreground mt-0.5">Add bonus units when household size exceeds this number.</p>
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground">Bonus Qty</label>
                                  <Input
                                    type="number" min="1" placeholder="e.g. 1"
                                    className="h-8 text-xs mt-1"
                                    defaultValue={(m as any).allocationBonusQty ?? ""}
                                    onBlur={e => updateMetric.mutate({ metricId: m.id, data: { allocationBonusQty: parseInt(e.target.value) || null } })}
                                  />
                                  <p className="text-xs text-muted-foreground mt-0.5">Extra units above the threshold (e.g. threshold 4, bonus 1 → family of 5 gets 2 units).</p>
                                </div>
                              </div>
                            )}
                            {(m as any).allocationType === "custom_question" && (
                              <div>
                                <label className="text-xs text-muted-foreground">Question to Ask Participant</label>
                                <Input
                                  placeholder="e.g. How many school-age children need backpacks?"
                                  className="h-8 text-xs mt-1"
                                  defaultValue={(m as any).customQuestionPrompt ?? ""}
                                  onBlur={e => updateMetric.mutate({ metricId: m.id, data: { customQuestionPrompt: e.target.value || null } })}
                                />
                                <p className="text-xs text-muted-foreground mt-0.5">Shown on the kiosk survey. Participant's answer determines units received.</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {program.metrics.length === 0 && (
                      <p className="text-sm text-muted-foreground italic">No metrics defined yet.</p>
                    )}
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <h4 className="text-sm font-medium mb-3">Add New Metric</h4>
                    <div className="flex gap-3 items-end flex-wrap">
                      <div className="flex-1 min-w-[150px]">
                        <label className="text-xs text-muted-foreground">Metric Name</label>
                        <Input
                          placeholder="e.g. Meals Served"
                          value={newMetricName}
                          onChange={e => setNewMetricName(e.target.value)}
                          data-testid="input-new-metric-name"
                        />
                      </div>
                      <div className="w-28">
                        <label className="text-xs text-muted-foreground">Measure</label>
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
                    {/* Metric Type — three mutually exclusive checkboxes */}
                    <div className="mt-2 ml-1 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Metric Type</p>
                      {(["participant", "service", "physical_item"] as const).map((type) => {
                        const labels: Record<string, string> = {
                          participant: "Participant — counts as a person served",
                          service: "Service Provided — a session, visit, or hour of service",
                          physical_item: "Physical Item Provided — a good distributed to participants",
                        };
                        return (
                          <label key={type} className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={newMetricType === type}
                              onCheckedChange={(checked) => { if (checked) setNewMetricType(type); }}
                              data-testid={`checkbox-new-metric-type-${type}`}
                            />
                            <span className="text-xs text-muted-foreground">{labels[type]}</span>
                          </label>
                        );
                      })}
                    </div>

                    {/* Service fields for new metric */}
                    {newMetricType === "service" && (
                      <div className="mt-2 ml-1 space-y-2 border-l-2 border-primary/20 pl-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Hourly Cost ($)</Label>
                            <Input
                              type="number" min="0" step="0.01" placeholder="0.00"
                              className="h-8 text-xs mt-1"
                              value={newMetricHourlyCost ?? ""}
                              onChange={e => setNewMetricHourlyCost(parseFloat(e.target.value) || null)}
                            />
                            <p className="text-xs text-muted-foreground mt-0.5">Cost per hour of service delivery.</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Number of Hours</Label>
                            <Input
                              type="number" min="0" placeholder="e.g. 2"
                              className="h-8 text-xs mt-1"
                              value={newMetricHoursCount ?? ""}
                              onChange={e => setNewMetricHoursCount(parseInt(e.target.value) || null)}
                            />
                            <p className="text-xs text-muted-foreground mt-0.5">Typical hours per session or service unit.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {newMetricType === "physical_item" && (
                      <div className="mt-2 space-y-2 border-l-2 border-primary/20 pl-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Unit Cost ($)</Label>
                            <Input
                              type="number" min="0" step="0.01" placeholder="0.00"
                              className="h-8 text-xs mt-1"
                              value={newMetricUnitCost ?? ""}
                              onChange={e => setNewMetricUnitCost(parseFloat(e.target.value) || null)}
                            />
                            <p className="text-xs text-muted-foreground mt-0.5">Market value per unit. Used to calculate budget coverage.</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Starting Inventory</Label>
                            <Input
                              type="number" min="0" placeholder="e.g. 500"
                              className="h-8 text-xs mt-1"
                              value={newMetricInventoryTotal ?? ""}
                              onChange={e => setNewMetricInventoryTotal(parseInt(e.target.value) || null)}
                            />
                            <p className="text-xs text-muted-foreground mt-0.5">Current stock on hand. Decrements with each check-in.</p>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Allocation Rule</Label>
                          <Select value={newMetricAllocationType} onValueChange={setNewMetricAllocationType}>
                            <SelectTrigger className="h-8 text-xs mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixed">Fixed (always 1)</SelectItem>
                              <SelectItem value="family_size_scaled">Family Size Threshold</SelectItem>
                              <SelectItem value="custom_question">Custom Question</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-0.5">Fixed: 1 unit per check-in. Family Size: base + bonus by household size. Custom: ask participant a number.</p>
                        </div>
                        {newMetricAllocationType === "family_size_scaled" && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">Family Size Threshold</Label>
                              <Input
                                type="number" min="1" placeholder="e.g. 5"
                                className="h-8 text-xs mt-1"
                                value={newMetricAllocationThreshold ?? ""}
                                onChange={e => setNewMetricAllocationThreshold(parseInt(e.target.value) || null)}
                              />
                              <p className="text-xs text-muted-foreground mt-0.5">Add bonus units when household size exceeds this number.</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Bonus Qty Above Threshold</Label>
                              <Input
                                type="number" min="1" placeholder="e.g. 1"
                                className="h-8 text-xs mt-1"
                                value={newMetricAllocationBonusQty ?? ""}
                                onChange={e => setNewMetricAllocationBonusQty(parseInt(e.target.value) || null)}
                              />
                              <p className="text-xs text-muted-foreground mt-0.5">Extra units above the threshold (e.g. threshold 4, bonus 1 → family of 5 gets 2 units).</p>
                            </div>
                          </div>
                        )}
                        {newMetricAllocationType === "custom_question" && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Question to Ask Participant</Label>
                            <Input
                              placeholder="e.g. How many school-age children need backpacks?"
                              className="h-8 text-xs mt-1"
                              value={newMetricCustomQuestionPrompt ?? ""}
                              onChange={e => setNewMetricCustomQuestionPrompt(e.target.value || null)}
                            />
                            <p className="text-xs text-muted-foreground mt-0.5">Shown on the kiosk survey. Participant's answer determines units received.</p>
                          </div>
                        )}
                      </div>
                    )}
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

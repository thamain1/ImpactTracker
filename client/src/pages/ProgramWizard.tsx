import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { api } from "@shared/routes";
import { useCreateProgram } from "@/hooks/use-programs";
import { useOrganizations } from "@/hooks/use-organizations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Plus, Trash2, Loader2, ArrowLeft, ArrowRight, Check, Clipboard, MapPin, Users, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const formSchema = api.programs.create.input.extend({
  orgId: z.coerce.number({ required_error: "Please select an organization" }),
  name: z.string().min(1, "Program name is required"),
  type: z.string().optional(),
  status: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  targetPopulation: z.string().optional(),
  goals: z.string().optional(),
  locations: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const STEPS = [
  { label: "Basics", icon: Clipboard, description: "Name and organization" },
  { label: "Details", icon: MapPin, description: "Type, dates, and location" },
  { label: "Population & Goals", icon: Target, description: "Who and what" },
  { label: "Metrics", icon: Users, description: "What to measure" },
];

export default function ProgramWizard() {
  const [step, setStep] = useState(0);
  const [, navigate] = useLocation();
  const { data: orgs, isLoading: orgsLoading } = useOrganizations();
  const createProgram = useCreateProgram();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      orgId: orgs?.[0]?.id || 0,
      name: "",
      description: "",
      type: "",
      status: "active",
      startDate: "",
      endDate: "",
      targetPopulation: "",
      goals: "",
      locations: "",
      metrics: [{ name: "Participants", unit: "people" }],
    },
  });

  const metrics = form.watch("metrics");

  const addMetric = () => {
    const current = form.getValues("metrics");
    form.setValue("metrics", [...current, { name: "", unit: "" }]);
  };

  const removeMetric = (index: number) => {
    const current = form.getValues("metrics");
    form.setValue("metrics", current.filter((_, i) => i !== index));
  };

  const nextStep = () => {
    if (step === 0) {
      const name = form.getValues("name");
      const orgId = form.getValues("orgId");
      if (!name || !orgId) {
        form.trigger(["name", "orgId"]);
        return;
      }
    }
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  };

  const prevStep = () => setStep(s => Math.max(s - 1, 0));

  const onSubmit = (values: FormValues) => {
    createProgram.mutate(values, {
      onSuccess: () => navigate("/programs"),
    });
  };

  if (orgsLoading) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Skeleton className="h-12 w-1/2 mb-8" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto pb-20">
      <button
        onClick={() => navigate("/programs")}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        data-testid="link-back-programs"
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Programs
      </button>

      <h1 className="text-3xl font-heading font-bold text-slate-900 mb-2">Create New Program</h1>
      <p className="text-muted-foreground mb-8">Follow the steps below to set up your program and define what you'll measure.</p>

      {/* Step Indicators */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <button
              type="button"
              onClick={() => i <= step && setStep(i)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all w-full ${
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
              data-testid={`step-${i}`}
            >
              <s.icon className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <div className="w-4 h-px bg-border shrink-0" />}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {(() => { const Icon = STEPS[step].icon; return <Icon className="w-5 h-5" />; })()}
            {STEPS[step].label}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{STEPS[step].description}</p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              {/* Step 1: Basics */}
              {step === 0 && (
                <>
                  <FormField
                    control={form.control}
                    name="orgId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization</FormLabel>
                        <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger data-testid="select-org">
                              <SelectValue placeholder="Select organization" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {orgs?.map(org => (
                              <SelectItem key={org.id} value={org.id.toString()}>{org.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Program Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Community Food Bank 2024" {...field} data-testid="input-program-name" />
                        </FormControl>
                        <FormDescription>Choose a clear, descriptive name for your program.</FormDescription>
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
                          <Textarea placeholder="Briefly describe the program's purpose and activities..." {...field} value={field.value || ""} data-testid="input-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Step 2: Details */}
              {step === 1 && (
                <>
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Program Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-type">
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
                        <FormDescription>Categorize your program to help with reporting.</FormDescription>
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
                            <Input type="date" {...field} value={field.value || ""} data-testid="input-start-date" />
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
                            <Input type="date" {...field} value={field.value || ""} data-testid="input-end-date" />
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
                          <Input placeholder="e.g. SPA 6, Downtown LA, County-wide" {...field} value={field.value || ""} data-testid="input-locations" />
                        </FormControl>
                        <FormDescription>Where does this program operate? Separate multiple locations with commas.</FormDescription>
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
                            <SelectTrigger data-testid="select-status">
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
                </>
              )}

              {/* Step 3: Population & Goals */}
              {step === 2 && (
                <>
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
                            data-testid="input-target-population"
                          />
                        </FormControl>
                        <FormDescription>Describe who this program serves.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="goals"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Program Goals</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g. Serve 10,000 meals per quarter; Reduce food insecurity by 20% in target area"
                            {...field}
                            value={field.value || ""}
                            data-testid="input-goals"
                          />
                        </FormControl>
                        <FormDescription>List the measurable outcomes you aim to achieve.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Step 4: Metrics */}
              {step === 3 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Define the numbers you'll track for this program. You can always add more later.
                  </p>

                  {metrics.map((_, index) => (
                    <div key={index} className="flex gap-3 items-end">
                      <FormField
                        control={form.control}
                        name={`metrics.${index}.name`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel className="text-xs">Metric Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Meals Served" {...field} data-testid={`input-metric-name-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`metrics.${index}.unit`}
                        render={({ field }) => (
                          <FormItem className="w-28">
                            <FormLabel className="text-xs">Unit</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. meals" {...field} data-testid={`input-metric-unit-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {metrics.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => removeMetric(index)}
                          data-testid={`button-remove-metric-${index}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}

                  <Button type="button" variant="outline" size="sm" onClick={addMetric} data-testid="button-add-metric">
                    <Plus className="w-3 h-3 mr-2" /> Add Metric
                  </Button>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  disabled={step === 0}
                  data-testid="button-prev-step"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Previous
                </Button>

                {step < STEPS.length - 1 ? (
                  <Button type="button" onClick={nextStep} data-testid="button-next-step">
                    Next <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={createProgram.isPending} data-testid="button-create-program">
                    {createProgram.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Create Program
                      </>
                    )}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

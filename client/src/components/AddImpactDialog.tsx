import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertImpactEntrySchema } from "@shared/schema";
import { useCreateImpactEntry } from "@/hooks/use-impact";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Plus, Loader2, Lightbulb, MapPin, CheckCircle2 } from "lucide-react";
import type { ProgramResponse } from "@shared/routes";

interface AddImpactDialogProps {
  program: ProgramResponse;
  lastGeographyLevel?: string;
}

interface GeoContext {
  spa?: string;
  city?: string;
  county?: string;
  state?: string;
}

const pctField = z.union([z.coerce.number().min(0).max(100), z.literal("")])
  .optional().nullable()
  .transform(v => v === "" ? null : (typeof v === "number" ? v : null));

const formSchema = insertImpactEntrySchema.extend({
  programId: z.coerce.number(),
  zipCode: z.string().optional(),
  demographics: z.string().optional(),
  outcomes: z.string().optional(),
  pctCompletingProgram: pctField,
  pctEmploymentGained: pctField,
  pctHousingSecured: pctField,
  pctGradeImprovement: pctField,
  pctRecidivismReduction: pctField,
});

const GEO_SUGGESTIONS: Record<string, string[]> = {
  SPA: ["SPA 1", "SPA 2", "SPA 3", "SPA 4", "SPA 5", "SPA 6", "SPA 7", "SPA 8"],
  City: ["Los Angeles", "Long Beach", "Pasadena", "Santa Monica", "Glendale", "Burbank"],
  County: ["Los Angeles County", "Orange County", "San Bernardino County", "Riverside County", "Ventura County"],
  State: ["California", "Oregon", "Washington", "Arizona", "Nevada"],
};

export function AddImpactDialog({ program, lastGeographyLevel }: AddImpactDialogProps) {
  const [open, setOpen] = useState(false);
  const createImpact = useCreateImpactEntry();
  const [metricInputs, setMetricInputs] = useState<Record<string, string>>({});
  const [geoContext, setGeoContext] = useState<GeoContext | null>(null);
  const [zipLooking, setZipLooking] = useState(false);
  const zipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      programId: program.id,
      date: new Date().toISOString().split("T")[0],
      geographyLevel: (lastGeographyLevel || "City") as "SPA" | "City" | "County" | "State",
      geographyValue: "",
      zipCode: "",
      demographics: "",
      outcomes: "",
      metricValues: {} as Record<string, number>,
      pctCompletingProgram: "" as any,
      pctEmploymentGained: "" as any,
      pctHousingSecured: "" as any,
      pctGradeImprovement: "" as any,
      pctRecidivismReduction: "" as any,
    },
  });

  const geoLevel = form.watch("geographyLevel");
  const zipValue = form.watch("zipCode");
  const suggestions = GEO_SUGGESTIONS[geoLevel] || [];

  // Auto-resolve zip code as user types (debounced)
  useEffect(() => {
    if (zipTimer.current) clearTimeout(zipTimer.current);
    const zip = (zipValue || "").replace(/\D/g, "");
    if (zip.length !== 5) {
      setGeoContext(null);
      return;
    }
    zipTimer.current = setTimeout(async () => {
      setZipLooking(true);
      try {
        const res = await apiRequest("GET", `/api/zipcode/${zip}`);
        if (res.ok) {
          const ctx: GeoContext = await res.json();
          setGeoContext(ctx);
          // Keep whatever level is currently selected; just fill in the matching value.
          // Fall back to the most specific available level only if the current level has no data.
          const currentLevel = form.getValues("geographyLevel");
          const valueMap: Record<string, string | undefined> = {
            SPA: ctx.spa,
            City: ctx.city,
            County: ctx.county,
            State: ctx.state,
          };
          const preferred = valueMap[currentLevel];
          if (preferred) {
            form.setValue("geographyValue", preferred);
          } else if (ctx.spa) {
            form.setValue("geographyLevel", "SPA");
            form.setValue("geographyValue", ctx.spa);
          } else if (ctx.city) {
            form.setValue("geographyLevel", "City");
            form.setValue("geographyValue", ctx.city);
          } else if (ctx.county) {
            form.setValue("geographyLevel", "County");
            form.setValue("geographyValue", ctx.county);
          } else if (ctx.state) {
            form.setValue("geographyLevel", "State");
            form.setValue("geographyValue", ctx.state);
          }
        } else {
          setGeoContext(null);
        }
      } catch {
        setGeoContext(null);
      } finally {
        setZipLooking(false);
      }
    }, 500);
    return () => { if (zipTimer.current) clearTimeout(zipTimer.current); };
  }, [zipValue, form]);

  const onSubmit = (values: any) => {
    const numericMetrics: Record<string, number> = {};
    program.metrics.forEach((metric) => {
      const val = metricInputs[metric.name];
      if (val) numericMetrics[metric.name] = parseFloat(val);
    });

    createImpact.mutate(
      { ...values, programId: program.id, metricValues: numericMetrics },
      {
        onSuccess: () => {
          setOpen(false);
          form.reset();
          setMetricInputs({});
          setGeoContext(null);
        },
      }
    );
  };

  const hasEmptyMetrics = program.metrics.some(m => !metricInputs[m.name]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-log-impact">
          <Plus className="w-4 h-4 mr-2" />
          Log Impact
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Log Impact Data</DialogTitle>
          <p className="text-sm text-muted-foreground">Record your program's impact for a specific date and location.</p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-4">

            {/* Date & ZIP Code */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-impact-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="zipCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                      ZIP Code
                      {zipLooking && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                      {geoContext && !zipLooking && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. 90003"
                        {...field}
                        value={field.value || ""}
                        maxLength={5}
                        data-testid="input-zip"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Resolved context banner */}
            {geoContext && (
              <div className="flex flex-wrap gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {[geoContext.spa, geoContext.city, geoContext.county, geoContext.state]
                  .filter(Boolean)
                  .map((v, i, arr) => (
                    <span key={v}>
                      {v}{i < arr.length - 1 ? " ·" : ""}
                    </span>
                  ))}
              </div>
            )}

            {/* Geography (auto-filled from zip, editable) */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="geographyLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Level</FormLabel>
                    <Select
                      onValueChange={(val) => {
                        field.onChange(val);
                        if (geoContext) {
                          const valueMap: Record<string, string | undefined> = {
                            SPA: geoContext.spa,
                            City: geoContext.city,
                            County: geoContext.county,
                            State: geoContext.state,
                          };
                          const resolved = valueMap[val];
                          if (resolved) form.setValue("geographyValue", resolved);
                        }
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-geo-level">
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="SPA">SPA (Service Planning Area)</SelectItem>
                        <SelectItem value="City">City</SelectItem>
                        <SelectItem value="County">County</SelectItem>
                        <SelectItem value="State">State</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="geographyValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. SPA 6" {...field} data-testid="input-geo-value" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Suggestions (when no zip resolved) */}
            {!geoContext && suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1 -mt-3">
                {suggestions.slice(0, 4).map(s => (
                  <button
                    key={s}
                    type="button"
                    className="text-xs px-2 py-0.5 bg-muted rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                    onClick={() => form.setValue("geographyValue", s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Impact Metrics */}
            <div className="space-y-3 border-t pt-4">
              <h4 className="font-medium text-sm text-muted-foreground">Impact Metrics</h4>
              {program.metrics.map((metric) => (
                <div key={metric.id} className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor={`metric-${metric.id}`} className="col-span-2 text-sm font-medium">
                    {metric.name} <span className="text-muted-foreground font-normal">({metric.unit})</span>
                  </Label>
                  <Input
                    id={`metric-${metric.id}`}
                    type="number"
                    placeholder="0"
                    value={metricInputs[metric.name] || ""}
                    onChange={(e) => setMetricInputs(prev => ({ ...prev, [metric.name]: e.target.value }))}
                    className="col-span-1"
                    data-testid={`input-metric-${metric.id}`}
                  />
                </div>
              ))}

              {hasEmptyMetrics && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg text-amber-800 text-xs">
                  <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Missing some metrics? We'll record 0 for any you leave blank. You can update these later.</span>
                </div>
              )}
            </div>

            {/* Demographics & Outcomes */}
            <div className="space-y-3 border-t pt-4">
              <h4 className="font-medium text-sm text-muted-foreground">Additional Context (Optional)</h4>
              <FormField
                control={form.control}
                name="demographics"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Demographics</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. 60% female, 40% male; 70% Hispanic/Latino; Ages 25-54"
                        {...field}
                        value={field.value || ""}
                        className="h-16"
                        data-testid="input-demographics"
                      />
                    </FormControl>
                    <FormDescription>Describe the demographics of participants served.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="outcomes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Outcomes / Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. 95% of participants reported improved food security"
                        {...field}
                        value={field.value || ""}
                        className="h-16"
                        data-testid="input-outcomes"
                      />
                    </FormControl>
                    <FormDescription>Notable results or observations from this reporting period.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Outcome Percentages */}
            <div className="space-y-3 border-t pt-4">
              <div>
                <h4 className="font-medium text-sm text-muted-foreground">Outcome Percentages (Optional)</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Leave blank for any outcome that doesn't apply to this program.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { name: "pctCompletingProgram", label: "% Completing Program", testId: "input-pct-completing" },
                  { name: "pctEmploymentGained", label: "% Employment Gained", testId: "input-pct-employment" },
                  { name: "pctHousingSecured", label: "% Housing Secured", testId: "input-pct-housing" },
                  { name: "pctGradeImprovement", label: "% Grade Improvement", testId: "input-pct-grade" },
                  { name: "pctRecidivismReduction", label: "% Recidivism Reduction", testId: "input-pct-recidivism" },
                ] as const).map(({ name, label, testId }) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">{label}</FormLabel>
                        <div className="relative">
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              placeholder="—"
                              {...field}
                              value={field.value ?? ""}
                              onChange={e => field.onChange(e.target.value)}
                              className="pr-7"
                              data-testid={testId}
                            />
                          </FormControl>
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={createImpact.isPending} className="w-full sm:w-auto" data-testid="button-save-impact">
                {createImpact.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Entry"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

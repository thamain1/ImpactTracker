import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertImpactEntrySchema } from "@shared/schema";
import { useUpdateImpactEntry } from "@/hooks/use-impact";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Loader2, MapPin, CheckCircle2 } from "lucide-react";
import type { ProgramResponse } from "@shared/routes";
import type { ImpactEntry } from "@shared/schema";

interface EditImpactDialogProps {
  program: ProgramResponse;
  entry: ImpactEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface GeoContext {
  spa?: string;
  city?: string;
  county?: string;
  state?: string;
}

const formSchema = insertImpactEntrySchema.extend({
  programId: z.coerce.number(),
  zipCode: z.string().optional(),
  demographics: z.string().optional(),
  outcomes: z.string().optional(),
});

export function EditImpactDialog({ program, entry, open, onOpenChange }: EditImpactDialogProps) {
  const updateImpact = useUpdateImpactEntry();
  const mv = entry.metricValues as Record<string, number>;
  const [metricInputs, setMetricInputs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    Object.entries(mv).forEach(([k, v]) => { initial[k] = String(v); });
    return initial;
  });
  const [geoContext, setGeoContext] = useState<GeoContext | null>(
    (entry.geoContext as GeoContext | null) ?? null
  );
  const [zipLooking, setZipLooking] = useState(false);
  const zipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      programId: program.id,
      date: entry.date,
      geographyLevel: entry.geographyLevel as "SPA" | "City" | "County" | "State",
      geographyValue: entry.geographyValue,
      zipCode: entry.zipCode || "",
      demographics: entry.demographics || "",
      outcomes: entry.outcomes || "",
      metricValues: mv,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        programId: program.id,
        date: entry.date,
        geographyLevel: entry.geographyLevel as "SPA" | "City" | "County" | "State",
        geographyValue: entry.geographyValue,
        zipCode: entry.zipCode || "",
        demographics: entry.demographics || "",
        outcomes: entry.outcomes || "",
        metricValues: mv,
      });
      const initial: Record<string, string> = {};
      Object.entries(mv).forEach(([k, v]) => { initial[k] = String(v); });
      setMetricInputs(initial);
      setGeoContext((entry.geoContext as GeoContext | null) ?? null);
    }
  }, [open, entry.id]);

  const zipValue = form.watch("zipCode");

  // Auto-resolve zip on change (debounced)
  useEffect(() => {
    if (zipTimer.current) clearTimeout(zipTimer.current);
    const zip = (zipValue || "").replace(/\D/g, "");
    if (zip.length !== 5) {
      if (zip.length === 0) setGeoContext(null);
      return;
    }
    zipTimer.current = setTimeout(async () => {
      setZipLooking(true);
      try {
        const res = await apiRequest("GET", `/api/zipcode/${zip}`);
        if (res.ok) {
          const ctx: GeoContext = await res.json();
          setGeoContext(ctx);
          if (ctx.spa) {
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
      numericMetrics[metric.name] = val ? parseFloat(val) : 0;
    });

    updateImpact.mutate(
      {
        id: entry.id,
        programId: program.id,
        date: values.date,
        geographyLevel: values.geographyLevel,
        geographyValue: values.geographyValue,
        zipCode: values.zipCode || null,
        demographics: values.demographics || null,
        outcomes: values.outcomes || null,
        metricValues: numericMetrics,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Edit Impact Entry</DialogTitle>
          <p className="text-sm text-muted-foreground">Update the details for this impact entry.</p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-4">

            {/* Date & ZIP */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-edit-date" />
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
                        placeholder="e.g. 90012"
                        {...field}
                        value={field.value || ""}
                        maxLength={5}
                        data-testid="input-edit-zip"
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
                    <span key={v}>{v}{i < arr.length - 1 ? " ·" : ""}</span>
                  ))}
              </div>
            )}

            {/* Geography */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="geographyLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Level</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-geo-level">
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
                      <Input placeholder="e.g. SPA 6" {...field} data-testid="input-edit-geo-value" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Impact Metrics */}
            <div className="space-y-3 border-t pt-4">
              <h4 className="font-medium text-sm text-muted-foreground">Impact Metrics</h4>
              {program.metrics.map((metric) => (
                <div key={metric.id} className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor={`edit-metric-${metric.id}`} className="col-span-2 text-sm font-medium">
                    {metric.name} <span className="text-muted-foreground font-normal">({metric.unit})</span>
                  </Label>
                  <Input
                    id={`edit-metric-${metric.id}`}
                    type="number"
                    placeholder="0"
                    value={metricInputs[metric.name] || ""}
                    onChange={(e) => setMetricInputs(prev => ({ ...prev, [metric.name]: e.target.value }))}
                    className="col-span-1"
                    data-testid={`input-edit-metric-${metric.id}`}
                  />
                </div>
              ))}
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
                        placeholder="e.g. 60% female, 40% male; 70% Hispanic/Latino"
                        {...field}
                        value={field.value || ""}
                        className="h-16"
                        data-testid="input-edit-demographics"
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
                        data-testid="input-edit-outcomes"
                      />
                    </FormControl>
                    <FormDescription>Notable results or observations.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-edit">
                Cancel
              </Button>
              <Button type="submit" disabled={updateImpact.isPending} data-testid="button-save-edit">
                {updateImpact.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

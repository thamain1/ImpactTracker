import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertImpactEntrySchema } from "@shared/schema";
import { useUpdateImpactEntry } from "@/hooks/use-impact";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import type { ProgramResponse } from "@shared/routes";
import type { ImpactEntry } from "@shared/schema";

interface EditImpactDialogProps {
  program: ProgramResponse;
  entry: ImpactEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formSchema = insertImpactEntrySchema.extend({
  programId: z.coerce.number(),
  zipCode: z.string().optional(),
  demographics: z.string().optional(),
  outcomes: z.string().optional(),
});

const GEO_SUGGESTIONS: Record<string, string[]> = {
  SPA: ["SPA 1 - Antelope Valley", "SPA 2 - San Fernando", "SPA 3 - San Gabriel", "SPA 4 - Metro", "SPA 5 - West", "SPA 6 - South", "SPA 7 - East", "SPA 8 - South Bay"],
  City: ["Los Angeles", "Long Beach", "Pasadena", "Santa Monica", "Glendale", "Burbank"],
  County: ["Los Angeles County", "Orange County", "San Bernardino County", "Riverside County", "Ventura County"],
  State: ["California", "Oregon", "Washington", "Arizona", "Nevada"],
};

export function EditImpactDialog({ program, entry, open, onOpenChange }: EditImpactDialogProps) {
  const updateImpact = useUpdateImpactEntry();
  const mv = entry.metricValues as Record<string, number>;
  const [metricInputs, setMetricInputs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    Object.entries(mv).forEach(([k, v]) => { initial[k] = String(v); });
    return initial;
  });

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
    }
  }, [open, entry.id]);

  const geoLevel = form.watch("geographyLevel");
  const suggestions = GEO_SUGGESTIONS[geoLevel] || [];

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
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
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
                name="geographyLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Geography Level</FormLabel>
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
            </div>

            <FormField
              control={form.control}
              name="geographyValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Los Angeles, SPA 6, etc." {...field} data-testid="input-edit-geo-value" />
                  </FormControl>
                  {suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="zipCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ZIP Code (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. 90012" {...field} value={field.value || ""} data-testid="input-edit-zip" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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

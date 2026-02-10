import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertImpactEntrySchema } from "@shared/schema";
import { useCreateImpactEntry } from "@/hooks/use-impact";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Plus, Loader2, Lightbulb } from "lucide-react";
import type { ProgramResponse } from "@shared/routes";

interface AddImpactDialogProps {
  program: ProgramResponse;
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

export function AddImpactDialog({ program }: AddImpactDialogProps) {
  const [open, setOpen] = useState(false);
  const createImpact = useCreateImpactEntry();
  const [metricInputs, setMetricInputs] = useState<Record<string, string>>({});
  const [showSuggestions, setShowSuggestions] = useState(false);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      programId: program.id,
      date: new Date().toISOString().split("T")[0],
      geographyLevel: "City" as const,
      geographyValue: "",
      zipCode: "",
      demographics: "",
      outcomes: "",
      metricValues: {} as Record<string, number>,
    },
  });

  const geoLevel = form.watch("geographyLevel");
  const suggestions = GEO_SUGGESTIONS[geoLevel] || [];

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
            {/* Date & Geography */}
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
                name="geographyLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Geography Level</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
            </div>

            <FormField
              control={form.control}
              name="geographyValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Los Angeles, SPA 6, etc." {...field} data-testid="input-geo-value" />
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
                    <Input placeholder="e.g. 90012" {...field} value={field.value || ""} data-testid="input-zip" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                        placeholder="e.g. 95% of participants reported improved food security; 3 families connected to housing resources"
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

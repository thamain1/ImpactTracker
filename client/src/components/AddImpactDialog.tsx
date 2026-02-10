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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Loader2 } from "lucide-react";
import type { ProgramResponse } from "@shared/routes";

interface AddImpactDialogProps {
  program: ProgramResponse;
}

const formSchema = insertImpactEntrySchema.extend({
  programId: z.coerce.number(),
  // Metric values will be handled as a dynamic object in submit handler
});

export function AddImpactDialog({ program }: AddImpactDialogProps) {
  const [open, setOpen] = useState(false);
  const createImpact = useCreateImpactEntry();

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      programId: program.id,
      date: new Date().toISOString().split("T")[0],
      geographyLevel: "City" as const,
      geographyValue: "",
      metricValues: {} as Record<string, number>,
    },
  });

  // Manage metric inputs separately since they are dynamic JSON
  const [metricInputs, setMetricInputs] = useState<Record<string, string>>({});

  const onSubmit = (values: any) => {
    // Convert string inputs to numbers for the JSON payload
    const numericMetrics: Record<string, number> = {};
    
    program.metrics.forEach((metric) => {
      const val = metricInputs[metric.name];
      if (val) {
        numericMetrics[metric.name] = parseFloat(val);
      }
    });

    createImpact.mutate(
      {
        ...values,
        programId: program.id,
        metricValues: numericMetrics,
      },
      {
        onSuccess: () => {
          setOpen(false);
          form.reset();
          setMetricInputs({});
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-accent hover:bg-accent/90 text-white font-semibold shadow-lg shadow-accent/20">
          <Plus className="w-4 h-4 mr-2" />
          Log Impact
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Log Impact Data</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reporting Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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
                    <FormLabel>Geo Level</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
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
                  <FormLabel>Geography Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Los Angeles, SPA 6, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4 border-t pt-4">
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
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={createImpact.isPending} className="w-full sm:w-auto">
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

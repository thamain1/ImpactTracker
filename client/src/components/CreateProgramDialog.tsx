import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@shared/routes";
import { useCreateProgram } from "@/hooks/use-programs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Trash2, Loader2 } from "lucide-react";

// Use the exact input schema from api definition
const formSchema = api.programs.create.input.extend({
  orgId: z.coerce.number(),
});

interface CreateProgramDialogProps {
  orgId: number;
}

export function CreateProgramDialog({ orgId }: CreateProgramDialogProps) {
  const [open, setOpen] = useState(false);
  const createProgram = useCreateProgram();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      orgId,
      name: "",
      description: "",
      metrics: [{ name: "Participants", unit: "people" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "metrics",
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createProgram.mutate(values, {
      onSuccess: () => {
        setOpen(false);
        form.reset({
          orgId,
          name: "",
          description: "",
          metrics: [{ name: "Participants", unit: "people" }],
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shadow-lg hover:-translate-y-0.5 transition-all">
          <Plus className="w-4 h-4 mr-2" />
          New Program
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Create New Program</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Program Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Youth Mentorship 2024" {...field} />
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
                    <Input placeholder="Brief description of goals..." {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Impact Metrics to Track</h4>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => append({ name: "", unit: "", countsAsParticipant: true })}
                >
                  <Plus className="w-3 h-3 mr-2" /> Add Metric
                </Button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-3 items-end">
                  <FormField
                    control={form.control}
                    name={`metrics.${index}.name`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="text-xs">Metric Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Meals Served" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`metrics.${index}.unit`}
                    render={({ field }) => (
                      <FormItem className="w-24">
                        <FormLabel className="text-xs">Unit</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. meals" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={createProgram.isPending}>
                {createProgram.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Program"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

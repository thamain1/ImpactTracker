import { useState, useEffect } from "react";
import { resolveAgeBands, type AgeBand } from "@/lib/ageBands";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trash2 } from "lucide-react";
import { useUpdateSurveyResponse, useDeleteSurveyResponse } from "@/hooks/use-survey";

interface Program { id: number; name: string }

interface SurveyResponse {
  id: number;
  programId: number;
  respondentType: string;
  email: string | null;
  sex: string | null;
  ageRange: string | null;
  familySize: number | null;
  householdIncome: string | null;
  createdAt: string;
}

interface Props {
  response: SurveyResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgPrograms: Program[];
  programId: number;
  ageBands?: AgeBand[] | null;
  targetAgeMin?: number | null;
  targetAgeMax?: number | null;
}

export function EditSurveyResponseDialog({ response, open, onOpenChange, orgPrograms, programId, ageBands, targetAgeMin, targetAgeMax }: Props) {
  const update = useUpdateSurveyResponse(programId);
  const del = useDeleteSurveyResponse(programId);

  const [respondentType, setRespondentType] = useState("");
  const [linkedProgramId, setLinkedProgramId] = useState("");
  const [email, setEmail] = useState("");
  const [sex, setSex] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [familySize, setFamilySize] = useState("");
  const [householdIncome, setHouseholdIncome] = useState("");

  useEffect(() => {
    if (!response) return;
    setRespondentType(response.respondentType || "participant");
    setLinkedProgramId(String(response.programId));
    setEmail(response.email || "");
    setSex(response.sex || "");
    setAgeRange(response.ageRange || "");
    setFamilySize(response.familySize != null ? String(response.familySize) : "");
    setHouseholdIncome(response.householdIncome || "");
  }, [response]);

  if (!response) return null;

  const handleSave = () => {
    update.mutate({
      id: response.id,
      respondentType,
      programId: parseInt(linkedProgramId) || response.programId,
      email: email || null,
      sex: sex || null,
      ageRange: ageRange || null,
      familySize: familySize ? parseInt(familySize) : null,
      householdIncome: householdIncome || null,
    }, { onSuccess: () => onOpenChange(false) });
  };

  const handleDelete = () => {
    del.mutate(response.id, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Survey Response</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Respondent type */}
          <div className="space-y-1.5">
            <Label>Respondent Type</Label>
            <Select value={respondentType} onValueChange={setRespondentType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="participant">Participant</SelectItem>
                <SelectItem value="supporter">Supporter</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Program */}
          <div className="space-y-1.5">
            <Label>Program</Label>
            <Select value={linkedProgramId} onValueChange={setLinkedProgramId}>
              <SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger>
              <SelectContent>
                {orgPrograms.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Sex */}
            <div className="space-y-1.5">
              <Label>Sex</Label>
              <Select value={sex || "__none__"} onValueChange={v => setSex(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="non-binary">Non-binary</SelectItem>
                  <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Age Range — resolved from program config; full master list is the fallback so staff can always reclassify */}
            {(() => {
              const resolvedBands = resolveAgeBands(ageBands, targetAgeMin, targetAgeMax);
              // If the saved value isn't in the resolved list (e.g. legacy "under-18"), prepend it
              const hasCurrentValue = !ageRange || ageRange === "__none__" || resolvedBands.some(b => b.value === ageRange);
              const displayBands = hasCurrentValue
                ? resolvedBands
                : [{ value: ageRange, label: ageRange }, ...resolvedBands];
              return (
                <div className="space-y-1.5">
                  <Label>Age Range</Label>
                  <Select value={ageRange || "__none__"} onValueChange={v => setAgeRange(v === "__none__" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {displayBands.map(b => (
                        <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })()}

            {/* Family Size */}
            <div className="space-y-1.5">
              <Label>Family Size</Label>
              <Select value={familySize || "__none__"} onValueChange={v => setFamilySize(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {["1","2","3","4","5","6","7","8"].map(n => (
                    <SelectItem key={n} value={n}>{n === "8" ? "8+" : n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Household Income */}
            <div className="space-y-1.5">
              <Label>Household Income</Label>
              <Select value={householdIncome || "__none__"} onValueChange={v => setHouseholdIncome(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  <SelectItem value="under-25k">Under $25K</SelectItem>
                  <SelectItem value="25k-49k">$25K–$49K</SelectItem>
                  <SelectItem value="50k-74k">$50K–$74K</SelectItem>
                  <SelectItem value="75k-99k">$75K–$99K</SelectItem>
                  <SelectItem value="100k-plus">$100K+</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-2">
          <Button
            variant="destructive"
            size="sm"
            disabled={del.isPending}
            onClick={handleDelete}
          >
            {del.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={update.isPending} onClick={handleSave}>
              {update.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

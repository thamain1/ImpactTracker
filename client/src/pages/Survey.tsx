import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle, ChevronLeft, Loader2, Package } from "lucide-react";

interface SurveyMetric {
  id: number;
  name: string;
  unit: string;
  itemType: string;
  allocationType: string;
  allocationBaseQty: number;
  allocationThreshold?: number | null;
  allocationBonusQty?: number | null;
  customQuestionPrompt?: string | null;
  inventoryRemaining?: number | null;
}

interface SurveyProgram {
  id: number;
  name: string;
  metrics: SurveyMetric[];
}

interface SurveyData {
  programId: number;
  programName: string;
  orgName: string;
  orgMission: string;
  programs: SurveyProgram[];
}

interface Allocation {
  programId: number;
  metricId: number;
  metricName: string;
  unit: string;
  qty: number;
}

type Role = "" | "participant" | "supporter";

function calcAllocations(
  programs: SurveyProgram[],
  selectedProgramIds: number[],
  familySize: number | null,
  customAnswers: Record<number, number>
): Allocation[] {
  const result: Allocation[] = [];
  for (const prog of programs.filter(p => selectedProgramIds.includes(p.id))) {
    for (const metric of prog.metrics) {
      let qty = metric.allocationBaseQty;
      if (metric.allocationType === "family_size_scaled"
          && familySize != null
          && metric.allocationThreshold != null
          && familySize > metric.allocationThreshold) {
        qty += metric.allocationBonusQty ?? 0;
      } else if (metric.allocationType === "custom_question") {
        qty = customAnswers[prog.id] ?? 0;
      }
      result.push({
        programId: prog.id,
        metricId: metric.id,
        metricName: metric.name,
        unit: metric.unit,
        qty,
      });
    }
  }
  return result;
}

function initialState() {
  return {
    step: 0,
    role: "" as Role,
    selectedProgramIds: [] as number[],
    email: "",
    sex: "",
    ageRange: "",
    familySize: "",
    householdIncome: "",
    countdown: 5,
  };
}

export default function Survey() {
  const [, params] = useRoute("/survey/:programId");
  const programId = params?.programId;

  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Role>("");
  const [selectedProgramIds, setSelectedProgramIds] = useState<number[]>([]);
  const [email, setEmail] = useState("");
  const [sex, setSex] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [familySize, setFamilySize] = useState("");
  const [householdIncome, setHouseholdIncome] = useState("");
  const [countdown, setCountdown] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Allocation-related state
  const [customAnswers, setCustomAnswers] = useState<Record<number, number>>({});
  const [modalProgram, setModalProgram] = useState<SurveyProgram | null>(null);
  const [modalAnswer, setModalAnswer] = useState("");
  const [allocations, setAllocations] = useState<Allocation[]>([]);

  // Fetch survey data on mount
  useEffect(() => {
    if (!programId) return;
    fetch(`/api/survey/${programId}`)
      .then(r => {
        if (!r.ok) throw new Error(`Program not found (${r.status})`);
        return r.json();
      })
      .then(setSurvey)
      .catch(e => setLoadError(e.message));
  }, [programId]);

  // Auto-reset countdown when on thank-you step (step 5)
  useEffect(() => {
    if (step !== 5) return;
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(interval);
          resetForm();
          return 5;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  function resetForm() {
    const s = initialState();
    setStep(s.step);
    setRole(s.role);
    setSelectedProgramIds(s.selectedProgramIds);
    setEmail(s.email);
    setSex(s.sex);
    setAgeRange(s.ageRange);
    setFamilySize(s.familySize);
    setHouseholdIncome(s.householdIncome);
    setCountdown(s.countdown);
    setSubmitError(null);
    setCustomAnswers({});
    setAllocations([]);
  }

  function handleProgramCheck(prog: SurveyProgram, checked: boolean) {
    if (checked) {
      setSelectedProgramIds(prev => [...prev, prog.id]);
      // If this program has a custom_question metric, open the modal
      const hasCustomQ = prog.metrics.some(m => m.allocationType === "custom_question");
      if (hasCustomQ) {
        setModalProgram(prog);
        setModalAnswer("");
      }
    } else {
      setSelectedProgramIds(prev => prev.filter(id => id !== prog.id));
      setCustomAnswers(prev => {
        const next = { ...prev };
        delete next[prog.id];
        return next;
      });
    }
  }

  function confirmCustomAnswer() {
    if (!modalProgram) return;
    const num = parseInt(modalAnswer) || 0;
    setCustomAnswers(prev => ({ ...prev, [modalProgram.id]: num }));
    setModalProgram(null);
    setModalAnswer("");
  }

  async function submitResponse(type: Role) {
    if (!programId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const body: Record<string, unknown> = {
        respondentType: type,
      };
      if (type === "participant") {
        body.email = email || null;
        body.sex = sex || null;
        body.ageRange = ageRange || null;
        body.familySize = familySize ? parseInt(familySize) : null;
        body.householdIncome = householdIncome || null;
        body.allocations = allocations.map(a => ({
          programId: a.programId,
          metricId: a.metricId,
          qty: a.qty,
        }));
      }
      const res = await fetch(`/api/survey/${programId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).message || `Submit failed (${res.status})`);
      }
      setStep(5);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleContinue() {
    if (step === 0) {
      if (!role) return;
      if (role === "supporter") {
        await submitResponse("supporter");
      } else {
        setStep(1);
      }
    } else if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      // Compute allocations, then advance to preview step
      if (survey) {
        const fs = familySize ? parseInt(familySize) : null;
        const computed = calcAllocations(survey.programs, selectedProgramIds, fs, customAnswers);
        setAllocations(computed);
      }
      setStep(4);
    } else if (step === 4) {
      await submitResponse("participant");
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold text-red-600">Unable to load survey</p>
          <p className="text-sm text-slate-500">{loadError}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50 flex flex-col">
      {/* Custom question modal */}
      {modalProgram && (
        <Dialog open={!!modalProgram} onOpenChange={(open) => { if (!open) setModalProgram(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{modalProgram.name}</DialogTitle>
            </DialogHeader>
            {modalProgram.metrics
              .filter(m => m.allocationType === "custom_question" && m.customQuestionPrompt)
              .map(m => (
                <div key={m.id} className="space-y-2">
                  <Label>{m.customQuestionPrompt}</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={modalAnswer}
                    onChange={e => setModalAnswer(e.target.value)}
                  />
                </div>
              ))}
            <DialogFooter>
              <Button onClick={confirmCustomAnswer}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Org branding header */}
      <header className="bg-white border-b border-slate-200 px-6 py-6 text-center shadow-sm">
        <div className="max-w-lg mx-auto space-y-1">
          <h1 className="text-3xl font-bold text-slate-900">{survey.orgName}</h1>
          {survey.orgMission && (
            <p className="text-sm italic text-slate-500">{survey.orgMission}</p>
          )}
          <div className="pt-1">
            <Badge variant="secondary" className="text-xs font-medium">
              Program: {survey.programName}
            </Badge>
          </div>
        </div>
      </header>

      {/* Step card */}
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6">

          {submitError && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          {/* Step 0 — Role selection */}
          {step === 0 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-slate-800">Welcome!</h2>
                <p className="text-slate-500">Are you here as a…</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-select">I am a</Label>
                <Select value={role} onValueChange={v => setRole(v as Role)}>
                  <SelectTrigger id="role-select">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="participant">Participant</SelectItem>
                    <SelectItem value="supporter">Supporter (volunteer / donor / helper)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                disabled={!role || submitting}
                onClick={handleContinue}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Continue
              </Button>
            </div>
          )}

          {/* Step 1 — Program selection (participants only) */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-slate-800">Which programs are you here for today?</h2>
                <p className="text-slate-400 text-sm">Select all that apply</p>
              </div>
              <div className="space-y-3">
                {survey.programs.length === 0 && (
                  <p className="text-slate-400 text-sm italic">No active programs found.</p>
                )}
                {survey.programs.map(p => {
                  const checked = selectedProgramIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        checked
                          ? "border-primary bg-primary/5"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleProgramCheck(p, !checked)}
                        className="accent-primary w-4 h-4"
                      />
                      <span className="text-slate-700 font-medium">{p.name}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(0)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <Button className="flex-1" onClick={handleContinue}>
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 2 — Email (participants only) */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-slate-800">Contact (optional)</h2>
                <p className="text-slate-400 text-sm">We&apos;ll never share your information.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-input">Email address</Label>
                <Input
                  id="email-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <Button className="flex-1" onClick={handleContinue}>
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 3 — Demographics (participants only) */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-slate-800">About You</h2>
                <p className="text-slate-400 text-sm">All fields are optional.</p>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Sex</Label>
                  <Select value={sex} onValueChange={setSex}>
                    <SelectTrigger>
                      <SelectValue placeholder="Prefer not to say" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="non-binary">Non-binary</SelectItem>
                      <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Age Range</Label>
                  <Select value={ageRange} onValueChange={setAgeRange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select age range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="under-18">Under 18</SelectItem>
                      <SelectItem value="18-24">18–24</SelectItem>
                      <SelectItem value="25-34">25–34</SelectItem>
                      <SelectItem value="35-44">35–44</SelectItem>
                      <SelectItem value="45-54">45–54</SelectItem>
                      <SelectItem value="55-64">55–64</SelectItem>
                      <SelectItem value="65+">65+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Family Size</Label>
                  <Select value={familySize} onValueChange={setFamilySize}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select family size" />
                    </SelectTrigger>
                    <SelectContent>
                      {["1","2","3","4","5","6","7","8"].map(n => (
                        <SelectItem key={n} value={n}>{n === "8" ? "8+" : n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Household Income</Label>
                  <Select value={householdIncome} onValueChange={setHouseholdIncome}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select income range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="under-25k">Under $25K</SelectItem>
                      <SelectItem value="25k-49k">$25K–$49K</SelectItem>
                      <SelectItem value="50k-74k">$50K–$74K</SelectItem>
                      <SelectItem value="75k-99k">$75K–$99K</SelectItem>
                      <SelectItem value="100k-plus">$100K+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <Button className="flex-1" onClick={handleContinue}>
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 4 — Allocation Preview */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-slate-800">Here&apos;s what you&apos;ll receive today:</h2>
                <p className="text-slate-400 text-sm">Please confirm before submitting.</p>
              </div>

              {allocations.length === 0 ? (
                <p className="text-slate-400 text-sm italic">No items to display.</p>
              ) : (
                <div className="space-y-4">
                  {(() => {
                    const byProgram: Record<number, { name: string; items: Allocation[] }> = {};
                    allocations.forEach(a => {
                      if (!byProgram[a.programId]) {
                        const prog = survey.programs.find(p => p.id === a.programId);
                        byProgram[a.programId] = { name: prog?.name ?? "Program", items: [] };
                      }
                      byProgram[a.programId].items.push(a);
                    });
                    return Object.entries(byProgram).map(([pid, group]) => (
                      <div key={pid} className="rounded-lg border border-slate-200 p-4">
                        <p className="text-sm font-semibold text-slate-700 mb-2">{group.name}</p>
                        <ul className="space-y-1">
                          {group.items.map(a => (
                            <li key={a.metricId} className="flex items-center gap-2 text-sm text-slate-600">
                              <Package className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span className="font-medium text-slate-800">{a.metricName}</span>
                              <span className="text-slate-400">×</span>
                              <span className="font-bold text-primary">{a.qty}</span>
                              <span className="text-slate-400 text-xs">{a.unit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ));
                  })()}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <Button className="flex-1" disabled={submitting} onClick={handleContinue}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Submit
                </Button>
              </div>
            </div>
          )}

          {/* Step 5 — Thank you */}
          {step === 5 && (
            <div className="text-center space-y-5 py-4">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-slate-800">
                  {role === "supporter" ? "Thank you for your support!" : "Thank you for your time!"}
                </h2>
                <p className="text-slate-500 text-sm">Your response has been recorded.</p>
              </div>
              <p className="text-slate-400 text-sm">
                Resetting in {countdown}…
              </p>
              <Button variant="outline" onClick={resetForm} className="mx-auto">
                Start Over Now
              </Button>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

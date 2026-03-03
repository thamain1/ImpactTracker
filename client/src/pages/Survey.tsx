import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ChevronLeft, Loader2 } from "lucide-react";

interface SurveyData {
  programId: number;
  programName: string;
  orgName: string;
  orgMission: string;
  metrics: { name: string; unit: string }[];
}

type Role = "" | "participant" | "supporter";

function initialState() {
  return {
    step: 0,
    role: "" as Role,
    resources: [] as string[],
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
  const [resources, setResources] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [sex, setSex] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [familySize, setFamilySize] = useState("");
  const [householdIncome, setHouseholdIncome] = useState("");
  const [countdown, setCountdown] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  // Auto-reset countdown when on thank-you step
  useEffect(() => {
    if (step !== 4) return;
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
    setResources(s.resources);
    setEmail(s.email);
    setSex(s.sex);
    setAgeRange(s.ageRange);
    setFamilySize(s.familySize);
    setHouseholdIncome(s.householdIncome);
    setCountdown(s.countdown);
    setSubmitError(null);
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
        body.resourceSelected = resources.length > 0 ? resources : null;
        body.email = email || null;
        body.sex = sex || null;
        body.ageRange = ageRange || null;
        body.familySize = familySize ? parseInt(familySize) : null;
        body.householdIncome = householdIncome || null;
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
      setStep(4);
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

          {/* Step 1 — Resource selection (participants only) */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-slate-800">Which resources are you taking advantage of today?</h2>
                <p className="text-slate-400 text-sm">Select all that apply</p>
              </div>
              <div className="space-y-3">
                {survey.metrics.length === 0 && (
                  <p className="text-slate-400 text-sm italic">No resources configured for this program.</p>
                )}
                {survey.metrics.map(m => {
                  const checked = resources.includes(m.name);
                  return (
                    <label
                      key={m.name}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        checked
                          ? "border-primary bg-primary/5"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        value={m.name}
                        checked={checked}
                        onChange={() =>
                          setResources(prev =>
                            checked ? prev.filter(r => r !== m.name) : [...prev, m.name]
                          )
                        }
                        className="accent-primary w-4 h-4"
                      />
                      <span className="text-slate-700 font-medium">{m.name}</span>
                      <span className="text-slate-400 text-sm ml-auto">{m.unit}</span>
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
                <Button className="flex-1" disabled={submitting} onClick={handleContinue}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Submit
                </Button>
              </div>
            </div>
          )}

          {/* Step 4 — Thank you */}
          {step === 4 && (
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

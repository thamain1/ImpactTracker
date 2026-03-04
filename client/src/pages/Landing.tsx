import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

type AuthMode = "signin" | "signup";

export default function Landing() {
  // ── Auth modal state ────────────────────────────────────────────────────────
  const [signInOpen, setSignInOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // ── Early access form state ─────────────────────────────────────────────────
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);
  const [programCount, setProgramCount] = useState("");
  const [trackingMethod, setTrackingMethod] = useState("");
  const [formError, setFormError] = useState("");

  // ── Auth submit ─────────────────────────────────────────────────────────────
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { first_name: firstName || null, last_name: lastName || null } },
        });
        if (error) throw error;
        toast({ title: "Account created", description: "Welcome to MetriProof! You are now signed in." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      setSignInOpen(false);
      navigate("/");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast({
        title: mode === "signup" ? "Sign up failed" : "Sign in failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Early access form submit ────────────────────────────────────────────────
  const earlyAccessMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Submission failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setIsFormSubmitted(true);
      setFormError("");
    },
    onError: (error: Error) => {
      setFormError(error.message);
    },
  });

  const scrollToForm = () => {
    document.getElementById("early-access-form")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-white text-foreground font-sans selection:bg-primary/20">

      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-100 sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <div className="container mx-auto px-6 h-28 flex items-center justify-between">
          <div className="flex items-center">
            <img src="/metriproof-logo.png" alt="MetriProof" className="h-24 w-auto" />
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              className="text-sm font-medium hover:bg-gray-50"
              onClick={() => { setSignInOpen(true); setMode("signin"); }}
              data-testid="nav-signin"
            >
              Sign In
            </Button>
            <Button
              variant="ghost"
              className="text-sm font-medium hover:bg-gray-50"
              onClick={scrollToForm}
              data-testid="nav-cta"
            >
              Request Access
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="pt-24 pb-32 overflow-hidden">
          <div className="container mx-auto px-6">
            <div className="flex flex-col lg:flex-row items-center gap-16">
              <div className="w-full lg:w-1/2 flex flex-col items-start text-left">
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1] mb-6">
                  Measure What Matters.{" "}
                  <span className="text-primary block">Prove What Works.</span>
                </h1>
                <p className="text-xl font-medium text-slate-600 mb-10 leading-relaxed max-w-xl">
                  MetriProof is a simple platform that helps nonprofits capture participant data, track program outcomes,
                  and generate funder-ready reports — without messy spreadsheets.
                </p>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <Button
                    size="lg"
                    className="h-14 px-8 text-base bg-primary hover:bg-primary/90 text-white rounded-lg shadow-sm"
                    onClick={scrollToForm}
                    data-testid="hero-cta"
                  >
                    Request Early Access
                  </Button>
                  <span className="text-sm font-medium text-slate-500 flex items-center gap-2">
                    <span className="w-8 h-[1px] bg-slate-300 inline-block"></span>
                    Built for nonprofit leaders
                  </span>
                </div>
              </div>
              <div className="w-full lg:w-1/2 relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent rounded-2xl -m-4 sm:-m-8 z-0"></div>
                <div className="relative z-10 rounded-xl border border-gray-200/60 shadow-2xl overflow-hidden bg-white/50 backdrop-blur-sm">
                  <img
                    src="/dashboard-mockup.png"
                    alt="MetriProof Dashboard"
                    className="w-full h-auto object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── The Problem ───────────────────────────────────────────────────── */}
        <section className="py-24 bg-gray-50 border-y border-gray-100">
          <div className="container mx-auto px-6 max-w-4xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 tracking-tight">
                Most nonprofits are doing powerful work —{" "}
                <br className="hidden md:block" />
                but struggle to clearly prove it.
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {[
                "Data lives in disconnected spreadsheets",
                "Funders request numbers that take hours to find",
                "Reports take weeks to prepare manually",
                "Staff spend more time reporting than serving",
              ].map((problem, i) => (
                <div key={i} className="flex items-start gap-4 p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                  <div className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-lg font-bold block leading-none">&times;</span>
                  </div>
                  <p className="text-slate-700 font-medium leading-relaxed">{problem}</p>
                </div>
              ))}
            </div>
            <div className="text-center">
              <p className="inline-block px-6 py-3 bg-white border border-gray-200 rounded-full text-lg font-semibold text-slate-800 shadow-sm">
                Impact shouldn&apos;t be hard to show.
              </p>
            </div>
          </div>
        </section>

        {/* ── The Solution ──────────────────────────────────────────────────── */}
        <section className="py-32">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 tracking-tight">
                MetriProof simplifies everything.
              </h2>
              <p className="text-xl text-slate-600">No clutter. No overbuilt dashboards. Just clarity.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-x-8 gap-y-12 max-w-5xl mx-auto">
              {[
                { title: "Track participants", desc: "across multiple programs effortlessly" },
                { title: "Monitor goals", desc: "vs. actual performance in real time" },
                { title: "Measure impact", desc: "consistently across all locations" },
                { title: "Generate reports", desc: "clean, visual, and ready instantly" },
                { title: "Know true costs", desc: "understand your cost per participant" },
              ].map((feature, i) => (
                <div key={i} className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-6">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{feature.title}</h3>
                  <p className="text-slate-600">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Who It's For ──────────────────────────────────────────────────── */}
        <section className="py-24 bg-slate-900 text-white">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-16 items-center">
              <div className="w-full md:w-1/2">
                <h2 className="text-3xl md:text-4xl font-bold mb-6 tracking-tight">
                  Built for organizations that manage programs and need clean reporting.
                </h2>
                <div className="w-12 h-1 bg-primary mb-8"></div>
              </div>
              <div className="w-full md:w-1/2">
                <ul className="space-y-4 text-lg text-slate-300">
                  {[
                    "Executive Directors",
                    "Program Managers",
                    "Grant Writers",
                    "Community Organizations",
                    "Foundations managing multiple initiatives",
                  ].map((role, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <ArrowRight className="w-5 h-5 text-primary" />
                      <span className="font-medium text-white">{role}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── Early Access Form + Pricing ───────────────────────────────────── */}
        <section id="early-access-form" className="py-32 bg-gray-50">
          <div className="container mx-auto px-6">
            <div className="max-w-6xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col lg:flex-row border border-gray-100">

              {/* Pricing Column */}
              <div className="w-full lg:w-2/5 bg-primary p-12 lg:p-16 flex flex-col justify-between text-white">
                <div>
                  <div className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-semibold tracking-wider uppercase mb-8">
                    Early Access
                  </div>
                  <h2 className="text-3xl lg:text-4xl font-bold mb-6 leading-tight">
                    Join the Founding Impact Cohort
                  </h2>
                  <p className="text-blue-100 mb-10 text-lg leading-relaxed">
                    We&apos;re onboarding 25 nonprofit leaders who want clarity, clean reporting, and real-time visibility into program impact.
                  </p>
                  <div className="mb-12">
                    <p className="text-blue-200 text-sm font-medium mb-2 uppercase tracking-wide">Founding Partner Rate</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold">$1,200</span>
                      <span className="text-blue-200">/ year</span>
                    </div>
                    <p className="text-blue-200 text-sm mt-3 opacity-80">(Locks in pricing before tiered public launch)</p>
                  </div>
                </div>
                <div className="pt-8 border-t border-white/20">
                  <p className="font-medium flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-40"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                    </span>
                    Limited to 25 organizations.
                  </p>
                </div>
              </div>

              {/* Form Column */}
              <div className="w-full lg:w-3/5 p-12 lg:p-16">
                <h3 className="text-2xl font-bold text-slate-900 mb-8">Apply for Early Access</h3>

                {isFormSubmitted ? (
                  <div className="flex flex-col items-center justify-center text-center py-12 space-y-4 animate-in fade-in zoom-in duration-500">
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center text-green-500 mb-4">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h4 className="text-2xl font-bold text-slate-900">You&apos;re on the list!</h4>
                    <p className="text-slate-600 text-lg max-w-md">
                      Thank you for your interest. We&apos;ve received your application and will be in touch with next steps shortly.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-8 border-gray-200 text-slate-600 hover:bg-gray-50"
                      onClick={() => setIsFormSubmitted(false)}
                    >
                      Submit another response
                    </Button>
                  </div>
                ) : (
                  <form
                    className="space-y-6"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const formData = new FormData(form);
                      earlyAccessMutation.mutate({
                        firstName: formData.get("firstName") as string,
                        lastName: formData.get("lastName") as string,
                        organizationName: formData.get("orgName") as string,
                        role: formData.get("role") as string,
                        email: formData.get("email") as string,
                        programCount,
                        trackingMethod,
                        biggestChallenge: formData.get("challenge") as string,
                      });
                    }}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input id="firstName" name="firstName" placeholder="Jane" className="bg-gray-50 border-gray-200 h-12" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input id="lastName" name="lastName" placeholder="Doe" className="bg-gray-50 border-gray-200 h-12" required />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="orgName">Organization Name</Label>
                        <Input id="orgName" name="orgName" placeholder="Hope Foundation" className="bg-gray-50 border-gray-200 h-12" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Input id="role" name="role" placeholder="Executive Director" className="bg-gray-50 border-gray-200 h-12" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="formEmail">Email</Label>
                      <Input id="formEmail" name="email" type="email" placeholder="jane@hopefoundation.org" className="bg-gray-50 border-gray-200 h-12" required />
                    </div>
                    <div className="space-y-2">
                      <Label>How many programs do you manage?</Label>
                      <Select value={programCount} onValueChange={setProgramCount} required>
                        <SelectTrigger className="bg-gray-50 border-gray-200 h-12">
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1-3">1–3 programs</SelectItem>
                          <SelectItem value="4-10">4–10 programs</SelectItem>
                          <SelectItem value="10+">10+ programs</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Are you currently tracking impact digitally?</Label>
                      <Select value={trackingMethod} onValueChange={setTrackingMethod} required>
                        <SelectTrigger className="bg-gray-50 border-gray-200 h-12">
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="platform">Yes, using a specialized platform</SelectItem>
                          <SelectItem value="spreadsheets">Yes, using spreadsheets (Excel/Sheets)</SelectItem>
                          <SelectItem value="no">No, mostly paper or not tracking</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="challenge">Biggest reporting challenge?</Label>
                      <Textarea
                        id="challenge"
                        name="challenge"
                        placeholder="Briefly describe your main struggle with data and reporting..."
                        className="bg-gray-50 border-gray-200 resize-none h-24"
                        required
                      />
                    </div>
                    {formError && (
                      <p className="text-red-500 text-sm">{formError}</p>
                    )}
                    <Button
                      type="submit"
                      size="lg"
                      className="w-full h-14 text-lg font-medium mt-4 bg-slate-900 hover:bg-slate-800 text-white"
                      disabled={earlyAccessMutation.isPending}
                    >
                      {earlyAccessMutation.isPending ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" /> Submitting...
                        </span>
                      ) : (
                        "Join Early Access"
                      )}
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="py-12 border-t border-gray-100 bg-white">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="font-bold text-xl tracking-tight text-slate-900">MetriProof</div>
          <div className="flex items-center gap-6 text-sm text-slate-500 font-medium">
            <span>&copy; 2026 MetriProof.</span>
          </div>
        </div>
      </footer>

      {/* ── Sign In Modal ─────────────────────────────────────────────────────── */}
      <Dialog open={signInOpen} onOpenChange={setSignInOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-2xl text-slate-900">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </DialogTitle>
            <p className="text-sm text-slate-500 mt-1">
              {mode === "signin"
                ? "Sign in to your MetriProof account."
                : "Start tracking your program impact today."}
            </p>
          </DialogHeader>

          <form onSubmit={handleAuthSubmit} className="space-y-4 mt-2">
            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="authFirstName">First name</Label>
                  <Input
                    id="authFirstName"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="Jane"
                    autoComplete="given-name"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="authLastName">Last name</Label>
                  <Input
                    id="authLastName"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Smith"
                    autoComplete="family-name"
                  />
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="authEmail">Email</Label>
              <Input
                id="authEmail"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jane@nonprofit.org"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="authPassword">Password</Label>
              <Input
                id="authPassword"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "At least 6 characters" : "••••••••"}
                required
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {mode === "signin" ? "Signing in..." : "Creating account..."}
                </>
              ) : mode === "signin" ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-slate-500">
            {mode === "signin" ? (
              <>
                Don&apos;t have an account?{" "}
                <button type="button" onClick={() => setMode("signup")} className="text-primary font-medium hover:underline">
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button type="button" onClick={() => setMode("signin")} className="text-primary font-medium hover:underline">
                  Sign in
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

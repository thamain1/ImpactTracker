import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3, Globe2, Layers, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

type AuthMode = "signin" | "signup";

export default function Landing() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName || null,
              last_name: lastName || null,
            },
          },
        });
        if (error) throw error;
        toast({
          title: "Account created",
          description: "Welcome to ImpactTracker! You are now signed in.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      <header className="px-6 py-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <Globe2 className="w-8 h-8 text-primary" />
          <span className="font-heading font-bold text-2xl text-slate-900">ImpactTracker</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row">
        {/* Hero Section */}
        <section className="flex-1 flex flex-col justify-center items-center text-center px-6 py-16 max-w-2xl mx-auto lg:mx-0 lg:pl-16 lg:text-left lg:items-start">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Enhanced Geography Tracking
          </div>

          <h1 className="font-heading font-extrabold text-5xl md:text-6xl tracking-tight text-slate-900 mb-6">
            Measure your{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400">
              Impact
            </span>
            <br />
            Tell your story.
          </h1>

          <p className="text-lg text-slate-600 max-w-xl mb-10 leading-relaxed">
            The all-in-one platform for nonprofits to track program outcomes, visualize geographic impact,
            and generate grant-ready reports in seconds.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-xl">
            <div className="flex flex-col gap-2">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <BarChart3 className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-slate-800">Real-time Analytics</p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                <Globe2 className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-slate-800">Geographic Mapping</p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                <Layers className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-slate-800">Grant-Ready Reports</p>
            </div>
          </div>
        </section>

        {/* Auth Form */}
        <section className="flex items-center justify-center px-6 py-16 lg:py-0 lg:w-[440px] lg:flex-shrink-0">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
            <div className="mb-6">
              <h2 className="font-heading font-bold text-2xl text-slate-900 mb-1">
                {mode === "signin" ? "Welcome back" : "Create your account"}
              </h2>
              <p className="text-sm text-slate-500">
                {mode === "signin"
                  ? "Sign in to your ImpactTracker account."
                  : "Start tracking your program impact today."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="Jane"
                      autoComplete="given-name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      placeholder="Smith"
                      autoComplete="family-name"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="jane@nonprofit.org"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
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

            <div className="mt-5 text-center text-sm text-slate-500">
              {mode === "signin" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className="text-primary font-medium hover:underline"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className="text-primary font-medium hover:underline"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-50 py-8 px-6 border-t border-slate-200 text-center">
        <p className="text-slate-500 font-medium text-sm">© 2024 ImpactTracker. Built for change makers.</p>
      </footer>
    </div>
  );
}

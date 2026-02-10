import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { BarChart3, Globe2, Layers, CheckCircle } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      <header className="px-6 py-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <Globe2 className="w-8 h-8 text-primary" />
          <span className="font-heading font-bold text-2xl text-slate-900">ImpactTracker</span>
        </div>
        <div className="flex gap-4">
          <a href="/api/login">
            <Button variant="ghost" className="font-medium">Log In</Button>
          </a>
          <a href="/api/login">
            <Button className="font-semibold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
              Get Started
            </Button>
          </a>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {/* Hero Section */}
        <section className="flex-1 flex flex-col justify-center items-center text-center px-4 py-20 lg:py-32 max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            New: Enhanced Geography Tracking
          </div>
          
          <h1 className="font-heading font-extrabold text-5xl md:text-7xl tracking-tight text-slate-900 mb-6">
            Measure your <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400">Impact</span> <br className="hidden md:block"/>
            Tell your story.
          </h1>
          
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mb-10 leading-relaxed">
            The all-in-one platform for nonprofits to track program outcomes, visualize geographic impact, and generate grant-ready reports in seconds.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
            <a href="/api/login">
              <Button size="lg" className="h-14 px-8 text-lg w-full sm:w-auto bg-primary hover:bg-primary/90 shadow-xl shadow-primary/25">
                Start Tracking Free
              </Button>
            </a>
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg w-full sm:w-auto border-slate-300">
              View Demo
            </Button>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="bg-white py-24 border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-12">
              <div className="flex flex-col gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-2">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h3 className="font-heading font-bold text-xl">Real-time Analytics</h3>
                <p className="text-slate-600 leading-relaxed">
                  Watch your impact grow with live dashboards. Track meals served, students taught, and lives changed as it happens.
                </p>
              </div>
              <div className="flex flex-col gap-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 mb-2">
                  <Globe2 className="w-6 h-6" />
                </div>
                <h3 className="font-heading font-bold text-xl">Geographic Mapping</h3>
                <p className="text-slate-600 leading-relaxed">
                  Break down your data by Service Planning Area (SPA), City, County, or Statewide levels automatically.
                </p>
              </div>
              <div className="flex flex-col gap-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600 mb-2">
                  <Layers className="w-6 h-6" />
                </div>
                <h3 className="font-heading font-bold text-xl">Grant-Ready Reports</h3>
                <p className="text-slate-600 leading-relaxed">
                  Export professional PDF reports instantly. Save hours on grant reporting and focus on your mission.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-50 py-12 px-6 border-t border-slate-200 text-center">
        <p className="text-slate-500 font-medium">© 2024 ImpactTracker. Built for change makers.</p>
      </footer>
    </div>
  );
}

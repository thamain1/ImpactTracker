import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarNav } from "@/components/SidebarNav";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Programs from "@/pages/Programs";
import ProgramDetails from "@/pages/ProgramDetails";
import ProgramWizard from "@/pages/ProgramWizard";
import Reports from "@/pages/Reports";
import AdminDashboard from "@/pages/AdminDashboard";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/welcome" />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      <SidebarNav />
      <main className="flex-1 overflow-auto">
        <Component />
      </main>
    </div>
  );
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  if (user) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/welcome">
        <PublicRoute component={Landing} />
      </Route>

      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>

      <Route path="/programs">
        <ProtectedRoute component={Programs} />
      </Route>

      <Route path="/programs/new">
        <ProtectedRoute component={ProgramWizard} />
      </Route>

      <Route path="/programs/:id">
        <ProtectedRoute component={ProgramDetails} />
      </Route>

      <Route path="/reports">
        <ProtectedRoute component={Reports} />
      </Route>

      <Route path="/admin">
        <ProtectedRoute component={AdminDashboard} />
      </Route>

      <Route path="/settings">
        <ProtectedRoute component={Settings} />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

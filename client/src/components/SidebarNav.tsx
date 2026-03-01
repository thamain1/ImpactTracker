import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  PieChart, 
  FolderOpen, 
  LogOut, 
  Building2,
  Menu,
  ShieldCheck,
  Settings,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

const mainItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/programs", label: "Programs", icon: FolderOpen },
  { href: "/reports", label: "Reports", icon: PieChart },
];

const bottomItems = [
  { href: "/admin", label: "Admin", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNav() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  const NavContent = () => (
    <div className="flex flex-col h-full bg-slate-900 text-white">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-2 rounded-lg">
            <Building2 className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-lg leading-none">ImpactTracker</h2>
            <span className="text-xs text-slate-400 font-medium">Nonprofit Edition</span>
          </div>
        </div>
      </div>

      <div className="flex-1 py-6 px-3 space-y-1">
        {mainItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <div
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer group",
                  active 
                    ? "bg-primary text-white shadow-lg shadow-primary/25" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                )}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <item.icon className={cn("w-5 h-5", active ? "text-white" : "text-slate-500 group-hover:text-white")} />
                {item.label}
              </div>
            </Link>
          );
        })}

        <div className="my-4 border-t border-slate-800" />

        {bottomItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <div
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer group",
                  active 
                    ? "bg-primary text-white shadow-lg shadow-primary/25" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                )}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <item.icon className={cn("w-5 h-5", active ? "text-white" : "text-slate-500 group-hover:text-white")} />
                {item.label}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-950/50">
        <div className="flex items-center gap-3 mb-4 px-2">
          {user?.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url as string} alt={(user.user_metadata?.first_name as string) || "User"} className="w-8 h-8 rounded-full ring-2 ring-slate-800" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-300">
              {(user?.user_metadata?.first_name as string)?.[0]}{(user?.user_metadata?.last_name as string)?.[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {(user?.user_metadata?.first_name as string) || ""} {(user?.user_metadata?.last_name as string) || ""}
            </p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="w-full justify-start text-slate-400 border-slate-700 hover:bg-slate-800 hover:text-white"
          onClick={() => logout()}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Log Out
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 h-screen sticky top-0 border-r bg-slate-900 border-slate-800 shadow-xl z-30">
        <NavContent />
      </aside>

      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
           <Building2 className="w-6 h-6 text-primary" />
           <span className="font-heading font-bold text-white">ImpactTracker</span>
        </div>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-slate-800" data-testid="button-mobile-menu">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 border-r-slate-800 bg-slate-900">
            <NavContent />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

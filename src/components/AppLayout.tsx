import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard,
  Users,
  Scissors,
  Receipt,
  Package,
  Wallet,
  Gift,
  UserCog,
  LogOut,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/services", label: "Services", icon: Scissors },
  { to: "/bills", label: "Bills", icon: Receipt },
  { to: "/products", label: "Products", icon: Package },
  { to: "/expenses", label: "Expenses", icon: Wallet },
  { to: "/gift-cards", label: "Gift Cards", icon: Gift },
  { to: "/staff", label: "Staff", icon: UserCog },
];

export function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [loading, user, nav]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-60 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-5 py-6 flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-primary-foreground font-bold">
            ✂
          </div>
          <div>
            <div className="font-bold text-lg leading-tight">CutBook</div>
            <div className="text-xs opacity-70">Salon Manager</div>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {NAV.map((item) => {
            const active = loc.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="text-xs opacity-70 px-2 mb-2 truncate">{user.email}</div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
            onClick={() => signOut().then(() => nav({ to: "/login" }))}
          >
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b bg-card px-4 md:px-6 flex items-center justify-between">
          <div className="md:hidden font-bold">CutBook</div>
          <div className="flex-1" />
          <Link to="/billing/new">
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> New Bill
            </Button>
          </Link>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

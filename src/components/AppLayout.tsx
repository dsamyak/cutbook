import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard, Users, Scissors, Receipt, Package,
  Wallet, Gift, UserCog, LogOut, Plus, Menu, X, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function AppLayout() {
  const { user, loading, signOut, isAdmin, isOwner, canManage, roles } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [loading, user, nav]);

  useEffect(() => {
    setMobileOpen(false);
  }, [loc.pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  // No role assigned yet
  const hasRole = roles.length > 0;

  // Build nav items based on role
  const navItems: { to: string; label: string; icon: any }[] = [];

  if (isAdmin) {
    navItems.push(
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/admin", label: "Admin Panel", icon: Shield },
      { to: "/clients", label: "Clients", icon: Users },
      { to: "/services", label: "Services", icon: Scissors },
      { to: "/bills", label: "Bills", icon: Receipt },
      { to: "/products", label: "Products", icon: Package },
      { to: "/expenses", label: "Expenses", icon: Wallet },
      { to: "/gift-cards", label: "Gift Cards", icon: Gift },
      { to: "/staff", label: "Staff", icon: UserCog },
    );
  } else if (isOwner) {
    navItems.push(
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/clients", label: "Clients", icon: Users },
      { to: "/services", label: "Services", icon: Scissors },
      { to: "/bills", label: "Bills", icon: Receipt },
      { to: "/products", label: "Products", icon: Package },
      { to: "/expenses", label: "Expenses", icon: Wallet },
      { to: "/gift-cards", label: "Gift Cards", icon: Gift },
      { to: "/staff", label: "Staff", icon: UserCog },
    );
  } else {
    // Barber or no role — limited access
    navItems.push(
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/services", label: "Services", icon: Scissors },
    );
  }

  const roleLabel = isAdmin ? "Admin" : isOwner ? "Owner" : roles.includes("barber") ? "Barber" : "No Role";
  const roleBadgeClass = isAdmin
    ? "bg-destructive/15 text-destructive"
    : isOwner
      ? "bg-primary/15 text-primary"
      : "bg-muted text-muted-foreground";

  const sidebarContent = (
    <>
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
        {navItems.map((item) => {
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
        <div className="flex items-center gap-2 px-2 mb-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${roleBadgeClass}`}>
            {roleLabel}
          </span>
        </div>
        <div className="text-xs opacity-70 px-2 mb-2 truncate">
          {user.user_metadata?.full_name || user.email}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
          onClick={() => signOut().then(() => nav({ to: "/login" }))}
        >
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 flex flex-col bg-sidebar text-sidebar-foreground shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="absolute right-3 top-5">
              <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent/50 h-8 w-8" onClick={() => setMobileOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b bg-card px-4 md:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden h-9 w-9" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="md:hidden font-bold">CutBook</div>
          </div>
          <div className="flex-1" />
          {canManage && (
            <Link to="/billing/new" search={{ clientId: "" }}>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> New Bill
              </Button>
            </Link>
          )}
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {!hasRole ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
              <Shield className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-bold">No Role Assigned</h2>
              <p className="text-muted-foreground mt-2 max-w-md">
                Your account has been created but no role has been assigned yet. 
                Please contact your admin to get access.
              </p>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}

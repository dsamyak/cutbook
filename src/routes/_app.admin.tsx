import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import {
  Plus, Shield, ShieldCheck, Scissors, UserPlus, Search,
  Copy, Check, RefreshCw, Users, Loader2,
} from "lucide-react";
import { useAuth, type Role } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin")({ component: AdminPage });

function AdminPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <Shield className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground mt-2">Only administrators can access this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Manage users and their roles</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["admin-users"] })}
          >
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <InviteUserDialog onCreated={() => qc.invalidateQueries({ queryKey: ["admin-users"] })} />
        </div>
      </div>
      <UsersTable />
    </div>
  );
}

function UsersTable() {
  const [q, setQ] = useState("");
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      // Get all profiles
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, created_at")
        .order("created_at", { ascending: true });
      if (pErr) throw pErr;

      // Get all roles
      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("id, user_id, role");
      if (rErr) throw rErr;

      // Combine
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id),
      }));
    },
    staleTime: 10_000,
    retry: 2,
  });

  const filtered = (data ?? []).filter((u) => {
    if (!q) return true;
    const ql = q.toLowerCase();
    return u.full_name?.toLowerCase().includes(ql);
  });

  async function addRole(userId: string, role: Role) {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) {
      if (error.message.includes("duplicate")) return toast.error("User already has this role");
      return toast.error(error.message);
    }
    toast.success("Role added");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  async function removeRole(roleId: string) {
    const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
    if (error) return toast.error(error.message);
    toast.success("Role removed");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  const roleIcon = (role: string) => {
    if (role === "admin") return <Shield className="h-3 w-3" />;
    if (role === "owner") return <ShieldCheck className="h-3 w-3" />;
    return <Scissors className="h-3 w-3" />;
  };

  const roleBadgeClass = (role: string) => {
    if (role === "admin") return "bg-destructive/15 text-destructive";
    if (role === "owner") return "bg-primary/15 text-primary";
    return "bg-muted text-muted-foreground";
  };

  return (
    <>
      <Card className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search users…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
      </Card>

      <Card>
        {error ? (
          <div className="p-6 text-destructive text-center">
            <p className="font-medium">Failed to load users</p>
            <p className="text-sm text-muted-foreground mt-1">{(error as Error).message}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => qc.invalidateQueries({ queryKey: ["admin-users"] })}
            >
              Retry
            </Button>
          </div>
        ) : isLoading ? (
          <div className="p-6 text-muted-foreground flex items-center gap-2 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading users…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No users found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">User</th>
                  <th className="text-left">Roles</th>
                  <th className="text-left">Joined</th>
                  <th className="text-right pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-primary-foreground font-bold text-xs">
                          {(u.full_name ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">{u.full_name ?? "Unknown"}</div>
                          <div className="text-xs text-muted-foreground">{u.id.slice(0, 8)}…</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0 && (
                          <span className="text-xs text-muted-foreground italic">No role</span>
                        )}
                        {u.roles.map((r: any) => (
                          <span key={r.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleBadgeClass(r.role)}`}>
                            {roleIcon(r.role)}
                            {r.role}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button
                                  className="ml-1 hover:text-destructive"
                                  title="Remove role"
                                >
                                  ×
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove Role</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to remove the <strong>{r.role}</strong> role
                                    from <strong>{u.full_name}</strong>? They will lose access to
                                    features associated with this role.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => removeRole(r.id)}>
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-muted-foreground text-xs">
                      {new Date(u.created_at).toLocaleDateString("en-IN")}
                    </td>
                    <td className="text-right pr-3">
                      <AddRoleDropdown
                        userId={u.id}
                        existingRoles={u.roles.map((r: any) => r.role)}
                        onAdd={addRole}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold">{data?.length ?? 0}</div>
          <div className="text-xs text-muted-foreground">Total Users</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold">
            {(data ?? []).filter((u) => u.roles.some((r: any) => r.role === "admin" || r.role === "owner")).length}
          </div>
          <div className="text-xs text-muted-foreground">Managers</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold">
            {(data ?? []).filter((u) => u.roles.length === 0).length}
          </div>
          <div className="text-xs text-muted-foreground">Pending Role</div>
        </Card>
      </div>

      {/* Role Legend */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3 text-sm">Role Hierarchy</h3>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
            <div className="flex items-center gap-1.5 font-semibold text-destructive mb-1">
              <Shield className="h-3.5 w-3.5" /> Admin
            </div>
            <p className="text-muted-foreground">Full system access. Can add/remove Owners and manage all settings.</p>
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
            <div className="flex items-center gap-1.5 font-semibold text-primary mb-1">
              <ShieldCheck className="h-3.5 w-3.5" /> Owner
            </div>
            <p className="text-muted-foreground">Salon owner. Can manage barbers, billing, clients, expenses, and payroll.</p>
          </div>
          <div className="bg-muted border rounded-lg p-3">
            <div className="flex items-center gap-1.5 font-semibold mb-1">
              <Scissors className="h-3.5 w-3.5" /> Barber
            </div>
            <p className="text-muted-foreground">Staff member. Can view dashboard and their own attendance/stats.</p>
          </div>
        </div>
      </Card>
    </>
  );
}

function AddRoleDropdown({
  userId,
  existingRoles,
  onAdd,
}: {
  userId: string;
  existingRoles: string[];
  onAdd: (userId: string, role: Role) => void;
}) {
  const [role, setRole] = useState<Role | "">("");
  const available = (["owner", "barber", "admin"] as Role[]).filter(
    (r) => !existingRoles.includes(r)
  );

  if (available.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      <Select value={role} onValueChange={(v) => setRole(v as Role)}>
        <SelectTrigger className="h-7 w-24 text-xs">
          <SelectValue placeholder="Add role" />
        </SelectTrigger>
        <SelectContent>
          {available.map((r) => (
            <SelectItem key={r} value={r} className="capitalize">
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {role && (
        <Button
          size="sm"
          className="h-7 text-xs px-2"
          onClick={() => {
            onAdd(userId, role as Role);
            setRole("");
          }}
        >
          <Plus className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

function InviteUserDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const signUpUrl = typeof window !== "undefined"
    ? `${window.location.origin}/login`
    : "/login";

  function copyLink() {
    navigator.clipboard.writeText(signUpUrl).then(() => {
      setCopied(true);
      toast.success("Sign-up link copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" /> Invite User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            To add a new user to CutBook:
          </p>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                1
              </div>
              <div>
                <p className="text-sm font-medium">Share the sign-up link</p>
                <p className="text-xs text-muted-foreground">
                  Send them this link so they can create their account with email & password.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    value={signUpUrl}
                    readOnly
                    className="text-xs h-8 bg-muted"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 flex-shrink-0"
                    onClick={copyLink}
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                2
              </div>
              <div>
                <p className="text-sm font-medium">Assign their role</p>
                <p className="text-xs text-muted-foreground">
                  After they sign up, they'll appear in the users table above. Assign them
                  the appropriate role (Owner / Barber).
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                3
              </div>
              <div>
                <p className="text-sm font-medium">They're ready!</p>
                <p className="text-xs text-muted-foreground">
                  Once a role is assigned, they can log in and access features based on their role.
                </p>
              </div>
            </div>
          </div>

          <Button variant="outline" className="w-full" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

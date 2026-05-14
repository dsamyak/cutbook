import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { fmtMoney } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/clients")({ component: ClientsPage });

function ClientsPage() {
  const [q, setQ] = useState("");
  const qc = useQueryClient();
  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients", q],
    queryFn: async () => {
      let query = supabase.from("clients").select("*").order("created_at", { ascending: false }).limit(200);
      if (q) query = query.or(`full_name.ilike.%${q}%,mobile.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">{clients?.length ?? 0} clients shown</p>
        </div>
        <NewClientDialog onCreated={() => qc.invalidateQueries({ queryKey: ["clients"] })} />
      </div>

      <Card className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or mobile…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="p-6 text-muted-foreground">Loading…</div>
        ) : (clients ?? []).length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            No clients yet. Click <strong>New Client</strong> to add your first one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left">Mobile</th>
                  <th className="text-left">Gender</th>
                  <th className="text-right">Total Spent</th>
                  <th className="text-right">Due</th>
                  <th className="text-left pl-4">Last Visit</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {clients!.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="p-3 font-medium">{c.full_name}</td>
                    <td>{c.mobile}</td>
                    <td className="capitalize text-muted-foreground">{c.gender ?? "—"}</td>
                    <td className="text-right">{fmtMoney(c.total_spent)}</td>
                    <td className={`text-right ${Number(c.due_amount) > 0 ? "text-destructive font-medium" : ""}`}>
                      {fmtMoney(c.due_amount)}
                    </td>
                    <td className="pl-4 text-muted-foreground text-xs">
                      {c.last_visit_at ? new Date(c.last_visit_at).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td className="text-right pr-3">
                      <Link to="/clients/$id" params={{ id: c.id }}>
                        <Button variant="ghost" size="sm">Open</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function NewClientDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ full_name: "", mobile: "", gender: "male", date_of_birth: "", notes: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("clients").insert({
      full_name: form.full_name,
      mobile: form.mobile,
      gender: form.gender,
      date_of_birth: form.date_of_birth || null,
      notes: form.notes || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Client added");
    setOpen(false);
    setForm({ full_name: "", mobile: "", gender: "male", date_of_birth: "", notes: "" });
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> New Client</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Client</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Full name *</Label>
            <Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <Label>Mobile *</Label>
            <Input required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date of birth</Label>
              <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save Client"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

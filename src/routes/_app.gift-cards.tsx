import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useState, useMemo } from "react";
import { Plus, Search, Gift, CreditCard, History } from "lucide-react";
import { fmtMoney } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/gift-cards")({ component: GiftCardsPage });

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "GC-";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function GiftCardsPage() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: giftCards, isLoading } = useQuery({
    queryKey: ["gift-cards", statusFilter],
    queryFn: async () => {
      let query = supabase.from("gift_cards").select("*,clients(full_name,mobile)").order("created_at", { ascending: false });
      if (statusFilter && statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: transactions } = useQuery({
    queryKey: ["gift-card-txns", selectedCard],
    enabled: !!selectedCard,
    queryFn: async () => {
      const { data } = await supabase.from("gift_card_transactions").select("*").eq("gift_card_id", selectedCard!).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!giftCards) return [];
    if (!q) return giftCards;
    const ql = q.toLowerCase();
    return giftCards.filter((g) =>
      g.code.toLowerCase().includes(ql) || (g as any).clients?.full_name?.toLowerCase().includes(ql)
    );
  }, [giftCards, q]);

  const totalActive = useMemo(
    () => (giftCards ?? []).filter((g) => g.status === "active").reduce((s, g) => s + Number(g.balance), 0),
    [giftCards]
  );

  async function voidCard(id: string) {
    const { error } = await supabase.from("gift_cards").update({ status: "void" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Gift card voided");
    qc.invalidateQueries({ queryKey: ["gift-cards"] });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gift Cards</h1>
          <p className="text-sm text-muted-foreground">Issue, track, and redeem gift cards</p>
        </div>
        <IssueGiftCardDialog onCreated={() => qc.invalidateQueries({ queryKey: ["gift-cards"] })} />
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
        <Card className="p-4 relative overflow-hidden">
          <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full opacity-10 bg-gradient-to-br from-accent to-primary-glow" />
          <Gift className="h-4 w-4 text-muted-foreground" />
          <div className="mt-2 text-xs text-muted-foreground">Total Active Cards</div>
          <div className="text-xl font-bold mt-0.5">{(giftCards ?? []).filter((g) => g.status === "active").length}</div>
        </Card>
        <Card className="p-4 relative overflow-hidden">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <div className="mt-2 text-xs text-muted-foreground">Active Balance</div>
          <div className="text-xl font-bold mt-0.5">{fmtMoney(totalActive)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total Issued</div>
          <div className="text-xl font-bold mt-1">{(giftCards ?? []).length}</div>
        </Card>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by code or client…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="redeemed">Redeemed</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="void">Void</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className={`grid gap-4 ${selectedCard ? "lg:grid-cols-3" : ""}`}>
        <Card className={selectedCard ? "lg:col-span-2" : ""}>
          {isLoading ? (
            <div className="p-6 text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">No gift cards. Click <strong>Issue Gift Card</strong> to create one.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Code</th>
                    <th className="text-left">Client</th>
                    <th className="text-right">Value</th>
                    <th className="text-right">Balance</th>
                    <th className="text-left pl-4">Status</th>
                    <th className="text-left">Expires</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((g: any) => (
                    <tr key={g.id} className={`border-b last:border-0 hover:bg-muted/40 cursor-pointer ${selectedCard === g.id ? "bg-muted/60" : ""}`} onClick={() => setSelectedCard(g.id)}>
                      <td className="p-3 font-mono font-medium text-primary">{g.code}</td>
                      <td className="text-muted-foreground">{g.clients?.full_name ?? "—"}</td>
                      <td className="text-right tabular-nums">{fmtMoney(g.initial_value)}</td>
                      <td className="text-right font-semibold tabular-nums">{fmtMoney(g.balance)}</td>
                      <td className="pl-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          g.status === "active" ? "bg-success/15 text-success" :
                          g.status === "redeemed" ? "bg-muted text-muted-foreground" :
                          g.status === "expired" ? "bg-warning/15 text-warning-foreground" :
                          "bg-destructive/15 text-destructive"
                        }`}>{g.status}</span>
                      </td>
                      <td className="text-xs text-muted-foreground">{g.expires_on ? new Date(g.expires_on + "T00:00:00").toLocaleDateString("en-IN") : "—"}</td>
                      <td className="text-right pr-3">
                        {g.status === "active" && (
                          <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={(e) => { e.stopPropagation(); voidCard(g.id); }}>Void</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {selectedCard && (
          <Card className="p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><History className="h-4 w-4" /> Transaction History</h3>
            {!transactions || transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions yet.</p>
            ) : (
              <div className="space-y-2">
                {transactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-2 rounded-md bg-muted/40">
                    <div>
                      <div className="text-xs font-medium capitalize">{t.kind}</div>
                      <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</div>
                    </div>
                    <div className={`font-semibold tabular-nums ${t.kind === "redeem" ? "text-destructive" : "text-success"}`}>
                      {t.kind === "redeem" ? "−" : "+"}{fmtMoney(t.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function IssueGiftCardDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(generateCode());
  const [form, setForm] = useState({ clientId: "", value: "", expires_on: "" });

  const { data: clients } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id,full_name,mobile").order("full_name").limit(500);
      return data ?? [];
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.value || Number(form.value) <= 0) return toast.error("Enter a valid amount");
    setBusy(true);
    const val = Number(form.value);
    const { data: gc, error } = await supabase.from("gift_cards").insert({
      code,
      client_id: form.clientId || null,
      initial_value: val,
      balance: val,
      expires_on: form.expires_on || null,
    }).select("id").single();
    if (error) { setBusy(false); return toast.error(error.message); }

    await supabase.from("gift_card_transactions").insert({
      gift_card_id: gc.id, amount: val, kind: "issue",
    });
    setBusy(false);
    toast.success("Gift card issued: " + code);
    setOpen(false);
    setCode(generateCode());
    setForm({ clientId: "", value: "", expires_on: "" });
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setCode(generateCode()); }}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Issue Gift Card</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Issue Gift Card</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Gift Card Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} className="font-mono" />
            <p className="text-xs text-muted-foreground mt-1">Auto-generated. You can customize it.</p>
          </div>
          <div>
            <Label>Assign to Client (optional)</Label>
            <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
              <SelectTrigger><SelectValue placeholder="Select client…" /></SelectTrigger>
              <SelectContent>
                {clients?.map((c) => (<SelectItem key={c.id} value={c.id}>{c.full_name} — {c.mobile}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Value (₹) *</Label>
              <Input type="number" required min={1} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            </div>
            <div>
              <Label>Expires on</Label>
              <Input type="date" value={form.expires_on} onChange={(e) => setForm({ ...form, expires_on: e.target.value })} />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Issuing…" : "Issue Gift Card"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { fmtMoney, useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

type Item = { type: "service" | "product"; id: string; name: string; unit_price: number; qty: number };

export const Route = createFileRoute("/_app/billing/new")({
  component: NewBillPage,
  validateSearch: (s: Record<string, unknown>) => ({ clientId: (s.clientId as string) || "" }),
});

function NewBillPage() {
  const { clientId: presetClient } = Route.useSearch();
  const { user } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [clientId, setClientId] = useState(presetClient);
  const [newClient, setNewClient] = useState({ full_name: "", mobile: "" });
  const [barberId, setBarberId] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [discountType, setDiscountType] = useState<"none" | "percent" | "flat">("none");
  const [discountValue, setDiscountValue] = useState(0);
  const [payments, setPayments] = useState<{ method: "cash" | "upi" | "card" | "gift_card"; amount: number }[]>([
    { method: "cash", amount: 0 },
  ]);
  const [notes, setNotes] = useState("");

  const { data } = useQuery({
    queryKey: ["billing-data"],
    queryFn: async () => {
      const [clients, services, products, barbers] = await Promise.all([
        supabase.from("clients").select("id,full_name,mobile").order("full_name").limit(500),
        supabase.from("services").select("id,name,price").eq("active", true).order("name"),
        supabase.from("products").select("id,name,price,stock").eq("active", true).order("name"),
        supabase.from("barbers").select("id,full_name").eq("active", true).order("full_name"),
      ]);
      return {
        clients: clients.data ?? [],
        services: services.data ?? [],
        products: products.data ?? [],
        barbers: barbers.data ?? [],
      };
    },
  });

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.unit_price * i.qty, 0), [items]);
  const discountAmount = useMemo(() => {
    if (discountType === "percent") return Math.min(subtotal, (subtotal * discountValue) / 100);
    if (discountType === "flat") return Math.min(subtotal, discountValue);
    return 0;
  }, [discountType, discountValue, subtotal]);
  const total = Math.max(0, subtotal - discountAmount);
  const paid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const due = Math.max(0, total - paid);

  function addService(id: string) {
    const s = data?.services.find((x) => x.id === id);
    if (!s) return;
    setItems((p) => [...p, { type: "service", id: s.id, name: s.name, unit_price: Number(s.price), qty: 1 }]);
  }
  function addProduct(id: string) {
    const p = data?.products.find((x) => x.id === id);
    if (!p) return;
    setItems((prev) => [...prev, { type: "product", id: p.id, name: p.name, unit_price: Number(p.price), qty: 1 }]);
  }
  function updateItem(idx: number, patch: Partial<Item>) {
    setItems((p) => p.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function removeItem(idx: number) {
    setItems((p) => p.filter((_, i) => i !== idx));
  }

  async function submit() {
    if (items.length === 0) return toast.error("Add at least one service or product");
    let finalClientId = clientId;
    setBusy(true);
    try {
      if (!finalClientId) {
        if (!newClient.full_name || !newClient.mobile) {
          setBusy(false);
          return toast.error("Pick a client or enter new client details");
        }
        const { data: c, error } = await supabase
          .from("clients")
          .insert({ full_name: newClient.full_name, mobile: newClient.mobile })
          .select("id")
          .single();
        if (error) throw error;
        finalClientId = c.id;
      }

      const status = due === 0 ? "paid" : paid === 0 ? "due" : "partial";

      const { data: bill, error: billErr } = await supabase
        .from("bills")
        .insert({
          client_id: finalClientId,
          barber_id: barberId || null,
          subtotal,
          discount_type: discountType,
          discount_value: discountValue,
          discount_amount: discountAmount,
          total,
          amount_paid: paid,
          due_amount: due,
          status,
          notes: notes || null,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (billErr) throw billErr;

      const itemRows = items.map((i) => ({
        bill_id: bill.id,
        item_type: i.type,
        service_id: i.type === "service" ? i.id : null,
        product_id: i.type === "product" ? i.id : null,
        name: i.name,
        qty: i.qty,
        unit_price: i.unit_price,
        total: i.unit_price * i.qty,
      }));
      const { error: itemErr } = await supabase.from("bill_items").insert(itemRows);
      if (itemErr) throw itemErr;

      const payRows = payments
        .filter((p) => Number(p.amount) > 0)
        .map((p) => ({ bill_id: bill.id, method: p.method, amount: Number(p.amount) }));
      if (payRows.length) {
        const { error } = await supabase.from("payments").insert(payRows);
        if (error) throw error;
      }

      // Update client aggregates
      const { data: cur } = await supabase
        .from("clients")
        .select("total_spent,due_amount")
        .eq("id", finalClientId)
        .single();
      await supabase
        .from("clients")
        .update({
          total_spent: Number(cur?.total_spent ?? 0) + total,
          due_amount: Number(cur?.due_amount ?? 0) + due,
          last_visit_at: new Date().toISOString(),
        })
        .eq("id", finalClientId);

      // Decrement product stock
      for (const i of items.filter((x) => x.type === "product")) {
        const { data: p } = await supabase.from("products").select("stock").eq("id", i.id).single();
        if (p) await supabase.from("products").update({ stock: Math.max(0, p.stock - i.qty) }).eq("id", i.id);
      }

      toast.success("Bill created");
      nav({ to: "/bills/$id", params: { id: bill.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create bill");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <h1 className="text-2xl font-bold tracking-tight">New Bill</h1>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-5 space-y-3">
            <h3 className="font-semibold">Client</h3>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Select existing client…" /></SelectTrigger>
              <SelectContent>
                {data?.clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name} — {c.mobile}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!clientId && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                <div>
                  <Label className="text-xs">New client name</Label>
                  <Input value={newClient.full_name} onChange={(e) => setNewClient({ ...newClient, full_name: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Mobile</Label>
                  <Input value={newClient.mobile} onChange={(e) => setNewClient({ ...newClient, mobile: e.target.value })} />
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs">Barber / Staff</Label>
              <Select value={barberId} onValueChange={setBarberId}>
                <SelectTrigger><SelectValue placeholder="Optional — assign staff" /></SelectTrigger>
                <SelectContent>
                  {data?.barbers.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">No barbers added yet</div>}
                  {data?.barbers.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <h3 className="font-semibold">Items</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Add service</Label>
                <Select value="" onValueChange={addService}>
                  <SelectTrigger><SelectValue placeholder="Pick a service…" /></SelectTrigger>
                  <SelectContent>
                    {data?.services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} — {fmtMoney(s.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Add product</Label>
                <Select value="" onValueChange={addProduct}>
                  <SelectTrigger><SelectValue placeholder="Pick a product…" /></SelectTrigger>
                  <SelectContent>
                    {data?.products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {fmtMoney(p.price)} (stock {p.stock})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No items added yet.</p>
            ) : (
              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-md bg-muted/40">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{it.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{it.type}</div>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      value={it.qty}
                      onChange={(e) => updateItem(idx, { qty: Math.max(1, Number(e.target.value) || 1) })}
                      className="w-16 h-8"
                    />
                    <Input
                      type="number"
                      min={0}
                      value={it.unit_price}
                      onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) || 0 })}
                      className="w-24 h-8"
                    />
                    <div className="w-24 text-right font-semibold tabular-nums">{fmtMoney(it.unit_price * it.qty)}</div>
                    <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-3">
            <h3 className="font-semibold">Payments</h3>
            {payments.map((p, i) => (
              <div key={i} className="flex gap-2">
                <Select value={p.method} onValueChange={(v: any) => setPayments(payments.map((x, j) => (i === j ? { ...x, method: v } : x)))}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="gift_card">Gift Card</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  value={p.amount}
                  onChange={(e) => setPayments(payments.map((x, j) => (i === j ? { ...x, amount: Number(e.target.value) || 0 } : x)))}
                />
                {payments.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => setPayments(payments.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setPayments([...payments, { method: "cash", amount: 0 }])}>
              <Plus className="h-4 w-4 mr-1" /> Split payment
            </Button>
            <div>
              <Label className="text-xs">Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </Card>
        </div>

        <Card className="p-5 h-fit sticky top-4 space-y-3">
          <h3 className="font-semibold">Summary</h3>
          <Row label="Subtotal" value={fmtMoney(subtotal)} />
          <div className="space-y-2">
            <Label className="text-xs">Discount</Label>
            <div className="flex gap-2">
              <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="percent">%</SelectItem>
                  <SelectItem value="flat">Flat ₹</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={0}
                value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                disabled={discountType === "none"}
              />
            </div>
            <Row label="Discount applied" value={`− ${fmtMoney(discountAmount)}`} muted />
          </div>
          <hr />
          <Row label="Total" value={fmtMoney(total)} bold />
          <Row label="Paid" value={fmtMoney(paid)} muted />
          <Row label="Due" value={fmtMoney(due)} accent={due > 0} bold />
          <Button className="w-full mt-2" disabled={busy} onClick={submit}>
            {busy ? "Saving…" : "Create Bill"}
          </Button>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, muted, bold, accent }: { label: string; value: any; muted?: boolean; bold?: boolean; accent?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-sm ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className={`tabular-nums ${bold ? "font-bold text-base" : ""} ${accent ? "text-destructive" : ""}`}>{value}</span>
    </div>
  );
}

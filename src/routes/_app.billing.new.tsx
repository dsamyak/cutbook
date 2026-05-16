import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { fmtMoney, useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Trash2, Plus, Search, X, Gift, User, Scissors, Package, Banknote, Tag, Zap, ChevronRight } from "lucide-react";

/* ─── Debounce hook ─────────────────────────────────────────────────────────── */
function useDebounce(value: string, ms = 150) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

type Item = { type: "service" | "product"; id: string; name: string; unit_price: number; qty: number };

export const Route = createFileRoute("/_app/billing/new")({
  component: NewBillPage,
  validateSearch: (s: Record<string, unknown>) => ({ clientId: (s.clientId as string) || "" }),
});

/* ─── Searchable Dropdown with debounce + keyboard nav ──────────────────────── */
function SearchableDropdown({
  items, onSelect, placeholder, icon: Icon, renderItem,
}: {
  items: { id: string; label: string; sublabel?: string }[];
  onSelect: (id: string) => void;
  placeholder: string;
  icon: React.ElementType;
  renderItem?: (item: { id: string; label: string; sublabel?: string }) => React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = useMemo(() => {
    if (!debouncedQuery) return items.slice(0, 50);
    const ql = debouncedQuery.toLowerCase();
    return items.filter(
      (i) => i.label.toLowerCase().includes(ql) || i.sublabel?.toLowerCase().includes(ql)
    ).slice(0, 50);
  }, [items, debouncedQuery]);

  useEffect(() => { setActiveIdx(-1); }, [debouncedQuery]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); onSelect(filtered[activeIdx].id); setQuery(""); setOpen(false); }
    else if (e.key === "Escape") { setOpen(false); }
  }, [open, filtered, activeIdx, onSelect]);

  useEffect(() => {
    if (activeIdx >= 0 && listRef.current) {
      const el = listRef.current.children[activeIdx] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIdx]);

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder={placeholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          className="pl-9 pr-8"
        />
        {query && (
          <button type="button" onClick={() => { setQuery(""); setOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div ref={listRef} className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border bg-popover shadow-xl animate-in fade-in-0 zoom-in-95 duration-150">
          {filtered.map((item, i) => (
            <button key={item.id} type="button"
              className={`w-full text-left px-3 py-2 transition-colors border-b last:border-0 text-sm ${i === activeIdx ? "bg-primary/10" : "hover:bg-accent/40"}`}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => { onSelect(item.id); setQuery(""); setOpen(false); }}>
              {renderItem ? renderItem(item) : (
                <div><div className="font-medium">{item.label}</div>
                  {item.sublabel && <div className="text-xs text-muted-foreground">{item.sublabel}</div>}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
      {open && query && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border bg-popover shadow-xl p-3 text-sm text-muted-foreground text-center">No results found</div>
      )}
    </div>
  );
}

/* ─── Main Billing Page ─────────────────────────────────────────────────────── */
function NewBillPage() {
  const { clientId: presetClient } = Route.useSearch();
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [clientId, setClientId] = useState(presetClient);
  const [newClient, setNewClient] = useState({ full_name: "", mobile: "" });
  const [barberId, setBarberId] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [discountType, setDiscountType] = useState<"none" | "percent" | "flat">("none");
  const [discountValue, setDiscountValue] = useState(0);
  const [payments, setPayments] = useState<{ method: "cash" | "upi" | "card" | "gift_card"; amount: number; giftCardCode?: string }[]>([
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

  // Auto-fill client details when a client is selected
  const selectedClient = useMemo(() => {
    if (!clientId || !data?.clients) return null;
    return data.clients.find((c) => c.id === clientId) ?? null;
  }, [clientId, data?.clients]);

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.unit_price * i.qty, 0), [items]);
  const discountAmount = useMemo(() => {
    if (discountType === "percent") return Math.min(subtotal, (subtotal * discountValue) / 100);
    if (discountType === "flat") return Math.min(subtotal, discountValue);
    return 0;
  }, [discountType, discountValue, subtotal]);
  const total = Math.max(0, subtotal - discountAmount);
  const paid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const due = Math.max(0, total - paid);
  const paidPercent = total > 0 ? Math.min(100, (paid / total) * 100) : 0;

  // Auto-fill first payment to total when items change
  useEffect(() => {
    if (total > 0 && payments.length === 1 && payments[0].amount === 0) {
      setPayments([{ ...payments[0], amount: total }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  // --- Searchable items for client dropdown ---
  const clientSearchItems = useMemo(
    () =>
      (data?.clients ?? []).map((c) => ({
        id: c.id,
        label: c.full_name,
        sublabel: c.mobile,
      })),
    [data?.clients]
  );

  // --- Searchable items for services ---
  const serviceSearchItems = useMemo(
    () =>
      (data?.services ?? []).map((s) => ({
        id: s.id,
        label: s.name,
        sublabel: fmtMoney(s.price),
      })),
    [data?.services]
  );

  // --- Searchable items for products ---
  const productSearchItems = useMemo(
    () =>
      (data?.products ?? []).map((p) => ({
        id: p.id,
        label: p.name,
        sublabel: `${fmtMoney(p.price)} · stock ${p.stock}`,
      })),
    [data?.products]
  );

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

  function selectClient(id: string) {
    setClientId(id);
  }

  function clearClient() {
    setClientId("");
    setNewClient({ full_name: "", mobile: "" });
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

      // --- Gift Card Balance Validation & Deduction ---
      const giftCardPayments = payments.filter((p) => p.method === "gift_card" && Number(p.amount) > 0);
      const giftCardDeductions: { cardId: string; code: string; amount: number; currentBalance: number }[] = [];

      for (const gcp of giftCardPayments) {
        if (!gcp.giftCardCode) {
          setBusy(false);
          return toast.error("Enter a gift card code for gift card payment");
        }
        const { data: gc, error: gcErr } = await supabase
          .from("gift_cards")
          .select("id,balance,status,expires_on")
          .eq("code", gcp.giftCardCode.trim().toUpperCase())
          .single();

        if (gcErr || !gc) {
          setBusy(false);
          return toast.error(`Gift card "${gcp.giftCardCode}" not found`);
        }
        if (gc.status !== "active") {
          setBusy(false);
          return toast.error(`Gift card "${gcp.giftCardCode}" is ${gc.status}`);
        }
        if (gc.expires_on && new Date(gc.expires_on + "T23:59:59") < new Date()) {
          setBusy(false);
          return toast.error(`Gift card "${gcp.giftCardCode}" has expired`);
        }
        if (Number(gc.balance) < Number(gcp.amount)) {
          setBusy(false);
          return toast.error(
            `Gift card "${gcp.giftCardCode}" has insufficient balance: ${fmtMoney(gc.balance)} available, ${fmtMoney(gcp.amount)} requested`
          );
        }
        giftCardDeductions.push({
          cardId: gc.id,
          code: gcp.giftCardCode,
          amount: Number(gcp.amount),
          currentBalance: Number(gc.balance),
        });
      }

      // Calculate bill amounts — cap bill's amount_paid at total
      const billPaid = Math.min(paid, total);
      const billDue = Math.max(0, total - billPaid);
      const excess = Math.max(0, paid - total); // overpayment to clear old dues
      const status = billDue === 0 ? "paid" : billPaid === 0 ? "due" : "partial";

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
          amount_paid: billPaid,
          due_amount: billDue,
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

      // --- Deduct gift card balances ---
      for (const gcd of giftCardDeductions) {
        const newBalance = gcd.currentBalance - gcd.amount;
        const newStatus = newBalance <= 0 ? "redeemed" : "active";

        const { error: gcUpdateErr } = await supabase
          .from("gift_cards")
          .update({ balance: newBalance, status: newStatus })
          .eq("id", gcd.cardId);
        if (gcUpdateErr) console.error("Gift card balance update error:", gcUpdateErr);

        await supabase.from("gift_card_transactions").insert({
          gift_card_id: gcd.cardId,
          bill_id: bill.id,
          amount: gcd.amount,
          kind: "redeem",
        });
      }

      // --- Update client aggregates ---
      const { data: cur } = await supabase
        .from("clients")
        .select("total_spent,due_amount")
        .eq("id", finalClientId)
        .single();

      const clientOldDue = Number(cur?.due_amount ?? 0);
      // New due from this bill, minus any excess that clears old dues
      const dueReduction = Math.min(excess, clientOldDue);
      const clientNewDue = Math.max(0, clientOldDue + billDue - dueReduction);

      await supabase
        .from("clients")
        .update({
          total_spent: Number(cur?.total_spent ?? 0) + total,
          due_amount: clientNewDue,
          last_visit_at: new Date().toISOString(),
        })
        .eq("id", finalClientId);

      // --- Apply excess to oldest unpaid bills ---
      if (dueReduction > 0) {
        const { data: dueBills } = await supabase
          .from("bills")
          .select("id,due_amount,amount_paid,total")
          .eq("client_id", finalClientId)
          .gt("due_amount", 0)
          .neq("id", bill.id)
          .order("created_at", { ascending: true });

        let remaining = dueReduction;
        for (const db of dueBills ?? []) {
          if (remaining <= 0) break;
          const dbDue = Number(db.due_amount);
          const apply = Math.min(remaining, dbDue);
          const newDbDue = dbDue - apply;
          const newDbPaid = Number(db.amount_paid) + apply;
          const newDbStatus = newDbDue === 0 ? "paid" : "partial";

          await supabase
            .from("bills")
            .update({ due_amount: newDbDue, amount_paid: newDbPaid, status: newDbStatus })
            .eq("id", db.id);

          // Record the excess as a payment on the old bill
          await supabase.from("payments").insert({
            bill_id: db.id,
            method: "cash",
            amount: apply,
          });

          remaining -= apply;
        }

        toast.success(`${fmtMoney(dueReduction)} excess applied to previous dues`);
      }

      // Decrement product stock
      for (const i of items.filter((x) => x.type === "product")) {
        const { data: p } = await supabase.from("products").select("stock").eq("id", i.id).single();
        if (p) await supabase.from("products").update({ stock: Math.max(0, p.stock - i.qty) }).eq("id", i.id);
      }

      // Invalidate queries for fresh data
      qc.invalidateQueries({ queryKey: ["gift-cards"] });
      qc.invalidateQueries({ queryKey: ["all-bills"] });

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
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
          <Scissors className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Bill</h1>
          <p className="text-xs text-muted-foreground">Create an invoice for your client</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* ── Client Section ──────────────────────────────────────────── */}
          <Card className="p-5 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Client
            </h3>
            {selectedClient ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div>
                  <div className="font-medium">{selectedClient.full_name}</div>
                  <div className="text-sm text-muted-foreground">{selectedClient.mobile}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={clearClient} className="text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <SearchableDropdown
                  items={clientSearchItems}
                  onSelect={selectClient}
                  placeholder="Search client by name or phone…"
                  icon={Search}
                  renderItem={(item) => (
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{item.label}</span>
                      <span className="text-xs text-muted-foreground">{item.sublabel}</span>
                    </div>
                  )}
                />
                <div className="relative">
                  <div className="absolute inset-x-0 top-1/2 border-t border-dashed" />
                  <div className="relative flex justify-center">
                    <span className="bg-card px-3 text-xs text-muted-foreground">or add new client</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">New client name</Label>
                    <Input value={newClient.full_name} onChange={(e) => setNewClient({ ...newClient, full_name: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Mobile</Label>
                    <Input value={newClient.mobile} onChange={(e) => setNewClient({ ...newClient, mobile: e.target.value })} />
                  </div>
                </div>
              </>
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

          {/* ── Items Section ──────────────────────────────────────────── */}
          <Card className="p-5 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Scissors className="h-4 w-4 text-primary" /> Items
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Add service</Label>
                <SearchableDropdown
                  items={serviceSearchItems}
                  onSelect={addService}
                  placeholder="Search services…"
                  icon={Search}
                  renderItem={(item) => (
                    <div className="flex items-center justify-between">
                      <span>{item.label}</span>
                      <span className="text-xs font-semibold text-primary tabular-nums">{item.sublabel}</span>
                    </div>
                  )}
                />
              </div>
              <div>
                <Label className="text-xs">Add product</Label>
                <SearchableDropdown
                  items={productSearchItems}
                  onSelect={addProduct}
                  placeholder="Search products…"
                  icon={Package}
                  renderItem={(item) => (
                    <div className="flex items-center justify-between">
                      <span>{item.label}</span>
                      <span className="text-xs text-muted-foreground">{item.sublabel}</span>
                    </div>
                  )}
                />
              </div>
            </div>

            {items.length === 0 ? (
              <div className="py-8 text-center">
                <Scissors className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Search and add services or products above</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg border bg-card hover:shadow-sm transition-shadow group">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${it.type === 'service' ? 'bg-primary/10 text-primary' : 'bg-chart-3/15 text-chart-3'}`}>
                      {it.type === 'service' ? <Scissors className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{it.name}</div>
                      <div className="text-[11px] text-muted-foreground capitalize">{it.type}</div>
                    </div>
                    <Input type="number" min={1} value={it.qty}
                      onChange={(e) => updateItem(idx, { qty: Math.max(1, Number(e.target.value) || 1) })}
                      className="w-14 h-8 text-center" />
                    <span className="text-xs text-muted-foreground">×</span>
                    <Input type="number" min={0} value={it.unit_price}
                      onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) || 0 })}
                      className="w-22 h-8" />
                    <div className="w-24 text-right font-semibold tabular-nums text-sm">{fmtMoney(it.unit_price * it.qty)}</div>
                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeItem(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t text-sm">
                  <span className="text-muted-foreground">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                  <span className="font-semibold">{fmtMoney(subtotal)}</span>
                </div>
              </div>
            )}
          </Card>

          {/* ── Discount + Payment combined ──────────────────────────── */}
          <Card className="p-5 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" /> Discount
            </h3>
            <div className="flex gap-3 items-end">
              <div className="flex-shrink-0">
                <Label className="text-xs">Type</Label>
                <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="percent">%</SelectItem>
                    <SelectItem value="flat">Flat ₹</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-xs">Value</Label>
                <Input type="number" min={0} value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                  disabled={discountType === "none"} />
              </div>
              {discountAmount > 0 && (
                <div className="flex items-center gap-1 text-sm font-medium text-success whitespace-nowrap pb-2">
                  <Zap className="h-3.5 w-3.5" /> − {fmtMoney(discountAmount)} saved
                </div>
              )}
            </div>
          </Card>

          {/* ── Payments Section ───────────────────────────────────── */}
          <Card className="p-5 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Banknote className="h-4 w-4 text-primary" /> Payments
            </h3>
            {payments.map((p, i) => (
              <div key={i} className="space-y-2 p-3 rounded-lg bg-muted/30 border">
                <div className="flex gap-2">
                  <Select
                    value={p.method}
                    onValueChange={(v: any) =>
                      setPayments(payments.map((x, j) => (i === j ? { ...x, method: v, giftCardCode: v === "gift_card" ? x.giftCardCode : undefined } : x)))
                    }
                  >
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
                    placeholder="Amount"
                    value={p.amount || ""}
                    onChange={(e) =>
                      setPayments(payments.map((x, j) => (i === j ? { ...x, amount: Number(e.target.value) || 0 } : x)))
                    }
                  />
                  {payments.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => setPayments(payments.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                {p.method === "gift_card" && (
                  <div className="flex gap-2 items-center">
                    <Gift className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      placeholder="Enter gift card code (e.g. GC-XXXXXXXX)"
                      value={p.giftCardCode ?? ""}
                      onChange={(e) =>
                        setPayments(payments.map((x, j) => (i === j ? { ...x, giftCardCode: e.target.value.toUpperCase() } : x)))
                      }
                      className="font-mono"
                    />
                  </div>
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

        {/* ── Summary Sidebar ──────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card className="p-5 h-fit sticky top-4 space-y-3 border-primary/20 shadow-lg shadow-primary/5">
            <h3 className="font-semibold flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              Bill Summary
            </h3>
            <Row label="Subtotal" value={fmtMoney(subtotal)} />
            {discountAmount > 0 && <Row label="Discount" value={`− ${fmtMoney(discountAmount)}`} muted />}
            <hr />
            <Row label="Total" value={fmtMoney(total)} bold />
            {/* Payment progress bar */}
            {total > 0 && (
              <div className="space-y-1">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow transition-all duration-500 ease-out" style={{ width: `${paidPercent}%` }} />
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>{Math.round(paidPercent)}% paid</span>
                  <span>{fmtMoney(paid)} / {fmtMoney(total)}</span>
                </div>
              </div>
            )}
            <Row label="Due" value={fmtMoney(due)} accent={due > 0} bold />
            <Button className="w-full mt-2 h-11 text-sm font-semibold shadow-lg shadow-primary/20" disabled={busy} onClick={submit}>
              {busy ? (
                <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</span>
              ) : (
                <span className="flex items-center gap-2"><ChevronRight className="h-4 w-4" /> Create Bill — {fmtMoney(total)}</span>
              )}
            </Button>
          </Card>
        </div>
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

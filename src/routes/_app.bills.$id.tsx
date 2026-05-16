import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtMoney } from "@/lib/auth";
import { ArrowLeft, Printer, CreditCard, Gift, CheckCircle, Clock, AlertTriangle, Banknote } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/bills/$id")({ component: BillView });

function BillView() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [payBusy, setPayBusy] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<"cash" | "upi" | "card" | "gift_card">("cash");
  const [giftCardCode, setGiftCardCode] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["bill", id],
    queryFn: async () => {
      const [bill, items, pays] = await Promise.all([
        supabase
          .from("bills")
          .select("*,clients(full_name,mobile),barbers(full_name)")
          .eq("id", id)
          .single(),
        supabase.from("bill_items").select("*").eq("bill_id", id),
        supabase.from("payments").select("*").eq("bill_id", id),
      ]);
      return { bill: bill.data, items: items.data ?? [], payments: pays.data ?? [] };
    },
  });

  async function recordDuePayment() {
    if (!data?.bill) return;
    const b = data.bill;
    const amount = Number(payAmount);

    if (amount <= 0) return toast.error("Enter a valid amount");
    if (amount > Number(b.due_amount)) return toast.error(`Amount exceeds due balance of ${fmtMoney(b.due_amount)}`);

    setPayBusy(true);
    try {
      // --- Gift Card validation for due payment ---
      let giftCardDeduction: { cardId: string; currentBalance: number } | null = null;

      if (payMethod === "gift_card") {
        if (!giftCardCode.trim()) {
          setPayBusy(false);
          return toast.error("Enter a gift card code");
        }
        const { data: gc, error: gcErr } = await supabase
          .from("gift_cards")
          .select("id,balance,status,expires_on")
          .eq("code", giftCardCode.trim().toUpperCase())
          .single();

        if (gcErr || !gc) {
          setPayBusy(false);
          return toast.error(`Gift card "${giftCardCode}" not found`);
        }
        if (gc.status !== "active") {
          setPayBusy(false);
          return toast.error(`Gift card is ${gc.status}`);
        }
        if (gc.expires_on && new Date(gc.expires_on + "T23:59:59") < new Date()) {
          setPayBusy(false);
          return toast.error("Gift card has expired");
        }
        if (Number(gc.balance) < amount) {
          setPayBusy(false);
          return toast.error(`Insufficient gift card balance: ${fmtMoney(gc.balance)} available`);
        }
        giftCardDeduction = { cardId: gc.id, currentBalance: Number(gc.balance) };
      }

      // Insert payment record
      const { error: payErr } = await supabase.from("payments").insert({
        bill_id: b.id,
        method: payMethod,
        amount,
      });
      if (payErr) throw payErr;

      // Update bill: increase amount_paid, decrease due_amount, update status
      const newPaid = Number(b.amount_paid) + amount;
      const newDue = Math.max(0, Number(b.due_amount) - amount);
      const newStatus = newDue === 0 ? "paid" : "partial";

      const { error: billErr } = await supabase
        .from("bills")
        .update({ amount_paid: newPaid, due_amount: newDue, status: newStatus })
        .eq("id", b.id);
      if (billErr) throw billErr;

      // Update client's due_amount
      const { data: client } = await supabase
        .from("clients")
        .select("due_amount")
        .eq("id", b.client_id)
        .single();
      if (client) {
        const clientNewDue = Math.max(0, Number(client.due_amount) - amount);
        await supabase
          .from("clients")
          .update({ due_amount: clientNewDue })
          .eq("id", b.client_id);
      }

      // Deduct gift card balance if applicable
      if (giftCardDeduction) {
        const newBalance = giftCardDeduction.currentBalance - amount;
        const newGcStatus = newBalance <= 0 ? "redeemed" : "active";
        await supabase
          .from("gift_cards")
          .update({ balance: newBalance, status: newGcStatus })
          .eq("id", giftCardDeduction.cardId);
        await supabase.from("gift_card_transactions").insert({
          gift_card_id: giftCardDeduction.cardId,
          bill_id: b.id,
          amount,
          kind: "redeem",
        });
        qc.invalidateQueries({ queryKey: ["gift-cards"] });
      }

      toast.success(`Payment of ${fmtMoney(amount)} recorded`);
      setPayAmount(0);
      setGiftCardCode("");
      qc.invalidateQueries({ queryKey: ["bill", id] });
      qc.invalidateQueries({ queryKey: ["all-bills"] });
      qc.invalidateQueries({ queryKey: ["client", b.client_id] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to record payment");
    } finally {
      setPayBusy(false);
    }
  }

  if (isLoading || !data?.bill) return <div className="text-muted-foreground">Loading…</div>;
  const b = data.bill;

  return (
    <div className="max-w-2xl mx-auto space-y-4 print:max-w-none">
      <div className="flex items-center justify-between print:hidden">
        <Link to="/bills" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground gap-1">
          <ArrowLeft className="h-4 w-4" /> All bills
        </Link>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>
      <Card className="p-8 print:shadow-none print:border-0">
        <div className="flex items-start justify-between border-b pb-4 mb-4">
          <div>
            <div className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">CutBook</div>
            <div className="text-xs text-muted-foreground">Salon Invoice</div>
          </div>
          <div className="text-right">
            <div className="font-semibold">Bill #{b.bill_no}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(b.created_at).toLocaleString("en-IN")}
            </div>
            <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
              b.status === 'paid' ? 'bg-success/15 text-success' :
              b.status === 'partial' ? 'bg-warning/15 text-warning-foreground' :
              'bg-destructive/15 text-destructive'
            }`}>
              {b.status === 'paid' ? <CheckCircle className="h-3 w-3" /> : b.status === 'partial' ? <Clock className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              {b.status}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Billed To</div>
            <div className="font-medium">{b.clients?.full_name}</div>
            <div className="text-muted-foreground">{b.clients?.mobile}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Served By</div>
            <div className="font-medium">{b.barbers?.full_name ?? "—"}</div>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th className="text-left py-2">Item</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Price</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((i) => (
              <tr key={i.id} className="border-b last:border-0">
                <td className="py-2">{i.name}</td>
                <td className="text-right">{i.qty}</td>
                <td className="text-right">{fmtMoney(i.unit_price)}</td>
                <td className="text-right font-medium">{fmtMoney(i.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 ml-auto w-64 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmtMoney(b.subtotal)}</span></div>
          {Number(b.discount_amount) > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Discount {b.discount_type === "percent" ? `(${b.discount_value}%)` : ""}</span>
              <span>− {fmtMoney(b.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base border-t pt-1"><span>Total</span><span>{fmtMoney(b.total)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Paid</span><span>{fmtMoney(b.amount_paid)}</span></div>
          {Number(b.due_amount) > 0 && (
            <div className="flex justify-between text-destructive font-semibold"><span>Due</span><span>{fmtMoney(b.due_amount)}</span></div>
          )}
        </div>
        {/* Payment progress */}
        {Number(b.total) > 0 && (
          <div className="mt-4 space-y-1">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow transition-all" style={{ width: `${Math.min(100, (Number(b.amount_paid) / Number(b.total)) * 100)}%` }} />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{Math.round((Number(b.amount_paid) / Number(b.total)) * 100)}% collected</span>
              <span>{fmtMoney(b.amount_paid)} / {fmtMoney(b.total)}</span>
            </div>
          </div>
        )}
        {data.payments.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <div className="text-xs font-medium text-muted-foreground mb-2">Payment History</div>
            <div className="space-y-1.5">
              {data.payments.map((p, i) => (
                <div key={p.id || i} className="flex items-center gap-2 text-sm">
                  <div className={`h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
                    p.method === 'cash' ? 'bg-chart-3/15 text-chart-3' :
                    p.method === 'upi' ? 'bg-chart-2/15 text-chart-2' :
                    p.method === 'card' ? 'bg-chart-1/15 text-chart-1' :
                    'bg-accent text-accent-foreground'
                  }`}>
                    {p.method === 'cash' ? '₹' : p.method === 'upi' ? 'U' : p.method === 'card' ? 'C' : 'G'}
                  </div>
                  <span className="capitalize text-muted-foreground flex-1">{p.method.replace('_', ' ')}</span>
                  <span className="font-semibold tabular-nums">{fmtMoney(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* ── Record Due Payment ──────────────────────────────────────── */}
      {Number(b.due_amount) > 0 && (
        <Card className="p-5 space-y-4 print:hidden border-destructive/20 shadow-lg shadow-destructive/5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Banknote className="h-4 w-4 text-primary" /> Record Due Payment
            </h3>
            <span className="text-sm font-semibold text-destructive">{fmtMoney(b.due_amount)} outstanding</span>
          </div>
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <Label className="text-xs">Method</Label>
              <Select value={payMethod} onValueChange={(v: any) => setPayMethod(v)}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="gift_card">Gift Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <Label className="text-xs">Amount</Label>
              <Input type="number" min={0} max={Number(b.due_amount)} value={payAmount || ""}
                onChange={(e) => setPayAmount(Number(e.target.value) || 0)}
                placeholder={`Max ${fmtMoney(b.due_amount)}`} />
            </div>
            <Button variant="outline" size="sm" className="text-xs mb-0.5"
              onClick={() => setPayAmount(Number(b.due_amount))}>
              Pay full
            </Button>
          </div>
          {payMethod === "gift_card" && (
            <div className="flex gap-2 items-center">
              <Gift className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Input placeholder="Gift card code (e.g. GC-XXXXXXXX)" value={giftCardCode}
                onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())} className="font-mono" />
            </div>
          )}
          <Button className="w-full h-11 font-semibold shadow-lg shadow-primary/20" disabled={payBusy || payAmount <= 0} onClick={recordDuePayment}>
            {payBusy ? (
              <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing…</span>
            ) : (
              `Record Payment of ${fmtMoney(payAmount)}`
            )}
          </Button>
        </Card>
      )}
    </div>
  );
}

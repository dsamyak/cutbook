import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/lib/auth";
import { ArrowLeft, Printer } from "lucide-react";

export const Route = createFileRoute("/_app/bills/$id")({ component: BillView });

function BillView() {
  const { id } = Route.useParams();
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
            <div className="text-2xl font-bold">CutBook</div>
            <div className="text-xs text-muted-foreground">Salon Invoice</div>
          </div>
          <div className="text-right">
            <div className="font-semibold">Bill #{b.bill_no}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(b.created_at).toLocaleString("en-IN")}
            </div>
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
        {data.payments.length > 0 && (
          <div className="mt-6 pt-4 border-t text-xs text-muted-foreground">
            Payment: {data.payments.map((p) => `${p.method.toUpperCase()} ${fmtMoney(p.amount)}`).join(" • ")}
          </div>
        )}
        {b.notes && <div className="mt-3 text-xs italic text-muted-foreground">Note: {b.notes}</div>}
        <div className="mt-8 text-center text-xs text-muted-foreground">Thank you for visiting!</div>
      </Card>
    </div>
  );
}

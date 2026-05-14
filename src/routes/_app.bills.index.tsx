import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { fmtMoney } from "@/lib/auth";

export const Route = createFileRoute("/_app/bills/")({ component: BillsList });

function BillsList() {
  const { data, isLoading } = useQuery({
    queryKey: ["all-bills"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bills")
        .select("id,bill_no,total,due_amount,status,created_at,clients(full_name,mobile),barbers(full_name)")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bills</h1>
        <p className="text-sm text-muted-foreground">Latest 200 bills</p>
      </div>
      <Card>
        {isLoading ? (
          <div className="p-6 text-muted-foreground">Loading…</div>
        ) : (data ?? []).length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No bills yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Bill #</th>
                  <th className="text-left">Client</th>
                  <th className="text-left">Staff</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Due</th>
                  <th className="text-left pl-4">Status</th>
                  <th className="text-right pr-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {data!.map((b: any) => (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="p-3">
                      <Link to="/bills/$id" params={{ id: b.id }} className="text-primary hover:underline font-medium">
                        #{b.bill_no}
                      </Link>
                    </td>
                    <td>
                      <div>{b.clients?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{b.clients?.mobile}</div>
                    </td>
                    <td className="text-muted-foreground">{b.barbers?.full_name ?? "—"}</td>
                    <td className="text-right font-medium">{fmtMoney(b.total)}</td>
                    <td className={`text-right ${Number(b.due_amount) > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {fmtMoney(b.due_amount)}
                    </td>
                    <td className="pl-4 capitalize">{b.status}</td>
                    <td className="text-right pr-3 text-xs text-muted-foreground">
                      {new Date(b.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
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

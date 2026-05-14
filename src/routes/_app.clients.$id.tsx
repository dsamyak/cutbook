import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/lib/auth";
import { ArrowLeft, Phone, Calendar, Receipt } from "lucide-react";

export const Route = createFileRoute("/_app/clients/$id")({ component: ClientProfile });

function ClientProfile() {
  const { id } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const [client, bills] = await Promise.all([
        supabase.from("clients").select("*").eq("id", id).single(),
        supabase
          .from("bills")
          .select("id,bill_no,total,status,due_amount,amount_paid,discount_amount,created_at,bill_items(name,qty,total),barbers(full_name)")
          .eq("client_id", id)
          .order("created_at", { ascending: false }),
      ]);
      return { client: client.data, bills: bills.data ?? [] };
    },
  });

  if (isLoading || !data?.client) return <div className="text-muted-foreground">Loading…</div>;
  const c = data.client;

  return (
    <div className="space-y-5">
      <Link to="/clients" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground gap-1">
        <ArrowLeft className="h-4 w-4" /> All clients
      </Link>

      <Card className="p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">{c.full_name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Phone className="h-4 w-4" />{c.mobile}</span>
              {c.date_of_birth && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(c.date_of_birth).toLocaleDateString("en-IN")}
                </span>
              )}
              {c.gender && <span className="capitalize">{c.gender}</span>}
            </div>
            {c.notes && <p className="text-sm mt-3 text-muted-foreground italic">"{c.notes}"</p>}
          </div>
          <Link to="/billing/new" search={{ clientId: c.id } as any}>
            <Button>New Bill</Button>
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-6">
          <Stat label="Total Spent" value={fmtMoney(c.total_spent)} />
          <Stat label="Outstanding Due" value={fmtMoney(c.due_amount)} accent={Number(c.due_amount) > 0} />
          <Stat label="Visits" value={data.bills.length} />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Receipt className="h-4 w-4" /> Service History</h3>
        {data.bills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bills for this client yet.</p>
        ) : (
          <div className="space-y-3">
            {data.bills.map((b: any) => (
              <div key={b.id} className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <Link to="/bills/$id" params={{ id: b.id }} className="font-medium hover:underline">
                      Bill #{b.bill_no}
                    </Link>
                    <span className="text-xs text-muted-foreground ml-2">
                      {new Date(b.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                    {b.barbers?.full_name && (
                      <span className="text-xs text-muted-foreground ml-2">• by {b.barbers.full_name}</span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{fmtMoney(b.total)}</div>
                    {Number(b.due_amount) > 0 && (
                      <div className="text-xs text-destructive">Due {fmtMoney(b.due_amount)}</div>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {(b.bill_items ?? []).map((i: any) => `${i.name} ×${i.qty}`).join(" · ") || "No items"}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold mt-0.5 ${accent ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}

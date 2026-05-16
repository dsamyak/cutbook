import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/lib/auth";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { Users, Receipt, IndianRupee, AlertCircle, Wallet, Gift } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

const COLORS = ["hsl(280 70% 55%)", "hsl(200 70% 55%)", "hsl(150 60% 50%)", "hsl(60 80% 55%)", "hsl(340 70% 60%)"];

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

      const [clients, todayBills, allBills, expenses, gifts, recent, topServices] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("bills").select("id,total", { count: "exact" }).gte("created_at", todayStart),
        supabase.from("bills").select("total,due_amount,created_at,barber_id"),
        supabase.from("expenses").select("amount"),
        supabase.from("gift_cards").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase
          .from("bills")
          .select("id,bill_no,total,status,created_at,clients(full_name)")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase.from("bill_items").select("name,total").eq("item_type", "service").limit(500),
      ]);

      const totalRevenue = (allBills.data ?? []).reduce((s, b) => s + Number(b.total), 0);
      const totalDue = (allBills.data ?? []).reduce((s, b) => s + Number(b.due_amount), 0);
      const todayRevenue = (todayBills.data ?? []).reduce((s, b) => s + Number(b.total), 0);
      const totalExpenses = (expenses.data ?? []).reduce((s, e) => s + Number(e.amount), 0);

      const svcMap = new Map<string, number>();
      (topServices.data ?? []).forEach((r) => {
        svcMap.set(r.name, (svcMap.get(r.name) ?? 0) + Number(r.total));
      });
      const top = [...svcMap.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

      return {
        clientCount: clients.count ?? 0,
        todayCount: todayBills.count ?? 0,
        todayRevenue,
        totalRevenue,
        totalDue,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses,
        activeGifts: gifts.count ?? 0,
        recent: recent.data ?? [],
        topServices: top,
      };
    },
  });

  if (isLoading || !data) return <div className="text-muted-foreground">Loading dashboard…</div>;

  const kpis = [
    { label: "Total Clients", value: data.clientCount, icon: Users, accent: "from-primary to-primary-glow" },
    { label: "Today's Bills", value: data.todayCount, sub: fmtMoney(data.todayRevenue), icon: Receipt, accent: "from-chart-2 to-chart-3" },
    { label: "Total Revenue", value: fmtMoney(data.totalRevenue), icon: IndianRupee, accent: "from-chart-3 to-chart-4" },
    { label: "Pending Dues", value: fmtMoney(data.totalDue), icon: AlertCircle, accent: "from-warning to-destructive" },
    { label: "Total Expenses", value: fmtMoney(data.totalExpenses), icon: Wallet, accent: "from-chart-5 to-destructive" },
    { label: "Active Gift Cards", value: data.activeGifts, icon: Gift, accent: "from-accent to-primary-glow" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Net profit so far: <span className="font-semibold text-foreground">{fmtMoney(data.netProfit)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/clients"><Button variant="outline" size="sm">Clients</Button></Link>
          <Link to="/billing/new" search={{ clientId: "" }}><Button size="sm">New Bill</Button></Link>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4 relative overflow-hidden">
            <div className={`absolute -top-6 -right-6 h-20 w-20 rounded-full opacity-10 bg-gradient-to-br ${k.accent}`} />
            <k.icon className="h-4 w-4 text-muted-foreground" />
            <div className="mt-2 text-xs text-muted-foreground">{k.label}</div>
            <div className="text-xl font-bold mt-0.5">{k.value}</div>
            {k.sub && <div className="text-xs text-muted-foreground">{k.sub}</div>}
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-semibold mb-4">Top Services by Revenue</h3>
          {data.topServices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No service revenue yet. Create your first bill.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.topServices}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="oklch(0.55 0.18 280)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Service Mix</h3>
          {data.topServices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.topServices} dataKey="value" nameKey="name" outerRadius={90}>
                  {data.topServices.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Recent Transactions</h3>
          <Link to="/bills" className="text-sm text-primary hover:underline">View all →</Link>
        </div>
        {data.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bills yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2">Bill #</th>
                  <th className="text-left">Client</th>
                  <th className="text-right">Amount</th>
                  <th className="text-left pl-4">Status</th>
                  <th className="text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((b: any) => (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2">
                      <Link to="/bills/$id" params={{ id: b.id }} className="text-primary hover:underline">
                        #{b.bill_no}
                      </Link>
                    </td>
                    <td>{b.clients?.full_name ?? "—"}</td>
                    <td className="text-right font-medium">{fmtMoney(b.total)}</td>
                    <td className="pl-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        b.status === "paid" ? "bg-success/15 text-success" :
                        b.status === "partial" ? "bg-warning/15 text-warning-foreground" :
                        b.status === "due" ? "bg-destructive/15 text-destructive" :
                        "bg-muted text-muted-foreground"
                      }`}>{b.status}</span>
                    </td>
                    <td className="text-right text-muted-foreground text-xs">
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

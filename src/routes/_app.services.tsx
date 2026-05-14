import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { Search, Sparkles } from "lucide-react";
import { fmtMoney } from "@/lib/auth";

export const Route = createFileRoute("/_app/services")({ component: ServicesPage });

function ServicesPage() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["services-all"],
    queryFn: async () => {
      const [cats, svcs] = await Promise.all([
        supabase.from("service_categories").select("*").order("sort_order"),
        supabase.from("services").select("*").eq("active", true).order("price"),
      ]);
      return { cats: cats.data ?? [], svcs: svcs.data ?? [] };
    },
  });

  const grouped = useMemo(() => {
    if (!data) return [];
    const ql = q.toLowerCase();
    return data.cats
      .map((cat) => ({
        ...cat,
        services: data.svcs.filter(
          (s) => s.category_id === cat.id && (!ql || s.name.toLowerCase().includes(ql)),
        ),
      }))
      .filter((c) => c.services.length > 0);
  }, [data, q]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Service Catalog</h1>
        <p className="text-sm text-muted-foreground">All services and rates from your salon.</p>
      </div>
      <Card className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search services…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
      </Card>

      {isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {grouped.map((cat) => (
            <Card key={cat.id} className="p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> {cat.name}
              </h3>
              <ul className="divide-y text-sm">
                {cat.services.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2">
                    <span className="text-foreground">{s.name}</span>
                    <span className="font-semibold tabular-nums">{fmtMoney(s.price)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

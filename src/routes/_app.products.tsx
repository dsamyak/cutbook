import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useState, useMemo } from "react";
import { Plus, Search, Package, AlertTriangle, Pencil } from "lucide-react";
import { fmtMoney } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/products")({ component: ProductsPage });

function ProductsPage() {
  const [q, setQ] = useState("");
  const qc = useQueryClient();
  const { data: products, isLoading } = useQuery({
    queryKey: ["products-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!products) return [];
    if (!q) return products;
    const ql = q.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(ql) || p.sku?.toLowerCase().includes(ql));
  }, [products, q]);

  const lowStockCount = useMemo(
    () => (products ?? []).filter((p) => p.active && p.stock <= (p.low_stock_threshold ?? 5)).length,
    [products]
  );

  async function toggleActive(id: string, active: boolean) {
    const { error } = await supabase.from("products").update({ active }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(active ? "Product activated" : "Product deactivated");
    qc.invalidateQueries({ queryKey: ["products-all"] });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">Inventory management with stock tracking</p>
        </div>
        <ProductDialog onSaved={() => qc.invalidateQueries({ queryKey: ["products-all"] })} />
      </div>

      {lowStockCount > 0 && (
        <Card className="p-4 border-warning/50 bg-warning/5">
          <div className="flex items-center gap-2 text-warning-foreground">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">{lowStockCount} product{lowStockCount > 1 ? "s" : ""} running low on stock</span>
          </div>
        </Card>
      )}

      <Card className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or SKU…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="p-6 text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No products yet. Click <strong>Add Product</strong> to start.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Product</th>
                  <th className="text-left">SKU</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Cost</th>
                  <th className="text-right">Stock</th>
                  <th className="text-center">Active</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const lowStock = p.active && p.stock <= (p.low_stock_threshold ?? 5);
                  return (
                    <tr key={p.id} className={`border-b last:border-0 hover:bg-muted/40 ${!p.active ? "opacity-50" : ""}`}>
                      <td className="p-3"><div className="flex items-center gap-2"><Package className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{p.name}</span></div></td>
                      <td className="text-muted-foreground text-xs">{p.sku ?? "—"}</td>
                      <td className="text-right font-semibold tabular-nums">{fmtMoney(p.price)}</td>
                      <td className="text-right text-muted-foreground tabular-nums">{p.cost ? fmtMoney(p.cost) : "—"}</td>
                      <td className="text-right">
                        <span className={`inline-flex items-center gap-1 tabular-nums ${lowStock ? "text-destructive font-semibold" : ""}`}>
                          {lowStock && <AlertTriangle className="h-3 w-3" />}{p.stock}
                        </span>
                      </td>
                      <td className="text-center"><Switch checked={p.active} onCheckedChange={(v) => toggleActive(p.id, v)} /></td>
                      <td className="text-right pr-3"><ProductDialog product={p} onSaved={() => qc.invalidateQueries({ queryKey: ["products-all"] })} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function ProductDialog({ product, onSaved }: { product?: any; onSaved: () => void }) {
  const isEdit = !!product;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: product?.name ?? "", sku: product?.sku ?? "", price: product?.price?.toString() ?? "",
    cost: product?.cost?.toString() ?? "", stock: product?.stock?.toString() ?? "0",
    low_stock_threshold: product?.low_stock_threshold?.toString() ?? "5",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.price) return toast.error("Name and price required");
    setBusy(true);
    const payload = {
      name: form.name, sku: form.sku || null, price: Number(form.price),
      cost: form.cost ? Number(form.cost) : null, stock: Number(form.stock) || 0,
      low_stock_threshold: Number(form.low_stock_threshold) || 5,
    };
    const { error } = isEdit
      ? await supabase.from("products").update(payload).eq("id", product.id)
      : await supabase.from("products").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(isEdit ? "Product updated" : "Product added");
    setOpen(false);
    if (!isEdit) setForm({ name: "", sku: "", price: "", cost: "", stock: "0", low_stock_threshold: "5" });
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
        ) : (
          <Button className="gap-2"><Plus className="h-4 w-4" /> Add Product</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Name *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="e.g. SHMP-200" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Price (₹) *</Label><Input type="number" required min={0} step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
            <div><Label>Cost (₹)</Label><Input type="number" min={0} step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Stock</Label><Input type="number" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></div>
            <div><Label>Low stock alert</Label><Input type="number" min={0} value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} /></div>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : isEdit ? "Update" : "Save Product"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

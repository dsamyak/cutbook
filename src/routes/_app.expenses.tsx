import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState, useMemo } from "react";
import { Plus, Search, Wallet, Trash2, CalendarDays } from "lucide-react";
import { fmtMoney } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/expenses")({
  component: ExpensesPage,
});

const CATEGORIES = [
  "Rent",
  "Utilities",
  "Supplies",
  "Staff",
  "Marketing",
  "Maintenance",
  "Equipment",
  "Other",
];

function ExpensesPage() {
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const qc = useQueryClient();

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses", catFilter, monthFilter],
    queryFn: async () => {
      let query = supabase
        .from("expenses")
        .select("*")
        .order("spent_on", { ascending: false })
        .limit(500);
      if (catFilter && catFilter !== "all")
        query = query.eq("category", catFilter);
      if (monthFilter) {
        const [y, m] = monthFilter.split("-");
        const start = `${y}-${m}-01`;
        const endDate = new Date(Number(y), Number(m), 0);
        const end = `${y}-${m}-${String(endDate.getDate()).padStart(2, "0")}`;
        query = query.gte("spent_on", start).lte("spent_on", end);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!expenses) return [];
    if (!q) return expenses;
    const ql = q.toLowerCase();
    return expenses.filter(
      (e) =>
        e.description?.toLowerCase().includes(ql) ||
        e.vendor?.toLowerCase().includes(ql) ||
        e.category.toLowerCase().includes(ql)
    );
  }, [expenses, q]);

  const totalAmount = useMemo(
    () => filtered.reduce((s, e) => s + Number(e.amount), 0),
    [filtered]
  );
  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((e) => {
      map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount));
    });
    return [...map.entries()]
      .map(([cat, total]) => ({ cat, total }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  async function deleteExpense(id: string) {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Expense deleted");
    qc.invalidateQueries({ queryKey: ["expenses"] });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            Track salon operational costs
          </p>
        </div>
        <NewExpenseDialog
          onCreated={() =>
            qc.invalidateQueries({ queryKey: ["expenses"] })
          }
        />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card className="p-4 relative overflow-hidden">
          <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full opacity-10 bg-gradient-to-br from-chart-5 to-destructive" />
          <Wallet className="h-4 w-4 text-muted-foreground" />
          <div className="mt-2 text-xs text-muted-foreground">
            Total (filtered)
          </div>
          <div className="text-xl font-bold mt-0.5">{fmtMoney(totalAmount)}</div>
        </Card>
        {categoryTotals.slice(0, 3).map((ct) => (
          <Card key={ct.cat} className="p-4">
            <div className="text-xs text-muted-foreground">{ct.cat}</div>
            <div className="text-lg font-bold mt-1">{fmtMoney(ct.total)}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search expenses…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="w-44"
          />
        </div>
      </Card>

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="p-6 text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            No expenses found. Click <strong>Add Expense</strong> to track one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left">Category</th>
                  <th className="text-left">Vendor</th>
                  <th className="text-left">Description</th>
                  <th className="text-left">Payment</th>
                  <th className="text-right">Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b last:border-0 hover:bg-muted/40"
                  >
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      {new Date(e.spent_on + "T00:00:00").toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-muted font-medium">
                        {e.category}
                      </span>
                    </td>
                    <td className="text-muted-foreground">{e.vendor ?? "—"}</td>
                    <td className="max-w-[200px] truncate">
                      {e.description ?? "—"}
                    </td>
                    <td className="text-muted-foreground capitalize text-xs">
                      {e.payment_method ?? "—"}
                    </td>
                    <td className="text-right font-semibold tabular-nums">
                      {fmtMoney(e.amount)}
                    </td>
                    <td className="text-right pr-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => deleteExpense(e.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
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

function NewExpenseDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    category: "Supplies",
    amount: "",
    vendor: "",
    description: "",
    payment_method: "cash",
    spent_on: new Date().toISOString().split("T")[0],
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0)
      return toast.error("Enter a valid amount");
    setBusy(true);
    const { error } = await supabase.from("expenses").insert({
      category: form.category,
      amount: Number(form.amount),
      vendor: form.vendor || null,
      description: form.description || null,
      payment_method: form.payment_method,
      spent_on: form.spent_on,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Expense added");
    setOpen(false);
    setForm({
      category: "Supplies",
      amount: "",
      vendor: "",
      description: "",
      payment_method: "cash",
      spent_on: new Date().toISOString().split("T")[0],
    });
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Add Expense
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category *</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (₹) *</Label>
              <Input
                type="number"
                required
                min={0}
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Vendor</Label>
            <Input
              value={form.vendor}
              onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              placeholder="e.g. Amazon, Local Supplier"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="What was this expense for?"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Payment Method</Label>
              <Select
                value={form.payment_method}
                onValueChange={(v) =>
                  setForm({ ...form, payment_method: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={form.spent_on}
                onChange={(e) => setForm({ ...form, spent_on: e.target.value })}
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Saving…" : "Save Expense"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useState, useMemo } from "react";
import { Plus, UserCog, Clock, IndianRupee, Pencil, CalendarCheck } from "lucide-react";
import { fmtMoney } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/staff")({ component: StaffPage });

const INCENTIVE_TIERS = [
  { min: 200000, pct: 15 },
  { min: 150000, pct: 12 },
  { min: 100000, pct: 10 },
  { min: 75000, pct: 7 },
  { min: 50000, pct: 5 },
];

function getIncentivePct(revenue: number): number {
  for (const tier of INCENTIVE_TIERS) {
    if (revenue >= tier.min) return tier.pct;
  }
  return 0;
}

function StaffPage() {
  const qc = useQueryClient();
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff & Payroll</h1>
          <p className="text-sm text-muted-foreground">Manage barbers, attendance, and salary</p>
        </div>
        <BarberDialog onSaved={() => qc.invalidateQueries({ queryKey: ["barbers"] })} />
      </div>

      <Tabs defaultValue="barbers">
        <TabsList>
          <TabsTrigger value="barbers">Barbers</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
        </TabsList>

        <TabsContent value="barbers" className="mt-4"><BarbersTab /></TabsContent>
        <TabsContent value="attendance" className="mt-4"><AttendanceTab /></TabsContent>
        <TabsContent value="payroll" className="mt-4"><PayrollTab /></TabsContent>
      </Tabs>

      <Card className="p-4">
        <h3 className="font-semibold mb-2 text-sm">Incentive Tiers</h3>
        <div className="grid grid-cols-5 gap-2 text-xs">
          {INCENTIVE_TIERS.slice().reverse().map((t) => (
            <div key={t.min} className="bg-muted/40 rounded-md p-2 text-center">
              <div className="font-bold text-primary">{t.pct}%</div>
              <div className="text-muted-foreground">≥ {fmtMoney(t.min)}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ── Barbers Tab ── */
function BarbersTab() {
  const qc = useQueryClient();
  const { data: barbers, isLoading } = useQuery({
    queryKey: ["barbers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("barbers").select("*").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function toggleActive(id: string, active: boolean) {
    const { error } = await supabase.from("barbers").update({ active }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(active ? "Barber activated" : "Barber deactivated");
    qc.invalidateQueries({ queryKey: ["barbers"] });
  }

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {(barbers ?? []).length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground col-span-full">
          No barbers added yet. Click <strong>Add Barber</strong> to start.
        </Card>
      ) : (
        barbers!.map((b) => (
          <Card key={b.id} className={`p-5 ${!b.active ? "opacity-50" : ""}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-primary-foreground font-bold text-sm">
                  {b.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold">{b.full_name}</div>
                  <div className="text-xs text-muted-foreground">{b.mobile ?? "No phone"}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={b.active} onCheckedChange={(v) => toggleActive(b.id, v)} />
                <BarberDialog barber={b} onSaved={() => qc.invalidateQueries({ queryKey: ["barbers"] })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
              <div className="bg-muted/40 rounded-md p-2">
                <div className="text-xs text-muted-foreground">Monthly Salary</div>
                <div className="font-semibold">{fmtMoney(b.monthly_salary)}</div>
              </div>
              <div className="bg-muted/40 rounded-md p-2">
                <div className="text-xs text-muted-foreground">Shift Start</div>
                <div className="font-semibold">{b.shift_start ?? "10:00"}</div>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

/* ── Attendance Tab ── */
function AttendanceTab() {
  const qc = useQueryClient();
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);

  const { data: barbers } = useQuery({
    queryKey: ["barbers"],
    queryFn: async () => {
      const { data } = await supabase.from("barbers").select("*").eq("active", true).order("full_name");
      return data ?? [];
    },
  });

  const { data: attendance } = useQuery({
    queryKey: ["attendance", selectedDate],
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("*").eq("date", selectedDate);
      return data ?? [];
    },
  });

  async function markAttendance(barberId: string, status: string, checkIn?: string) {
    const existing = attendance?.find((a) => a.barber_id === barberId);
    if (existing) {
      const { error } = await supabase.from("attendance").update({ status, check_in: checkIn || existing.check_in }).eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("attendance").insert({
        barber_id: barberId, date: selectedDate, status, check_in: checkIn || null,
      });
      if (error) return toast.error(error.message);
    }
    toast.success("Attendance updated");
    qc.invalidateQueries({ queryKey: ["attendance", selectedDate] });
  }

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <div className="flex items-center gap-3">
          <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-44" />
          <span className="text-sm text-muted-foreground">{new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</span>
        </div>
      </Card>

      <Card>
        {(barbers ?? []).length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No active barbers.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Barber</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Check-in</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {barbers?.map((b) => {
                  const att = attendance?.find((a) => a.barber_id === b.id);
                  return (
                    <tr key={b.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="p-3 font-medium">{b.full_name}</td>
                      <td className="text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          att?.status === "present" ? "bg-success/15 text-success" :
                          att?.status === "half_day" ? "bg-warning/15 text-warning-foreground" :
                          att?.status === "absent" ? "bg-destructive/15 text-destructive" :
                          "bg-muted text-muted-foreground"
                        }`}>{att?.status ?? "unmarked"}</span>
                      </td>
                      <td className="text-center text-muted-foreground text-xs">
                        {att?.check_in ?? "—"}
                      </td>
                      <td className="text-right pr-3">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant={att?.status === "present" ? "default" : "outline"} className="h-7 text-xs px-2" onClick={() => markAttendance(b.id, "present", new Date().toTimeString().slice(0, 5))}>P</Button>
                          <Button size="sm" variant={att?.status === "half_day" ? "default" : "outline"} className="h-7 text-xs px-2" onClick={() => markAttendance(b.id, "half_day")}>H</Button>
                          <Button size="sm" variant={att?.status === "absent" ? "destructive" : "outline"} className="h-7 text-xs px-2" onClick={() => markAttendance(b.id, "absent")}>A</Button>
                        </div>
                      </td>
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

/* ── Payroll Tab ── */
function PayrollTab() {
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [busy, setBusy] = useState(false);

  const { data: barbers } = useQuery({
    queryKey: ["barbers"],
    queryFn: async () => {
      const { data } = await supabase.from("barbers").select("*").eq("active", true).order("full_name");
      return data ?? [];
    },
  });

  const { data: salaryRecords } = useQuery({
    queryKey: ["salary-records", year, month],
    queryFn: async () => {
      const { data } = await supabase.from("salary_records").select("*,barbers(full_name)").eq("period_year", year).eq("period_month", month);
      return data ?? [];
    },
  });

  async function generatePayroll() {
    if (!barbers?.length) return toast.error("No active barbers");
    setBusy(true);
    try {
      const startOfMonth = `${year}-${String(month).padStart(2, "0")}-01T00:00:00`;
      const endDate = new Date(year, month, 0);
      const endOfMonth = `${year}-${String(month).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}T23:59:59`;

      for (const b of barbers) {
        const existing = salaryRecords?.find((s) => s.barber_id === b.id);
        if (existing) continue;

        const { data: bills } = await supabase.from("bills").select("total").eq("barber_id", b.id).gte("created_at", startOfMonth).lte("created_at", endOfMonth);
        const revenue = (bills ?? []).reduce((s, bill) => s + Number(bill.total), 0);
        const pct = getIncentivePct(revenue);
        const incentive = Math.round(revenue * pct / 100);

        const { data: attData } = await supabase.from("attendance").select("check_in,status").eq("barber_id", b.id).gte("date", `${year}-${String(month).padStart(2, "0")}-01`).lte("date", `${year}-${String(month).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`);

        let overtimeMinutes = 0;
        const shiftStart = b.shift_start ?? "10:00";
        (attData ?? []).forEach((a) => {
          if (a.check_in && a.status === "present") {
            const [sh, sm] = shiftStart.split(":").map(Number);
            const [ch, cm] = a.check_in.split(":").map(Number);
            const shiftMins = sh * 60 + sm;
            const checkMins = ch * 60 + cm;
            if (checkMins < shiftMins) overtimeMinutes += shiftMins - checkMins;
          }
        });
        const overtimeHours = overtimeMinutes / 60;
        const hourlyRate = Number(b.monthly_salary) / (26 * 8);
        const overtimeAmount = Math.round(overtimeHours * hourlyRate * 1.5);

        const total = Number(b.monthly_salary) + incentive + overtimeAmount;

        await supabase.from("salary_records").insert({
          barber_id: b.id, period_year: year, period_month: month,
          base_salary: Number(b.monthly_salary), revenue_generated: revenue,
          incentive_pct: pct, incentive_amount: incentive,
          overtime_amount: overtimeAmount, total,
        });
      }
      toast.success("Payroll generated for " + month + "/" + year);
      qc.invalidateQueries({ queryKey: ["salary-records"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate payroll");
    } finally {
      setBusy(false);
    }
  }

  async function markPaid(id: string) {
    const { error } = await supabase.from("salary_records").update({ paid_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marked as paid");
    qc.invalidateQueries({ queryKey: ["salary-records"] });
  }

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24" min={2020} max={2100} />
          <Button onClick={generatePayroll} disabled={busy}>{busy ? "Generating…" : "Generate Payroll"}</Button>
        </div>
      </Card>

      <Card>
        {(salaryRecords ?? []).length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">No payroll records for this period. Click <strong>Generate Payroll</strong>.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Barber</th>
                  <th className="text-right">Base</th>
                  <th className="text-right">Revenue</th>
                  <th className="text-right">Incentive</th>
                  <th className="text-right">Overtime</th>
                  <th className="text-right">Total</th>
                  <th className="text-center">Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {salaryRecords!.map((s: any) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="p-3 font-medium">{s.barbers?.full_name ?? "—"}</td>
                    <td className="text-right tabular-nums">{fmtMoney(s.base_salary)}</td>
                    <td className="text-right tabular-nums text-muted-foreground">{fmtMoney(s.revenue_generated)}</td>
                    <td className="text-right tabular-nums">
                      <span className="text-success">{fmtMoney(s.incentive_amount)}</span>
                      <span className="text-xs text-muted-foreground ml-1">({s.incentive_pct}%)</span>
                    </td>
                    <td className="text-right tabular-nums">{fmtMoney(s.overtime_amount)}</td>
                    <td className="text-right font-bold tabular-nums">{fmtMoney(s.total)}</td>
                    <td className="text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${s.paid_at ? "bg-success/15 text-success" : "bg-warning/15 text-warning-foreground"}`}>
                        {s.paid_at ? "Paid" : "Pending"}
                      </span>
                    </td>
                    <td className="text-right pr-3">
                      {!s.paid_at && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markPaid(s.id)}>Mark Paid</Button>
                      )}
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

/* ── Barber Dialog ── */
function BarberDialog({ barber, onSaved }: { barber?: any; onSaved: () => void }) {
  const isEdit = !!barber;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    full_name: barber?.full_name ?? "",
    mobile: barber?.mobile ?? "",
    monthly_salary: barber?.monthly_salary?.toString() ?? "",
    shift_start: barber?.shift_start ?? "10:00",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name) return toast.error("Name is required");
    setBusy(true);
    const payload = {
      full_name: form.full_name,
      mobile: form.mobile || null,
      monthly_salary: Number(form.monthly_salary) || 0,
      shift_start: form.shift_start || "10:00",
    };
    const { error } = isEdit
      ? await supabase.from("barbers").update(payload).eq("id", barber.id)
      : await supabase.from("barbers").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(isEdit ? "Barber updated" : "Barber added");
    setOpen(false);
    if (!isEdit) setForm({ full_name: "", mobile: "", monthly_salary: "", shift_start: "10:00" });
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
        ) : (
          <Button className="gap-2"><Plus className="h-4 w-4" /> Add Barber</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? "Edit Barber" : "Add Barber"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Full Name *</Label><Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div><Label>Mobile</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Monthly Salary (₹)</Label><Input type="number" min={0} value={form.monthly_salary} onChange={(e) => setForm({ ...form, monthly_salary: e.target.value })} /></div>
            <div><Label>Shift Start Time</Label><Input type="time" value={form.shift_start} onChange={(e) => setForm({ ...form, shift_start: e.target.value })} /></div>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : isEdit ? "Update" : "Add Barber"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

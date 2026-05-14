import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_app/staff")({
  component: () => (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold tracking-tight">Staff & Payroll</h1>
      <Card className="p-10 text-center text-muted-foreground">
        <div className="text-4xl mb-2">💈</div>
        <p className="text-sm">
          Barber profiles, attendance, salary slips, incentives (5% @ ₹50k → 15% @ ₹200k), and overtime calculations.
        </p>
        <p className="text-xs mt-2">Coming in the next phase.</p>
      </Card>
    </div>
  ),
});

import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_app/expenses")({
  component: () => (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
      <Card className="p-10 text-center text-muted-foreground">
        <div className="text-4xl mb-2">💸</div>
        <p className="text-sm">Track rent, utilities, supplies, and other expenses.</p>
        <p className="text-xs mt-2">Coming in the next phase.</p>
      </Card>
    </div>
  ),
});

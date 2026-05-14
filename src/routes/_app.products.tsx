import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";

function ComingSoon({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <Card className="p-10 text-center text-muted-foreground">
        <div className="text-4xl mb-2">🚧</div>
        <p className="text-sm">{desc}</p>
        <p className="text-xs mt-2">Coming in the next phase.</p>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/_app/products")({
  component: () => <ComingSoon title="Products" desc="Inventory management with stock tracking and low-stock alerts." />,
});

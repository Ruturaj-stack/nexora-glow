import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BatteryMedium, MonitorSmartphone, Plus, Signal } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { GlassPanel } from "@/components/common/glass-panel";
import { devices } from "@/data/mock";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/devices")({
  head: () => ({
    meta: [
      { title: "Devices — Nexora AI Workspace" },
      {
        name: "description",
        content: "Monitor every device meshed with Nexora, from workstations to edge sensors.",
      },
      { property: "og:title", content: "Devices — Nexora AI Workspace" },
      {
        property: "og:description",
        content: "Monitor every device meshed with Nexora, from workstations to edge sensors.",
      },
    ],
  }),
  component: DevicesPage,
});

const statusTone = {
  online: "bg-success/12 text-success",
  idle: "bg-warning/12 text-warning",
  offline: "bg-muted text-muted-foreground",
} as const;

function DevicesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Devices"
        description="Six endpoints in the local mesh. Mock telemetry for Phase 1."
        actions={
          <Button size="sm" variant="outline" className="gap-2">
            <Plus className="size-4" /> Pair device
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {devices.map((d, i) => (
          <motion.div
            key={d.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -3 }}
            className="glass hover-lift rounded-2xl p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <MonitorSmartphone className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{d.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.type} · {d.os}
                  </p>
                </div>
              </div>
              <Badge className={cn("shrink-0 capitalize", statusTone[d.status])} variant="secondary">
                {d.status}
              </Badge>
            </div>

            <div className="mt-5 space-y-3">
              <div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Signal className="size-3" /> Load
                  </span>
                  <span className="font-mono">{d.load}%</span>
                </div>
                <Progress value={d.load} className="mt-1.5 h-1.5" />
              </div>

              {d.battery !== null && (
                <div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <BatteryMedium className="size-3" /> Battery
                    </span>
                    <span className="font-mono">{d.battery}%</span>
                  </div>
                  <Progress value={d.battery} className="mt-1.5 h-1.5" />
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

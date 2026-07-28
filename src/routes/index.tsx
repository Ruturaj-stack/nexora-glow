import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Activity,
  Cpu,
  Gauge,
  HardDrive,
  MonitorSmartphone,
  Workflow,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { GlassPanel } from "@/components/common/glass-panel";
import { Sparkline } from "@/components/common/sparkline";
import { AIOrb, orbStateLabel } from "@/features/orb/ai-orb";
import { OrbStatePicker } from "@/features/orb/orb-state-picker";
import { useAppStore } from "@/store/app-store";
import { cpuSeries, latencySeries, memorySeries, automations, devices } from "@/data/mock";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Nexora AI Workspace" },
      {
        name: "description",
        content:
          "Live system overview for Nexora: assistant state, device health, memory usage and automation activity.",
      },
      { property: "og:title", content: "Dashboard — Nexora AI Workspace" },
      {
        property: "og:description",
        content: "Assistant state, device health, memory usage and automation activity at a glance.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const orbState = useAppStore((s) => s.orbState);
  const onlineDevices = devices.filter((d) => d.status === "online").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Good morning, Ari"
        description="Nexora is synchronised across your workspace. Here's the current state."
        actions={
          <Button variant="outline" size="sm" className="gap-2">
            <Zap className="size-4 text-primary" /> Run briefing
          </Button>
        }
      />

      <GlassPanel className="overflow-hidden p-6 sm:p-8">
        <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center">
          <AIOrb state={orbState} size={200} className="shrink-0" />
          <div className="min-w-0 flex-1 text-center lg:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Assistant · {orbStateLabel(orbState)}
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">
              <span className="text-gradient">Nexora</span> is standing by
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground lg:mx-0">
              Context window is warm with 12,480 memories, six devices are meshed, and four
              automations are armed. Say the word or press{" "}
              <kbd className="rounded border border-border bg-surface/70 px-1.5 py-0.5 font-mono text-[11px]">
                Ctrl K
              </kbd>
              .
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2 lg:justify-start">
              <OrbStatePicker />
            </div>
          </div>
        </div>
      </GlassPanel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="CPU load" value="29%" delta="−6% vs last hour" trend="up" icon={Cpu} delay={0.05}>
          <Sparkline data={cpuSeries} />
        </StatCard>
        <StatCard
          label="Memory"
          value="70%"
          delta="11.2 GB of 16 GB"
          icon={HardDrive}
          delay={0.1}
        >
          <Sparkline data={memorySeries} />
        </StatCard>
        <StatCard
          label="Response latency"
          value="58ms"
          delta="−18% this week"
          trend="up"
          icon={Gauge}
          delay={0.15}
        >
          <Sparkline data={latencySeries} />
        </StatCard>
        <StatCard
          label="Devices online"
          value={`${onlineDevices}/${devices.length}`}
          delta="1 device unreachable"
          trend="down"
          icon={MonitorSmartphone}
          delay={0.2}
        >
          <Progress value={(onlineDevices / devices.length) * 100} className="h-1.5" />
        </StatCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassPanel className="p-5 lg:col-span-2" delay={0.25}>
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold">Automation activity</h3>
            <Badge variant="secondary" className="gap-1.5">
              <Workflow className="size-3" /> 4 flows
            </Badge>
          </div>
          <div className="mt-4 space-y-2">
            {automations.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.06 }}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface/40 p-3 transition-colors hover:border-primary/25"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Activity className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.trigger}</p>
                </div>
                <span className="hidden shrink-0 font-mono text-[11px] text-muted-foreground sm:block">
                  {a.lastRun}
                </span>
                <span
                  className={`size-2 shrink-0 rounded-full ${a.enabled ? "bg-success" : "bg-muted-foreground/50"}`}
                />
              </motion.div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel className="p-5" delay={0.3}>
          <h3 className="font-display text-base font-semibold">Device mesh</h3>
          <div className="mt-4 space-y-3">
            {devices.slice(0, 5).map((d) => (
              <div key={d.id} className="flex items-center gap-3">
                <span
                  className={`size-2 shrink-0 rounded-full ${
                    d.status === "online"
                      ? "bg-success"
                      : d.status === "idle"
                        ? "bg-warning"
                        : "bg-muted-foreground/50"
                  }`}
                />
                <p className="min-w-0 flex-1 truncate text-sm">{d.name}</p>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {d.load}%
                </span>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

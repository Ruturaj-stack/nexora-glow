import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Braces, KeyRound, TerminalSquare } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { GlassPanel } from "@/components/common/glass-panel";
import { logs } from "@/data/mock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/developer")({
  head: () => ({
    meta: [
      { title: "Developer — Nexora AI Workspace" },
      {
        name: "description",
        content: "Runtime logs, API keys and design-token inspection for Nexora builders.",
      },
      { property: "og:title", content: "Developer — Nexora AI Workspace" },
      {
        property: "og:description",
        content: "Runtime logs, API keys and design-token inspection for Nexora builders.",
      },
    ],
  }),
  component: DeveloperPage,
});

const levelTone: Record<string, string> = {
  info: "text-primary",
  debug: "text-muted-foreground",
  warn: "text-warning",
  error: "text-destructive",
};

const tokens = [
  { name: "--primary", value: "oklch(0.79 0.135 195)" },
  { name: "--surface", value: "oklch(0.213 0.023 255)" },
  { name: "--success", value: "oklch(0.75 0.15 160)" },
  { name: "--warning", value: "oklch(0.81 0.14 78)" },
  { name: "--destructive", value: "oklch(0.63 0.19 22)" },
];

function DeveloperPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Developer"
        description="Inspect runtime output and the design system powering Nexora."
        actions={
          <Button variant="outline" size="sm" className="gap-2">
            <KeyRound className="size-4" /> API keys
          </Button>
        }
      />

      <GlassPanel className="p-0">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <TerminalSquare className="size-4 text-primary" />
          <h3 className="font-display text-base font-semibold">Runtime log</h3>
          <Badge variant="secondary" className="ml-auto text-[10px]">
            live · mock
          </Badge>
        </div>
        <div className="space-y-1 p-4 font-mono text-xs">
          {logs.map((l, i) => (
            <motion.div
              key={l.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="grid grid-cols-[auto_auto_auto_minmax(0,1fr)] items-baseline gap-3 rounded-md px-2 py-1.5 hover:bg-accent/40"
            >
              <span className="text-muted-foreground/70">{l.time}</span>
              <span className={cn("w-12 uppercase", levelTone[l.level])}>{l.level}</span>
              <span className="text-muted-foreground">[{l.scope}]</span>
              <span className="truncate">{l.message}</span>
            </motion.div>
          ))}
        </div>
      </GlassPanel>

      <GlassPanel className="p-5" delay={0.1}>
        <h3 className="flex items-center gap-2 font-display text-base font-semibold">
          <Braces className="size-4 text-primary" /> Design tokens
        </h3>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tokens.map((t) => (
            <div
              key={t.name}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface/40 p-3"
            >
              <span
                className="size-8 shrink-0 rounded-lg border border-glass-border"
                style={{ background: t.value }}
              />
              <div className="min-w-0">
                <p className="truncate font-mono text-xs font-medium">{t.name}</p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">{t.value}</p>
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}

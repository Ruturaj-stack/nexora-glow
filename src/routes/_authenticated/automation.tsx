import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { Play, Plus, Workflow } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { GlassPanel } from "@/components/common/glass-panel";
import { automations } from "@/data/mock";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/automation")({
  head: () => ({
    meta: [
      { title: "Automation — Nexora AI Workspace" },
      {
        name: "description",
        content: "Design triggers and flows that let Nexora act on your behalf automatically.",
      },
      { property: "og:title", content: "Automation — Nexora AI Workspace" },
      {
        property: "og:description",
        content: "Design triggers and flows that let Nexora act on your behalf automatically.",
      },
    ],
  }),
  component: AutomationPage,
});

function AutomationPage() {
  const [state, setState] = useState(() =>
    Object.fromEntries(automations.map((a) => [a.id, a.enabled])),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automation"
        description="Flows and triggers. Editing is stubbed for Phase 1."
        actions={
          <Button size="sm" className="gap-2">
            <Plus className="size-4" /> New flow
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {automations.map((a, i) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            className="glass hover-lift rounded-2xl p-5"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Workflow className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{a.name}</p>
                <p className="truncate text-xs text-muted-foreground">{a.trigger}</p>
              </div>
              <Switch
                checked={state[a.id]}
                onCheckedChange={(v) => setState((s) => ({ ...s, [a.id]: v }))}
                aria-label={`Toggle ${a.name}`}
              />
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
              <span className="font-mono">{a.runs.toLocaleString()} runs</span>
              <span className="font-mono">{a.lastRun}</span>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                <Play className="size-3" /> Run
              </Button>
            </div>
          </motion.div>
        ))}
      </div>

      <GlassPanel className="p-8 text-center" delay={0.3}>
        <p className="font-display text-base font-semibold">Flow builder arrives in Phase 2</p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
          A node canvas for chaining triggers, conditions and assistant actions is planned next.
        </p>
      </GlassPanel>
    </div>
  );
}

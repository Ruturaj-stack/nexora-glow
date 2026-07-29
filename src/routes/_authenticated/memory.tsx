import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { Brain, Search, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { GlassPanel } from "@/components/common/glass-panel";
import { StatCard } from "@/components/common/stat-card";
import { memories } from "@/data/mock";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/memory")({
  head: () => ({
    meta: [
      { title: "Memory — Nexora AI Workspace" },
      {
        name: "description",
        content: "Browse the long-term memory index that gives Nexora persistent context.",
      },
      { property: "og:title", content: "Memory — Nexora AI Workspace" },
      {
        property: "og:description",
        content: "Browse the long-term memory index that gives Nexora persistent context.",
      },
    ],
  }),
  component: MemoryPage,
});

function MemoryPage() {
  const [q, setQ] = useState("");
  const filtered = memories.filter((m) =>
    `${m.title} ${m.type} ${m.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Memory" description="Long-term knowledge Nexora recalls across sessions." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Stored memories" value="12,480" delta="+312 this week" trend="up" icon={Brain} />
        <StatCard label="Collections" value="6" delta="All healthy" icon={Sparkles} delay={0.05} />
        <StatCard label="Index size" value="284 MB" delta="of 2 GB budget" icon={Search} delay={0.1}>
          <Progress value={14} className="h-1.5" />
        </StatCard>
      </div>

      <GlassPanel className="p-5" delay={0.15}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
          <h3 className="truncate font-display text-base font-semibold">Recent entries</h3>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter memories…"
            className="h-9 w-full sm:w-64"
          />
        </div>

        <div className="mt-4 space-y-2">
          {filtered.map((m, i) => (
            <motion.div
              key={m.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-surface/40 p-3.5 transition-colors hover:border-primary/25 sm:flex"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{m.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {m.type} · {m.tokens.toLocaleString()} tokens · {m.updated}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5 sm:ml-auto">
                {m.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-[10px]">
                    {t}
                  </Badge>
                ))}
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No memories match.</p>
          )}
        </div>
      </GlassPanel>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { ArrowUp, Paperclip, Plus, Mic } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { GlassPanel } from "@/components/common/glass-panel";
import { AIOrb } from "@/features/orb/ai-orb";
import { chatThread, conversations } from "@/data/mock";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Chat — Nexora AI Workspace" },
      {
        name: "description",
        content: "A calm, focused conversation surface for talking with your Nexora assistant.",
      },
      { property: "og:title", content: "Chat — Nexora AI Workspace" },
      {
        property: "og:description",
        content: "A calm, focused conversation surface for talking with your Nexora assistant.",
      },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const orbState = useAppStore((s) => s.orbState);
  const [draft, setDraft] = useState("");
  const [active, setActive] = useState(conversations[0].id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chat"
        description="Phase 1 preview — conversation UI only, no model connected yet."
        actions={
          <Button size="sm" className="gap-2">
            <Plus className="size-4" /> New chat
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <GlassPanel className="hidden h-fit p-3 lg:block">
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
            Recent
          </p>
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              className={cn(
                "w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                active === c.id ? "bg-accent" : "hover:bg-accent/50",
              )}
            >
              <p className="truncate text-sm font-medium">{c.title}</p>
              <p className="truncate text-xs text-muted-foreground">{c.preview}</p>
            </button>
          ))}
        </GlassPanel>

        <GlassPanel className="flex min-h-[60vh] flex-col p-0" delay={0.08}>
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {chatThread.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}
              >
                {m.role === "assistant" ? (
                  <AIOrb state={orbState} size={40} className="shrink-0" />
                ) : (
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold">
                    A
                  </span>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl border border-border px-4 py-3 text-sm leading-relaxed",
                    m.role === "assistant"
                      ? "bg-surface/60"
                      : "bg-primary/10 border-primary/20",
                  )}
                >
                  {m.text}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface/50 p-2 transition-colors focus-within:border-primary/40">
              <Button variant="ghost" size="icon" className="shrink-0" aria-label="Attach file">
                <Paperclip className="size-4" />
              </Button>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={1}
                placeholder="Ask Nexora anything…"
                className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
              <Button variant="ghost" size="icon" className="shrink-0" aria-label="Voice input">
                <Mic className="size-4" />
              </Button>
              <Button size="icon" className="shrink-0" aria-label="Send message">
                <ArrowUp className="size-4" />
              </Button>
            </div>
            <p className="px-2 pt-2 text-[11px] text-muted-foreground">
              Responses are disabled in Phase 1.
            </p>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ChevronDown, Loader2, X, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToolStore } from "@/store/tool-store";
import { cancelExecution } from "./tool-manager";
import type { ToolExecution } from "./types";

function StatusIcon({ status }: { status: ToolExecution["status"] }) {
  if (status === "success") return <CheckCircle2 className="size-4 text-success" />;
  if (status === "error") return <XCircle className="size-4 text-destructive" />;
  if (status === "cancelled") return <X className="size-4 text-muted-foreground" />;
  return <Loader2 className="size-4 animate-spin text-primary" />;
}

/** Floating live feed of queued, running and just-finished tool executions. */
export function ToolExecutionPanel() {
  const { executions, panelOpen, setPanelOpen, clearFinished } = useToolStore();
  const [expanded, setExpanded] = useState<string | null>(null);

  const visible = executions.slice(0, 5);
  const active = executions.some((e) => e.status === "queued" || e.status === "running");

  return (
    <AnimatePresence>
      {panelOpen && visible.length > 0 && (
        <motion.aside
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className="fixed bottom-16 right-4 z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-background/85 shadow-2xl backdrop-blur-xl"
        >
          <header className="flex items-center gap-2 border-b border-border/70 px-3 py-2">
            <span className="text-xs font-medium">
              {active ? "Executing tools" : "Recent tool activity"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 px-2 text-[11px]"
              onClick={clearFinished}
            >
              Clear
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setPanelOpen(false)}
              aria-label="Hide tool panel"
            >
              <X className="size-3.5" />
            </Button>
          </header>

          <ul className="max-h-72 divide-y divide-border/60 overflow-y-auto">
            {visible.map((execution) => (
              <li key={execution.id} className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <StatusIcon status={execution.status} />
                  <span className="truncate font-mono text-[11px]">{execution.tool}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                    {execution.durationMs ? `${execution.durationMs}ms` : execution.status}
                  </span>
                  {(execution.status === "running" || execution.status === "queued") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-[10px]"
                      onClick={() => cancelExecution(execution.id)}
                    >
                      Stop
                    </Button>
                  )}
                  <button
                    onClick={() => setExpanded(expanded === execution.id ? null : execution.id)}
                    aria-label="Toggle details"
                    className="text-muted-foreground"
                  >
                    <ChevronDown
                      className={cn(
                        "size-3.5 transition-transform",
                        expanded === execution.id && "rotate-180",
                      )}
                    />
                  </button>
                </div>

                {execution.error && (
                  <p className="mt-1 line-clamp-2 text-[11px] text-destructive">{execution.error}</p>
                )}

                <AnimatePresence initial={false}>
                  {expanded === execution.id && (
                    <motion.pre
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-2 overflow-hidden whitespace-pre-wrap rounded-lg bg-surface/60 p-2 font-mono text-[10px] text-muted-foreground"
                    >
                      {[
                        `permission: ${execution.permission}`,
                        `runtime: ${execution.runtime} · source: ${execution.source}`,
                        ...execution.logs,
                        execution.result !== undefined
                          ? `result: ${JSON.stringify(execution.result).slice(0, 400)}`
                          : "",
                      ]
                        .filter(Boolean)
                        .join("\n")}
                    </motion.pre>
                  )}
                </AnimatePresence>
              </li>
            ))}
          </ul>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

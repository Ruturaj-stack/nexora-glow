import { useState } from "react";
import { motion } from "framer-motion";
import { Play, ShieldAlert, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getTool } from "./registry";
import { executeTool } from "./tool-manager";
import { SCOPE_LABELS } from "./types";

/**
 * Rendered for a ```nexora-tool fenced block in an assistant message.
 * The AI can only *propose* a call — the user presses Run, and the permission
 * gate still applies.
 */
export function ToolCallCard({ code }: { code: string }) {
  const [state, setState] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [output, setOutput] = useState<string>("");

  let parsed: { tool?: string; params?: Record<string, unknown> } | null = null;
  try {
    parsed = JSON.parse(code) as { tool?: string; params?: Record<string, unknown> };
  } catch {
    parsed = null;
  }

  const definition = parsed?.tool ? getTool(parsed.tool) : undefined;

  if (!parsed?.tool || !definition) {
    return (
      <div className="my-3 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
        <span>
          Nexora proposed an action that is not in the tool registry, so it cannot be executed.
        </span>
      </div>
    );
  }

  const run = async () => {
    setState("running");
    const outcome = await executeTool(definition.name, parsed?.params ?? {}, { source: "chat" });
    setState(outcome.ok ? "done" : "failed");
    setOutput(
      outcome.ok
        ? JSON.stringify(outcome.execution.result ?? {}, null, 2).slice(0, 800)
        : (outcome.execution.error ?? "Failed"),
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-3 overflow-hidden rounded-xl border border-primary/30 bg-primary/5"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-primary/20 px-3 py-2">
        <Wrench className="size-4 text-primary" />
        <span className="text-xs font-medium">{definition.title}</span>
        <Badge variant="outline" className="font-mono text-[10px]">
          {definition.name}
        </Badge>
        {definition.scopes.map((scope) => (
          <Badge key={scope} variant="secondary" className="text-[10px]">
            {SCOPE_LABELS[scope]}
          </Badge>
        ))}
        <Button
          size="sm"
          className="ml-auto h-7 px-2.5 text-[11px]"
          disabled={state === "running"}
          onClick={run}
        >
          <Play className="mr-1 size-3" />
          {state === "running" ? "Running…" : state === "idle" ? "Run" : "Run again"}
        </Button>
      </div>
      <pre className="overflow-x-auto px-3 py-2 font-mono text-[11px] text-muted-foreground">
        {JSON.stringify(parsed.params ?? {}, null, 2)}
      </pre>
      {output && (
        <pre
          className={`overflow-x-auto border-t border-primary/20 px-3 py-2 font-mono text-[11px] ${
            state === "failed" ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {output}
        </pre>
      )}
    </motion.div>
  );
}

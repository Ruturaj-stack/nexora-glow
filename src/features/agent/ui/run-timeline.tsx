import { motion } from "framer-motion";
import { Check, CircleDashed, Loader2, RotateCcw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { StepStatus, WorkflowExecution } from "../types";

/** Live and historical view of a single workflow run. */

const stepTone: Record<StepStatus, string> = {
  pending: "text-muted-foreground",
  running: "text-primary",
  success: "text-success",
  error: "text-destructive",
  skipped: "text-muted-foreground",
  rolledback: "text-warning",
};

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "running") return <Loader2 className="size-3.5 animate-spin" />;
  if (status === "success") return <Check className="size-3.5" />;
  if (status === "error") return <X className="size-3.5" />;
  if (status === "rolledback") return <RotateCcw className="size-3.5" />;
  return <CircleDashed className="size-3.5" />;
}

const runTone: Record<WorkflowExecution["status"], string> = {
  running: "bg-primary/12 text-primary",
  success: "bg-success/12 text-success",
  error: "bg-destructive/12 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

export function RunTimeline({ execution }: { execution: WorkflowExecution }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={runTone[execution.status]}>{execution.status}</Badge>
        <span className="text-sm font-medium">{execution.workflowName}</span>
        <span className="text-xs text-muted-foreground">
          {execution.trigger} · {(execution.durationMs / 1000).toFixed(1)}s ·{" "}
          {new Date(execution.startedAt).toLocaleTimeString()}
        </span>
      </div>

      <ol className="space-y-1.5">
        {execution.steps.map((step, index) => (
          <motion.li
            key={`${step.nodeId}-${index}`}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-start gap-2 rounded-lg bg-card/40 px-3 py-2 text-sm"
          >
            <span className={`mt-0.5 ${stepTone[step.status]}`}>
              <StepIcon status={step.status} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{step.label}</span>
              {step.error && <span className="block text-xs text-destructive">{step.error}</span>}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{step.durationMs}ms</span>
          </motion.li>
        ))}
        {!execution.steps.length && (
          <li className="text-sm text-muted-foreground">No steps recorded.</li>
        )}
      </ol>

      {execution.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {execution.error}
        </p>
      )}

      {execution.logs.length > 0 && (
        <ScrollArea className="max-h-40 rounded-lg border border-border/60 bg-background/40">
          <pre className="p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
            {execution.logs.join("\n")}
          </pre>
        </ScrollArea>
      )}
    </div>
  );
}

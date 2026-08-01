import { AlertTriangle, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToolStore } from "@/store/tool-store";
import { answerPermission } from "./permission-manager";
import { SCOPE_LABELS } from "./types";

/** Blocking Allow once / Always allow / Deny prompt shown before any tool runs. */
export function ToolPermissionDialog() {
  const pending = useToolStore((s) => s.pending);

  return (
    <AlertDialog open={Boolean(pending)}>
      <AlertDialogContent className="max-w-md border-border bg-background/95 backdrop-blur-xl">
        {pending && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-start gap-3">
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                  pending.danger ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary"
                }`}
              >
                {pending.danger ? (
                  <AlertTriangle className="size-5" />
                ) : (
                  <ShieldCheck className="size-5" />
                )}
              </span>
              <div className="min-w-0">
                <AlertDialogTitle className="font-display text-base">
                  Allow “{pending.title}”?
                </AlertDialogTitle>
                <AlertDialogDescription className="mt-1 text-xs">
                  {pending.description}
                </AlertDialogDescription>
              </div>
            </div>

            <div className="mt-4 space-y-2 rounded-xl border border-border bg-surface/50 p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Scope
                </span>
                {pending.scopes.map((scope) => (
                  <Badge key={scope} variant="secondary" className="text-[10px]">
                    {SCOPE_LABELS[scope]}
                  </Badge>
                ))}
                <Badge variant="outline" className="ml-auto font-mono text-[10px]">
                  {pending.source}
                </Badge>
              </div>
              <pre className="max-h-32 overflow-auto rounded-lg bg-background/60 p-2 font-mono text-[11px] text-muted-foreground">
                {pending.tool}({JSON.stringify(pending.params, null, 2)})
              </pre>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => answerPermission(pending.id, "deny")}>
                Deny
              </Button>
              <Button variant="outline" onClick={() => answerPermission(pending.id, "always")}>
                Always allow
              </Button>
              <Button onClick={() => answerPermission(pending.id, "once")}>Allow once</Button>
            </div>
          </motion.div>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Play } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { getConnector } from "../connector-registry";
import { runDeviceCommand } from "../device-commands";
import type { DeviceRecord } from "../types";

/** Runs any capability action a device's connector exposes, with JSON input. */
export function DeviceActionDialog({
  device,
  open,
  onOpenChange,
}: {
  device: DeviceRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const connector = device ? getConnector(device.connector) : undefined;
  const [selected, setSelected] = useState<string | null>(null);
  const [params, setParams] = useState("{}");
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const action = useMemo(
    () => connector?.actions.find((a) => a.id === selected) ?? null,
    [connector, selected],
  );

  const run = async () => {
    if (!device || !action) return;
    let input: Record<string, unknown>;
    try {
      input = params.trim() ? (JSON.parse(params) as Record<string, unknown>) : {};
    } catch {
      setError("Parameters must be valid JSON.");
      return;
    }
    setBusy(true);
    setError(null);
    setOutput(null);
    const outcome = await runDeviceCommand(device.id, action.id, input, "devices-page");
    setBusy(false);
    if (outcome.ok) setOutput(JSON.stringify(outcome.execution.result ?? null, null, 2));
    else setError(outcome.execution.error ?? "Action failed");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{device?.name ?? "Device"} actions</DialogTitle>
          <DialogDescription>
            Every action runs through the permission-gated tool engine and is written to device
            history.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {(connector?.actions ?? []).map((a) => (
            <motion.button
              key={a.id}
              type="button"
              whileTap={{ scale: 0.99 }}
              onClick={() => {
                setSelected(a.id);
                setOutput(null);
                setError(null);
              }}
              className={`w-full rounded-xl border p-3 text-left transition-colors ${
                selected === a.id ? "border-primary/50 bg-primary/5" : "border-border/60"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{a.label}</span>
                <span className="flex gap-1">
                  {a.danger ? (
                    <Badge variant="secondary" className="bg-warning/12 text-warning">
                      danger
                    </Badge>
                  ) : null}
                  {a.planned ? <Badge variant="secondary">planned</Badge> : null}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>
            </motion.button>
          ))}
          {!connector?.actions.length ? (
            <p className="text-sm text-muted-foreground">
              This connector exposes no executable actions.
            </p>
          ) : null}
        </div>

        {action ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Parameters (JSON)</p>
            <Textarea
              value={params}
              onChange={(e) => setParams(e.target.value)}
              rows={4}
              className="font-mono text-xs"
            />
            <Button onClick={run} disabled={busy || action.planned} className="gap-2">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              Run {action.label}
            </Button>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {output ? (
          <pre className="max-h-52 overflow-auto rounded-xl bg-muted/40 p-3 text-xs">{output}</pre>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

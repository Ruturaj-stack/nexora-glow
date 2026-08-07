import { useTelemetryStore, telemetryPayload } from "@/features/telemetry/telemetry";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Consent surface for optional telemetry. Off until the user turns it on,
 * and the exact payload is inspectable before anything is shared.
 */
export function TelemetryConsent() {
  const consent = useTelemetryStore((s) => s.consent);
  const queued = useTelemetryStore((s) => s.queue.length);
  const setConsent = useTelemetryStore((s) => s.setConsent);
  const clear = useTelemetryStore((s) => s.clear);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">Anonymous usage telemetry</p>
          <p className="text-xs text-muted-foreground">
            Disabled by default. No message content, addresses or credentials are ever collected.
          </p>
        </div>
        <Switch
          checked={consent === "granted"}
          aria-label="Enable anonymous telemetry"
          onCheckedChange={(next) => setConsent(next ? "granted" : "denied")}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{queued} events queued locally</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => {
            // eslint-disable-next-line no-console
            console.info(telemetryPayload());
            toast.info("Payload printed to the console");
          }}
        >
          Inspect payload
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          disabled={!queued}
          onClick={() => {
            clear();
            toast.success("Telemetry queue cleared");
          }}
        >
          Clear
        </Button>
      </div>
    </div>
  );
}

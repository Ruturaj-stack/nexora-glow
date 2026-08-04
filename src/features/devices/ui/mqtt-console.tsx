import { useState } from "react";
import { Loader2, PlugZap, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GlassPanel } from "@/components/common/glass-panel";
import { useDeviceStore } from "@/store/device-store";
import { ensureBrokerConnection } from "../connectors/mqtt";
import { mqttDisconnect, mqttSubscribe, mqttUnsubscribe } from "../mqtt-manager";
import { publishMqtt } from "../device-commands";

const statusTone: Record<string, string> = {
  connected: "bg-success/12 text-success",
  connecting: "bg-warning/12 text-warning",
  reconnecting: "bg-warning/12 text-warning",
  disconnected: "bg-muted text-muted-foreground",
  error: "bg-destructive/12 text-destructive",
};

/** MQTT console: connection, topic explorer, publish and message history. */
export function MqttConsole() {
  const devices = useDeviceStore((s) => s.devices);
  const status = useDeviceStore((s) => s.mqttStatus);
  const error = useDeviceStore((s) => s.mqttError);
  const brokerId = useDeviceStore((s) => s.mqttBrokerId);
  const subscriptions = useDeviceStore((s) => s.subscriptions);
  const messages = useDeviceStore((s) => s.messages);
  const clearMessages = useDeviceStore((s) => s.clearMessages);

  const brokers = devices.filter((d) => d.connector === "mqtt");
  const [selected, setSelected] = useState(brokerId ?? brokers[0]?.id ?? "");
  const [topic, setTopic] = useState("nexora/#");
  const [publishTopic, setPublishTopic] = useState("nexora/commands");
  const [payload, setPayload] = useState("");
  const [qos, setQos] = useState<"0" | "1" | "2">("0");
  const [retain, setRetain] = useState(false);
  const [busy, setBusy] = useState(false);

  const guard = async (label: string, run: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await run();
    } catch (e) {
      toast.error(label, { description: e instanceof Error ? e.message : "Failed" });
    } finally {
      setBusy(false);
    }
  };

  if (!brokers.length) {
    return (
      <GlassPanel className="p-6 text-sm text-muted-foreground">
        Pair an MQTT broker first — it appears here as a device with a WebSocket endpoint.
      </GlassPanel>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <div className="space-y-4">
        <GlassPanel className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Broker</h3>
            <Badge variant="secondary" className={statusTone[status]}>
              {status}
            </Badge>
          </div>

          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger>
              <SelectValue placeholder="Select broker" />
            </SelectTrigger>
            <SelectContent>
              {brokers.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          <div className="flex gap-2">
            <Button
              size="sm"
              className="gap-2"
              disabled={busy || !selected}
              onClick={() => guard("Connection failed", () => ensureBrokerConnection(selected))}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
              Connect
            </Button>
            <Button size="sm" variant="outline" onClick={() => void mqttDisconnect()}>
              Disconnect
            </Button>
          </div>
        </GlassPanel>

        <GlassPanel className="space-y-3 p-5">
          <h3 className="text-sm font-semibold">Topic explorer</h3>
          <div className="flex gap-2">
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="sensors/#" />
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                guard("Subscribe failed", async () => {
                  await ensureBrokerConnection(selected);
                  await mqttSubscribe(topic, Number(qos) as 0 | 1 | 2);
                })
              }
            >
              Subscribe
            </Button>
          </div>
          <div className="space-y-2">
            {subscriptions.map((sub) => (
              <div
                key={sub.topic}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono">{sub.topic}</p>
                  <p className="text-muted-foreground">
                    QoS {sub.qos} · {sub.messages} messages
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Unsubscribe ${sub.topic}`}
                  onClick={() => guard("Unsubscribe failed", () => mqttUnsubscribe(sub.topic))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {!subscriptions.length ? (
              <p className="text-xs text-muted-foreground">No active subscriptions.</p>
            ) : null}
          </div>
        </GlassPanel>

        <GlassPanel className="space-y-3 p-5">
          <h3 className="text-sm font-semibold">Publish</h3>
          <Input
            value={publishTopic}
            onChange={(e) => setPublishTopic(e.target.value)}
            placeholder="Topic"
          />
          <Input
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            placeholder="Payload"
          />
          <div className="flex items-center gap-3">
            <Select value={qos} onValueChange={(v) => setQos(v as "0" | "1" | "2")}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">QoS 0</SelectItem>
                <SelectItem value="1">QoS 1</SelectItem>
                <SelectItem value="2">QoS 2</SelectItem>
              </SelectContent>
            </Select>
            <Label className="flex items-center gap-2 text-xs">
              <Switch checked={retain} onCheckedChange={setRetain} /> Retained
            </Label>
          </div>
          <Button
            size="sm"
            className="gap-2"
            disabled={busy || !selected}
            onClick={() =>
              guard("Publish failed", () =>
                publishMqtt(selected, publishTopic, payload, {
                  qos: Number(qos) as 0 | 1 | 2,
                  retain,
                }),
              )
            }
          >
            <Send className="size-4" /> Publish
          </Button>
        </GlassPanel>
      </div>

      <GlassPanel className="flex min-h-[420px] flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Message history</h3>
          <Button size="sm" variant="ghost" onClick={clearMessages}>
            Clear
          </Button>
        </div>
        <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-lg border border-border/60 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="truncate font-mono text-foreground">{message.topic}</span>
                  <span>
                    {message.direction === "in" ? "↓" : "↑"} QoS {message.qos}
                    {message.retained ? " · retained" : ""}
                  </span>
                </div>
                <p className="mt-1 break-all font-mono text-xs">{message.payload || "(empty)"}</p>
              </motion.div>
            ))}
          </AnimatePresence>
          {!messages.length ? (
            <p className="text-xs text-muted-foreground">
              Subscribe to a topic to stream messages here.
            </p>
          ) : null}
        </div>
      </GlassPanel>
    </div>
  );
}

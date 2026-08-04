import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Radar, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GlassPanel } from "@/components/common/glass-panel";
import { approvePairing, listPairings, rejectPairing, requestPairing } from "@/lib/devices.functions";
import { listConnectors } from "../connector-registry";
import { defaultDiscoveryCandidates, discoverDevices, loadDevices } from "../device-manager";
import type { DiscoveredHost } from "../device-manager";

/**
 * DevicePairingService UI — request, discover and explicitly approve.
 * No device is ever connected without the owner approving the request.
 */
export function PairingPanel() {
  const connectors = listConnectors();
  const queryClient = useQueryClient();
  const [connectorId, setConnectorId] = useState(connectors[0]?.id ?? "generic");
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [discovered, setDiscovered] = useState<DiscoveredHost[]>([]);
  const [scanning, setScanning] = useState(false);

  const connector = connectors.find((c) => c.id === connectorId);
  const pairings = useQuery({ queryKey: ["device-pairings"], queryFn: () => listPairings() });

  const request = useMutation({
    mutationFn: async () => {
      if (!connector) throw new Error("Pick a connector");
      const credentials: Record<string, string> = {};
      for (const field of connector.fields) {
        if (field.secret && values[field.name]) credentials[field.name] = values[field.name]!;
      }
      return requestPairing({
        data: {
          name: name.trim() || connector.label,
          type: connector.types[0] ?? "custom",
          connector: connector.id,
          method: connector.pairingMethods.includes("code") ? "code" : "manual",
          address: values["address"] ?? "",
          capabilities: connector.capabilities,
          platform: "",
          metadata: values["baseTopic"] ? { baseTopic: values["baseTopic"] } : {},
          credentials,
        },
      });
    },
    onSuccess: (response) => {
      toast.success("Pairing requested", { description: `Code ${response.data.code}` });
      setValues({});
      setName("");
      void queryClient.invalidateQueries({ queryKey: ["device-pairings"] });
    },
    onError: (error: Error) => toast.error("Pairing failed", { description: error.message }),
  });

  const approve = useMutation({
    mutationFn: (pairingId: string) => approvePairing({ data: { pairingId } }),
    onSuccess: async (response) => {
      toast.success(`${response.data.name} paired`);
      await loadDevices();
      void queryClient.invalidateQueries({ queryKey: ["device-pairings"] });
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (error: Error) => toast.error("Approval failed", { description: error.message }),
  });

  const reject = useMutation({
    mutationFn: (pairingId: string) => rejectPairing({ data: { pairingId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["device-pairings"] }),
  });

  const scan = async () => {
    setScanning(true);
    const hosts = await discoverDevices(defaultDiscoveryCandidates());
    setScanning(false);
    setDiscovered(hosts);
    if (!hosts.length) toast.info("No devices answered on the default addresses.");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <GlassPanel className="space-y-4 p-5">
        <div>
          <h3 className="text-sm font-semibold">Pair a device</h3>
          <p className="text-xs text-muted-foreground">
            Secrets are encrypted server-side and never returned to the browser.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Connector</Label>
          <Select value={connectorId} onValueChange={setConnectorId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {connectors.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{connector?.description}</p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Device name</Label>
          <Input
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder={connector?.label}
          />
        </div>

        {connector?.fields.map((field) => (
          <div key={field.name} className="space-y-2">
            <Label className="text-xs">
              {field.label}
              {field.optional ? " (optional)" : ""}
            </Label>
            <Input
              type={field.secret ? "password" : "text"}
              value={values[field.name] ?? ""}
              maxLength={4000}
              placeholder={field.placeholder}
              onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
            />
          </div>
        ))}

        {connector?.id === "mqtt" ? (
          <div className="space-y-2">
            <Label className="text-xs">Base topic</Label>
            <Input
              value={values["baseTopic"] ?? ""}
              placeholder="nexora/#"
              onChange={(e) => setValues((v) => ({ ...v, baseTopic: e.target.value }))}
            />
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => request.mutate()} disabled={request.isPending} className="gap-2">
            {request.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Request pairing
          </Button>
          <Button variant="outline" onClick={scan} disabled={scanning} className="gap-2">
            {scanning ? <Loader2 className="size-4 animate-spin" /> : <Radar className="size-4" />}
            Scan network
          </Button>
        </div>

        {discovered.length ? (
          <div className="space-y-2 rounded-xl border border-border/60 p-3">
            <p className="text-xs font-medium">Discovered hosts</p>
            {discovered.map((host) => (
              <button
                key={host.address}
                type="button"
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted/50"
                onClick={() => {
                  setConnectorId(host.suggestedConnector);
                  setValues((v) => ({ ...v, address: host.address }));
                  setName(host.name);
                }}
              >
                <span className="font-mono">{host.address}</span>
                <Badge variant="secondary">{host.suggestedConnector}</Badge>
              </button>
            ))}
          </div>
        ) : null}
      </GlassPanel>

      <GlassPanel className="space-y-3 p-5">
        <h3 className="text-sm font-semibold">Awaiting approval</h3>
        {!pairings.data?.data.length ? (
          <p className="text-xs text-muted-foreground">
            No pending requests. Requested devices appear here until you approve them.
          </p>
        ) : null}
        {pairings.data?.data.map((pairing) => (
          <div
            key={pairing.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{pairing.name}</p>
              <p className="text-xs text-muted-foreground">
                {pairing.connector} · code{" "}
                <span className="font-mono text-foreground">{pairing.code}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() => approve.mutate(pairing.id)}
                aria-label="Approve pairing"
              >
                <Check className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => reject.mutate(pairing.id)}
                aria-label="Reject pairing"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </GlassPanel>
    </div>
  );
}

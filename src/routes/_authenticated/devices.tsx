import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MonitorSmartphone, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { GlassPanel } from "@/components/common/glass-panel";
import { StatCard } from "@/components/common/stat-card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeviceStore, mergeDevice } from "@/store/device-store";
import { loadDevices, startHealthMonitor } from "@/features/devices/device-manager";
import { DeviceCard } from "@/features/devices/ui/device-card";
import { DeviceActionDialog } from "@/features/devices/ui/device-action-dialog";
import { PairingPanel } from "@/features/devices/ui/pairing-panel";
import { MqttConsole } from "@/features/devices/ui/mqtt-console";
import { EntityBrowser } from "@/features/devices/ui/entity-browser";
import {
  clearDeviceEvents,
  clearDeviceHistory,
  listDeviceEvents,
  listDeviceHistory,
  revokeDevice,
  updateDevice,
} from "@/lib/devices.functions";
import type { DeviceRecord } from "@/features/devices/types";

export const Route = createFileRoute("/_authenticated/devices")({
  head: () => ({
    meta: [
      { title: "Devices — Nexora Connector Framework" },
      {
        name: "description",
        content:
          "Pair, monitor and control MQTT brokers, Home Assistant hubs, ESP32 boards and phones from Nexora.",
      },
      { property: "og:title", content: "Devices — Nexora Connector Framework" },
      {
        property: "og:description",
        content: "Secure pairing, live telemetry and permission-gated control for every device.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DevicesPage,
});

const levelTone: Record<string, string> = {
  info: "bg-muted text-muted-foreground",
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  error: "bg-destructive/12 text-destructive",
};

function DevicesPage() {
  const queryClient = useQueryClient();
  const devices = useDeviceStore((s) => s.devices);
  const liveStatus = useDeviceStore((s) => s.liveStatus);
  const search = useDeviceStore((s) => s.search);
  const setSearch = useDeviceStore((s) => s.setSearch);
  const groupBy = useDeviceStore((s) => s.groupBy);
  const setGroupBy = useDeviceStore((s) => s.setGroupBy);
  const [actionDevice, setActionDevice] = useState<DeviceRecord | null>(null);

  useQuery({ queryKey: ["devices"], queryFn: () => loadDevices() });
  const events = useQuery({ queryKey: ["device-events"], queryFn: () => listDeviceEvents() });
  const history = useQuery({ queryKey: ["device-history"], queryFn: () => listDeviceHistory() });

  useEffect(() => startHealthMonitor(60_000), []);

  const favorite = useMutation({
    mutationFn: (device: DeviceRecord) =>
      updateDevice({ data: { id: device.id, favorite: !device.favorite } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices"] }),
  });

  const revoke = useMutation({
    mutationFn: (device: DeviceRecord) => revokeDevice({ data: { id: device.id } }),
    onSuccess: async (_r, device) => {
      toast.success(`${device.name} revoked`);
      useDeviceStore.getState().removeDevice(device.id);
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (error: Error) => toast.error("Revoke failed", { description: error.message }),
  });

  const merged = useMemo(
    () => devices.map((device) => mergeDevice(device, liveStatus[device.id])),
    [devices, liveStatus],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? merged.filter(
          (d) =>
            d.name.toLowerCase().includes(q) ||
            d.connector.includes(q) ||
            d.address.toLowerCase().includes(q),
        )
      : merged;
  }, [merged, search]);

  const groups = useMemo(() => {
    const map = new Map<string, DeviceRecord[]>();
    for (const device of filtered) {
      const key =
        groupBy === "type" ? device.type : groupBy === "status" ? device.status : device.group;
      map.set(key, [...(map.get(key) ?? []), device]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupBy]);

  const online = merged.filter((d) => d.status === "online").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Devices"
        description="Pair, monitor and control external hardware through the connector framework."
        icon={MonitorSmartphone}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Paired devices" value={String(merged.length)} />
        <StatCard label="Online now" value={String(online)} />
        <StatCard label="Recent events" value={String(events.data?.data.length ?? 0)} />
        <StatCard label="Commands logged" value={String(history.data?.data.length ?? 0)} />
      </div>

      <Tabs defaultValue="fleet" className="space-y-4">
        <TabsList>
          <TabsTrigger value="fleet">Fleet</TabsTrigger>
          <TabsTrigger value="pairing">Pairing</TabsTrigger>
          <TabsTrigger value="mqtt">MQTT</TabsTrigger>
          <TabsTrigger value="entities">Home Assistant</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="fleet" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search devices"
                className="pl-9"
              />
            </div>
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="group">Group by room</SelectItem>
                <SelectItem value="type">Group by type</SelectItem>
                <SelectItem value="status">Group by status</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!merged.length ? (
            <GlassPanel className="p-8 text-center text-sm text-muted-foreground">
              No devices paired yet. Use the Pairing tab to request your first connection.
            </GlassPanel>
          ) : null}

          {groups.map(([group, items]) => (
            <section key={group} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold capitalize">{group}</h2>
                <Badge variant="secondary">{items.length}</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    onOpenActions={() => setActionDevice(device)}
                    onToggleFavorite={() => favorite.mutate(device)}
                    onRevoke={() => revoke.mutate(device)}
                  />
                ))}
              </div>
            </section>
          ))}
        </TabsContent>

        <TabsContent value="pairing">
          <PairingPanel />
        </TabsContent>

        <TabsContent value="mqtt">
          <MqttConsole />
        </TabsContent>

        <TabsContent value="entities">
          <EntityBrowser />
        </TabsContent>

        <TabsContent value="activity" className="grid gap-4 lg:grid-cols-2">
          <GlassPanel className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Event stream</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await clearDeviceEvents();
                  void events.refetch();
                }}
              >
                Clear
              </Button>
            </div>
            <div className="max-h-[460px] space-y-2 overflow-y-auto">
              {events.data?.data.map((event) => (
                <div key={event.id} className="rounded-xl border border-border/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm">{event.deviceName || event.type}</span>
                    <Badge variant="secondary" className={levelTone[event.level]}>
                      {event.level}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{event.message}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
              {!events.data?.data.length ? (
                <p className="text-xs text-muted-foreground">No device events recorded yet.</p>
              ) : null}
            </div>
          </GlassPanel>

          <GlassPanel className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Command history</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await clearDeviceHistory();
                  void history.refetch();
                }}
              >
                Clear
              </Button>
            </div>
            <div className="max-h-[460px] space-y-2 overflow-y-auto">
              {history.data?.data.map((row) => (
                <div key={row.id} className="rounded-xl border border-border/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-xs">{row.action}</span>
                    <Badge
                      variant="secondary"
                      className={
                        row.status === "success"
                          ? "bg-success/12 text-success"
                          : "bg-destructive/12 text-destructive"
                      }
                    >
                      {row.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {row.deviceName} · {row.durationMs}ms · {row.source}
                  </p>
                  {row.detail ? (
                    <p className="truncate text-[11px] text-muted-foreground">{row.detail}</p>
                  ) : null}
                </div>
              ))}
              {!history.data?.data.length ? (
                <p className="text-xs text-muted-foreground">No commands executed yet.</p>
              ) : null}
            </div>
          </GlassPanel>
        </TabsContent>
      </Tabs>

      <DeviceActionDialog
        device={actionDevice}
        open={Boolean(actionDevice)}
        onOpenChange={(open) => !open && setActionDevice(null)}
      />
    </div>
  );
}

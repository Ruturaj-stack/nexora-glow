import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GlassPanel } from "@/components/common/glass-panel";
import { listHomeAssistantEntities } from "@/lib/devices.functions";
import { useDeviceStore } from "@/store/device-store";
import { callHaService } from "../device-commands";

const ON_STATES = new Set(["on", "open", "unlocked", "playing", "home"]);

/** Home Assistant entity browser with per-domain quick controls. */
export function EntityBrowser() {
  const devices = useDeviceStore((s) => s.devices);
  const entities = useDeviceStore((s) => s.entities);
  const setEntities = useDeviceStore((s) => s.setEntities);
  const patchEntity = useDeviceStore((s) => s.patchEntity);

  const hubs = devices.filter((d) => d.connector === "home-assistant");
  const [hubId, setHubId] = useState(hubs[0]?.id ?? "");
  const [query, setQuery] = useState("");

  const list = useQuery({
    queryKey: ["ha-entities", hubId],
    enabled: Boolean(hubId),
    queryFn: async () => {
      const response = await listHomeAssistantEntities({ data: { deviceId: hubId } });
      setEntities(hubId, response.data);
      return response.data;
    },
  });

  const toggle = useMutation({
    mutationFn: async (entity: { entityId: string; domain: string; state: string }) => {
      const on = ON_STATES.has(entity.state);
      const actionId =
        entity.domain === "light"
          ? on
            ? "light.turn_off"
            : "light.turn_on"
          : entity.domain === "lock"
            ? on
              ? "lock.lock"
              : "lock.unlock"
            : entity.domain === "cover"
              ? on
                ? "cover.close"
                : "cover.open"
              : entity.domain === "scene"
                ? "scene.turn_on"
                : entity.domain === "script"
                  ? "script.turn_on"
                  : "switch.toggle";
      const outcome = await callHaService(hubId, actionId, entity.entityId, {}, "entity-browser");
      if (!outcome.ok) throw new Error(outcome.execution.error ?? "Service call failed");
      patchEntity(hubId, entity.entityId, on ? "off" : "on");
    },
    onError: (error: Error) => toast.error("Control failed", { description: error.message }),
  });

  const rows = useMemo(() => {
    const all = entities[hubId] ?? [];
    const q = query.trim().toLowerCase();
    return q
      ? all.filter((e) => e.name.toLowerCase().includes(q) || e.entityId.includes(q))
      : all;
  }, [entities, hubId, query]);

  if (!hubs.length) {
    return (
      <GlassPanel className="p-6 text-sm text-muted-foreground">
        Pair a Home Assistant hub to browse and control its entities. The access token stays
        encrypted on the server.
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={hubId} onValueChange={setHubId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Select hub" />
          </SelectTrigger>
          <SelectContent>
            {hubs.map((h) => (
              <SelectItem key={h.id} value={h.id}>
                {h.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter entities"
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => void list.refetch()} className="gap-2">
          {list.isFetching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Refresh
        </Button>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {rows.map((entity) => (
          <div
            key={entity.entityId}
            className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{entity.name}</p>
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {entity.entityId}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={ON_STATES.has(entity.state) ? "bg-success/12 text-success" : ""}
              >
                {entity.state}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                disabled={toggle.isPending}
                onClick={() =>
                  toggle.mutate({
                    entityId: entity.entityId,
                    domain: entity.domain,
                    state: entity.state,
                  })
                }
              >
                Toggle
              </Button>
            </div>
          </div>
        ))}
        {!rows.length && !list.isFetching ? (
          <p className="text-xs text-muted-foreground">No entities match that filter.</p>
        ) : null}
      </div>
    </GlassPanel>
  );
}

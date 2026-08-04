import { useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  BatteryCharging,
  Loader2,
  MoreVertical,
  RefreshCw,
  Signal,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlassPanel } from "@/components/common/glass-panel";
import { CAPABILITY_LABELS, type Capability, type DeviceRecord } from "../types";
import { probeDevice } from "../device-manager";
import { getConnector } from "../connector-registry";

const statusTone: Record<string, string> = {
  online: "bg-success/12 text-success",
  idle: "bg-warning/12 text-warning",
  pairing: "bg-warning/12 text-warning",
  offline: "bg-muted text-muted-foreground",
  error: "bg-destructive/12 text-destructive",
};

export function DeviceCard({
  device,
  onOpenActions,
  onToggleFavorite,
  onRevoke,
}: {
  device: DeviceRecord;
  onOpenActions: () => void;
  onToggleFavorite: () => void;
  onRevoke: () => void;
}) {
  const [probing, setProbing] = useState(false);
  const connector = getConnector(device.connector);

  const probe = async () => {
    setProbing(true);
    try {
      await probeDevice(device.id);
    } catch (error) {
      toast.error(`${device.name} unreachable`, {
        description: error instanceof Error ? error.message : "Probe failed",
      });
    } finally {
      setProbing(false);
    }
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <GlassPanel className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold">{device.name}</h3>
              {device.favorite ? <Star className="size-3.5 fill-warning text-warning" /> : null}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {connector?.label ?? device.connector} · {device.connection}
              {device.address ? ` · ${device.address}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className={statusTone[device.status]}>
              {device.status}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" aria-label={`${device.name} menu`}>
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onToggleFavorite}>
                  <Star className="size-4" /> {device.favorite ? "Unfavourite" : "Favourite"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={probe}>
                  <RefreshCw className="size-4" /> Probe now
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onRevoke} className="text-destructive">
                  <Trash2 className="size-4" /> Revoke device
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {device.battery !== null ? (
            <span className="flex items-center gap-1">
              <BatteryCharging className="size-3.5" />
              {device.battery}%{device.charging ? " ⚡" : ""}
            </span>
          ) : null}
          {device.signal !== null ? (
            <span className="flex items-center gap-1">
              <Signal className="size-3.5" />
              {device.signal}%
            </span>
          ) : null}
          {device.firmware ? (
            <span className="flex items-center gap-1">
              <Activity className="size-3.5" />
              {device.firmware}
            </span>
          ) : null}
          <span>
            {device.lastSeenAt
              ? `Seen ${new Date(device.lastSeenAt).toLocaleTimeString()}`
              : "Never seen"}
          </span>
        </div>

        <div className="flex flex-wrap gap-1">
          {device.capabilities.slice(0, 6).map((capability) => (
            <Badge key={capability} variant="secondary" className="text-[10px]">
              {CAPABILITY_LABELS[capability as Capability] ?? capability}
            </Badge>
          ))}
        </div>

        <div className="mt-auto flex gap-2 pt-1">
          <Button size="sm" onClick={onOpenActions} className="flex-1">
            Controls
          </Button>
          <Button size="sm" variant="outline" onClick={probe} disabled={probing} className="gap-2">
            {probing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Probe
          </Button>
        </div>
      </GlassPanel>
    </motion.div>
  );
}

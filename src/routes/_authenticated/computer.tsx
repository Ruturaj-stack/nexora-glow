import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Camera,
  Cpu,
  Gauge,
  HardDrive,
  Layers,
  Link2,
  MemoryStick,
  Monitor,
  RefreshCcw,
  Wifi,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { GlassPanel } from "@/components/common/glass-panel";
import { StatCard } from "@/components/common/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { useToolStore } from "@/store/tool-store";
import { executeTool } from "@/features/tools/tool-manager";
import { useBridgeStatus } from "@/features/tools/use-tools";
import { getBridgeUrl, setBridgeUrl } from "@/features/tools/bridge";

export const Route = createFileRoute("/_authenticated/computer")({
  head: () => ({
    meta: [
      { title: "Computer — Nexora System Control" },
      {
        name: "description",
        content:
          "Live CPU, memory, storage, network and process telemetry with permission-gated computer control.",
      },
      { property: "og:title", content: "Computer — Nexora System Control" },
      {
        property: "og:description",
        content: "Live machine telemetry and permission-gated computer control in Nexora.",
      },
    ],
  }),
  component: ComputerPage,
});

interface ProcessRow {
  pid?: number | string;
  name?: string;
  cpu?: number;
  memory?: number;
}

interface WindowRow {
  id?: string;
  title?: string;
  app?: string;
}

function ComputerPage() {
  const snapshot = useToolStore((s) => s.snapshot);
  const screenshots = useToolStore((s) => s.screenshots);
  const removeScreenshot = useToolStore((s) => s.removeScreenshot);
  const bridge = useBridgeStatus();
  const [processes, setProcesses] = useState<ProcessRow[]>([]);
  const [windows, setWindows] = useState<WindowRow[]>([]);
  const [bridgeUrl, setUrl] = useState(getBridgeUrl());

  const refresh = () => void executeTool("system.info", {}, { source: "dashboard", silent: true });

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => clearInterval(timer);
  }, []);

  const loadBridgeLists = async () => {
    const [proc, win] = await Promise.all([
      executeTool("system.processes", {}, { source: "dashboard", silent: true }),
      executeTool("windows.list", {}, { source: "dashboard", silent: true }),
    ]);
    if (proc.ok) setProcesses((proc.execution.result as ProcessRow[]) ?? []);
    if (win.ok) setWindows((win.execution.result as WindowRow[]) ?? []);
  };

  const storagePct =
    snapshot?.storageUsedGb && snapshot.storageQuotaGb
      ? Math.min(100, Math.round((snapshot.storageUsedGb / snapshot.storageQuotaGb) * 100))
      : 0;
  const heapPct =
    snapshot?.heapUsedMb && snapshot.heapLimitMb
      ? Math.min(100, Math.round((snapshot.heapUsedMb / snapshot.heapLimitMb) * 100))
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Computer"
        description="Machine telemetry and permission-gated control surface."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Main thread load"
          value={`${snapshot?.mainThreadLoad ?? 0}%`}
          icon={Gauge}
          delta={snapshot ? `${snapshot.cores ?? "?"} logical cores` : "Sampling…"}
        >
          <Progress value={snapshot?.mainThreadLoad ?? 0} className="h-1.5" />
        </StatCard>
        <StatCard
          label="Memory"
          value={snapshot?.heapUsedMb ? `${snapshot.heapUsedMb} MB` : "—"}
          icon={MemoryStick}
          delta={snapshot?.memoryGb ? `${snapshot.memoryGb} GB device RAM` : "Heap only"}
          delay={0.05}
        >
          <Progress value={heapPct} className="h-1.5" />
        </StatCard>
        <StatCard
          label="Storage"
          value={snapshot?.storageUsedGb != null ? `${snapshot.storageUsedGb} GB` : "—"}
          icon={HardDrive}
          delta={snapshot?.storageQuotaGb ? `of ${snapshot.storageQuotaGb} GB quota` : ""}
          delay={0.1}
        >
          <Progress value={storagePct} className="h-1.5" />
        </StatCard>
        <StatCard
          label="Network"
          value={snapshot?.network.online ? "Online" : "Offline"}
          icon={Wifi}
          trend={snapshot?.network.online ? "up" : "down"}
          delta={
            snapshot?.network.downlinkMbps
              ? `${snapshot.network.downlinkMbps} Mbps · ${snapshot.network.effectiveType ?? ""}`
              : "Link metrics unavailable"
          }
          delay={0.15}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <GlassPanel className="p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Cpu className="size-4" />
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-base font-semibold">Machine</h3>
              <p className="truncate text-xs text-muted-foreground">
                Reported by the runtime, refreshed every 15s
              </p>
            </div>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={refresh}>
              <RefreshCcw className="mr-1.5 size-3.5" />
              Refresh
            </Button>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            {[
              ["Platform", snapshot?.platform ?? "—"],
              ["Runtime", snapshot?.browser ?? "—"],
              ["Language", snapshot?.language ?? "—"],
              [
                "Display",
                snapshot
                  ? `${snapshot.screen.width}×${snapshot.screen.height} @${snapshot.screen.pixelRatio}x`
                  : "—",
              ],
              [
                "Battery",
                snapshot?.battery
                  ? `${snapshot.battery.level}% ${snapshot.battery.charging ? "charging" : ""}`
                  : "Not reported",
              ],
              ["Session uptime", snapshot ? `${snapshot.uptimeSeconds}s` : "—"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-surface/40 p-3">
                <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-1 truncate font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </GlassPanel>

        <GlassPanel className="p-5" delay={0.05}>
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Link2 className="size-4" />
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-base font-semibold">Desktop bridge</h3>
              <p className="truncate text-xs text-muted-foreground">
                Local agent required for applications, files, windows and hardware controls
              </p>
            </div>
            <Badge
              variant={bridge?.connected ? "default" : "secondary"}
              className="ml-auto shrink-0"
            >
              {bridge?.connected ? "Connected" : "Offline"}
            </Badge>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex gap-2">
              <Input
                value={bridgeUrl}
                onChange={(e) => setUrl(e.target.value)}
                className="h-9 font-mono text-xs"
                aria-label="Bridge address"
              />
              <Button variant="outline" size="sm" onClick={() => setBridgeUrl(bridgeUrl)}>
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {bridge?.connected
                ? `v${bridge.version ?? "?"} on ${bridge.platform ?? "unknown"} · ${bridge.capabilities.length} capabilities`
                : (bridge?.message ??
                  "Nexora never runs OS commands from the browser. Operating-system tools are proxied through a local agent you control.")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={loadBridgeLists}>
                <Layers className="mr-1.5 size-3.5" />
                Load processes & windows
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void executeTool(
                    "desktop.screenshot",
                    { copyToClipboard: true },
                    { source: "dashboard" },
                  )
                }
              >
                <Camera className="mr-1.5 size-3.5" />
                Screenshot
              </Button>
            </div>
          </div>
        </GlassPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassPanel className="p-5" delay={0.1}>
          <h3 className="flex items-center gap-2 font-display text-base font-semibold">
            <Activity className="size-4 text-primary" />
            Processes
          </h3>
          {processes.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Connect the desktop bridge and load processes to see live CPU and memory usage.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border/60 text-sm">
              {processes.slice(0, 12).map((p, i) => (
                <li key={`${p.pid}-${i}`} className="flex items-center gap-3 py-2">
                  <span className="truncate">{p.name ?? "process"}</span>
                  <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
                    {p.cpu != null ? `${p.cpu}% cpu` : ""} {p.memory != null ? `${p.memory} MB` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>

        <GlassPanel className="p-5" delay={0.15}>
          <h3 className="flex items-center gap-2 font-display text-base font-semibold">
            <Monitor className="size-4 text-primary" />
            Windows
          </h3>
          {windows.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Window focus, minimise and maximise become available when the bridge is connected.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {windows.slice(0, 10).map((w, i) => (
                <li
                  key={`${w.id}-${i}`}
                  className="flex items-center gap-2 rounded-xl border border-border bg-surface/40 px-3 py-2 text-sm"
                >
                  <span className="truncate">{w.title ?? w.app ?? "window"}</span>
                  <div className="ml-auto flex shrink-0 gap-1">
                    {(["focus", "minimize", "maximize"] as const).map((action) => (
                      <Button
                        key={action}
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px] capitalize"
                        onClick={() =>
                          void executeTool(
                            `windows.${action}`,
                            { id: String(w.id ?? "") },
                            { source: "dashboard" },
                          )
                        }
                      >
                        {action}
                      </Button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
      </div>

      {screenshots.length > 0 && (
        <GlassPanel className="p-5" delay={0.2}>
          <h3 className="flex items-center gap-2 font-display text-base font-semibold">
            <Camera className="size-4 text-primary" />
            Screenshot history
          </h3>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {screenshots.map((shot) => (
              <motion.figure
                key={shot.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="overflow-hidden rounded-xl border border-border"
              >
                <img
                  src={shot.dataUrl}
                  alt={`Screen capture ${shot.filename}`}
                  className="aspect-video w-full object-cover"
                  loading="lazy"
                />
                <figcaption className="flex items-center gap-2 px-2 py-1.5 text-[10px] text-muted-foreground">
                  <span className="truncate">
                    {shot.width}×{shot.height}
                  </span>
                  <button
                    className="ml-auto shrink-0 hover:text-destructive"
                    onClick={() => removeScreenshot(shot.id)}
                  >
                    Remove
                  </button>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </GlassPanel>
      )}
    </div>
  );
}

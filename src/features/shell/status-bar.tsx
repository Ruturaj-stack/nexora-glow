import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Database, GitBranch, Wifi } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { orbStateLabel } from "@/features/orb/ai-orb";
import { listMemories } from "@/lib/memories.functions";
import { listDevices } from "@/lib/devices.functions";
import { releaseLabel } from "@/config/version";
import { cn } from "@/lib/utils";

/** Shared, low-frequency workspace counts so the status bar never fabricates data. */
function useCounts() {
  const memories = useQuery({
    queryKey: ["memories"],
    queryFn: async () => (await listMemories()).data,
    staleTime: 120_000,
    retry: 1,
  });
  const devices = useQuery({
    queryKey: ["devices"],
    queryFn: async () => (await listDevices()).data,
    staleTime: 120_000,
    retry: 1,
  });
  return {
    memoryCount: memories.data?.length ?? null,
    deviceCount: devices.data?.length ?? null,
    ready: Boolean(memories.data || devices.data),
  };
}

export function StatusBar() {
  const orbState = useAppStore((s) => s.orbState);
  const online = orbState !== "offline";
  const { memoryCount, deviceCount, ready } = useCounts();

  return (
    <footer className="flex h-9 shrink-0 items-center gap-4 border-t border-border bg-background/70 px-4 text-[11px] text-muted-foreground backdrop-blur-xl">
      <div className="flex items-center gap-1.5">
        <motion.span
          className={cn("size-1.5 rounded-full", online ? "bg-success" : "bg-muted-foreground")}
          animate={online ? { opacity: [1, 0.35, 1] } : { opacity: 0.5 }}
          transition={{ duration: 2.4, repeat: Infinity }}
        />
        <span className="font-medium text-foreground/80">{orbStateLabel(orbState)}</span>
      </div>

      {memoryCount !== null && (
        <span className="hidden items-center gap-1.5 sm:flex">
          <Database className="size-3" /> {memoryCount.toLocaleString()} memories
        </span>
      )}
      {deviceCount !== null && (
        <span className="hidden items-center gap-1.5 md:flex">
          <Wifi className="size-3" /> {deviceCount} devices
        </span>
      )}
      {!ready && (
        <span className="hidden items-center gap-1.5 sm:italic sm:flex">workspace syncing…</span>
      )}

      <span className="ml-auto flex items-center gap-1.5 font-mono">
        <GitBranch className="size-3" /> {releaseLabel()}
      </span>
    </footer>
  );
}

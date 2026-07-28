import { motion } from "framer-motion";
import { Cpu, Wifi, Database, GitBranch } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { orbStateLabel } from "@/features/orb/ai-orb";
import { cn } from "@/lib/utils";

export function StatusBar() {
  const orbState = useAppStore((s) => s.orbState);
  const online = orbState !== "offline";

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

      <span className="hidden items-center gap-1.5 sm:flex">
        <Cpu className="size-3" /> CPU 18%
      </span>
      <span className="hidden items-center gap-1.5 sm:flex">
        <Database className="size-3" /> 12.4k memories
      </span>
      <span className="hidden items-center gap-1.5 md:flex">
        <Wifi className="size-3" /> Local mesh · 6 devices
      </span>

      <span className="ml-auto flex items-center gap-1.5 font-mono">
        <GitBranch className="size-3" /> v0.1.0 · phase 1
      </span>
    </footer>
  );
}

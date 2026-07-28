import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "flat";
  icon: LucideIcon;
  children?: ReactNode;
  delay?: number;
}

export function StatCard({
  label,
  value,
  delta,
  trend = "flat",
  icon: Icon,
  children,
  delay = 0,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      className="glass hover-lift group relative overflow-hidden rounded-2xl p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{value}</p>
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/16">
          <Icon className="size-5" />
        </span>
      </div>

      {delta && (
        <p
          className={cn(
            "mt-3 text-xs font-medium",
            trend === "up" && "text-success",
            trend === "down" && "text-destructive",
            trend === "flat" && "text-muted-foreground",
          )}
        >
          {delta}
        </p>
      )}

      {children && <div className="mt-4">{children}</div>}
    </motion.div>
  );
}

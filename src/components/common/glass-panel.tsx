import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  delay?: number;
}

export function GlassPanel({ children, className, interactive, delay = 0 }: GlassPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "glass rounded-2xl",
        interactive && "hover-lift cursor-pointer",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

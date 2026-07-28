import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { OrbState } from "@/store/app-store";

const stateConfig: Record<
  OrbState,
  { label: string; hue: string; scale: number[]; duration: number; opacity: number }
> = {
  idle: { label: "Idle", hue: "var(--primary)", scale: [1, 1.04, 1], duration: 5, opacity: 1 },
  listening: {
    label: "Listening",
    hue: "oklch(0.75 0.15 160)",
    scale: [1, 1.09, 1],
    duration: 1.6,
    opacity: 1,
  },
  thinking: {
    label: "Thinking",
    hue: "oklch(0.7 0.14 265)",
    scale: [1, 1.02, 0.98, 1],
    duration: 2.2,
    opacity: 1,
  },
  speaking: {
    label: "Speaking",
    hue: "oklch(0.81 0.14 78)",
    scale: [1, 1.12, 0.97, 1.07, 1],
    duration: 1.1,
    opacity: 1,
  },
  offline: {
    label: "Offline",
    hue: "oklch(0.55 0.02 255)",
    scale: [1, 1, 1],
    duration: 6,
    opacity: 0.5,
  },
};

export const orbStateLabel = (s: OrbState) => stateConfig[s].label;

interface AIOrbProps {
  state: OrbState;
  size?: number;
  className?: string;
}

export function AIOrb({ state, size = 176, className }: AIOrbProps) {
  const cfg = stateConfig[state];
  const bars = [0.4, 0.75, 1, 0.65, 0.45];

  return (
    <div
      className={cn("relative grid place-items-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`AI orb — ${cfg.label}`}
    >
      {/* ambient halo */}
      <motion.div
        className="absolute inset-0 rounded-full blur-2xl"
        style={{ background: `radial-gradient(circle, ${cfg.hue} 0%, transparent 68%)` }}
        animate={{ opacity: state === "offline" ? 0.15 : [0.28, 0.5, 0.28] }}
        transition={{ duration: cfg.duration, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* pulse rings */}
      <AnimatePresence>
        {(state === "listening" || state === "speaking") && (
          <>
            {[0, 0.6].map((d) => (
              <motion.span
                key={d}
                className="absolute rounded-full border"
                style={{ borderColor: cfg.hue, width: size * 0.72, height: size * 0.72 }}
                initial={{ scale: 0.85, opacity: 0.55 }}
                animate={{ scale: 1.45, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2.2, repeat: Infinity, delay: d, ease: "easeOut" }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* rotating gradient shell */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size * 0.78,
          height: size * 0.78,
          background: `conic-gradient(from 0deg, transparent 0%, ${cfg.hue} 35%, transparent 70%, ${cfg.hue} 100%)`,
          opacity: state === "offline" ? 0.18 : 0.55,
          filter: "blur(6px)",
        }}
        animate={{ rotate: 360 }}
        transition={{
          duration: state === "thinking" ? 3.4 : 16,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* core */}
      <motion.div
        className="relative grid place-items-center overflow-hidden rounded-full border border-glass-border"
        style={{
          width: size * 0.62,
          height: size * 0.62,
          background: `radial-gradient(circle at 32% 28%, oklch(1 0 0 / 22%), transparent 45%), radial-gradient(circle at 60% 70%, ${cfg.hue} 0%, oklch(0.2 0.03 250) 78%)`,
          opacity: cfg.opacity,
          boxShadow: `0 0 44px -8px ${cfg.hue}`,
        }}
        animate={{ scale: cfg.scale }}
        transition={{ duration: cfg.duration, repeat: Infinity, ease: "easeInOut" }}
      >
        {state === "speaking" && (
          <div className="flex items-end gap-[3px]">
            {bars.map((b, i) => (
              <motion.span
                key={i}
                className="w-[3px] rounded-full bg-background/80"
                animate={{ height: [6, 6 + b * 22, 8] }}
                transition={{
                  duration: 0.7,
                  repeat: Infinity,
                  delay: i * 0.08,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        )}

        {state === "thinking" && (
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="size-1.5 rounded-full bg-background/85"
                animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.16 }}
              />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

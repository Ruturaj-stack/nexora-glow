import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface VisualizerProps {
  bands: number[];
  level: number;
  active: boolean;
  className?: string;
}

const IDLE_BANDS = Array.from({ length: 16 }, () => 0.05);

/** Live microphone waveform — falls back to a calm resting line when idle. */
export function AudioVisualizer({ bands, level, active, className }: VisualizerProps) {
  const values = bands.length ? bands : IDLE_BANDS;

  return (
    <div
      className={cn("flex h-12 items-center justify-center gap-[3px]", className)}
      role="img"
      aria-label={active ? `Microphone level ${Math.round(level * 100)} percent` : "Microphone idle"}
    >
      {values.map((value, index) => (
        <motion.span
          key={index}
          className={cn(
            "w-[3px] rounded-full",
            active ? "bg-primary" : "bg-muted-foreground/40",
          )}
          animate={{ height: Math.max(4, value * 44) }}
          transition={{ type: "spring", stiffness: 320, damping: 24 }}
        />
      ))}
    </div>
  );
}

/** Compact horizontal voice level meter. */
export function VoiceLevelMeter({ level, active }: { level: number; active: boolean }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface/70">
      <motion.div
        className={cn("h-full rounded-full", active ? "bg-primary" : "bg-muted-foreground/40")}
        animate={{ width: `${Math.round(Math.min(1, level) * 100)}%` }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
      />
    </div>
  );
}

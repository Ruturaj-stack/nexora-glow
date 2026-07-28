import { useAppStore, type OrbState } from "@/store/app-store";
import { cn } from "@/lib/utils";

const states: { key: OrbState; label: string }[] = [
  { key: "idle", label: "Idle" },
  { key: "listening", label: "Listening" },
  { key: "thinking", label: "Thinking" },
  { key: "speaking", label: "Speaking" },
  { key: "offline", label: "Offline" },
];

export function OrbStatePicker({ className }: { className?: string }) {
  const { orbState, setOrbState } = useAppStore();

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-xl border border-border bg-surface/50 p-1",
        className,
      )}
      role="group"
      aria-label="AI orb state"
    >
      {states.map((s) => (
        <button
          key={s.key}
          onClick={() => setOrbState(s.key)}
          className={cn(
            "rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all duration-200",
            orbState === s.key
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

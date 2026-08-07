import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { snapshot, type MetricsSnapshot } from "@/lib/observability/metrics";
import { releaseLabel } from "@/config/version";

/** Live counters and duration percentiles from the in-process metrics registry. */
export function MetricsPanel() {
  const [data, setData] = useState<MetricsSnapshot>(() => snapshot());

  useEffect(() => {
    const timer = setInterval(() => setData(snapshot()), 3000);
    return () => clearInterval(timer);
  }, []);

  const counters = Object.entries(data.counters).sort(([a], [b]) => a.localeCompare(b));
  const durations = Object.entries(data.durations).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Activity className="size-3.5 text-primary" />
        {releaseLabel()} · uptime {Math.round(data.uptimeMs / 1000)}s
      </p>

      {counters.length === 0 && durations.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface/30 px-3 py-6 text-center text-xs text-muted-foreground">
          No metrics recorded yet in this session.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Counters
            </p>
            <div className="space-y-1">
              {counters.map(([name, value]) => (
                <div
                  key={name}
                  className="flex items-baseline justify-between gap-3 rounded-lg border border-border bg-surface/30 px-3 py-1.5 font-mono text-[11px]"
                >
                  <span className="truncate text-muted-foreground">{name}</span>
                  <span className="tabular-nums">{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Durations (ms)
            </p>
            <div className="space-y-1">
              {durations.map(([name, histogram]) => (
                <div
                  key={name}
                  className="rounded-lg border border-border bg-surface/30 px-3 py-1.5 font-mono text-[11px]"
                >
                  <p className="truncate text-muted-foreground">{name}</p>
                  <p className="tabular-nums">
                    n={histogram.count} · avg={histogram.avg} · p95={histogram.p95} · max=
                    {histogram.max}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

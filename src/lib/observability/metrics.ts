/**
 * In-process metrics registry.
 *
 * Counters and duration histograms for requests, tool executions, workflow
 * runs, plugin calls and device probes. Exposed as JSON via /api/public/metrics
 * and rendered on the Developer page — no external agent required.
 */

export interface HistogramSnapshot {
  count: number;
  min: number;
  max: number;
  avg: number;
  p95: number;
}

export interface MetricsSnapshot {
  startedAt: string;
  uptimeMs: number;
  counters: Record<string, number>;
  durations: Record<string, HistogramSnapshot>;
}

const startedAt = Date.now();
const counters = new Map<string, number>();
const samples = new Map<string, number[]>();

const MAX_SAMPLES = 500;

function key(name: string, labels?: Record<string, string>): string {
  if (!labels) return name;
  const suffix = Object.keys(labels)
    .sort()
    .map((label) => `${label}=${labels[label]}`)
    .join(",");
  return suffix ? `${name}{${suffix}}` : name;
}

export function increment(name: string, labels?: Record<string, string>, by = 1) {
  const id = key(name, labels);
  counters.set(id, (counters.get(id) ?? 0) + by);
}

export function observe(name: string, durationMs: number, labels?: Record<string, string>) {
  const id = key(name, labels);
  const list = samples.get(id) ?? [];
  list.push(Math.max(0, Math.round(durationMs)));
  if (list.length > MAX_SAMPLES) list.shift();
  samples.set(id, list);
}

/** Times an async operation and records both a counter and a duration. */
export async function timed<T>(
  name: string,
  run: () => Promise<T>,
  labels?: Record<string, string>,
): Promise<T> {
  const started = Date.now();
  try {
    const result = await run();
    increment(`${name}.success`, labels);
    return result;
  } catch (error) {
    increment(`${name}.error`, labels);
    throw error;
  } finally {
    observe(name, Date.now() - started, labels);
  }
}

function summarise(values: number[]): HistogramSnapshot {
  const sorted = [...values].sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return {
    count: sorted.length,
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    avg: sorted.length ? Math.round(total / sorted.length) : 0,
    p95: sorted[index] ?? 0,
  };
}

export function snapshot(): MetricsSnapshot {
  return {
    startedAt: new Date(startedAt).toISOString(),
    uptimeMs: Date.now() - startedAt,
    counters: Object.fromEntries(counters),
    durations: Object.fromEntries(
      [...samples.entries()].map(([id, values]) => [id, summarise(values)]),
    ),
  };
}

export function resetMetrics() {
  counters.clear();
  samples.clear();
}

import { describe, it, expect, beforeEach } from "vitest";
import { increment, observe, resetMetrics, snapshot, timed } from "@/lib/observability/metrics";

describe("metrics", () => {
  beforeEach(() => resetMetrics());

  it("aggregates counters with labels", () => {
    increment("tool.run", { tool: "clipboard" });
    increment("tool.run", { tool: "clipboard" });
    increment("tool.run", { tool: "volume" });
    const { counters } = snapshot();
    expect(counters["tool.run{tool=clipboard}"]).toBe(2);
    expect(counters["tool.run{tool=volume}"]).toBe(1);
  });

  it("summarises duration samples", () => {
    [10, 20, 30, 40, 50].forEach((ms) => observe("device.probe", ms));
    const histogram = snapshot().durations["device.probe"];
    expect(histogram.count).toBe(5);
    expect(histogram.min).toBe(10);
    expect(histogram.max).toBe(50);
    expect(histogram.avg).toBe(30);
    expect(histogram.p95).toBe(50);
  });

  it("records success and error outcomes around timed work", async () => {
    await timed("workflow.run", async () => "done");
    await expect(
      timed("workflow.run", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const { counters, durations } = snapshot();
    expect(counters["workflow.run.success"]).toBe(1);
    expect(counters["workflow.run.error"]).toBe(1);
    expect(durations["workflow.run"].count).toBe(2);
  });
});

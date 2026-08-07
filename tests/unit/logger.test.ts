import { describe, it, expect, beforeEach } from "vitest";
import {
  createLogger,
  exportLogs,
  getLogs,
  logger,
  searchLogs,
  setLogLevel,
  subscribeToLogs,
  __resetLogger,
} from "@/lib/observability/logger";

describe("logger", () => {
  beforeEach(() => __resetLogger());

  it("records structured entries with scope and level", () => {
    logger.info("boot complete", { ms: 12 });
    const [record] = getLogs();
    expect(record.scope).toBe("nexora");
    expect(record.level).toBe("info");
    expect(record.message).toBe("boot complete");
    expect(record.data).toEqual({ ms: 12 });
  });

  it("namespaces child loggers", () => {
    createLogger("tools").child("queue").warn("saturated");
    expect(getLogs()[0].scope).toBe("tools:queue");
  });

  it("honours the minimum level", () => {
    setLogLevel("warn");
    logger.debug("noise");
    logger.info("noise");
    logger.error("real");
    expect(getLogs()).toHaveLength(1);
    expect(getLogs()[0].message).toBe("real");
  });

  it("filters by level and free text", () => {
    logger.info("device paired");
    logger.error("device offline");
    expect(searchLogs({ level: "error" })).toHaveLength(1);
    expect(searchLogs({ text: "PAIRED" })).toHaveLength(1);
    expect(searchLogs({ scope: "nexora" })).toHaveLength(2);
  });

  it("exports newline-delimited JSON", () => {
    logger.audit("export requested");
    const lines = exportLogs().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).level).toBe("audit");
  });

  it("notifies subscribers", () => {
    let count = 0;
    const unsubscribe = subscribeToLogs(() => (count += 1));
    logger.info("one");
    unsubscribe();
    logger.info("two");
    expect(count).toBe(2); // initial snapshot + one update
  });
});

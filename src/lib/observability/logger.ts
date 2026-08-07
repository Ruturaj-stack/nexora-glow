/**
 * Centralised structured logger.
 *
 * One sink for the whole app: info / warn / error / debug / audit.
 * Records are kept in a bounded ring buffer so the Developer page can search
 * and export them without any storage backend, and mirrored to the console
 * (dev) or to `console.error` only (production) to keep noise down.
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "audit";

export interface LogRecord {
  id: string;
  time: string;
  level: LogLevel;
  scope: string;
  message: string;
  data?: Record<string, unknown>;
}

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  audit: 25,
  warn: 30,
  error: 40,
};

const MAX_RECORDS = 500;

let buffer: LogRecord[] = [];
let minLevel: LogLevel = "debug";
let counter = 0;

type Listener = (records: readonly LogRecord[]) => void;
const listeners = new Set<Listener>();

function notify() {
  const snapshot = buffer;
  for (const listener of listeners) listener(snapshot);
}

function mirror(record: LogRecord) {
  if (typeof console === "undefined") return;
  const line = `[${record.scope}] ${record.message}`;
  if (record.level === "error") console.error(line, record.data ?? "");
  else if (record.level === "warn") console.warn(line, record.data ?? "");
  else if (import.meta.env?.DEV) console.info(line, record.data ?? "");
}

function write(level: LogLevel, scope: string, message: string, data?: Record<string, unknown>) {
  if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) return;
  counter += 1;
  const record: LogRecord = {
    id: `log_${Date.now().toString(36)}_${counter}`,
    time: new Date().toISOString(),
    level,
    scope,
    message,
    ...(data ? { data } : {}),
  };
  buffer = [...buffer.slice(-(MAX_RECORDS - 1)), record];
  mirror(record);
  notify();
}

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  /** Security-relevant events: permission grants, device pairing, exports. */
  audit(message: string, data?: Record<string, unknown>): void;
  child(childScope: string): Logger;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (m, d) => write("debug", scope, m, d),
    info: (m, d) => write("info", scope, m, d),
    warn: (m, d) => write("warn", scope, m, d),
    error: (m, d) => write("error", scope, m, d),
    audit: (m, d) => write("audit", scope, m, d),
    child: (childScope) => createLogger(`${scope}:${childScope}`),
  };
}

export const logger = createLogger("nexora");

export function setLogLevel(level: LogLevel) {
  minLevel = level;
}

export function getLogLevel(): LogLevel {
  return minLevel;
}

export function getLogs(): readonly LogRecord[] {
  return buffer;
}

export function clearLogs() {
  buffer = [];
  notify();
}

export function subscribeToLogs(listener: Listener): () => void {
  listeners.add(listener);
  listener(buffer);
  return () => listeners.delete(listener);
}

export interface LogQuery {
  level?: LogLevel | "all";
  scope?: string;
  text?: string;
}

export function searchLogs(query: LogQuery, records: readonly LogRecord[] = buffer): LogRecord[] {
  const text = query.text?.trim().toLowerCase();
  return records.filter((record) => {
    if (query.level && query.level !== "all" && record.level !== query.level) return false;
    if (query.scope && !record.scope.startsWith(query.scope)) return false;
    if (text) {
      const haystack = `${record.scope} ${record.message} ${JSON.stringify(record.data ?? {})}`;
      if (!haystack.toLowerCase().includes(text)) return false;
    }
    return true;
  });
}

/** Newline-delimited JSON — the format log shippers expect. */
export function exportLogs(records: readonly LogRecord[] = buffer): string {
  return records.map((record) => JSON.stringify(record)).join("\n");
}

/** Test seam: reset all module state. */
export function __resetLogger() {
  buffer = [];
  counter = 0;
  minLevel = "debug";
  listeners.clear();
}

import { getTool } from "@/features/tools/registry";
import { executeTool } from "@/features/tools/tool-manager";
import type { Json } from "./types";

/**
 * ActionEngine — the only bridge between a workflow step and real work.
 *
 * Every action is dispatched through the Tool Execution Engine, so workflows
 * inherit its permission prompts, serial queue, timeouts and audit log.
 */

const TEMPLATE = /\{\{\s*([\w.]+)\s*\}\}/g;

function lookup(path: string, variables: Record<string, Json>): Json | undefined {
  return path.split(".").reduce<Json | undefined>((acc, key) => {
    if (acc && typeof acc === "object" && !Array.isArray(acc)) return (acc as Record<string, Json>)[key];
    return undefined;
  }, variables as Json);
}

/** Replaces {{variable}} placeholders anywhere inside a parameter tree. */
export function interpolate(value: unknown, variables: Record<string, Json>): Json {
  if (typeof value === "string") {
    const whole = /^\{\{\s*([\w.]+)\s*\}\}$/.exec(value.trim());
    if (whole) {
      const resolved = lookup(whole[1], variables);
      return resolved === undefined ? "" : resolved;
    }
    return value.replace(TEMPLATE, (_match, path: string) => {
      const resolved = lookup(path, variables);
      if (resolved === undefined || resolved === null) return "";
      return typeof resolved === "object" ? JSON.stringify(resolved) : String(resolved);
    });
  }
  if (Array.isArray(value)) return value.map((item) => interpolate(item, variables));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        interpolate(item, variables),
      ]),
    );
  }
  return (value ?? null) as Json;
}

export interface ToolCallOutcome {
  ok: boolean;
  output: Json;
  error?: string;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function runToolCall(
  tool: string,
  params: unknown,
  variables: Record<string, Json>,
  options: { source?: string; timeoutMs?: number } = {},
): Promise<ToolCallOutcome> {
  if (!getTool(tool)) {
    return { ok: false, output: null, error: `Unknown tool "${tool}"` };
  }

  const resolved = interpolate(params ?? {}, variables);
  const payload = (resolved && typeof resolved === "object" && !Array.isArray(resolved)
    ? resolved
    : {}) as Record<string, unknown>;

  try {
    const outcome = await withTimeout(
      executeTool(tool, payload, { source: options.source ?? "workflow", silent: true }),
      options.timeoutMs ?? 30_000,
      tool,
    );
    return {
      ok: outcome.ok,
      output: (outcome.execution.result ?? null) as Json,
      error: outcome.execution.error,
    };
  } catch (error) {
    return {
      ok: false,
      output: null,
      error: error instanceof Error ? error.message : "Action failed",
    };
  }
}

export async function runWithRetries(
  tool: string,
  params: unknown,
  variables: Record<string, Json>,
  options: { source?: string; timeoutMs?: number; retries?: number; onAttempt?: (attempt: number) => void },
): Promise<ToolCallOutcome & { attempts: number }> {
  const max = (options.retries ?? 0) + 1;
  let last: ToolCallOutcome = { ok: false, output: null, error: "Not executed" };

  for (let attempt = 1; attempt <= max; attempt += 1) {
    options.onAttempt?.(attempt);
    last = await runToolCall(tool, params, variables, options);
    if (last.ok) return { ...last, attempts: attempt };
    if (attempt < max) await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
  }

  return { ...last, attempts: max };
}

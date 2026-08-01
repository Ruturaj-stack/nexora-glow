import { toast } from "sonner";
import { getTool } from "./registry";
import { ensurePermission } from "./permission-manager";
import { executionQueue } from "./execution-queue";
import { ToolError, type ToolExecution } from "./types";
import { useToolStore } from "@/store/tool-store";
import { logToolExecution } from "@/lib/tools.functions";

/**
 * The only entry point for running a tool.
 *
 * Pipeline: registry lookup → schema validation → permission gate → serial
 * queue → execution → audit log. Neither the AI nor the UI can bypass a step.
 */

export interface ExecuteOptions {
  /** Where the request came from: "chat", "manual", "palette", … */
  source?: string;
  /** Suppresses the toast on completion. */
  silent?: boolean;
}

export interface ExecuteOutcome {
  ok: boolean;
  execution: ToolExecution;
}

function toolError(error: unknown): { message: string; code: ToolExecution["errorCode"] } {
  if (error instanceof ToolError) return { message: error.message, code: error.code };
  return {
    message: error instanceof Error ? error.message : "Execution failed",
    code: "EXECUTION_FAILED",
  };
}

export async function executeTool(
  name: string,
  params: Record<string, unknown> = {},
  options: ExecuteOptions = {},
): Promise<ExecuteOutcome> {
  const store = useToolStore.getState();
  const source = options.source ?? "manual";
  const id = `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const tool = getTool(name);

  const base: ToolExecution = {
    id,
    tool: name,
    category: tool?.category ?? "system",
    params,
    status: "queued",
    durationMs: 0,
    permission: "none",
    runtime: tool?.runtime ?? "browser",
    source,
    createdAt: new Date().toISOString(),
    logs: [],
  };

  const fail = async (message: string, code: ToolExecution["errorCode"], permission = "none") => {
    const execution: ToolExecution = {
      ...base,
      status: code === "CANCELLED" ? "cancelled" : "error",
      error: message,
      errorCode: code,
      permission,
    };
    store.patchExecution(id, execution);
    if (!options.silent) toast.error(tool?.title ?? name, { description: message });
    await audit(execution);
    return { ok: false, execution };
  };

  store.pushExecution(base);

  if (!tool) return fail(`Unknown tool "${name}".`, "NOT_FOUND");

  const parsed = tool.schema.safeParse(params);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => i.message).join("; "), "INVALID_INPUT");
  }

  let permission: string;
  try {
    store.appendLog(id, "Awaiting permission…");
    permission = await ensurePermission(tool, params, source);
  } catch (error) {
    const { message, code } = toolError(error);
    return fail(message, code);
  }

  store.patchExecution(id, { status: "running", permission });
  store.appendLog(id, `Authorised (${permission})`);
  const started = performance.now();

  try {
    const result = await executionQueue.enqueue(
      id,
      (signal) =>
        tool.execute(parsed.data, {
          signal,
          log: (line) => store.appendLog(id, line),
        }),
      tool.timeoutMs ?? 20000,
    );

    const execution: ToolExecution = {
      ...base,
      status: "success",
      result,
      permission,
      durationMs: Math.round(performance.now() - started),
    };
    store.patchExecution(id, execution);
    if (!options.silent) toast.success(`${tool.title} completed`);
    await audit(execution);
    return { ok: true, execution };
  } catch (error) {
    const { message, code } = toolError(error);
    const execution: ToolExecution = {
      ...base,
      status: code === "CANCELLED" ? "cancelled" : "error",
      error: message,
      errorCode: code,
      permission,
      durationMs: Math.round(performance.now() - started),
    };
    store.patchExecution(id, execution);
    if (!options.silent) toast.error(tool.title, { description: message });
    await audit(execution);
    return { ok: false, execution };
  }
}

export function cancelExecution(id: string) {
  executionQueue.cancel(id);
}

/** Persists the run to the audit log. Never throws into the caller. */
async function audit(execution: ToolExecution) {
  try {
    await logToolExecution({
      data: {
        tool: execution.tool,
        category: execution.category,
        params: execution.params,
        status: execution.status === "cancelled" ? "cancelled" : execution.status === "success" ? "success" : "error",
        result: execution.result ?? null,
        error: execution.error?.slice(0, 600),
        errorCode: execution.errorCode,
        durationMs: execution.durationMs,
        permission: execution.permission,
        runtime: execution.runtime,
        source: execution.source,
      },
    });
  } catch {
    // Audit failures must never break the user's action.
  }
}

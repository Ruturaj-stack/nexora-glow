import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ok, type ApiResponse } from "@/lib/api-response";

/**
 * REST-equivalent server functions for the tool engine:
 *   GET/PUT /api/v1/tools/permissions
 *   GET     /api/v1/tools/executions
 *   POST    /api/v1/tools/executions   (audit record)
 */

export type PermissionDecisionInput = "ask" | "always" | "denied";

export interface ToolPermissionRecord {
  scope: string;
  decision: PermissionDecisionInput;
  updatedAt: string;
}

export interface ToolExecutionRecord {
  id: string;
  tool: string;
  category: string;
  params: Record<string, unknown>;
  status: string;
  result: unknown;
  error: string | null;
  errorCode: string | null;
  durationMs: number;
  permission: string;
  runtime: string;
  source: string;
  createdAt: string;
}

const EXEC_SELECT =
  "id, tool, category, params, status, result, error, error_code, duration_ms, permission, runtime, source, created_at";

interface ExecRow {
  id: string;
  tool: string;
  category: string;
  params: unknown;
  status: string;
  result: unknown;
  error: string | null;
  error_code: string | null;
  duration_ms: number;
  permission: string;
  runtime: string;
  source: string;
  created_at: string;
}

function toExecution(row: ExecRow): ToolExecutionRecord {
  return {
    id: row.id,
    tool: row.tool,
    category: row.category,
    params: (row.params ?? {}) as Record<string, unknown>,
    status: row.status,
    result: row.result,
    error: row.error,
    errorCode: row.error_code,
    durationMs: row.duration_ms,
    permission: row.permission,
    runtime: row.runtime,
    source: row.source,
    createdAt: row.created_at,
  };
}

export const listToolPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiResponse<ToolPermissionRecord[]>> => {
    const { data, error } = await context.supabase
      .from("tool_permissions")
      .select("scope, decision, updated_at");
    if (error) throw new Error(error.message);
    return ok(
      (data ?? []).map((row) => ({
        scope: row.scope,
        decision: row.decision as PermissionDecisionInput,
        updatedAt: row.updated_at,
      })),
    );
  });

export const setToolPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        scope: z.string().min(1).max(40),
        decision: z.enum(["ask", "always", "denied"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ApiResponse<null>> => {
    const { error } = await context.supabase
      .from("tool_permissions")
      .upsert(
        { user_id: context.userId, scope: data.scope, decision: data.decision },
        { onConflict: "user_id,scope" },
      );
    if (error) throw new Error(error.message);
    return ok(null, "Permission updated");
  });

export const resetToolPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiResponse<null>> => {
    const { error } = await context.supabase
      .from("tool_permissions")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return ok(null, "All tool permissions reset");
  });

export const listToolExecutions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiResponse<ToolExecutionRecord[]>> => {
    const { data, error } = await context.supabase
      .from("tool_executions")
      .select(EXEC_SELECT)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return ok((data ?? []).map((row) => toExecution(row as ExecRow)));
  });

export const logToolExecution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tool: z.string().min(1).max(80),
        category: z.string().min(1).max(40),
        params: z.record(z.unknown()).default({}),
        status: z.enum(["success", "error", "cancelled"]),
        result: z.unknown().optional(),
        error: z.string().max(600).optional(),
        errorCode: z.string().max(40).optional(),
        durationMs: z.number().int().min(0).max(3_600_000).default(0),
        permission: z.string().max(200).default("none"),
        runtime: z.enum(["browser", "bridge"]).default("browser"),
        source: z.string().max(40).default("manual"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ApiResponse<ToolExecutionRecord | null>> => {
    const serialised = JSON.stringify(data.result ?? null);
    const { data: row, error } = await context.supabase
      .from("tool_executions")
      .insert({
        user_id: context.userId,
        tool: data.tool,
        category: data.category,
        params: data.params,
        status: data.status,
        result: serialised.length > 20000 ? { truncated: true } : (data.result ?? null),
        error: data.error ?? null,
        error_code: data.errorCode ?? null,
        duration_ms: data.durationMs,
        permission: data.permission,
        runtime: data.runtime,
        source: data.source,
      })
      .select(EXEC_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return ok(toExecution(row as ExecRow), "Execution recorded");
  });

export const clearToolExecutions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiResponse<null>> => {
    const { error } = await context.supabase
      .from("tool_executions")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return ok(null, "Audit log cleared");
  });

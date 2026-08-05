import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ok, type ApiResponse } from "@/lib/api-response";
import {
  TRIGGER_TYPES,
  triggerConfigSchema,
  workflowGraphSchema,
  type Workflow,
  type WorkflowExecution,
  type WorkflowGraph,
  type WorkflowStatus,
  type WorkflowTrigger,
  type TriggerConfig,
  type TriggerType,
} from "@/features/agent/types";

/**
 * REST-equivalent server functions for the agent engine:
 *   GET/POST/DELETE /api/v1/workflows
 *   POST            /api/v1/workflows/:id/triggers
 *   GET/POST        /api/v1/workflows/executions
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

interface WorkflowRow {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  graph: any;
  variables: any;
  template_id: string;
  runs: number;
  failures: number;
  last_status: string;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

interface TriggerRow {
  id: string;
  workflow_id: string;
  type: string;
  config: any;
  enabled: boolean;
  next_run_at: string | null;
  last_fired_at: string | null;
}

interface ExecutionRow {
  id: string;
  workflow_id: string | null;
  workflow_name: string;
  status: string;
  trigger: string;
  steps: any;
  logs: any;
  variables: any;
  error: string | null;
  duration_ms: number;
  started_at: string;
  finished_at: string | null;
}

const WORKFLOW_SELECT =
  "id, name, description, category, enabled, graph, variables, template_id, runs, failures, last_status, last_run_at, created_at, updated_at";
const TRIGGER_SELECT = "id, workflow_id, type, config, enabled, next_run_at, last_fired_at";
const EXECUTION_SELECT =
  "id, workflow_id, workflow_name, status, trigger, steps, logs, variables, error, duration_ms, started_at, finished_at";

function safeGraph(raw: unknown): WorkflowGraph {
  const parsed = workflowGraphSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : { nodes: [], edges: [], rollbackOnFailure: false, timeoutMs: 300_000 };
}

function toTrigger(row: TriggerRow): WorkflowTrigger {
  const config = triggerConfigSchema.safeParse(row.config ?? {});
  return {
    id: row.id,
    workflowId: row.workflow_id,
    type: row.type as TriggerType,
    config: (config.success ? config.data : triggerConfigSchema.parse({})) as TriggerConfig,
    enabled: row.enabled,
    nextRunAt: row.next_run_at,
    lastFiredAt: row.last_fired_at,
  };
}

function toWorkflow(row: WorkflowRow, triggers: TriggerRow[]): Workflow {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    enabled: row.enabled,
    graph: safeGraph(row.graph),
    variables: (row.variables ?? {}) as Record<string, unknown>,
    templateId: row.template_id,
    runs: row.runs,
    failures: row.failures,
    lastStatus: row.last_status as WorkflowStatus,
    lastRunAt: row.last_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    triggers: triggers.filter((t) => t.workflow_id === row.id).map(toTrigger),
  };
}

function toExecution(row: ExecutionRow): WorkflowExecution {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    workflowName: row.workflow_name,
    status: row.status as WorkflowExecution["status"],
    trigger: row.trigger,
    steps: Array.isArray(row.steps) ? (row.steps as WorkflowExecution["steps"]) : [],
    logs: Array.isArray(row.logs) ? (row.logs as string[]) : [],
    variables: (row.variables ?? {}) as Record<string, unknown>,
    error: row.error,
    durationMs: row.duration_ms,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

const triggerInputSchema = z.object({
  type: z.enum(TRIGGER_TYPES),
  config: triggerConfigSchema.partial().default({}),
  enabled: z.boolean().default(true),
});

const saveInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  description: z.string().max(400).default(""),
  category: z.string().max(40).default("general"),
  enabled: z.boolean().default(true),
  graph: workflowGraphSchema,
  variables: z.record(z.string(), z.any()).default({}),
  templateId: z.string().max(60).default(""),
  triggers: z.array(triggerInputSchema).max(10).default([]),
});

export const listWorkflows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiResponse<Workflow[]>> => {
    const [{ data: rows, error }, { data: triggers, error: triggerError }] = await Promise.all([
      context.supabase.from("workflows").select(WORKFLOW_SELECT).order("updated_at", { ascending: false }),
      context.supabase.from("workflow_triggers").select(TRIGGER_SELECT),
    ]);
    if (error) throw new Error(error.message);
    if (triggerError) throw new Error(triggerError.message);
    return ok(
      (rows ?? []).map((row) => toWorkflow(row as WorkflowRow, (triggers ?? []) as TriggerRow[])),
    );
  });

export const saveWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<ApiResponse<Workflow>> => {
    const payload = {
      user_id: context.userId,
      name: data.name,
      description: data.description,
      category: data.category,
      enabled: data.enabled,
      graph: data.graph as any,
      variables: data.variables as any,
      template_id: data.templateId,
    };

    const query = data.id
      ? context.supabase.from("workflows").update(payload).eq("id", data.id)
      : context.supabase.from("workflows").insert(payload);

    const { data: row, error } = await query.select(WORKFLOW_SELECT).single();
    if (error) throw new Error(error.message);
    const saved = row as WorkflowRow;

    await context.supabase.from("workflow_triggers").delete().eq("workflow_id", saved.id);
    if (data.triggers.length) {
      const { error: triggerError } = await context.supabase.from("workflow_triggers").insert(
        data.triggers.map((trigger) => ({
          user_id: context.userId,
          workflow_id: saved.id,
          type: trigger.type,
          config: triggerConfigSchema.parse(trigger.config) as any,
          enabled: trigger.enabled,
        })),
      );
      if (triggerError) throw new Error(triggerError.message);
    }

    const { data: triggers } = await context.supabase
      .from("workflow_triggers")
      .select(TRIGGER_SELECT)
      .eq("workflow_id", saved.id);

    return ok(toWorkflow(saved, (triggers ?? []) as TriggerRow[]), "Workflow saved");
  });

export const setWorkflowEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ApiResponse<null>> => {
    const { error } = await context.supabase
      .from("workflows")
      .update({ enabled: data.enabled })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return ok(null, data.enabled ? "Workflow enabled" : "Workflow paused");
  });

export const deleteWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ApiResponse<null>> => {
    const { error } = await context.supabase.from("workflows").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return ok(null, "Workflow deleted");
  });

export const listWorkflowExecutions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiResponse<WorkflowExecution[]>> => {
    const { data, error } = await context.supabase
      .from("workflow_executions")
      .select(EXECUTION_SELECT)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return ok((data ?? []).map((row) => toExecution(row as ExecutionRow)));
  });

export const recordWorkflowExecution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workflowId: z.string().uuid().nullable().default(null),
        workflowName: z.string().max(80).default(""),
        status: z.enum(["running", "success", "error", "cancelled"]),
        trigger: z.string().max(40).default("manual"),
        steps: z.array(z.record(z.string(), z.any())).max(80).default([]),
        logs: z.array(z.string().max(400)).max(200).default([]),
        variables: z.record(z.string(), z.any()).default({}),
        error: z.string().max(600).nullable().default(null),
        durationMs: z.number().int().min(0).max(3_600_000).default(0),
        startedAt: z.string().max(40),
        finishedAt: z.string().max(40).nullable().default(null),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ApiResponse<WorkflowExecution>> => {
    const { data: row, error } = await context.supabase
      .from("workflow_executions")
      .insert({
        user_id: context.userId,
        workflow_id: data.workflowId,
        workflow_name: data.workflowName,
        status: data.status,
        trigger: data.trigger,
        steps: data.steps as any,
        logs: data.logs as any,
        variables: data.variables as any,
        error: data.error,
        duration_ms: data.durationMs,
        started_at: data.startedAt,
        finished_at: data.finishedAt,
      })
      .select(EXECUTION_SELECT)
      .single();
    if (error) throw new Error(error.message);

    if (data.workflowId) {
      const { data: current } = await context.supabase
        .from("workflows")
        .select("runs, failures")
        .eq("id", data.workflowId)
        .maybeSingle();
      await context.supabase
        .from("workflows")
        .update({
          runs: (current?.runs ?? 0) + 1,
          failures: (current?.failures ?? 0) + (data.status === "error" ? 1 : 0),
          last_status: data.status,
          last_run_at: data.finishedAt ?? new Date().toISOString(),
        })
        .eq("id", data.workflowId);
    }

    return ok(toExecution(row as ExecutionRow), "Run recorded");
  });

export const clearWorkflowExecutions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiResponse<null>> => {
    const { error } = await context.supabase
      .from("workflow_executions")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return ok(null, "Run history cleared");
  });

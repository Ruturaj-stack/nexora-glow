import { z } from "zod";

/**
 * Agent & Workflow domain model.
 *
 * A workflow is a validated, declarative graph. Nothing in it is code — every
 * step names a tool that already exists in the Tool Execution Engine, so a
 * workflow (or a plugin, or the AI) can never introduce new capabilities or
 * execute arbitrary instructions.
 */

/* ------------------------------------------------------------------ conditions */

export const CONDITION_TYPES = [
  "always",
  "battery",
  "deviceOnline",
  "weekday",
  "internet",
  "haEntity",
  "variable",
  "timeWindow",
] as const;

export type ConditionType = (typeof CONDITION_TYPES)[number];

export const CONDITION_LABELS: Record<ConditionType, string> = {
  always: "Always true",
  battery: "Battery level",
  deviceOnline: "Device is online",
  weekday: "Day of week",
  internet: "Internet connected",
  haEntity: "Home Assistant entity",
  variable: "Workflow variable",
  timeWindow: "Time of day between",
};

export const conditionSchema = z.object({
  type: z.enum(CONDITION_TYPES).default("always"),
  /** Device id, entity id, variable name or start time depending on the type. */
  target: z.string().max(120).default(""),
  operator: z.enum(["gt", "gte", "lt", "lte", "eq", "neq", "contains"]).default("gt"),
  value: z.string().max(200).default(""),
});

export type ConditionSpec = z.infer<typeof conditionSchema>;

/* ---------------------------------------------------------------------- nodes */

export const NODE_KINDS = ["action", "condition", "parallel", "delay", "ai"] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

const nodeBase = {
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(80),
  /** Explicit successor; when omitted execution falls through to the next node. */
  next: z.string().max(60).optional(),
};

const toolCallSchema = z.object({
  tool: z.string().min(1).max(80),
  params: z.record(z.string(), z.any()).default({}),
});

export const actionNodeSchema = z.object({
  ...nodeBase,
  kind: z.literal("action"),
  tool: z.string().min(1).max(80),
  params: z.record(z.string(), z.any()).default({}),
  /** Stores the tool result under this workflow variable. */
  assignTo: z.string().max(40).default(""),
  retries: z.number().int().min(0).max(5).default(0),
  timeoutMs: z.number().int().min(1000).max(300_000).default(30_000),
  continueOnError: z.boolean().default(false),
  /** Compensating call used by rollback when a later step fails. */
  undo: toolCallSchema.optional(),
  /** Set when the step was contributed by an installed plugin. */
  pluginId: z.string().max(60).optional(),
});

export const conditionNodeSchema = z.object({
  ...nodeBase,
  kind: z.literal("condition"),
  condition: conditionSchema,
  whenTrue: z.string().max(60).optional(),
  whenFalse: z.string().max(60).optional(),
});

export const parallelNodeSchema = z.object({
  ...nodeBase,
  kind: z.literal("parallel"),
  branches: z.array(toolCallSchema.extend({ label: z.string().max(80).default("") })).max(8),
  continueOnError: z.boolean().default(false),
  timeoutMs: z.number().int().min(1000).max(300_000).default(45_000),
});

export const delayNodeSchema = z.object({
  ...nodeBase,
  kind: z.literal("delay"),
  ms: z.number().int().min(100).max(600_000).default(1000),
});

export const aiNodeSchema = z.object({
  ...nodeBase,
  kind: z.literal("ai"),
  prompt: z.string().min(1).max(2000),
  assignTo: z.string().max(40).default("aiResult"),
  timeoutMs: z.number().int().min(1000).max(120_000).default(60_000),
});

export const workflowNodeSchema = z.discriminatedUnion("kind", [
  actionNodeSchema,
  conditionNodeSchema,
  parallelNodeSchema,
  delayNodeSchema,
  aiNodeSchema,
]);

export type ActionNode = z.infer<typeof actionNodeSchema>;
export type ConditionNode = z.infer<typeof conditionNodeSchema>;
export type ParallelNode = z.infer<typeof parallelNodeSchema>;
export type DelayNode = z.infer<typeof delayNodeSchema>;
export type AiNode = z.infer<typeof aiNodeSchema>;
export type WorkflowNode = z.infer<typeof workflowNodeSchema>;

export const workflowEdgeSchema = z.object({
  from: z.string().max(60),
  to: z.string().max(60),
  label: z.string().max(40).default(""),
});

export const workflowGraphSchema = z.object({
  nodes: z.array(workflowNodeSchema).max(60).default([]),
  edges: z.array(workflowEdgeSchema).max(120).default([]),
  rollbackOnFailure: z.boolean().default(false),
  /** Whole-run ceiling; the executor aborts anything still pending. */
  timeoutMs: z.number().int().min(5000).max(1_800_000).default(300_000),
});

export type WorkflowGraph = z.infer<typeof workflowGraphSchema>;

/* ------------------------------------------------------------------- triggers */

export const TRIGGER_TYPES = [
  "manual",
  "time",
  "date",
  "recurring",
  "app.launched",
  "device.connected",
  "mqtt.message",
  "homeassistant.event",
  "system.startup",
  "battery.level",
  "webhook",
] as const;

export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const TRIGGER_LABELS: Record<TriggerType, string> = {
  manual: "Manual run",
  time: "At a time of day",
  date: "On a specific date",
  recurring: "Every N minutes",
  "app.launched": "Application launched",
  "device.connected": "Device connected",
  "mqtt.message": "MQTT message",
  "homeassistant.event": "Home Assistant event",
  "system.startup": "Nexora startup",
  "battery.level": "Battery drops below",
  webhook: "Webhook (coming soon)",
};

/** Trigger types the runtime cannot fire yet — surfaced as "planned" in the UI. */
export const PLANNED_TRIGGERS: TriggerType[] = ["webhook"];

export const triggerConfigSchema = z.object({
  /** "HH:MM" for time, ISO date for date. */
  at: z.string().max(40).default(""),
  /** Recurring interval in minutes. */
  everyMinutes: z.number().int().min(1).max(10_080).default(60),
  /** 0–6, empty means every day. */
  days: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  deviceId: z.string().max(60).default(""),
  topic: z.string().max(200).default(""),
  entityId: z.string().max(120).default(""),
  match: z.string().max(200).default(""),
  threshold: z.number().min(0).max(100).default(30),
  appName: z.string().max(80).default(""),
});

export type TriggerConfig = z.infer<typeof triggerConfigSchema>;

export interface WorkflowTrigger {
  id: string;
  workflowId: string;
  type: TriggerType;
  config: TriggerConfig;
  enabled: boolean;
  nextRunAt: string | null;
  lastFiredAt: string | null;
}

/* ------------------------------------------------------------------ workflows */

export type WorkflowStatus = "idle" | "running" | "success" | "error" | "cancelled";

export interface Workflow {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  graph: WorkflowGraph;
  variables: Record<string, unknown>;
  templateId: string;
  runs: number;
  failures: number;
  lastStatus: WorkflowStatus;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  triggers: WorkflowTrigger[];
}

/* ----------------------------------------------------------------- executions */

export type StepStatus = "pending" | "running" | "success" | "error" | "skipped" | "rolledback";

export interface StepResult {
  nodeId: string;
  label: string;
  kind: NodeKind;
  status: StepStatus;
  attempts: number;
  durationMs: number;
  output?: unknown;
  error?: string;
  startedAt: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string | null;
  workflowName: string;
  status: "running" | "success" | "error" | "cancelled";
  trigger: string;
  steps: StepResult[];
  logs: string[];
  variables: Record<string, unknown>;
  error: string | null;
  durationMs: number;
  startedAt: string;
  finishedAt: string | null;
}

export class WorkflowError extends Error {
  constructor(
    message: string,
    public readonly nodeId?: string,
  ) {
    super(message);
    this.name = "WorkflowError";
  }
}

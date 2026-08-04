import type { ZodType } from "zod";

/** Coarse capability groups a tool must declare before it can run. */
export const PERMISSION_SCOPES = [
  "applications",
  "filesystem",
  "desktop",
  "clipboard",
  "windows",
  "system",
  "network",
  "notifications",
  "devices",
] as const;

export type PermissionScope = (typeof PERMISSION_SCOPES)[number];

export const SCOPE_LABELS: Record<PermissionScope, string> = {
  applications: "Applications",
  filesystem: "Filesystem",
  desktop: "Desktop",
  clipboard: "Clipboard",
  windows: "Windows",
  system: "System",
  network: "Network",
  notifications: "Notifications",
  devices: "Devices",
};

/** Stored answer for a scope. `ask` prompts on every execution. */
export type PermissionDecision = "ask" | "always" | "denied";

/** Where the tool physically runs. */
export type ToolRuntime = "browser" | "bridge";

export type ToolCategory =
  | "applications"
  | "folders"
  | "files"
  | "clipboard"
  | "windows"
  | "desktop"
  | "system"
  | "volume"
  | "brightness"
  | "browser"
  | "notifications";

export type ToolErrorCode =
  | "INVALID_INPUT"
  | "PERMISSION_DENIED"
  | "BRIDGE_UNAVAILABLE"
  | "NOT_SUPPORTED"
  | "NOT_FOUND"
  | "TIMEOUT"
  | "CANCELLED"
  | "EXECUTION_FAILED";

export class ToolError extends Error {
  constructor(
    public readonly code: ToolErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ToolError";
  }
}

export interface ToolContext {
  signal: AbortSignal;
  /** Streams a human-readable progress line into the execution panel. */
  log: (line: string) => void;
}

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  title: string;
  description: string;
  category: ToolCategory;
  scopes: PermissionScope[];
  runtime: ToolRuntime;
  /** Destructive tools always prompt, even when the scope is allowed. */
  danger?: boolean;
  /** Registered but not executable yet — surfaced as "planned" in the UI. */
  planned?: boolean;
  timeoutMs?: number;
  schema: ZodType<TInput>;
  execute: (input: TInput, ctx: ToolContext) => Promise<TOutput>;
}

export type ToolStatus = "queued" | "running" | "success" | "error" | "cancelled";

export interface ToolExecution {
  id: string;
  tool: string;
  category: ToolCategory;
  params: Record<string, unknown>;
  status: ToolStatus;
  result?: unknown;
  error?: string;
  errorCode?: ToolErrorCode;
  durationMs: number;
  permission: string;
  runtime: ToolRuntime;
  source: string;
  createdAt: string;
  logs: string[];
}

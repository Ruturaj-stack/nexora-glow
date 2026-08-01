import { useToolStore, type PermissionAnswer, type PermissionRequest } from "@/store/tool-store";
import { setToolPermission } from "@/lib/tools.functions";
import type { PermissionDecision, PermissionScope, ToolDefinition } from "./types";
import { ToolError } from "./types";

/**
 * Central gate between a requested tool and its execution.
 *
 * Rules:
 *  - a scope answered "denied" fails immediately, no prompt;
 *  - a scope answered "always" passes silently unless the tool is destructive;
 *  - anything else prompts the user with Allow once / Always allow / Deny.
 */

const resolvers = new Map<string, (answer: PermissionAnswer) => void>();

export function answerPermission(id: string, answer: PermissionAnswer) {
  const resolve = resolvers.get(id);
  resolvers.delete(id);
  useToolStore.getState().setPending(null);
  resolve?.(answer);
}

function prompt(request: PermissionRequest): Promise<PermissionAnswer> {
  useToolStore.getState().setPending(request);
  return new Promise((resolve) => resolvers.set(request.id, resolve));
}

export function getDecision(scope: PermissionScope): PermissionDecision {
  return useToolStore.getState().permissions[scope] ?? "ask";
}

async function persist(scope: PermissionScope, decision: PermissionDecision) {
  useToolStore.getState().setPermission(scope, decision);
  try {
    await setToolPermission({ data: { scope, decision } });
  } catch {
    // Local decision still applies; the sync retries on the next answer.
  }
}

/**
 * Resolves permission for a tool invocation.
 * @returns a label describing how the run was authorised.
 * @throws ToolError PERMISSION_DENIED when the user refuses.
 */
export async function ensurePermission(
  tool: ToolDefinition<unknown, unknown>,
  params: Record<string, unknown>,
  source: string,
): Promise<string> {
  const granted: string[] = [];

  for (const scope of tool.scopes) {
    const decision = getDecision(scope);
    if (decision === "denied") {
      throw new ToolError(
        "PERMISSION_DENIED",
        `${tool.title} needs the "${scope}" permission, which is set to denied.`,
      );
    }
    if (decision === "always" && !tool.danger) {
      granted.push(`${scope}:always`);
      continue;
    }

    const answer = await prompt({
      id: `${tool.name}-${scope}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tool: tool.name,
      title: tool.title,
      description: tool.description,
      scopes: [scope],
      params,
      danger: Boolean(tool.danger),
      source,
    });

    if (answer === "deny") {
      await persist(scope, "denied");
      throw new ToolError("PERMISSION_DENIED", `You denied ${tool.title}.`);
    }
    if (answer === "always") {
      await persist(scope, "always");
      granted.push(`${scope}:always`);
    } else {
      granted.push(`${scope}:once`);
    }
  }

  return granted.join(", ") || "none";
}

import { runToolCall, runWithRetries, interpolate } from "./action-engine";
import { evaluateCondition } from "./condition-engine";
import { useWorkflowStore } from "@/store/workflow-store";
import { recordWorkflowExecution } from "@/lib/workflows.functions";
import { runAgentPrompt } from "@/lib/agent.functions";
import {
  type ActionNode,
  type Json,
  type StepResult,
  type Workflow,
  type WorkflowExecution,
  type WorkflowGraph,
  type WorkflowNode,
} from "./types";

/**
 * WorkflowExecutor — walks a validated graph one node at a time.
 *
 * Sequential by default, parallel where a node declares branches, with retries,
 * per-step timeouts, conditional branching, cancellation and optional rollback
 * of completed steps when the run fails.
 */

interface RunHandle {
  cancelled: boolean;
}

const RUNNING = new Map<string, RunHandle>();

export function cancelWorkflowRun(runId: string) {
  const handle = RUNNING.get(runId);
  if (handle) handle.cancelled = true;
}

export function isRunning(runId: string) {
  return RUNNING.has(runId);
}

export interface RunOptions {
  trigger?: string;
  /** Seed variables merged over the workflow's own defaults. */
  input?: Record<string, Json>;
}

function nodeIndex(graph: WorkflowGraph) {
  return new Map(graph.nodes.map((node, index) => [node.id, index]));
}

function baseStep(node: WorkflowNode): StepResult {
  return {
    nodeId: node.id,
    label: node.label,
    kind: node.kind,
    status: "running",
    attempts: 0,
    durationMs: 0,
    startedAt: new Date().toISOString(),
  };
}

export async function runWorkflow(
  workflow: Workflow,
  options: RunOptions = {},
): Promise<WorkflowExecution> {
  const store = useWorkflowStore.getState();
  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const startedAt = new Date().toISOString();
  const startedMs = performance.now();
  const handle: RunHandle = { cancelled: false };
  RUNNING.set(runId, handle);

  const variables: Record<string, Json> = {
    ...(workflow.variables ?? {}),
    ...(options.input ?? {}),
  };
  const steps: StepResult[] = [];
  const logs: string[] = [];
  const undoStack: ActionNode[] = [];

  const execution: WorkflowExecution = {
    id: runId,
    workflowId: workflow.id,
    workflowName: workflow.name,
    status: "running",
    trigger: options.trigger ?? "manual",
    steps,
    logs,
    variables,
    error: null,
    durationMs: 0,
    startedAt,
    finishedAt: null,
  };

  store.startRun(execution);

  const log = (line: string) => {
    logs.push(`${new Date().toLocaleTimeString()} — ${line}`);
    useWorkflowStore.getState().patchRun(runId, { logs: [...logs] });
  };

  const sync = () => useWorkflowStore.getState().patchRun(runId, { steps: [...steps], variables: { ...variables } });

  const index = nodeIndex(workflow.graph);
  const deadline = startedMs + workflow.graph.timeoutMs;
  let cursor = workflow.graph.nodes.length ? workflow.graph.nodes[0].id : null;
  let guard = 0;
  let failure: string | null = null;

  log(`Run started (${options.trigger ?? "manual"})`);

  while (cursor && !failure) {
    if (handle.cancelled) break;
    if (performance.now() > deadline) {
      failure = "Workflow exceeded its total time limit";
      break;
    }
    guard += 1;
    if (guard > 200) {
      failure = "Workflow stopped: too many steps (possible loop)";
      break;
    }

    const position = index.get(cursor);
    if (position === undefined) {
      failure = `Step "${cursor}" does not exist`;
      break;
    }

    const node = workflow.graph.nodes[position];
    const step = baseStep(node);
    steps.push(step);
    sync();
    const stepStart = performance.now();
    let nextId: string | undefined = node.next;

    switch (node.kind) {
      case "action": {
        log(`▶ ${node.label} (${node.tool})`);
        const outcome = await runWithRetries(node.tool, node.params, variables, {
          source: "workflow",
          timeoutMs: node.timeoutMs,
          retries: node.retries,
          onAttempt: (attempt) => {
            step.attempts = attempt;
            if (attempt > 1) log(`↻ retry ${attempt - 1} of ${node.retries} — ${node.label}`);
            sync();
          },
        });
        step.attempts = outcome.attempts;
        step.output = outcome.output;
        if (outcome.ok) {
          step.status = "success";
          if (node.assignTo) variables[node.assignTo] = outcome.output;
          if (node.undo) undoStack.push(node);
        } else if (node.continueOnError) {
          step.status = "error";
          step.error = outcome.error ?? "Action failed";
          log(`⚠ ${node.label} failed but the workflow continues: ${step.error}`);
        } else {
          step.status = "error";
          step.error = outcome.error ?? "Action failed";
          failure = `${node.label}: ${step.error}`;
        }
        break;
      }

      case "condition": {
        const result = evaluateCondition(node.condition, variables);
        step.status = "success";
        step.output = { passed: result.passed, reason: result.reason };
        log(`◆ ${node.label} → ${result.passed ? "true" : "false"} (${result.reason})`);
        const branch = result.passed ? node.whenTrue : node.whenFalse;
        nextId = branch ?? node.next;
        if (!branch && !result.passed && !node.next) {
          log("Condition was false and no branch is defined — stopping.");
        }
        break;
      }

      case "parallel": {
        log(`⇉ ${node.label} — ${node.branches.length} branches`);
        const results = await Promise.all(
          node.branches.map((branch) =>
            runToolCall(branch.tool, branch.params, variables, {
              source: "workflow",
              timeoutMs: node.timeoutMs,
            }),
          ),
        );
        step.attempts = 1;
        step.output = results.map((r, i) => ({
          branch: node.branches[i].label || node.branches[i].tool,
          ok: r.ok,
          output: r.output,
          error: r.error ?? null,
        })) as Json;
        const failed = results.filter((r) => !r.ok);
        if (failed.length && !node.continueOnError) {
          step.status = "error";
          step.error = failed.map((r) => r.error).join("; ");
          failure = `${node.label}: ${step.error}`;
        } else {
          step.status = failed.length ? "error" : "success";
          if (failed.length) log(`⚠ ${failed.length} branch(es) failed but the workflow continues.`);
        }
        break;
      }

      case "delay": {
        log(`⏱ ${node.label} — waiting ${node.ms}ms`);
        await new Promise((resolve) => setTimeout(resolve, node.ms));
        step.status = "success";
        break;
      }

      case "ai": {
        log(`✦ ${node.label} — asking the assistant`);
        try {
          const prompt = String(interpolate(node.prompt, variables));
          const response = await runAgentPrompt({
            data: { prompt, context: JSON.stringify(variables).slice(0, 3000) },
          });
          const text = response.data.text;
          step.status = "success";
          step.output = text;
          variables[node.assignTo || "aiResult"] = text;
        } catch (error) {
          step.status = "error";
          step.error = error instanceof Error ? error.message : "The assistant step failed";
          failure = `${node.label}: ${step.error}`;
        }
        break;
      }

      default:
        step.status = "skipped";
    }

    step.durationMs = Math.round(performance.now() - stepStart);
    sync();

    if (failure) break;
    cursor = nextId ?? workflow.graph.nodes[position + 1]?.id ?? null;
  }

  if (handle.cancelled) {
    for (const step of steps) if (step.status === "running") step.status = "skipped";
    log("Run cancelled by the user.");
  }

  if (failure && workflow.graph.rollbackOnFailure && undoStack.length) {
    log(`↩ Rolling back ${undoStack.length} completed step(s)…`);
    for (const node of [...undoStack].reverse()) {
      if (!node.undo) continue;
      const undone = await runToolCall(node.undo.tool, node.undo.params, variables, {
        source: "workflow-rollback",
        timeoutMs: node.timeoutMs,
      });
      const target = steps.find((s) => s.nodeId === node.id);
      if (target) target.status = undone.ok ? "rolledback" : target.status;
      log(`${undone.ok ? "✓" : "✗"} rollback — ${node.label}`);
    }
    sync();
  }

  const status: WorkflowExecution["status"] = handle.cancelled
    ? "cancelled"
    : failure
      ? "error"
      : "success";
  const finishedAt = new Date().toISOString();
  const durationMs = Math.round(performance.now() - startedMs);

  log(`Run ${status} in ${(durationMs / 1000).toFixed(1)}s`);
  RUNNING.delete(runId);

  const final: WorkflowExecution = {
    ...execution,
    status,
    steps: [...steps],
    logs: [...logs],
    variables: { ...variables },
    error: failure,
    durationMs,
    finishedAt,
  };
  useWorkflowStore.getState().patchRun(runId, final);

  try {
    const saved = await recordWorkflowExecution({
      data: {
        workflowId: workflow.id,
        workflowName: workflow.name,
        status,
        trigger: final.trigger,
        steps: final.steps as unknown as Record<string, unknown>[],
        logs: final.logs.slice(-200),
        variables: final.variables,
        error: failure,
        durationMs,
        startedAt,
        finishedAt,
      },
    });
    useWorkflowStore.getState().patchRun(runId, { id: saved.data.id });
  } catch {
    // History persistence must never break the run itself.
  }

  return final;
}

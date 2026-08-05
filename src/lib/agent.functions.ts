import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ok, type ApiResponse } from "@/lib/api-response";
import { DEFAULT_MODEL } from "@/lib/ai/models";
import { toolManifest } from "@/features/tools/registry";
import { workflowGraphSchema, type WorkflowGraph } from "@/features/agent/types";

/**
 * Agent reasoning endpoints:
 *   POST /api/v1/agent/plan      — natural language → validated workflow graph
 *   POST /api/v1/agent/complete  — single-shot completion for AI workflow steps
 *
 * The planner can only emit steps that name tools already in the registry; the
 * graph is schema-validated before it ever reaches the executor.
 */

async function complete(prompt: string, system: string, signal?: AbortSignal): Promise<string> {
  const { streamChat } = await import("@/lib/ai/providers.server");
  const stream = await streamChat({
    model: DEFAULT_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    signal,
  });

  const reader = stream.getReader();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += value;
  }
  reader.releaseLock();
  return text;
}

function extractJson(raw: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(raw);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("The planner did not return a workflow.");
  return JSON.parse(body.slice(start, end + 1));
}

export interface WorkflowPlan {
  name: string;
  description: string;
  category: string;
  graph: WorkflowGraph;
}

export const planWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ prompt: z.string().trim().min(4).max(1000) }).parse(input),
  )
  .handler(async ({ data }): Promise<ApiResponse<WorkflowPlan>> => {
    const tools = toolManifest()
      .map((tool) => `- ${tool.name} — ${tool.description}`)
      .join("\n");

    const system = [
      "You are Nexora's workflow planner. Convert the user's request into a JSON automation plan.",
      "Reply with JSON only, no prose, in this shape:",
      '{"name":string,"description":string,"category":string,"graph":{"nodes":[...],"edges":[],"rollbackOnFailure":false,"timeoutMs":300000}}',
      'Node shapes: {"id","label","kind":"action","tool","params":{},"retries":0,"timeoutMs":30000,"continueOnError":false,"assignTo":""}',
      '{"id","label","kind":"condition","condition":{"type","target","operator","value"},"whenTrue":"nodeId","whenFalse":"nodeId"}',
      '{"id","label","kind":"delay","ms":1000} and {"id","label","kind":"ai","prompt":"...","assignTo":"aiResult"}',
      "Condition types: always, battery, deviceOnline, weekday, internet, haEntity, variable, timeWindow.",
      "Keep plans under 10 nodes. You may ONLY use these tools:",
      tools,
    ].join("\n");

    let raw: string;
    try {
      raw = await complete(data.prompt, system);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "The planner is unavailable.");
    }

    let parsedJson: unknown;
    try {
      parsedJson = extractJson(raw);
    } catch {
      throw new Error("The planner returned an unreadable plan. Try rephrasing the request.");
    }

    const shape = z
      .object({
        name: z.string().trim().min(1).max(80).default("Generated workflow"),
        description: z.string().max(400).default(""),
        category: z.string().max(40).default("general"),
        graph: z.unknown(),
      })
      .safeParse(parsedJson);
    if (!shape.success) throw new Error("The planner returned an invalid plan.");

    const graph = workflowGraphSchema.safeParse(shape.data.graph ?? {});
    if (!graph.success) {
      throw new Error("The planner produced steps Nexora cannot run safely.");
    }

    const known = new Set(toolManifest().map((tool) => tool.name));
    const unknown = graph.data.nodes.filter(
      (node) => node.kind === "action" && !known.has(node.tool),
    );
    if (unknown.length) {
      throw new Error(`The plan referenced unavailable tools: ${unknown.map((n) => n.label).join(", ")}`);
    }

    return ok(
      {
        name: shape.data.name,
        description: shape.data.description,
        category: shape.data.category,
        graph: graph.data,
      },
      "Plan ready",
    );
  });

export const runAgentPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        prompt: z.string().trim().min(1).max(4000),
        context: z.string().max(4000).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<ApiResponse<{ text: string }>> => {
    const system = [
      "You are Nexora's automation reasoner running inside a workflow step.",
      "Answer concisely and factually. Return plain text only — no markdown, no preamble.",
      data.context ? `Workflow context:\n${data.context}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const text = await complete(data.prompt, system);
    return ok({ text: text.trim() }, "Completed");
  });

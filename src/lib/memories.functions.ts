import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ok, type ApiResponse } from "@/lib/api-response";

export const MEMORY_CATEGORIES = [
  "preference",
  "project",
  "person",
  "style",
  "fact",
  "note",
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export interface MemoryRecord {
  id: string;
  title: string;
  content: string;
  category: string;
  importance: number;
  pinned: boolean;
  tags: string[];
  source: string;
  createdAt: string;
  updatedAt: string;
}

const memoryInput = z.object({
  title: z.string().trim().min(1).max(140),
  content: z.string().trim().max(4000).default(""),
  category: z.enum(MEMORY_CATEGORIES).default("note"),
  importance: z.number().int().min(1).max(5).default(3),
  pinned: z.boolean().default(false),
  tags: z.array(z.string().trim().min(1).max(32)).max(10).default([]),
});

function toRecord(row: {
  id: string;
  title: string;
  content: string;
  category: string;
  importance: number;
  pinned: boolean;
  tags: string[];
  source: string;
  created_at: string;
  updated_at: string;
}): MemoryRecord {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    importance: row.importance,
    pinned: row.pinned,
    tags: row.tags ?? [],
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT =
  "id, title, content, category, importance, pinned, tags, source, created_at, updated_at";

/** GET /api/v1/memories */
export const listMemories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiResponse<MemoryRecord[]>> => {
    const { data, error } = await context.supabase
      .from("memories")
      .select(SELECT)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);
    return ok((data ?? []).map(toRecord));
  });

/** POST /api/v1/memories */
export const createMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    memoryInput.extend({ source: z.string().default("manual") }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ApiResponse<MemoryRecord>> => {
    const { data: row, error } = await context.supabase
      .from("memories")
      .insert({ ...data, user_id: context.userId })
      .select(SELECT)
      .single();

    if (error) throw new Error(error.message);
    return ok(toRecord(row), "Memory saved");
  });

/** PUT /api/v1/memories/:id */
export const updateMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    memoryInput.partial().extend({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ApiResponse<null>> => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("memories").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return ok(null, "Memory updated");
  });

/** DELETE /api/v1/memories/:id */
export const deleteMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ApiResponse<null>> => {
    const { error } = await context.supabase.from("memories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return ok(null, "Memory deleted");
  });

/**
 * Distils durable facts from the tail of a conversation and stores anything new.
 * Runs after an assistant turn completes; failures are non-fatal.
 */
export const extractMemories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ conversationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ApiResponse<MemoryRecord[]>> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return ok([], "Memory extraction unavailable");

    const [{ data: recent }, { data: existing }] = await Promise.all([
      context.supabase
        .from("messages")
        .select("role, content")
        .eq("conversation_id", data.conversationId)
        .order("created_at", { ascending: false })
        .limit(6),
      context.supabase.from("memories").select("title").eq("user_id", context.userId).limit(60),
    ]);

    const transcript = (recent ?? [])
      .reverse()
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n")
      .slice(0, 8000);

    if (!transcript.trim()) return ok([]);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content: [
              "Extract durable long-term facts about the USER from the transcript: stable preferences, ongoing projects, people, writing/coding style, and important notes.",
              "Ignore transient questions, one-off tasks and anything about the assistant.",
              "Existing memory titles (do not duplicate these): " +
                ((existing ?? []).map((m) => m.title).join(" | ") || "none"),
              'Reply with JSON only: {"memories":[{"title":"","content":"","category":"preference|project|person|style|fact|note","importance":1-5,"tags":[]}]}',
              "Keep titles under 60 characters, content under 300 characters, and return an empty array when nothing durable is present.",
            ].join("\n"),
          },
          { role: "user", content: transcript },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) return ok([], "Memory extraction skipped");

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    let parsed: { memories?: unknown };
    try {
      parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? "{}") as { memories?: unknown };
    } catch {
      return ok([], "Memory extraction skipped");
    }

    const candidates = z
      .array(
        z.object({
          title: z.string().trim().min(1),
          content: z.string().trim().default(""),
          category: z.string().default("note"),
          importance: z.number().default(3),
          tags: z.array(z.string()).default([]),
        }),
      )
      .safeParse(parsed.memories ?? []);

    if (!candidates.success || candidates.data.length === 0) return ok([]);

    const known = new Set((existing ?? []).map((m) => m.title.toLowerCase()));
    const rows = candidates.data
      .filter((m) => !known.has(m.title.toLowerCase()))
      .slice(0, 5)
      .map((m) => ({
        user_id: context.userId,
        title: m.title.slice(0, 140),
        content: m.content.slice(0, 4000),
        category: (MEMORY_CATEGORIES as readonly string[]).includes(m.category)
          ? m.category
          : "note",
        importance: Math.min(5, Math.max(1, Math.round(m.importance))),
        tags: m.tags.slice(0, 10),
        source: "auto",
      }));

    if (rows.length === 0) return ok([]);

    const { data: inserted, error } = await context.supabase
      .from("memories")
      .insert(rows)
      .select(SELECT);

    if (error) return ok([], "Memory extraction skipped");
    return ok((inserted ?? []).map(toRecord), `${inserted?.length ?? 0} memories learned`);
  });

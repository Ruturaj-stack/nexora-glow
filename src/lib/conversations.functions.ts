import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ok, type ApiResponse } from "@/lib/api-response";
import { DEFAULT_MODEL } from "@/lib/ai/models";

export interface Attachment {
  name: string;
  path: string;
  size: number;
  type: string;
}

export interface ConversationRecord {
  id: string;
  title: string;
  pinned: boolean;
  model: string;
  lastMessageAt: string;
  createdAt: string;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments: Attachment[];
  tokenCount: number;
  error: boolean;
  createdAt: string;
}

const attachmentSchema = z.object({
  name: z.string(),
  path: z.string(),
  size: z.number(),
  type: z.string(),
});

/** GET /api/v1/conversations */
export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiResponse<ConversationRecord[]>> => {
    const { data, error } = await context.supabase
      .from("conversations")
      .select("id, title, pinned, model, last_message_at, created_at")
      .order("pinned", { ascending: false })
      .order("last_message_at", { ascending: false });

    if (error) throw new Error(error.message);

    return ok(
      (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        pinned: row.pinned,
        model: row.model,
        lastMessageAt: row.last_message_at,
        createdAt: row.created_at,
      })),
    );
  });

/** POST /api/v1/conversations */
export const createConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ title: z.string().trim().max(120).optional(), model: z.string().optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<ApiResponse<ConversationRecord>> => {
    const { data: row, error } = await context.supabase
      .from("conversations")
      .insert({
        user_id: context.userId,
        title: data.title?.length ? data.title : "New chat",
        model: data.model ?? DEFAULT_MODEL,
      })
      .select("id, title, pinned, model, last_message_at, created_at")
      .single();

    if (error) throw new Error(error.message);

    return ok(
      {
        id: row.id,
        title: row.title,
        pinned: row.pinned,
        model: row.model,
        lastMessageAt: row.last_message_at,
        createdAt: row.created_at,
      },
      "Conversation created",
    );
  });

/** PUT /api/v1/conversations/:id */
export const updateConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().trim().min(1).max(120).optional(),
        pinned: z.boolean().optional(),
        model: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ApiResponse<null>> => {
    const { id, ...patch } = data;
    const { error } = await context.supabase
      .from("conversations")
      .update({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {}),
        ...(patch.model !== undefined ? { model: patch.model } : {}),
      })
      .eq("id", id);

    if (error) throw new Error(error.message);
    return ok(null, "Conversation updated");
  });

/** DELETE /api/v1/conversations/:id */
export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ApiResponse<null>> => {
    const { error } = await context.supabase.from("conversations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return ok(null, "Conversation deleted");
  });

/** GET /api/v1/messages?conversationId= */
export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ conversationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ApiResponse<MessageRecord[]>> => {
    const { data: rows, error } = await context.supabase
      .from("messages")
      .select("id, conversation_id, role, content, attachments, token_count, error, created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

    return ok(
      (rows ?? []).map((row) => ({
        id: row.id,
        conversationId: row.conversation_id,
        role: row.role as MessageRecord["role"],
        content: row.content,
        attachments: (row.attachments ?? []) as unknown as Attachment[],
        tokenCount: row.token_count,
        error: row.error,
        createdAt: row.created_at,
      })),
    );
  });

/** POST /api/v1/messages — persists a user turn and titles new conversations. */
export const appendUserMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        content: z.string().trim().min(1).max(20_000),
        attachments: z.array(attachmentSchema).max(8).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ApiResponse<MessageRecord>> => {
    const { data: row, error } = await context.supabase
      .from("messages")
      .insert({
        conversation_id: data.conversationId,
        user_id: context.userId,
        role: "user",
        content: data.content,
        attachments: data.attachments,
        token_count: Math.ceil(data.content.length / 4),
      })
      .select("id, conversation_id, role, content, attachments, token_count, error, created_at")
      .single();

    if (error) throw new Error(error.message);

    const { count } = await context.supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", data.conversationId);

    const patch: { last_message_at: string; title?: string } = {
      last_message_at: new Date().toISOString(),
    };
    if ((count ?? 0) <= 1) {
      patch.title = data.content.replace(/\s+/g, " ").slice(0, 60);
    }
    await context.supabase.from("conversations").update(patch).eq("id", data.conversationId);

    return ok({
      id: row.id,
      conversationId: row.conversation_id,
      role: "user" as const,
      content: row.content,
      attachments: (row.attachments ?? []) as unknown as Attachment[],
      tokenCount: row.token_count,
      error: row.error,
      createdAt: row.created_at,
    });
  });

/** DELETE /api/v1/messages/:id */
export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ApiResponse<null>> => {
    const { error } = await context.supabase.from("messages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return ok(null, "Message deleted");
  });

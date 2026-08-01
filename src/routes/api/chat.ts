import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest } from "@/lib/supabase-request.server";
import { ProviderError, streamChat, type ChatMessageInput } from "@/lib/ai/providers.server";
import { DEFAULT_MODEL } from "@/lib/ai/models";
import { toolManifest } from "@/features/tools/registry";

const MAX_HISTORY = 40;

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ success: false, message, data: null }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let auth;
        try {
          auth = await authenticateRequest(request);
        } catch {
          return errorResponse("Unauthorized", 401);
        }
        const { supabase, userId } = auth;

        const body = (await request.json().catch(() => null)) as {
          conversationId?: string;
        } | null;
        if (!body?.conversationId) return errorResponse("conversationId is required", 400);

        const { data: conversation, error: conversationError } = await supabase
          .from("conversations")
          .select("id, model")
          .eq("id", body.conversationId)
          .maybeSingle();

        if (conversationError) return errorResponse(conversationError.message, 500);
        if (!conversation) return errorResponse("Conversation not found", 404);

        const [{ data: history }, { data: memories }] = await Promise.all([
          supabase
            .from("messages")
            .select("role, content")
            .eq("conversation_id", conversation.id)
            .order("created_at", { ascending: true })
            .limit(MAX_HISTORY),
          supabase
            .from("memories")
            .select("title, content, category, importance, pinned")
            .eq("user_id", userId)
            .order("pinned", { ascending: false })
            .order("importance", { ascending: false })
            .order("updated_at", { ascending: false })
            .limit(30),
        ]);

        const memoryBlock = (memories ?? [])
          .map((m) => `- [${m.category}] ${m.title}: ${m.content}`)
          .join("\n");

        const messages: ChatMessageInput[] = [
          {
            role: "system",
            content: [
              "You are Nexora, a calm, precise personal AI assistant inside a premium desktop workspace.",
              "Answer directly and concisely. Use GitHub-flavoured markdown, fenced code blocks with a language tag, LaTeX ($...$ / $$...$$) for maths and ```mermaid blocks for diagrams when they genuinely help.",
              [
                "You can propose computer actions, but you may NEVER claim to have run one and you must never emit shell or OS commands.",
                "To propose an action, emit a fenced ```nexora-tool block containing only JSON: {\"tool\":\"<name>\",\"params\":{}}.",
                "The user reviews and approves every proposal; only tools in this registry exist:",
                toolManifest()
                  .map((t) => `- ${t.name} (${t.runtime}) — ${t.description}`)
                  .join("\n"),
              ].join("\n"),
              memoryBlock
                ? `Long-term memory about this user (use it silently, never recite it):\n${memoryBlock}`
                : "You currently have no long-term memory about this user.",
            ].join("\n\n"),
          },
          ...(history ?? []).map((m) => ({
            role: m.role as ChatMessageInput["role"],
            content: m.content,
          })),
        ];

        try {
          const textStream = await streamChat({
            model: conversation.model || DEFAULT_MODEL,
            messages,
            signal: request.signal,
          });

          let full = "";
          const encoder = new TextEncoder();
          const out = new ReadableStream<Uint8Array>({
            async start(controller) {
              const reader = textStream.getReader();
              try {
                for (;;) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  full += value;
                  controller.enqueue(encoder.encode(value));
                }
              } catch (error) {
                controller.enqueue(
                  encoder.encode(
                    `\n\n_Stream interrupted: ${
                      error instanceof Error ? error.message : "unknown error"
                    }_`,
                  ),
                );
              } finally {
                reader.releaseLock();
              }

              if (full.trim()) {
                await supabase.from("messages").insert({
                  conversation_id: conversation.id,
                  user_id: userId,
                  role: "assistant",
                  content: full,
                  token_count: Math.ceil(full.length / 4),
                });
                await supabase
                  .from("conversations")
                  .update({ last_message_at: new Date().toISOString() })
                  .eq("id", conversation.id);
              }
              controller.close();
            },
          });

          return new Response(out, {
            headers: {
              "content-type": "text/plain; charset=utf-8",
              "cache-control": "no-cache, no-transform",
              "x-accel-buffering": "no",
            },
          });
        } catch (error) {
          if (error instanceof ProviderError) {
            const message =
              error.status === 429
                ? "Rate limit reached. Please wait a moment and try again."
                : error.status === 402
                  ? "AI credits exhausted. Add credits to continue."
                  : error.message;
            return errorResponse(message, error.status);
          }
          return errorResponse(
            error instanceof Error ? error.message : "Failed to reach the model",
            500,
          );
        }
      },
    },
  },
});

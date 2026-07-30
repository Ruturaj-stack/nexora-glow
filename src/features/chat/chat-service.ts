import { supabase } from "@/integrations/supabase/client";
import type { Attachment } from "@/lib/conversations.functions";

/** Storage service — uploads chat attachments to the user's private folder. */
export async function uploadAttachment(file: File, userId: string): Promise<Attachment> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  const path = `${userId}/${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage
    .from("chat-attachments")
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });

  if (error) throw new Error(error.message);

  return { name: file.name, path, size: file.size, type: file.type };
}

export async function getAttachmentUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("chat-attachments").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export interface StreamOptions {
  conversationId: string;
  onDelta: (delta: string) => void;
  signal?: AbortSignal;
}

/**
 * AI service — opens the streaming chat endpoint and pushes text deltas.
 * Resolves with the complete assistant response.
 */
export async function streamAssistant({
  conversationId,
  onDelta,
  signal,
}: StreamOptions): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session expired. Please sign in again.");

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ conversationId }),
    signal,
  });

  if (!response.ok || !response.body) {
    let message = "The assistant is unavailable right now.";
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) message = payload.message;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      full += value;
      onDelta(value);
    }
  }
  return full;
}

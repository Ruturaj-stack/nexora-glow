import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PanelRight } from "lucide-react";
import { GlassPanel } from "@/components/common/glass-panel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { MessageBubble, StreamingBubble } from "@/features/chat/message-bubble";
import { Composer } from "@/features/chat/composer";
import { ConversationList } from "@/features/chat/conversation-list";
import { streamAssistant, uploadAttachment } from "@/features/chat/chat-service";
import { useChatStore } from "@/store/chat-store";
import { useAuth } from "@/features/auth/auth-context";
import { MODELS, estimateTokens, getModel } from "@/lib/ai/models";
import { createMemory, extractMemories, listMemories } from "@/lib/memories.functions";
import {
  appendUserMessage,
  createConversation,
  deleteConversation,
  deleteMessage,
  listConversations,
  listMessages,
  updateConversation,
  type Attachment,
  type ConversationRecord,
} from "@/lib/conversations.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chat/$conversationId")({
  head: () => ({
    meta: [
      { title: "Chat — Nexora AI Workspace" },
      {
        name: "description",
        content: "Stream conversations with your Nexora assistant, backed by long-term memory.",
      },
      { property: "og:title", content: "Chat — Nexora AI Workspace" },
      {
        property: "og:description",
        content: "Stream conversations with your Nexora assistant, backed by long-term memory.",
      },
    ],
  }),
  component: ChatConversation,
});

function ChatConversation() {
  const { conversationId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  const {
    streamingId,
    streamBuffer,
    thinking,
    startStream,
    appendDelta,
    endStream,
    drafts,
    setDraft,
    contextPanelOpen,
    toggleContextPanel,
  } = useChatStore();

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const conversationsQuery = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => (await listConversations()).data,
  });

  const messagesQuery = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => (await listMessages({ data: { conversationId } })).data,
  });

  const memoriesQuery = useQuery({
    queryKey: ["memories"],
    queryFn: async () => (await listMemories()).data,
  });

  const conversation = conversationsQuery.data?.find((c) => c.id === conversationId);
  const messages = messagesQuery.data ?? [];
  const draft = drafts[conversationId] ?? "";
  const isStreaming = streamingId === conversationId;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, streamBuffer, thinking]);

  const refreshConversations = () => queryClient.invalidateQueries({ queryKey: ["conversations"] });

  const newChat = useMutation({
    mutationFn: async () => (await createConversation({ data: {} })).data,
    onSuccess: async (created) => {
      await refreshConversations();
      void navigate({ to: "/chat/$conversationId", params: { conversationId: created.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rename = useMutation({
    mutationFn: (input: { id: string; title: string }) => updateConversation({ data: input }),
    onSuccess: refreshConversations,
  });

  const togglePin = useMutation({
    mutationFn: (c: ConversationRecord) =>
      updateConversation({ data: { id: c.id, pinned: !c.pinned } }),
    onSuccess: refreshConversations,
  });

  const setModel = useMutation({
    mutationFn: (model: string) => updateConversation({ data: { id: conversationId, model } }),
    onSuccess: refreshConversations,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteConversation({ data: { id } }),
    onSuccess: async (_result, id) => {
      await refreshConversations();
      if (id === conversationId) void navigate({ to: "/chat", replace: true });
      toast.success("Conversation deleted");
    },
  });

  const removeMessage = useMutation({
    mutationFn: (id: string) => deleteMessage({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["messages", conversationId] }),
  });

  const remember = useMutation({
    mutationFn: (text: string) =>
      createMemory({
        data: {
          title: text.replace(/\s+/g, " ").slice(0, 60),
          content: text.slice(0, 3000),
          category: "note",
          importance: 3,
          pinned: false,
          tags: [],
          source: "chat",
        },
      }),
    onSuccess: () => {
      toast.success("Saved to memory");
      void queryClient.invalidateQueries({ queryKey: ["memories"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleFiles = async (files: File[]) => {
    if (!profile) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(files.slice(0, 8).map((f) => uploadAttachment(f, profile.id)));
      setAttachments((prev) => [...prev, ...uploaded].slice(0, 8));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text && attachments.length === 0) return;

    const outgoing = attachments;
    setDraft(conversationId, "");
    setAttachments([]);

    try {
      await appendUserMessage({
        data: {
          conversationId,
          content: text || `Sent ${outgoing.length} attachment(s)`,
          attachments: outgoing,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      void refreshConversations();

      const controller = new AbortController();
      abortRef.current = controller;
      startStream(conversationId);

      await streamAssistant({
        conversationId,
        signal: controller.signal,
        onDelta: appendDelta,
      });
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        toast.error(error instanceof Error ? error.message : "The assistant failed to respond");
      }
    } finally {
      endStream();
      abortRef.current = null;
      await queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      void extractMemories({ data: { conversationId } })
        .then((result) => {
          if (result.data.length) {
            void queryClient.invalidateQueries({ queryKey: ["memories"] });
          }
        })
        .catch(() => undefined);
    }
  };

  const exportConversation = (target: ConversationRecord) => {
    const body = messages
      .map((m) => `## ${m.role === "user" ? "You" : "Nexora"}\n\n${m.content}`)
      .join("\n\n");
    const blob = new Blob([`# ${target.title}\n\n${body}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${target.title.replace(/[^\w-]+/g, "-").toLowerCase()}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const model = getModel(conversation?.model ?? MODELS[0].id);
  const usedTokens =
    messages.reduce((total, m) => total + (m.tokenCount || estimateTokens(m.content)), 0) +
    estimateTokens(streamBuffer);
  const contextUsage = Math.min(100, (usedTokens / model.contextWindow) * 100);

  return (
    <div className="grid h-[calc(100vh-11rem)] gap-4 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_auto]">
      <GlassPanel className="hidden min-h-0 p-0 lg:block">
        <ConversationList
          conversations={conversationsQuery.data ?? []}
          activeId={conversationId}
          onCreate={() => newChat.mutate()}
          onRename={(id, title) => rename.mutate({ id, title })}
          onTogglePin={(c) => togglePin.mutate(c)}
          onDelete={(id) => remove.mutate(id)}
          onExport={exportConversation}
        />
      </GlassPanel>

      <GlassPanel className="flex min-h-0 flex-col p-0" delay={0.06}>
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          <p className="min-w-0 truncate text-sm font-medium">{conversation?.title ?? "Chat"}</p>
          <div className="flex shrink-0 items-center gap-2">
            <Select value={model.id} onValueChange={(value) => setModel.mutate(value)}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="hidden xl:inline-flex"
              onClick={toggleContextPanel}
              aria-label="Toggle context panel"
            >
              <PanelRight className="size-4" />
            </Button>
          </div>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
          {messages.length === 0 && !isStreaming && (
            <div className="grid h-full place-items-center text-center">
              <div>
                <p className="font-display text-lg font-semibold">Start a conversation</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nexora remembers what matters across sessions.
                </p>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              initial={(profile?.name ?? "U").slice(0, 1)}
              onRemember={(text) => remember.mutate(text)}
              onDelete={(id) => removeMessage.mutate(id)}
            />
          ))}

          {isStreaming && <StreamingBubble text={streamBuffer} thinking={thinking} />}
        </div>

        <Composer
          value={draft}
          onChange={(value) => setDraft(conversationId, value)}
          onSend={() => void send()}
          onStop={() => abortRef.current?.abort()}
          streaming={isStreaming}
          attachments={attachments}
          uploading={uploading}
          onFiles={(files) => void handleFiles(files)}
          onRemoveAttachment={(path) =>
            setAttachments((prev) => prev.filter((a) => a.path !== path))
          }
        />
      </GlassPanel>

      <GlassPanel
        className={cn("hidden w-72 min-h-0 overflow-y-auto p-4 xl:block", !contextPanelOpen && "xl:hidden")}
        delay={0.12}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
          Session
        </p>
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <p className="font-medium">{model.label}</p>
            <p className="text-xs text-muted-foreground">{model.description}</p>
          </div>
          <div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Context</span>
              <span>
                {usedTokens.toLocaleString()} / {model.contextWindow.toLocaleString()}
              </span>
            </div>
            <Progress value={contextUsage} className="mt-1.5 h-1.5" />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Messages</span>
            <span>{messages.length}</span>
          </div>
        </div>

        <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
          Memory in play
        </p>
        <div className="mt-3 space-y-2">
          {(memoriesQuery.data ?? []).slice(0, 6).map((memory) => (
            <div key={memory.id} className="rounded-xl border border-border bg-surface/40 p-2.5">
              <p className="truncate text-xs font-medium">{memory.title}</p>
              <Badge variant="secondary" className="mt-1 text-[10px]">
                {memory.category}
              </Badge>
            </div>
          ))}
          {(memoriesQuery.data ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">No memories yet.</p>
          )}
        </div>
      </GlassPanel>
    </div>
  );
}

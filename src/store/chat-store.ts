import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_MODEL } from "@/lib/ai/models";

interface ChatState {
  /** Model used for new conversations. */
  model: string;
  setModel: (model: string) => void;

  /** Conversation id currently streaming, if any. */
  streamingId: string | null;
  /** Partial assistant text for the streaming conversation. */
  streamBuffer: string;
  /** True between send and the first token. */
  thinking: boolean;

  startStream: (conversationId: string) => void;
  appendDelta: (delta: string) => void;
  endStream: () => void;

  /** Per-conversation draft text, kept across navigation. */
  drafts: Record<string, string>;
  setDraft: (conversationId: string, value: string) => void;

  contextPanelOpen: boolean;
  toggleContextPanel: () => void;

  searchQuery: string;
  setSearchQuery: (value: string) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      model: DEFAULT_MODEL,
      setModel: (model) => set({ model }),

      streamingId: null,
      streamBuffer: "",
      thinking: false,

      startStream: (conversationId) =>
        set({ streamingId: conversationId, streamBuffer: "", thinking: true }),
      appendDelta: (delta) =>
        set((s) => ({ streamBuffer: s.streamBuffer + delta, thinking: false })),
      endStream: () => set({ streamingId: null, streamBuffer: "", thinking: false }),

      drafts: {},
      setDraft: (conversationId, value) =>
        set((s) => ({ drafts: { ...s.drafts, [conversationId]: value } })),

      contextPanelOpen: true,
      toggleContextPanel: () => set((s) => ({ contextPanelOpen: !s.contextPanelOpen })),

      searchQuery: "",
      setSearchQuery: (value) => set({ searchQuery: value }),
    }),
    {
      name: "nexora-chat",
      partialize: (state) => ({
        model: state.model,
        drafts: state.drafts,
        contextPanelOpen: state.contextPanelOpen,
      }),
    },
  ),
);

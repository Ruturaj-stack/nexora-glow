import { Link } from "@tanstack/react-router";
import { Pin, PinOff, Pencil, Trash2, Download, Plus, Search } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ConversationRecord } from "@/lib/conversations.functions";

interface Props {
  conversations: ConversationRecord[];
  activeId: string;
  onCreate: () => void;
  onRename: (id: string, title: string) => void;
  onTogglePin: (conversation: ConversationRecord) => void;
  onDelete: (id: string) => void;
  onExport: (conversation: ConversationRecord) => void;
}

export function ConversationList({
  conversations,
  activeId,
  onCreate,
  onRename,
  onTogglePin,
  onDelete,
  onExport,
}: Props) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const commit = (id: string) => {
    const next = draftTitle.trim();
    if (next) onRename(id, next);
    setEditingId(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 p-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats…"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <Button size="icon" className="size-9 shrink-0" onClick={onCreate} aria-label="New chat">
          <Plus className="size-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        {filtered.map((conversation) => (
          <div
            key={conversation.id}
            className={cn(
              "group relative rounded-xl transition-colors",
              conversation.id === activeId ? "bg-accent" : "hover:bg-accent/50",
            )}
          >
            {editingId === conversation.id ? (
              <input
                autoFocus
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onBlur={() => commit(conversation.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit(conversation.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="w-full rounded-xl bg-transparent px-3 py-2.5 text-sm outline-none ring-1 ring-primary/40"
              />
            ) : (
              <>
                <Link
                  to="/chat/$conversationId"
                  params={{ conversationId: conversation.id }}
                  className="block px-3 py-2.5 pr-20"
                >
                  <p className="truncate text-sm font-medium">
                    {conversation.pinned && <Pin className="mr-1 inline size-3 text-primary" />}
                    {conversation.title}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {new Date(conversation.lastMessageAt).toLocaleString()}
                  </p>
                </Link>
                <div className="absolute right-1.5 top-1.5 flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => onTogglePin(conversation)}
                    aria-label={conversation.pinned ? "Unpin chat" : "Pin chat"}
                  >
                    {conversation.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => {
                      setDraftTitle(conversation.title);
                      setEditingId(conversation.id);
                    }}
                    aria-label="Rename chat"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => onExport(conversation)}
                    aria-label="Export chat"
                  >
                    <Download className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => onDelete(conversation.id)}
                    aria-label="Delete chat"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">No conversations.</p>
        )}
      </div>
    </div>
  );
}

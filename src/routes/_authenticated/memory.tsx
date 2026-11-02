import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Brain, Loader2, Pin, PinOff, Plus, RefreshCcw, Search, Sparkles, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { GlassPanel } from "@/components/common/glass-panel";
import { StatCard } from "@/components/common/stat-card";
import {
  createMemory,
  deleteMemory,
  listMemories,
  MEMORY_CATEGORIES,
  updateMemory,
  type MemoryRecord,
} from "@/lib/memories.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/memory")({
  head: () => ({
    meta: [
      { title: "Memory — Nexora AI Workspace" },
      {
        name: "description",
        content: "Browse the long-term memory index that gives Nexora persistent context.",
      },
      { property: "og:title", content: "Memory — Nexora AI Workspace" },
      {
        property: "og:description",
        content: "Browse the long-term memory index that gives Nexora persistent context.",
      },
    ],
  }),
  component: MemoryPage,
});

function relative(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function NewMemoryDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string>("note");
  const [pending, setPending] = useState(false);

  const save = useMutation({
    mutationFn: async () =>
      (
        await createMemory({
          data: {
            title,
            content,
            category: category as (typeof MEMORY_CATEGORIES)[number],
            importance: 3,
            pinned: false,
            tags: [],
          },
        })
      ).data,
    onSuccess: () => {
      setOpen(false);
      setTitle("");
      setContent("");
      toast.success("Memory saved");
      onCreated();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="size-4" /> New memory
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New memory</DialogTitle>
          <DialogDescription>Store a durable fact, preference or note.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="memory-title">Title</Label>
            <Input
              id="memory-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Prefers TypeScript with strict mode"
              maxLength={140}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="memory-content">Details</Label>
            <Textarea
              id="memory-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Optional context Nexora will recall later…"
              maxLength={4000}
              className="min-h-24"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <div className="flex flex-wrap gap-1.5">
              {MEMORY_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    "rounded-lg border border-border px-2.5 py-1 text-xs capitalize transition-colors",
                    category === c && "border-primary/50 bg-primary/10 text-primary",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!title.trim() || pending} onClick={() => save.mutate()}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save memory
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemoryPage() {
  const [q, setQ] = useState("");
  const queryClient = useQueryClient();

  const memoriesQuery = useQuery({
    queryKey: ["memories"],
    queryFn: async () => (await listMemories()).data,
  });
  const all = memoriesQuery.data ?? [];

  const togglePin = useMutation({
    mutationFn: async (m: MemoryRecord) =>
      (await updateMemory({ data: { id: m.id, pinned: !m.pinned } })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["memories"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await deleteMemory({ data: { id } })).data,
    onSuccess: () => {
      toast.success("Memory deleted");
      void queryClient.invalidateQueries({ queryKey: ["memories"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filtered = all.filter((m) =>
    `${m.title} ${m.content} ${m.category} ${m.tags.join(" ")}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  const pinnedCount = all.filter((m) => m.pinned).length;
  const categories = new Set(all.map((m) => m.category));

  const refresh = () => memoriesQuery.refetch();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Memory"
        description="Long-term knowledge Nexora recalls across sessions."
        actions={<NewMemoryDialog onCreated={() => refresh()} />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Stored memories"
          value={memoriesQuery.isLoading ? "…" : String(all.length)}
          delta={
            memoriesQuery.error
              ? "Unavailable"
              : memoriesQuery.dataUpdatedAt
                ? "Kept in sync with your chats"
                : "Loading"
          }
          icon={Brain}
        />
        <StatCard label="Pinned" value={memoriesQuery.isLoading ? "…" : String(pinnedCount)} delta="Always in context" icon={Pin} delay={0.05} />
        <StatCard
          label="Categories"
          value={memoriesQuery.isLoading ? "…" : String(categories.size)}
          delta={memoriesQuery.error ? "Unavailable" : "Preference · project · style…"}
          icon={Sparkles}
          delay={0.1}
        />
      </div>

      <GlassPanel className="p-5" delay={0.15}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
          <h3 className="truncate font-display text-base font-semibold">
            {q ? "Matching entries" : pinnedCount > 0 ? "Pinned & recent" : "Recent entries"}
          </h3>
          <div className="flex items-center gap-2">
            {memoriesQuery.isFetching && (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
            )}
            <Button variant="ghost" size="icon" className="size-8" onClick={refresh} aria-label="Refresh memories">
              <RefreshCcw className="size-3.5" />
            </Button>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search memories…"
              className="h-9 w-full sm:w-64"
            />
          </div>
        </div>

        {memoriesQuery.error && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <span className="text-destructive">Memories couldn't load: {memoriesQuery.error.message}</span>
            <Button variant="outline" size="sm" onClick={refresh}>
              Retry
            </Button>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {filtered.map((m, i) => (
            <motion.div
              key={m.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-surface/40 p-3.5 transition-colors hover:border-primary/25 sm:flex"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                  {m.pinned && <Pin className="size-3 shrink-0 text-primary" />}
                  {m.title}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {m.content ? `${m.content.slice(0, 180)} · ` : ""}
                  {m.category} · {relative(m.updatedAt)}
                  {m.source === "auto" ? " · learned from chats" : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 sm:ml-auto">
                {m.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="hidden text-[10px] sm:inline-flex">
                    {t}
                  </Badge>
                ))}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => togglePin.mutate(m)}
                  disabled={togglePin.isPending}
                  aria-label={m.pinned ? "Unpin memory" : "Pin memory"}
                >
                  {m.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:text-destructive"
                  onClick={() => remove.mutate(m.id)}
                  disabled={remove.isPending}
                  aria-label="Delete memory"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </motion.div>
          ))}
          {memoriesQuery.data && filtered.length === 0 && (
            <div className="py-10 text-center">
              {q ? (
                <p className="text-sm text-muted-foreground">No memories match “{q}”.</p>
              ) : (
                <>
                  <Search className="mx-auto size-8 text-muted-foreground/50" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    No memories yet. Nexora learns as you chat, or add one manually.
                  </p>
                </>
              )}
            </div>
          )}
          {memoriesQuery.isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[68px] animate-pulse rounded-xl border border-border bg-surface/30"
              />
            ))}
        </div>
      </GlassPanel>
    </div>
  );
}

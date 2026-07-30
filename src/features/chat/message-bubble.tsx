import { motion } from "framer-motion";
import { Copy, Check, Brain, Trash2, FileText, ImageIcon } from "lucide-react";
import { useState } from "react";
import { AIOrb } from "@/features/orb/ai-orb";
import { MarkdownMessage } from "@/features/chat/markdown-message";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MessageRecord } from "@/lib/conversations.functions";
import { getAttachmentUrl } from "@/features/chat/chat-service";

interface Props {
  message: MessageRecord;
  initial?: string;
  onRemember?: (text: string) => void;
  onDelete?: (id: string) => void;
}

function AttachmentChip({ name, path, type }: { name: string; path: string; type: string }) {
  const open = async () => {
    const url = await getAttachmentUrl(path);
    if (url) window.open(url, "_blank", "noopener");
  };
  const Icon = type.startsWith("image/") ? ImageIcon : FileText;
  return (
    <button
      onClick={open}
      className="flex items-center gap-1.5 rounded-lg border border-border bg-surface/60 px-2 py-1 text-xs transition-colors hover:border-primary/40"
    >
      <Icon className="size-3.5 text-muted-foreground" />
      <span className="max-w-40 truncate">{name}</span>
    </button>
  );
}

export function MessageBubble({ message, initial = "U", onRemember, onDelete }: Props) {
  const [copied, setCopied] = useState(false);
  const isAssistant = message.role === "assistant";

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={cn("group flex gap-3", !isAssistant && "flex-row-reverse")}
    >
      {isAssistant ? (
        <AIOrb state="idle" size={36} className="mt-1 shrink-0" />
      ) : (
        <span className="mt-1 grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold uppercase">
          {initial}
        </span>
      )}

      <div className={cn("min-w-0 max-w-[min(80ch,84%)]", !isAssistant && "flex flex-col items-end")}>
        {message.attachments.length > 0 && (
          <div className={cn("mb-2 flex flex-wrap gap-1.5", !isAssistant && "justify-end")}>
            {message.attachments.map((a) => (
              <AttachmentChip key={a.path} name={a.name} path={a.path} type={a.type} />
            ))}
          </div>
        )}

        {isAssistant ? (
          <MarkdownMessage content={message.content} />
        ) : (
          <div className="whitespace-pre-wrap rounded-2xl border border-primary/25 bg-primary/10 px-4 py-2.5 text-sm leading-relaxed text-foreground">
            {message.content}
          </div>
        )}

        <div
          className={cn(
            "mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100",
            !isAssistant && "flex-row-reverse",
          )}
        >
          <Button variant="ghost" size="icon" className="size-7" onClick={copy} aria-label="Copy message">
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </Button>
          {onRemember && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => onRemember(message.content)}
              aria-label="Save to memory"
            >
              <Brain className="size-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => onDelete(message.id)}
              aria-label="Delete message"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function StreamingBubble({ text, thinking }: { text: string; thinking: boolean }) {
  return (
    <div className="flex gap-3">
      <AIOrb state={thinking ? "thinking" : "speaking"} size={36} className="mt-1 shrink-0" />
      <div className="min-w-0 max-w-[min(80ch,84%)]">
        {thinking ? (
          <div className="flex items-center gap-1.5 py-2">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="size-1.5 rounded-full bg-primary/70"
                animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
            <span className="ml-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Thinking
            </span>
          </div>
        ) : (
          <MarkdownMessage content={text} />
        )}
      </div>
    </div>
  );
}

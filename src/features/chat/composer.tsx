import { useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from "react";
import { ArrowUp, Paperclip, Square, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/lib/conversations.functions";

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  attachments: Attachment[];
  uploading: boolean;
  onFiles: (files: File[]) => void;
  onRemoveAttachment: (path: string) => void;
}

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  attachments,
  uploading,
  onFiles,
  onRemoveAttachment,
}: ComposerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!streaming) onSend();
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length) onFiles(files);
  };

  const handlePick = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length) onFiles(files);
    event.target.value = "";
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className="border-t border-border p-3"
    >
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <span
              key={a.path}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-surface/60 px-2 py-1 text-xs"
            >
              <span className="max-w-40 truncate">{a.name}</span>
              <button onClick={() => onRemoveAttachment(a.path)} aria-label={`Remove ${a.name}`}>
                <X className="size-3 text-muted-foreground hover:text-foreground" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div
        className={cn(
          "flex items-end gap-2 rounded-2xl border border-border bg-surface/50 p-2 transition-colors focus-within:border-primary/40",
          dragging && "border-primary/60 bg-primary/5",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept="image/*,.pdf,.txt,.md,.csv,.json"
          onChange={handlePick}
        />
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-label="Attach file"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
        </Button>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={dragging ? "Drop files to attach…" : "Ask Nexora anything…"}
          className="max-h-40 min-h-9 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
        />
        {streaming ? (
          <Button size="icon" variant="secondary" className="shrink-0" onClick={onStop} aria-label="Stop generating">
            <Square className="size-3.5" />
          </Button>
        ) : (
          <Button
            size="icon"
            className="shrink-0"
            onClick={onSend}
            disabled={!value.trim() && attachments.length === 0}
            aria-label="Send message"
          >
            <ArrowUp className="size-4" />
          </Button>
        )}
      </div>
      <p className="px-2 pt-2 text-[11px] text-muted-foreground">
        Enter to send · Shift + Enter for a new line · drag files anywhere to attach
      </p>
    </div>
  );
}

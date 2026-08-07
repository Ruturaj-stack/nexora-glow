import { useEffect, useMemo, useState } from "react";
import { Download, Search, Trash2 } from "lucide-react";
import {
  clearLogs,
  exportLogs,
  searchLogs,
  subscribeToLogs,
  type LogLevel,
  type LogRecord,
} from "@/lib/observability/logger";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VirtualList } from "@/components/common/virtual-list";
import { cn } from "@/lib/utils";

const LEVELS: (LogLevel | "all")[] = ["all", "debug", "info", "audit", "warn", "error"];

const tone: Record<LogLevel, string> = {
  debug: "text-muted-foreground",
  info: "text-primary",
  audit: "text-success",
  warn: "text-warning",
  error: "text-destructive",
};

/** Live view over the centralised logger, with search and NDJSON export. */
export function LogViewer() {
  const [records, setRecords] = useState<readonly LogRecord[]>([]);
  const [level, setLevel] = useState<LogLevel | "all">("all");
  const [text, setText] = useState("");

  useEffect(() => subscribeToLogs(setRecords), []);

  const filtered = useMemo(
    () => searchLogs({ level, text }, records).slice().reverse(),
    [records, level, text],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search logs"
            aria-label="Search logs"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by level">
          {LEVELS.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={level === option ? "secondary" : "ghost"}
              className="h-8 px-2 text-[11px] uppercase"
              onClick={() => setLevel(option)}
            >
              {option}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 text-xs"
          onClick={() => {
            const blob = new Blob([exportLogs(filtered)], { type: "application/x-ndjson" });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `nexora-logs-${Date.now()}.ndjson`;
            anchor.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download className="size-3.5" /> Export
        </Button>
        <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={clearLogs}>
          <Trash2 className="size-3.5" /> Clear
        </Button>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface/30 px-3 py-6 text-center text-xs text-muted-foreground">
          No log records match this filter.
        </p>
      ) : (
        <VirtualList
          items={filtered}
          itemHeight={28}
          height={280}
          className="rounded-xl border border-border bg-surface/30"
          getKey={(record) => record.id}
          renderItem={(record) => (
            <div className="grid grid-cols-[auto_auto_auto_minmax(0,1fr)] items-baseline gap-3 px-3 py-1.5 font-mono text-[11px] hover:bg-accent/40">
              <span className="text-muted-foreground/70">{record.time.slice(11, 19)}</span>
              <span className={cn("w-12 uppercase", tone[record.level])}>{record.level}</span>
              <span className="text-muted-foreground">[{record.scope}]</span>
              <span className="truncate">{record.message}</span>
            </div>
          )}
        />
      )}
    </div>
  );
}

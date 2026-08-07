import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportWorkspace, importWorkspace } from "@/lib/backup.functions";
import { toApiMessage } from "@/lib/api-response";
import { logger } from "@/lib/observability/logger";
import { APP_VERSION } from "@/config/version";

/**
 * Backup & restore: downloads a portable JSON document containing settings,
 * memories, conversations, workflows, devices and plugin configuration, and
 * restores one back into the account.
 */
export function BackupPanel() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const exporter = useMutation({
    mutationFn: async () => (await exportWorkspace()).data,
    onSuccess: (doc) => {
      const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `nexora-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      logger.audit("Workspace exported", {
        memories: doc.memories.length,
        conversations: doc.conversations.length,
      });
      toast.success("Backup downloaded");
    },
    onError: (error) => toast.error(toApiMessage(error, "Export failed")),
  });

  const importer = useMutation({
    mutationFn: async (file: File) => {
      const parsed = JSON.parse(await file.text());
      return (await importWorkspace({ data: parsed })).data;
    },
    onSuccess: (result) => {
      setSummary(
        `${result.memories} memories · ${result.workflows} workflows · ${result.devices} devices · ${result.plugins} plugins`,
      );
      logger.audit("Workspace imported", { ...result });
      toast.success("Backup restored");
    },
    onError: (error) => toast.error(toApiMessage(error, "That file is not a valid Nexora backup")),
  });

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Portable JSON backup (format v{APP_VERSION}). Imports are additive — nothing is deleted.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          disabled={exporter.isPending}
          onClick={() => exporter.mutate()}
        >
          {exporter.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
          Export workspace
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          disabled={importer.isPending}
          onClick={() => fileInput.current?.click()}
        >
          {importer.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          Import backup
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          className="sr-only"
          aria-label="Choose a Nexora backup file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) importer.mutate(file);
          }}
        />
      </div>
      {summary && <p className="text-xs text-success">Restored {summary}</p>}
    </div>
  );
}

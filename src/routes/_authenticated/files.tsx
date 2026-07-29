import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { FileText, FolderOpen, Upload } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { GlassPanel } from "@/components/common/glass-panel";
import { files } from "@/data/mock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/files")({
  head: () => ({
    meta: [
      { title: "Files — Nexora AI Workspace" },
      {
        name: "description",
        content: "Every document Nexora has indexed, with status and last-modified detail.",
      },
      { property: "og:title", content: "Files — Nexora AI Workspace" },
      {
        property: "og:description",
        content: "Every document Nexora has indexed, with status and last-modified detail.",
      },
    ],
  }),
  component: FilesPage,
});

function FilesPage() {
  const [q, setQ] = useState("");
  const filtered = files.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Files"
        description="Indexed documents available to the assistant's retrieval layer."
        actions={
          <Button size="sm" className="gap-2">
            <Upload className="size-4" /> Upload
          </Button>
        }
      />

      <GlassPanel className="p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
          <h3 className="flex min-w-0 items-center gap-2 truncate font-display text-base font-semibold">
            <FolderOpen className="size-4 shrink-0 text-primary" /> Workspace library
          </h3>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search files…"
            className="h-9 w-full sm:w-64"
          />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="py-2 text-left font-medium">Name</th>
                <th className="py-2 text-left font-medium">Kind</th>
                <th className="py-2 text-left font-medium">Size</th>
                <th className="py-2 text-left font-medium">Modified</th>
                <th className="py-2 text-right font-medium">Index</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => (
                <motion.tr
                  key={f.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="border-b border-border/60 transition-colors last:border-0 hover:bg-accent/40"
                >
                  <td className="py-3 pr-3">
                    <span className="flex items-center gap-2.5">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{f.name}</span>
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">{f.kind}</td>
                  <td className="py-3 pr-3 font-mono text-xs text-muted-foreground">{f.size}</td>
                  <td className="py-3 pr-3 text-muted-foreground">{f.modified}</td>
                  <td className="py-3 text-right">
                    <Badge
                      variant="secondary"
                      className={
                        f.indexed ? "bg-success/12 text-success" : "bg-muted text-muted-foreground"
                      }
                    >
                      {f.indexed ? "Indexed" : "Pending"}
                    </Badge>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No files match.</p>
          )}
        </div>
      </GlassPanel>
    </div>
  );
}

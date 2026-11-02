import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileSearch, FolderOpen, Info, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { GlassPanel } from "@/components/common/glass-panel";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/files")({
  head: () => ({
    meta: [
      { title: "Files — Nexora AI Workspace" },
      {
        name: "description",
        content: "Document library status for Nexora: what is available today and what is planned.",
      },
      { property: "og:title", content: "Files — Nexora AI Workspace" },
      {
        property: "og:description",
        content: "Document library status for your Nexora workspace.",
      },
    ],
  }),
  component: FilesPage,
});

function FilesPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Files"
        description="Documents available to the assistant's retrieval layer."
      />

      <GlassPanel className="p-8 text-center sm:p-12">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/12">
          <FileSearch className="size-7 text-primary" />
        </div>
        <h2 className="mt-5 font-display text-lg font-semibold">Document indexing isn't connected yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Nexora can't browse or search a file library today — there's no document store or retrieval
          index behind this page yet, so we won't show one that doesn't exist.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button variant="outline" className="gap-2" onClick={() => navigate({ to: "/chat" })}>
            <MessageSquare className="size-4 text-primary" />
            Share a file in Chat
          </Button>
        </div>
      </GlassPanel>

      <GlassPanel className="p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Info className="size-4" />
          </span>
          <div className="min-w-0 text-sm">
            <p className="font-medium">What works today</p>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
              <li>
                <span className="inline-flex items-center gap-1.5">
                  <FolderOpen className="size-3.5 shrink-0" />
                  <span>
                    Files attached in a chat conversation are uploaded, stored with that conversation and
                    readable by the assistant there.
                  </span>
                </span>
              </li>
              <li className="text-muted-foreground/80">
                A cross-conversation document library with indexing and search needs a document-store
                backend that isn't built yet.
              </li>
            </ul>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}

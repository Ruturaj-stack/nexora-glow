import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Play, Search, ShieldCheck, Wrench } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { GlassPanel } from "@/components/common/glass-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listTools } from "@/features/tools/registry";
import { executeTool } from "@/features/tools/tool-manager";
import { PERMISSION_SCOPES, SCOPE_LABELS, type PermissionDecision } from "@/features/tools/types";
import { useToolStore } from "@/store/tool-store";
import { usePermissionSync, useBridgeStatus } from "@/features/tools/use-tools";
import {
  clearToolExecutions,
  listToolExecutions,
  resetToolPermissions,
  setToolPermission,
} from "@/lib/tools.functions";

export const Route = createFileRoute("/_authenticated/tools")({
  head: () => ({
    meta: [
      { title: "Tools — Nexora Execution Engine" },
      {
        name: "description",
        content:
          "Browse Nexora's tool registry, manage per-scope permissions and audit every executed action.",
      },
      { property: "og:title", content: "Tools — Nexora Execution Engine" },
      {
        property: "og:description",
        content: "Registry, permissions and audit log for Nexora's computer control engine.",
      },
    ],
  }),
  component: ToolsPage,
});

function ToolsPage() {
  const tools = listTools();
  const [query, setQuery] = useState("");
  const permissions = useToolStore((s) => s.permissions);
  const setLocalPermission = useToolStore((s) => s.setPermission);
  const resetLocal = useToolStore((s) => s.resetPermissions);
  const bridge = useBridgeStatus();
  usePermissionSync();
  const queryClient = useQueryClient();

  const history = useQuery({
    queryKey: ["tool-executions"],
    queryFn: () => listToolExecutions(),
  });

  const savePermission = useMutation({
    mutationFn: (input: { scope: string; decision: PermissionDecision }) =>
      setToolPermission({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tool-permissions"] }),
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter((t) =>
      `${t.name} ${t.title} ${t.description} ${t.category}`.toLowerCase().includes(q),
    );
  }, [tools, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tools"
        description="Every action Nexora can take, the permissions behind it, and a full audit trail."
      />

      <Tabs defaultValue="registry" className="space-y-4">
        <TabsList>
          <TabsTrigger value="registry">Registry</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="registry" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tools…"
              className="h-10 pl-9"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((tool, index) => {
              const needsBridge = tool.runtime === "bridge" && !bridge?.connected;
              return (
                <GlassPanel key={tool.name} className="p-4" delay={index * 0.02}>
                  <div className="flex items-start gap-2">
                    <Wrench className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{tool.title}</p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {tool.name}
                      </p>
                    </div>
                    {tool.danger && (
                      <Badge variant="destructive" className="ml-auto shrink-0 text-[10px]">
                        Sensitive
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{tool.description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {tool.scopes.map((scope) => (
                      <Badge key={scope} variant="secondary" className="text-[10px]">
                        {SCOPE_LABELS[scope]}
                      </Badge>
                    ))}
                    <Badge variant="outline" className="text-[10px]">
                      {tool.runtime}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto h-7 px-2 text-[11px]"
                      disabled={needsBridge}
                      onClick={() => void executeTool(tool.name, {}, { source: "registry" })}
                    >
                      <Play className="mr-1 size-3" />
                      {needsBridge ? "Bridge offline" : "Run"}
                    </Button>
                  </div>
                </GlassPanel>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="permissions">
          <GlassPanel className="p-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-4 text-primary" />
              <h3 className="font-display text-base font-semibold">Permission scopes</h3>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => {
                  resetLocal();
                  void resetToolPermissions();
                }}
              >
                Reset all
              </Button>
            </div>
            <ul className="mt-4 space-y-2">
              {PERMISSION_SCOPES.map((scope) => (
                <li
                  key={scope}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface/40 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{SCOPE_LABELS[scope]}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Tools that touch {scope}
                    </p>
                  </div>
                  <Select
                    value={permissions[scope] ?? "ask"}
                    onValueChange={(value) => {
                      const decision = value as PermissionDecision;
                      setLocalPermission(scope, decision);
                      savePermission.mutate({ scope, decision });
                    }}
                  >
                    <SelectTrigger className="ml-auto h-9 w-36 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ask">Ask every time</SelectItem>
                      <SelectItem value="always">Always allow</SelectItem>
                      <SelectItem value="denied">Deny</SelectItem>
                    </SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Sensitive tools always prompt, even when their scope is set to always allow.
            </p>
          </GlassPanel>
        </TabsContent>

        <TabsContent value="audit">
          <GlassPanel className="p-5">
            <div className="flex items-center gap-3">
              <History className="size-4 text-primary" />
              <h3 className="font-display text-base font-semibold">Execution history</h3>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={async () => {
                  await clearToolExecutions();
                  await history.refetch();
                }}
              >
                Clear log
              </Button>
            </div>

            {(history.data?.data ?? []).length === 0 ? (
              <p className="mt-4 text-xs text-muted-foreground">No tools have been run yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-border/60">
                {(history.data?.data ?? []).map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
                    <Badge
                      variant={
                        row.status === "success"
                          ? "secondary"
                          : row.status === "cancelled"
                            ? "outline"
                            : "destructive"
                      }
                      className="text-[10px]"
                    >
                      {row.status}
                    </Badge>
                    <span className="truncate font-mono text-xs">{row.tool}</span>
                    <span className="text-[11px] text-muted-foreground">{row.source}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                      {row.durationMs}ms · {new Date(row.createdAt).toLocaleString()}
                    </span>
                    {row.error && (
                      <p className="w-full text-[11px] text-destructive">{row.error}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </GlassPanel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity,
  Clock,
  Loader2,
  Pencil,
  Play,
  Plus,
  Search,
  Square,
  Trash2,
  Workflow as WorkflowIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { GlassPanel } from "@/components/common/glass-panel";
import { StatCard } from "@/components/common/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkflowStore } from "@/store/workflow-store";
import { WorkflowBuilder, type BuilderSubmit } from "@/features/agent/ui/workflow-builder";
import { RunTimeline } from "@/features/agent/ui/run-timeline";
import { cancelWorkflowRun, runWorkflow } from "@/features/agent/workflow-executor";
import { startScheduler, stopScheduler } from "@/features/agent/trigger-scheduler";
import { TRIGGER_LABELS, type Workflow } from "@/features/agent/types";
import {
  clearWorkflowExecutions,
  deleteWorkflow,
  listWorkflowExecutions,
  listWorkflows,
  saveWorkflow,
  setWorkflowEnabled,
} from "@/lib/workflows.functions";

export const Route = createFileRoute("/_authenticated/automation")({
  head: () => ({
    meta: [
      { title: "Automation — Nexora Agent & Workflow Engine" },
      {
        name: "description",
        content:
          "Plan, schedule and run multi-step Nexora workflows with conditions, retries and full run history.",
      },
      { property: "og:title", content: "Automation — Nexora Agent & Workflow Engine" },
      {
        property: "og:description",
        content: "Design triggers and flows that let Nexora act on your behalf automatically.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AutomationPage,
});

function AutomationPage() {
  const queryClient = useQueryClient();
  const workflows = useWorkflowStore((s) => s.workflows);
  const setWorkflows = useWorkflowStore((s) => s.setWorkflows);
  const executions = useWorkflowStore((s) => s.executions);
  const setExecutions = useWorkflowStore((s) => s.setExecutions);
  const activeRunIds = useWorkflowStore((s) => s.activeRunIds);
  const search = useWorkflowStore((s) => s.search);
  const setSearch = useWorkflowStore((s) => s.setSearch);
  const builderOpen = useWorkflowStore((s) => s.builderOpen);
  const setBuilderOpen = useWorkflowStore((s) => s.setBuilderOpen);
  const [editing, setEditing] = useState<Workflow | null>(null);

  const list = useQuery({
    queryKey: ["workflows"],
    queryFn: async () => {
      const response = await listWorkflows();
      setWorkflows(response.data);
      return response.data;
    },
  });

  const history = useQuery({
    queryKey: ["workflow-executions"],
    queryFn: async () => {
      const response = await listWorkflowExecutions();
      setExecutions(response.data);
      return response.data;
    },
  });

  useEffect(() => {
    startScheduler();
    return () => stopScheduler();
  }, []);

  const save = useMutation({
    mutationFn: (payload: BuilderSubmit) => saveWorkflow({ data: payload }),
    onSuccess: async (response) => {
      toast.success(response.message ?? "Workflow saved");
      setBuilderOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
    onError: (error: Error) => toast.error("Could not save", { description: error.message }),
  });

  const toggle = useMutation({
    mutationFn: (workflow: Workflow) =>
      setWorkflowEnabled({ data: { id: workflow.id, enabled: !workflow.enabled } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflows"] }),
  });

  const remove = useMutation({
    mutationFn: (workflow: Workflow) => deleteWorkflow({ data: { id: workflow.id } }),
    onSuccess: async () => {
      toast.success("Workflow deleted");
      await queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });

  const clearRuns = useMutation({
    mutationFn: () => clearWorkflowExecutions(),
    onSuccess: async () => {
      setExecutions([]);
      await queryClient.invalidateQueries({ queryKey: ["workflow-executions"] });
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return workflows;
    return workflows.filter(
      (workflow) =>
        workflow.name.toLowerCase().includes(term) ||
        workflow.description.toLowerCase().includes(term) ||
        workflow.category.toLowerCase().includes(term),
    );
  }, [workflows, search]);

  const totalRuns = workflows.reduce((sum, workflow) => sum + workflow.runs, 0);
  const totalFailures = workflows.reduce((sum, workflow) => sum + workflow.failures, 0);
  const successRate = totalRuns ? Math.round(((totalRuns - totalFailures) / totalRuns) * 100) : 100;

  const run = async (workflow: Workflow) => {
    const result = await runWorkflow(workflow, { trigger: "manual" });
    if (result.status === "success") toast.success(`${workflow.name} finished`);
    else if (result.status === "error") toast.error(`${workflow.name} failed`, { description: result.error ?? "" });
    await queryClient.invalidateQueries({ queryKey: ["workflows"] });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automation"
        description="Agentic workflows: plan them in words, run them through the tool engine."
        actions={
          <Button
            size="sm"
            className="gap-2"
            onClick={() => {
              setEditing(null);
              setBuilderOpen(true);
            }}
          >
            <Plus className="size-4" /> New workflow
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Workflows" value={String(workflows.length)} icon={WorkflowIcon} />
        <StatCard label="Total runs" value={String(totalRuns)} icon={Play} />
        <StatCard label="Success rate" value={`${successRate}%`} icon={Activity} />
        <StatCard label="Active now" value={String(activeRunIds.length)} icon={Clock} />
      </div>

      <Tabs defaultValue="flows" className="space-y-4">
        <TabsList>
          <TabsTrigger value="flows">Workflows</TabsTrigger>
          <TabsTrigger value="runs">Run history</TabsTrigger>
        </TabsList>

        <TabsContent value="flows" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search workflows"
              className="pl-9"
            />
          </div>

          {list.isLoading ? (
            <GlassPanel className="grid place-items-center p-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </GlassPanel>
          ) : filtered.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {filtered.map((workflow, index) => {
                const running = executions.some(
                  (execution) =>
                    execution.workflowId === workflow.id && execution.status === "running",
                );
                const liveRun = executions.find(
                  (execution) =>
                    execution.workflowId === workflow.id && execution.status === "running",
                );
                return (
                  <motion.div
                    key={workflow.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
                    className="glass hover-lift rounded-2xl p-5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-medium">{workflow.name}</h3>
                          <Badge variant="secondary" className="text-[10px] capitalize">
                            {workflow.category}
                          </Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {workflow.description || "No description"}
                        </p>
                      </div>
                      <Switch
                        checked={workflow.enabled}
                        onCheckedChange={() => toggle.mutate(workflow)}
                        aria-label={`Enable ${workflow.name}`}
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="text-[10px]">
                        {workflow.graph.nodes.length} steps
                      </Badge>
                      {workflow.triggers.length ? (
                        workflow.triggers.map((trigger) => (
                          <Badge key={trigger.id} variant="outline" className="text-[10px]">
                            {TRIGGER_LABELS[trigger.type]}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Manual run
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {workflow.runs} runs · {workflow.failures} failed
                      </Badge>
                    </div>

                    {liveRun && (
                      <div className="mt-4 rounded-xl border border-border/60 bg-card/40 p-3">
                        <RunTimeline execution={liveRun} />
                      </div>
                    )}

                    <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-4">
                      {running && liveRun ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => cancelWorkflowRun(liveRun.id)}
                        >
                          <Square className="size-3.5" /> Stop
                        </Button>
                      ) : (
                        <Button size="sm" className="gap-1.5" onClick={() => run(workflow)}>
                          <Play className="size-3.5" /> Run
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => {
                          setEditing(workflow);
                          setBuilderOpen(true);
                        }}
                      >
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto gap-1.5 text-destructive"
                        onClick={() => remove.mutate(workflow)}
                      >
                        <Trash2 className="size-3.5" /> Delete
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <GlassPanel className="p-10 text-center">
              <WorkflowIcon className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No workflows yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Describe what you want automated and Nexora will draft the steps for you.
              </p>
              <Button
                className="mt-4 gap-2"
                onClick={() => {
                  setEditing(null);
                  setBuilderOpen(true);
                }}
              >
                <Plus className="size-4" /> Create your first workflow
              </Button>
            </GlassPanel>
          )}
        </TabsContent>

        <TabsContent value="runs" className="space-y-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => clearRuns.mutate()}
              disabled={!executions.length}
            >
              Clear history
            </Button>
          </div>
          {history.isLoading ? (
            <GlassPanel className="grid place-items-center p-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </GlassPanel>
          ) : executions.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {executions.map((execution) => (
                <GlassPanel key={execution.id} className="p-5">
                  <RunTimeline execution={execution} />
                </GlassPanel>
              ))}
            </div>
          ) : (
            <GlassPanel className="p-10 text-center text-sm text-muted-foreground">
              No runs recorded yet.
            </GlassPanel>
          )}
        </TabsContent>
      </Tabs>

      <WorkflowBuilder
        open={builderOpen}
        initial={editing}
        saving={save.isPending}
        onClose={() => {
          setBuilderOpen(false);
          setEditing(null);
        }}
        onSave={(payload) => save.mutate(payload)}
      />
    </div>
  );
}

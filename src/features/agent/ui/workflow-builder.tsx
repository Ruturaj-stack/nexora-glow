import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDown,
  Bot,
  Clock,
  GitBranch,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toolManifest } from "@/features/tools/registry";
import { planWorkflow } from "@/lib/agent.functions";
import {
  CONDITION_LABELS,
  CONDITION_TYPES,
  PLANNED_TRIGGERS,
  TRIGGER_LABELS,
  TRIGGER_TYPES,
  workflowGraphSchema,
  type ConditionType,
  type NodeKind,
  type TriggerType,
  type Workflow,
  type WorkflowNode,
} from "../types";
import { WORKFLOW_TEMPLATES } from "../templates";

/**
 * WorkflowBuilder — a linear, form-driven graph editor.
 *
 * Every step is a typed node; parameters are plain JSON. Nothing is executed
 * here: the builder only produces a graph that the schema must accept.
 */

export interface BuilderValue {
  id?: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  nodes: WorkflowNode[];
  rollbackOnFailure: boolean;
  trigger: TriggerType;
  triggerAt: string;
  triggerEveryMinutes: number;
  triggerThreshold: number;
  triggerTopic: string;
  triggerDeviceId: string;
}

const EMPTY: BuilderValue = {
  name: "",
  description: "",
  category: "general",
  enabled: true,
  nodes: [],
  rollbackOnFailure: false,
  trigger: "manual",
  triggerAt: "08:00",
  triggerEveryMinutes: 60,
  triggerThreshold: 20,
  triggerTopic: "",
  triggerDeviceId: "",
};

const KIND_ICON: Record<NodeKind, typeof Zap> = {
  action: Zap,
  condition: GitBranch,
  parallel: GitBranch,
  delay: Clock,
  ai: Bot,
};

let counter = 0;
const nextId = (kind: string) => `${kind}-${Date.now().toString(36)}-${(counter += 1)}`;

function newNode(kind: NodeKind, tool: string): WorkflowNode {
  switch (kind) {
    case "condition":
      return {
        id: nextId("cond"),
        label: "Check a condition",
        kind: "condition",
        condition: { type: "always", target: "", operator: "gt", value: "" },
      };
    case "delay":
      return { id: nextId("delay"), label: "Wait", kind: "delay", ms: 5000 };
    case "ai":
      return {
        id: nextId("ai"),
        label: "Ask the assistant",
        kind: "ai",
        prompt: "Summarise the workflow context in one sentence.",
        assignTo: "aiResult",
        timeoutMs: 60_000,
      };
    default:
      return {
        id: nextId("action"),
        label: "Run a tool",
        kind: "action",
        tool,
        params: {},
        assignTo: "",
        retries: 0,
        timeoutMs: 30_000,
        continueOnError: false,
      };
  }
}

export function workflowToValue(workflow: Workflow): BuilderValue {
  const trigger = workflow.triggers[0];
  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    category: workflow.category,
    enabled: workflow.enabled,
    nodes: workflow.graph.nodes,
    rollbackOnFailure: workflow.graph.rollbackOnFailure,
    trigger: trigger?.type ?? "manual",
    triggerAt: trigger?.config.at || "08:00",
    triggerEveryMinutes: trigger?.config.everyMinutes ?? 60,
    triggerThreshold: trigger?.config.threshold ?? 20,
    triggerTopic: trigger?.config.topic ?? "",
    triggerDeviceId: trigger?.config.deviceId ?? "",
  };
}

export interface BuilderSubmit {
  id?: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  graph: ReturnType<typeof workflowGraphSchema.parse>;
  variables: Record<string, never>;
  templateId: string;
  triggers: { type: TriggerType; config: Record<string, unknown>; enabled: boolean }[];
}

export function WorkflowBuilder({
  open,
  initial,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  initial?: Workflow | null;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: BuilderSubmit) => void;
}) {
  const tools = useMemo(() => toolManifest(), []);
  const [value, setValue] = useState<BuilderValue>(EMPTY);
  const [prompt, setPrompt] = useState("");
  const [planning, setPlanning] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(initial ? workflowToValue(initial) : { ...EMPTY });
    setPrompt("");
  }, [open, initial]);

  const patch = (next: Partial<BuilderValue>) => setValue((v) => ({ ...v, ...next }));
  const patchNode = (index: number, next: Partial<WorkflowNode>) =>
    setValue((v) => ({
      ...v,
      nodes: v.nodes.map((node, i) => (i === index ? ({ ...node, ...next } as WorkflowNode) : node)),
    }));

  const addNode = (kind: NodeKind) =>
    patch({ nodes: [...value.nodes, newNode(kind, tools[0]?.name ?? "notifications.show")] });

  const applyTemplate = (templateId: string) => {
    const template = WORKFLOW_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    const config = (template.trigger.config ?? {}) as Record<string, number | string>;
    patch({
      name: template.name,
      description: template.description,
      category: template.category,
      nodes: template.graph.nodes,
      rollbackOnFailure: template.graph.rollbackOnFailure,
      trigger: template.trigger.type,
      triggerAt: String(config["at"] ?? "08:00"),
      triggerEveryMinutes: Number(config["everyMinutes"] ?? 60),
      triggerThreshold: Number(config["threshold"] ?? 20),
    });
    toast.success(`${template.name} loaded`);
  };

  const generate = async () => {
    if (prompt.trim().length < 4) return;
    setPlanning(true);
    try {
      const response = await planWorkflow({ data: { prompt: prompt.trim() } });
      const plan = response.data;
      patch({
        name: plan.name,
        description: plan.description,
        category: plan.category,
        nodes: plan.graph.nodes,
        rollbackOnFailure: plan.graph.rollbackOnFailure,
      });
      toast.success("Plan generated", { description: `${plan.graph.nodes.length} steps` });
    } catch (error) {
      toast.error("Could not plan that", {
        description: error instanceof Error ? error.message : "The planner failed",
      });
    } finally {
      setPlanning(false);
    }
  };

  const submit = () => {
    if (!value.name.trim()) {
      toast.error("Give the workflow a name");
      return;
    }
    const graph = workflowGraphSchema.safeParse({
      nodes: value.nodes,
      edges: [],
      rollbackOnFailure: value.rollbackOnFailure,
      timeoutMs: 300_000,
    });
    if (!graph.success) {
      toast.error("The workflow has invalid steps", {
        description: graph.error.issues[0]?.message,
      });
      return;
    }
    onSave({
      id: value.id,
      name: value.name.trim(),
      description: value.description.trim(),
      category: value.category,
      enabled: value.enabled,
      graph: graph.data,
      variables: {},
      templateId: "",
      triggers:
        value.trigger === "manual"
          ? []
          : [
              {
                type: value.trigger,
                config: {
                  at: value.triggerAt,
                  everyMinutes: value.triggerEveryMinutes,
                  threshold: value.triggerThreshold,
                  topic: value.triggerTopic,
                  deviceId: value.triggerDeviceId,
                },
                enabled: true,
              },
            ],
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="glass max-h-[92vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-6 py-4">
          <DialogTitle className="font-display">
            {value.id ? "Edit workflow" : "New workflow"}
          </DialogTitle>
          <DialogDescription>
            Steps run top to bottom. Every action is dispatched through the tool engine, so
            permissions still apply.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[64vh]">
          <div className="space-y-6 px-6 py-5">
            <div className="rounded-xl border border-border/60 bg-primary/5 p-4">
              <Label className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Sparkles className="size-3.5" /> Describe it and let Nexora plan
              </Label>
              <div className="mt-2 flex gap-2">
                <Input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Every weekday at 8am, brief me and dim the lights"
                />
                <Button onClick={generate} disabled={planning} className="gap-2">
                  {planning ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  Plan
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {WORKFLOW_TEMPLATES.map((template) => (
                  <Button
                    key={template.id}
                    size="sm"
                    variant="outline"
                    onClick={() => applyTemplate(template.id)}
                  >
                    {template.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="wf-name">Name</Label>
                <Input
                  id="wf-name"
                  value={value.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="Morning briefing"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wf-category">Category</Label>
                <Input
                  id="wf-category"
                  value={value.category}
                  onChange={(e) => patch({ category: e.target.value })}
                  placeholder="productivity"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="wf-desc">Description</Label>
                <Textarea
                  id="wf-desc"
                  rows={2}
                  value={value.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  placeholder="What this workflow does and when it should run."
                />
              </div>
            </div>

            <div className="rounded-xl border border-border/60 p-4">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Trigger</Label>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <Select
                  value={value.trigger}
                  onValueChange={(next) => patch({ trigger: next as TriggerType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map((type) => (
                      <SelectItem key={type} value={type} disabled={PLANNED_TRIGGERS.includes(type)}>
                        {TRIGGER_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {(value.trigger === "time" || value.trigger === "date") && (
                  <Input
                    value={value.triggerAt}
                    onChange={(e) => patch({ triggerAt: e.target.value })}
                    placeholder={value.trigger === "time" ? "08:00" : "2026-01-01T09:00"}
                  />
                )}
                {value.trigger === "recurring" && (
                  <Input
                    type="number"
                    min={1}
                    value={value.triggerEveryMinutes}
                    onChange={(e) => patch({ triggerEveryMinutes: Number(e.target.value) })}
                    placeholder="Every N minutes"
                  />
                )}
                {value.trigger === "battery.level" && (
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={value.triggerThreshold}
                    onChange={(e) => patch({ triggerThreshold: Number(e.target.value) })}
                    placeholder="Below %"
                  />
                )}
                {value.trigger === "mqtt.message" && (
                  <Input
                    value={value.triggerTopic}
                    onChange={(e) => patch({ triggerTopic: e.target.value })}
                    placeholder="home/sensors/#"
                  />
                )}
                {(value.trigger === "device.connected" || value.trigger === "homeassistant.event") && (
                  <Input
                    value={value.triggerDeviceId}
                    onChange={(e) => patch({ triggerDeviceId: e.target.value })}
                    placeholder="Device id"
                  />
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Steps ({value.nodes.length})
                </Label>
                <div className="flex flex-wrap gap-2">
                  {(["action", "condition", "delay", "ai"] as NodeKind[]).map((kind) => (
                    <Button key={kind} size="sm" variant="outline" onClick={() => addNode(kind)} className="gap-1.5">
                      <Plus className="size-3.5" /> {kind}
                    </Button>
                  ))}
                </div>
              </div>

              <AnimatePresence initial={false}>
                {value.nodes.map((node, index) => {
                  const Icon = KIND_ICON[node.kind];
                  return (
                    <motion.div
                      key={node.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="rounded-xl border border-border/60 bg-card/40 p-4"
                    >
                      <div className="flex items-center gap-2">
                        <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="size-3.5" />
                        </span>
                        <Input
                          value={node.label}
                          onChange={(e) => patchNode(index, { label: e.target.value })}
                          className="h-8 flex-1"
                        />
                        <Badge variant="secondary" className="capitalize">
                          {node.kind}
                        </Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            patch({ nodes: value.nodes.filter((_, i) => i !== index) })
                          }
                          aria-label="Remove step"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {node.kind === "action" && (
                          <>
                            <Select
                              value={node.tool}
                              onValueChange={(tool) => patchNode(index, { tool } as Partial<WorkflowNode>)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="max-h-72">
                                {tools.map((tool) => (
                                  <SelectItem key={tool.name} value={tool.name}>
                                    {tool.title}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              value={node.assignTo}
                              onChange={(e) =>
                                patchNode(index, { assignTo: e.target.value } as Partial<WorkflowNode>)
                              }
                              placeholder="Save result as variable"
                            />
                            <Textarea
                              rows={2}
                              className="sm:col-span-2 font-mono text-xs"
                              value={JSON.stringify(node.params)}
                              onChange={(e) => {
                                try {
                                  const params = JSON.parse(e.target.value || "{}");
                                  patchNode(index, { params } as Partial<WorkflowNode>);
                                } catch {
                                  // Keep the last valid value until the JSON parses.
                                }
                              }}
                            />
                          </>
                        )}

                        {node.kind === "condition" && (
                          <>
                            <Select
                              value={node.condition.type}
                              onValueChange={(type) =>
                                patchNode(index, {
                                  condition: { ...node.condition, type: type as ConditionType },
                                } as Partial<WorkflowNode>)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CONDITION_TYPES.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {CONDITION_LABELS[type]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              value={node.condition.value}
                              onChange={(e) =>
                                patchNode(index, {
                                  condition: { ...node.condition, value: e.target.value },
                                } as Partial<WorkflowNode>)
                              }
                              placeholder="Value"
                            />
                            <Input
                              value={node.condition.target}
                              onChange={(e) =>
                                patchNode(index, {
                                  condition: { ...node.condition, target: e.target.value },
                                } as Partial<WorkflowNode>)
                              }
                              placeholder="Target (device, entity or variable)"
                            />
                            <Input
                              value={node.whenTrue ?? ""}
                              onChange={(e) =>
                                patchNode(index, { whenTrue: e.target.value } as Partial<WorkflowNode>)
                              }
                              placeholder="Go to step id when true"
                            />
                          </>
                        )}

                        {node.kind === "delay" && (
                          <Input
                            type="number"
                            min={100}
                            value={node.ms}
                            onChange={(e) =>
                              patchNode(index, { ms: Number(e.target.value) } as Partial<WorkflowNode>)
                            }
                            placeholder="Milliseconds"
                          />
                        )}

                        {node.kind === "ai" && (
                          <>
                            <Textarea
                              rows={2}
                              className="sm:col-span-2"
                              value={node.prompt}
                              onChange={(e) =>
                                patchNode(index, { prompt: e.target.value } as Partial<WorkflowNode>)
                              }
                            />
                            <Input
                              value={node.assignTo}
                              onChange={(e) =>
                                patchNode(index, { assignTo: e.target.value } as Partial<WorkflowNode>)
                              }
                              placeholder="Save answer as variable"
                            />
                          </>
                        )}
                      </div>

                      {index < value.nodes.length - 1 && (
                        <div className="mt-3 flex justify-center text-muted-foreground">
                          <ArrowDown className="size-4" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {!value.nodes.length && (
                <p className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                  No steps yet — add one, load a template, or describe the automation above.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
              <div>
                <p className="text-sm font-medium">Roll back on failure</p>
                <p className="text-xs text-muted-foreground">
                  Undo completed steps that declare a compensating action.
                </p>
              </div>
              <Switch
                checked={value.rollbackOnFailure}
                onCheckedChange={(rollbackOnFailure) => patch({ rollbackOnFailure })}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="border-t border-border/60 px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving} className="gap-2">
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

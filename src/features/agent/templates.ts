import { workflowGraphSchema, type TriggerType, type WorkflowGraph } from "./types";

/**
 * Starter templates — realistic, ready-to-run graphs the user can drop into the
 * builder. They only reference core tools, so a template is always runnable.
 */

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  trigger: { type: TriggerType; config?: Record<string, unknown> };
  graph: WorkflowGraph;
}

const graph = (nodes: unknown[], extra: Partial<WorkflowGraph> = {}): WorkflowGraph =>
  workflowGraphSchema.parse({ nodes, edges: [], ...extra });

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "morning-briefing",
    name: "Morning briefing",
    description: "Every weekday morning, ask Nexora for a short briefing and show it as a notification.",
    category: "productivity",
    trigger: { type: "time", config: { at: "08:00", days: [1, 2, 3, 4, 5] } },
    graph: graph([
      {
        id: "weekday",
        label: "Only on weekdays",
        kind: "condition",
        condition: { type: "weekday", target: "", operator: "eq", value: "monday,tuesday,wednesday,thursday,friday" },
        whenTrue: "brief",
      },
      {
        id: "brief",
        label: "Write the briefing",
        kind: "ai",
        prompt: "Write a three-line morning briefing: focus for today, one reminder, one encouragement.",
        assignTo: "briefing",
      },
      {
        id: "notify",
        label: "Show the briefing",
        kind: "action",
        tool: "notifications.show",
        params: { title: "Morning briefing", body: "{{briefing}}" },
      },
    ]),
  },
  {
    id: "focus-block",
    name: "Focus block",
    description: "Dim the screen, mute distractions and announce a 50 minute deep-work block.",
    category: "productivity",
    trigger: { type: "manual" },
    graph: graph([
      { id: "dim", label: "Dim the display", kind: "action", tool: "brightness.set", params: { level: 40 } },
      {
        id: "announce",
        label: "Announce focus mode",
        kind: "action",
        tool: "notifications.show",
        params: { title: "Focus mode", body: "Deep work for the next 50 minutes." },
      },
      { id: "wait", label: "Wait 50 minutes", kind: "delay", ms: 600_000 },
      {
        id: "done",
        label: "Session complete",
        kind: "action",
        tool: "notifications.show",
        params: { title: "Focus complete", body: "Time for a break." },
      },
    ]),
  },
  {
    id: "battery-guard",
    name: "Battery guard",
    description: "When a device drops below 20%, warn you and dim the display to save power.",
    category: "system",
    trigger: { type: "battery.level", config: { threshold: 20 } },
    graph: graph([
      {
        id: "check",
        label: "Battery below 20%",
        kind: "condition",
        condition: { type: "battery", target: "", operator: "lt", value: "20" },
        whenTrue: "warn",
      },
      {
        id: "warn",
        label: "Warn about the battery",
        kind: "action",
        tool: "notifications.show",
        params: { title: "Battery low", body: "Under 20% remaining — plug in soon." },
      },
      { id: "save", label: "Reduce brightness", kind: "action", tool: "brightness.set", params: { level: 30 } },
    ]),
  },
  {
    id: "system-snapshot",
    name: "Hourly system snapshot",
    description: "Collect telemetry every hour and keep a copy on the clipboard.",
    category: "system",
    trigger: { type: "recurring", config: { everyMinutes: 60 } },
    graph: graph([
      {
        id: "read",
        label: "Read system telemetry",
        kind: "action",
        tool: "system.info",
        params: {},
        assignTo: "telemetry",
      },
      {
        id: "copy",
        label: "Copy the snapshot",
        kind: "action",
        tool: "clipboard.write",
        params: { text: "Nexora snapshot: {{telemetry}}" },
      },
    ]),
  },
  {
    id: "goodnight",
    name: "Goodnight scene",
    description: "Turn off the lights through Home Assistant and confirm the house is settled.",
    category: "smart-home",
    trigger: { type: "time", config: { at: "23:00" } },
    graph: graph(
      [
        {
          id: "internet",
          label: "Only when online",
          kind: "condition",
          condition: { type: "internet", target: "", operator: "eq", value: "true" },
          whenTrue: "lights",
        },
        {
          id: "lights",
          label: "Lights off",
          kind: "action",
          tool: "homeassistant.service",
          params: { deviceId: "", domain: "light", service: "turn_off" },
          continueOnError: true,
        },
        {
          id: "confirm",
          label: "Confirm goodnight",
          kind: "action",
          tool: "notifications.show",
          params: { title: "Goodnight", body: "Lights are off and the house is settled." },
        },
      ],
      { rollbackOnFailure: false },
    ),
  },
];

export function findTemplate(id: string) {
  return WORKFLOW_TEMPLATES.find((template) => template.id === id);
}

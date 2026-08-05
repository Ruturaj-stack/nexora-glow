import { z } from "zod";
import { bridgeCall } from "./bridge";
import {
  captureScreen,
  collectSystemSnapshot,
  copyImageToClipboard,
  downloadDataUrl,
  openUrl,
  readClipboardText,
  showNotification,
  writeClipboardText,
} from "./services";
import { useToolStore } from "@/store/tool-store";
import type { ToolDefinition } from "./types";

/**
 * The single source of truth for everything the assistant is allowed to do.
 * Nothing executes outside this registry — the AI can only name a tool, never
 * run a command.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/** A registry entry with its concrete input type erased. */
export type AnyTool = ToolDefinition<any, unknown>;

const empty = z.object({}).default({});

function bridgeTool(
  def: Omit<AnyTool, "execute" | "runtime"> & { bridgeName?: string },
): AnyTool {
  return {
    ...def,
    runtime: "bridge",
    execute: (input: Record<string, unknown>, ctx) => {
      ctx.log(`Dispatching to desktop bridge → ${def.bridgeName ?? def.name}`);
      return bridgeCall(def.bridgeName ?? def.name, input, ctx.signal);
    },
  };
}

const pathSchema = z.object({ path: z.string().trim().min(1).max(512) });

export const TOOLS: AnyTool[] = [
  // ── Clipboard ──────────────────────────────────────────────────────────
  {
    name: "clipboard.write",
    title: "Copy to clipboard",
    description: "Places text on the system clipboard.",
    category: "clipboard",
    scopes: ["clipboard"],
    runtime: "browser",
    schema: z.object({ text: z.string().min(1).max(20000) }),
    execute: ({ text }) => writeClipboardText(text),
  },
  {
    name: "clipboard.read",
    title: "Read clipboard",
    description: "Reads the current clipboard text.",
    category: "clipboard",
    scopes: ["clipboard"],
    runtime: "browser",
    danger: true,
    schema: empty,
    execute: () => readClipboardText(),
  },
  {
    name: "clipboard.clear",
    title: "Clear clipboard",
    description: "Overwrites the clipboard with an empty string.",
    category: "clipboard",
    scopes: ["clipboard"],
    runtime: "browser",
    schema: empty,
    execute: () => writeClipboardText(" "),
  },

  // ── Notifications & browser ────────────────────────────────────────────
  {
    name: "notifications.show",
    title: "Show notification",
    description: "Displays a desktop notification.",
    category: "notifications",
    scopes: ["notifications"],
    runtime: "browser",
    schema: z.object({ title: z.string().min(1).max(120), body: z.string().max(400).default("") }),
    execute: ({ title, body }) => showNotification(title, body),
  },
  {
    name: "browser.open",
    title: "Open URL",
    description: "Opens an http(s) address in a new tab.",
    category: "browser",
    scopes: ["network"],
    runtime: "browser",
    schema: z.object({ url: z.string().min(1).max(2000), newTab: z.boolean().default(true) }),
    execute: ({ url, newTab }) => Promise.resolve(openUrl(url, newTab)),
  },
  {
    name: "browser.search",
    title: "Web search",
    description: "Opens a web search for the given query.",
    category: "browser",
    scopes: ["network"],
    runtime: "browser",
    schema: z.object({ query: z.string().min(1).max(300) }),
    execute: ({ query }) =>
      Promise.resolve(openUrl(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`)),
  },

  // ── System telemetry & desktop capture ─────────────────────────────────
  {
    name: "system.info",
    title: "System telemetry",
    description: "Reads platform, memory, storage, battery and network metrics.",
    category: "system",
    scopes: ["system"],
    runtime: "browser",
    schema: empty,
    execute: async (_input, ctx) => {
      ctx.log("Sampling main thread, storage and battery…");
      const snapshot = await collectSystemSnapshot();
      useToolStore.getState().setSnapshot(snapshot);
      return snapshot;
    },
  },
  {
    name: "desktop.screenshot",
    title: "Capture screen",
    description: "Captures a screen or window you pick, then stores it in history.",
    category: "desktop",
    scopes: ["desktop"],
    runtime: "browser",
    danger: true,
    timeoutMs: 120000,
    schema: z.object({
      copyToClipboard: z.boolean().default(false),
      download: z.boolean().default(false),
    }),
    execute: async ({ copyToClipboard, download }, ctx) => {
      ctx.log("Waiting for the capture source you choose…");
      const shot = await captureScreen();
      const filename = `nexora-${Date.now()}.png`;
      useToolStore.getState().addScreenshot({ ...shot, id: filename, filename });
      if (copyToClipboard) {
        ctx.log("Copying image to clipboard…");
        await copyImageToClipboard(shot.dataUrl);
      }
      if (download) downloadDataUrl(shot.dataUrl, filename);
      return { filename, width: shot.width, height: shot.height, copied: copyToClipboard };
    },
  },

  // ── Applications (bridge) ──────────────────────────────────────────────
  bridgeTool({
    name: "applications.list",
    title: "List applications",
    description: "Lists installed or running applications on the machine.",
    category: "applications",
    scopes: ["applications"],
    schema: empty,
  }),
  bridgeTool({
    name: "applications.open",
    title: "Open application",
    description: "Launches an application by name.",
    category: "applications",
    scopes: ["applications"],
    schema: z.object({ app: z.string().trim().min(1).max(120) }),
  }),
  bridgeTool({
    name: "applications.close",
    title: "Close application",
    description: "Requests an application to quit.",
    category: "applications",
    scopes: ["applications"],
    danger: true,
    schema: z.object({ app: z.string().trim().min(1).max(120) }),
  }),

  // ── Files & folders (bridge) ───────────────────────────────────────────
  bridgeTool({
    name: "folders.list",
    title: "List folder",
    description: "Lists the entries of a directory.",
    category: "folders",
    scopes: ["filesystem"],
    schema: pathSchema,
  }),
  bridgeTool({
    name: "folders.create",
    title: "Create folder",
    description: "Creates a new directory.",
    category: "folders",
    scopes: ["filesystem"],
    schema: pathSchema,
  }),
  bridgeTool({
    name: "files.read",
    title: "Read file",
    description: "Reads a UTF-8 text file.",
    category: "files",
    scopes: ["filesystem"],
    danger: true,
    schema: pathSchema,
  }),
  bridgeTool({
    name: "files.write",
    title: "Write file",
    description: "Creates or overwrites a text file.",
    category: "files",
    scopes: ["filesystem"],
    danger: true,
    schema: z.object({ path: z.string().min(1).max(512), content: z.string().max(200000) }),
  }),
  bridgeTool({
    name: "files.move",
    title: "Move file",
    description: "Moves or renames a file.",
    category: "files",
    scopes: ["filesystem"],
    danger: true,
    schema: z.object({ from: z.string().min(1).max(512), to: z.string().min(1).max(512) }),
  }),
  bridgeTool({
    name: "files.delete",
    title: "Delete file",
    description: "Moves a file to the trash.",
    category: "files",
    scopes: ["filesystem"],
    danger: true,
    schema: pathSchema,
  }),
  bridgeTool({
    name: "files.search",
    title: "Search files",
    description: "Finds files matching a query beneath a folder.",
    category: "files",
    scopes: ["filesystem"],
    schema: z.object({
      path: z.string().min(1).max(512),
      query: z.string().min(1).max(200),
    }),
  }),

  // ── Windows (bridge) ───────────────────────────────────────────────────
  bridgeTool({
    name: "windows.list",
    title: "List windows",
    description: "Lists open windows across the desktop.",
    category: "windows",
    scopes: ["windows"],
    schema: empty,
  }),
  bridgeTool({
    name: "windows.focus",
    title: "Focus window",
    description: "Brings a window to the foreground.",
    category: "windows",
    scopes: ["windows"],
    schema: z.object({ id: z.string().min(1).max(120) }),
  }),
  bridgeTool({
    name: "windows.minimize",
    title: "Minimise window",
    description: "Minimises a window.",
    category: "windows",
    scopes: ["windows"],
    schema: z.object({ id: z.string().min(1).max(120) }),
  }),
  bridgeTool({
    name: "windows.maximize",
    title: "Maximise window",
    description: "Maximises a window.",
    category: "windows",
    scopes: ["windows"],
    schema: z.object({ id: z.string().min(1).max(120) }),
  }),

  // ── Processes, volume, brightness (bridge) ─────────────────────────────
  bridgeTool({
    name: "system.processes",
    title: "List processes",
    description: "Lists running processes with CPU and memory usage.",
    category: "system",
    scopes: ["system"],
    schema: empty,
  }),
  bridgeTool({
    name: "system.metrics",
    title: "Hardware metrics",
    description: "Reads real CPU, RAM, disk and network counters from the machine.",
    category: "system",
    scopes: ["system"],
    schema: empty,
  }),
  bridgeTool({
    name: "volume.set",
    title: "Set volume",
    description: "Sets the system output volume (0–100).",
    category: "volume",
    scopes: ["system"],
    schema: z.object({ level: z.number().min(0).max(100) }),
  }),
  bridgeTool({
    name: "volume.mute",
    title: "Mute audio",
    description: "Mutes or unmutes system audio.",
    category: "volume",
    scopes: ["system"],
    schema: z.object({ muted: z.boolean().default(true) }),
  }),
  bridgeTool({
    name: "brightness.set",
    title: "Set brightness",
    description: "Sets display brightness (0–100).",
    category: "brightness",
    scopes: ["system"],
    schema: z.object({ level: z.number().min(0).max(100) }),
  }),
  // ── Devices ────────────────────────────────────────────────────────────
  {
    name: "devices.action",
    title: "Run device action",
    description:
      "Runs a capability action on a paired device (lights, plugs, ESP32 GPIO, phone, hub).",
    category: "devices",
    scopes: ["devices"],
    runtime: "browser",
    danger: true,
    timeoutMs: 30000,
    schema: z.object({
      deviceId: z.string().uuid(),
      actionId: z.string().min(1).max(60),
      input: z.record(z.string(), z.any()).default({}),
    }),
    execute: async ({ deviceId, actionId, input }, ctx) => {
      const { dispatchDeviceAction } = await import("@/features/devices/device-manager");
      ctx.log(`Dispatching ${actionId} to device ${deviceId}`);
      const outcome = await dispatchDeviceAction(deviceId, actionId, input, "tools", ctx.signal);
      outcome.logs.forEach(ctx.log);
      return outcome.result;
    },
  },
  {
    name: "devices.status",
    title: "Read device status",
    description: "Probes a paired device for battery, signal, firmware and sensor state.",
    category: "devices",
    scopes: ["devices"],
    runtime: "browser",
    timeoutMs: 20000,
    schema: z.object({ deviceId: z.string().uuid() }),
    execute: async ({ deviceId }, ctx) => {
      const { probeDevice } = await import("@/features/devices/device-manager");
      ctx.log("Probing device…");
      return probeDevice(deviceId);
    },
  },
  {
    name: "mqtt.publish",
    title: "Publish MQTT message",
    description: "Publishes a payload to a topic on the connected MQTT broker.",
    category: "devices",
    scopes: ["devices", "network"],
    runtime: "browser",
    danger: true,
    schema: z.object({
      deviceId: z.string().uuid(),
      topic: z.string().min(1).max(200),
      payload: z.string().max(4000).default(""),
      qos: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(0),
      retain: z.boolean().default(false),
    }),
    execute: async ({ deviceId, topic, payload, qos, retain }, ctx) => {
      const { ensureBrokerConnection } = await import("@/features/devices/connectors/mqtt");
      const { mqttPublish } = await import("@/features/devices/mqtt-manager");
      await ensureBrokerConnection(deviceId);
      ctx.log(`Publishing to ${topic}`);
      return mqttPublish(topic, payload, { qos, retain });
    },
  },
  {
    name: "homeassistant.service",
    title: "Call Home Assistant service",
    description: "Calls a service on a paired Home Assistant hub, e.g. light.turn_on.",
    category: "devices",
    scopes: ["devices", "network"],
    runtime: "browser",
    danger: true,
    timeoutMs: 30000,
    schema: z.object({
      deviceId: z.string().uuid(),
      domain: z.string().regex(/^[a-z_]{1,40}$/),
      service: z.string().regex(/^[a-z_]{1,60}$/),
      entityId: z.string().max(120).optional(),
      payload: z.record(z.string(), z.any()).default({}),
    }),
    execute: async (input, ctx) => {
      const { callHomeAssistantService } = await import("@/lib/devices.functions");
      ctx.log(`${input.domain}.${input.service}`);
      const response = await callHomeAssistantService({ data: input });
      return response.data;
    },
  },
];


const INDEX = new Map(TOOLS.map((t) => [t.name, t]));

/**
 * Tools contributed at runtime by installed plugins. They are kept in a
 * separate map so a plugin can never shadow or replace a core tool, and so
 * uninstalling a plugin removes its capabilities immediately.
 */
const DYNAMIC = new Map<string, AnyTool>();

export function registerDynamicTool(tool: AnyTool) {
  if (INDEX.has(tool.name)) {
    throw new Error(`"${tool.name}" is a core tool and cannot be overridden.`);
  }
  DYNAMIC.set(tool.name, tool);
}

export function unregisterDynamicTools(predicate: (tool: AnyTool) => boolean) {
  for (const [name, tool] of DYNAMIC) {
    if (predicate(tool)) DYNAMIC.delete(name);
  }
}

export function getTool(name: string) {
  return INDEX.get(name) ?? DYNAMIC.get(name);
}

export function listTools() {
  return [...TOOLS, ...DYNAMIC.values()];
}

/** Compact manifest handed to the AI so it can only reference real tools. */
export function toolManifest() {
  return listTools().map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    category: t.category,
    runtime: t.runtime,
    scopes: t.scopes,
    danger: Boolean(t.danger),
  }));
}


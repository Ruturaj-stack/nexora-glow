import { z } from "zod";
import { registerDynamicTool, unregisterDynamicTools } from "@/features/tools/registry";
import type { ToolDefinition } from "@/features/tools/types";
import { runPluginTool } from "./sandbox";
import { findManifest } from "./registry";
import { PluginError, type InstalledPlugin, type PluginManifest, type PluginTool } from "./types";

/**
 * PluginManager — turns installed manifests into live, permission-gated tools.
 *
 * Plugin tools are namespaced `plugin.<pluginId>.<tool>` and live in the
 * registry's dynamic map, so they can never shadow a core tool and vanish the
 * moment a plugin is disabled or removed.
 */

const PREFIX = "plugin.";

export function pluginToolName(pluginId: string, tool: string) {
  return `${PREFIX}${pluginId}.${tool}`;
}

function inputSchema(tool: PluginTool) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of tool.inputs) {
    let base: z.ZodTypeAny =
      field.type === "number"
        ? z.coerce.number()
        : field.type === "boolean"
          ? z.coerce.boolean()
          : z.string().max(4000);
    if (!field.required) base = base.optional();
    shape[field.name] = base;
  }
  return z.object(shape).passthrough();
}

function toToolDefinition(plugin: InstalledPlugin, tool: PluginTool): ToolDefinition {
  return {
    name: pluginToolName(plugin.pluginId, tool.name),
    title: `${plugin.name}: ${tool.title}`,
    description: tool.description,
    category: "system",
    scopes: tool.scopes,
    runtime: "browser",
    timeoutMs: 30_000,
    schema: inputSchema(tool) as unknown as ToolDefinition["schema"],
    execute: async (input, ctx) => {
      ctx.log(`Running ${plugin.name} → ${tool.title}`);
      const result = await runPluginTool(
        plugin,
        tool,
        (input ?? {}) as Record<string, unknown>,
        ctx.signal,
      );
      if (!result.ok) throw new PluginError(result.error ?? "The plugin action failed.");
      return result.output;
    },
  };
}

/** Rebuilds the dynamic tool surface from the currently installed plugins. */
export function syncPluginTools(plugins: InstalledPlugin[]) {
  unregisterDynamicTools((tool) => tool.name.startsWith(PREFIX));
  for (const plugin of plugins) {
    if (!plugin.enabled) continue;
    for (const tool of plugin.manifest.tools) {
      try {
        registerDynamicTool(toToolDefinition(plugin, tool));
      } catch {
        // A plugin that collides with a core tool is simply skipped.
      }
    }
  }
}

export function defaultSettings(manifest: PluginManifest): Record<string, string | number | boolean> {
  return Object.fromEntries(
    manifest.settings.map((field) => [field.name, field.defaultValue ?? (field.type === "boolean" ? false : "")]),
  );
}

/** Everything the user is asked to approve before an install. */
export function installSummary(manifest: PluginManifest) {
  return {
    permissions: manifest.permissions,
    hosts: manifest.allowedHosts,
    tools: manifest.tools.map((tool) => tool.title),
    coreTools: manifest.uses,
  };
}

export function manifestFor(pluginId: string): PluginManifest {
  const manifest = findManifest(pluginId);
  if (!manifest) throw new PluginError(`Unknown plugin "${pluginId}".`);
  return manifest;
}

export function pluginTools(plugin: InstalledPlugin) {
  return plugin.manifest.tools.map((tool) => ({
    ...tool,
    qualifiedName: pluginToolName(plugin.pluginId, tool.name),
  }));
}

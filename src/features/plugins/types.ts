import type { PermissionScope } from "@/features/tools/types";

/**
 * Plugin framework domain model.
 *
 * A plugin is pure declarative data — a manifest listing permissions plus
 * either HTTP calls to whitelisted hosts or chains of existing Nexora tools.
 * Plugins never ship executable code, so nothing can escape the sandbox.
 */

export type PluginSource = "official" | "community" | "local";

export type PluginCategory =
  | "productivity"
  | "smart-home"
  | "developer"
  | "media"
  | "information"
  | "utility";

export interface PluginInputField {
  name: string;
  label: string;
  type: "string" | "number" | "boolean";
  required?: boolean;
  placeholder?: string;
}

export interface PluginSettingField {
  name: string;
  label: string;
  type: "string" | "number" | "boolean";
  secret?: boolean;
  placeholder?: string;
  defaultValue?: string | number | boolean;
}

export type PluginJson = string | number | boolean | null | PluginJson[] | { [key: string]: PluginJson };

export interface PluginHttpAction {
  kind: "http";
  method: "GET" | "POST";
  /** May contain {{input.x}} and {{setting.y}} placeholders. */
  url: string;
  headers?: Record<string, string>;
  body?: Record<string, PluginJson>;
}

export interface PluginChainAction {
  kind: "chain";
  steps: { tool: string; params: Record<string, PluginJson> }[];
}

export type PluginActionSpec = PluginHttpAction | PluginChainAction;

export interface PluginTool {
  /** Suffix only — the runtime namespaces it as plugin.<pluginId>.<name>. */
  name: string;
  title: string;
  description: string;
  scopes: PermissionScope[];
  inputs: PluginInputField[];
  action: PluginActionSpec;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: PluginCategory;
  source: PluginSource;
  /** Everything the plugin may ever do; the user approves this list on install. */
  permissions: PermissionScope[];
  /** Hosts an http action is allowed to call. Empty means no network at all. */
  allowedHosts: string[];
  /** Core tools a chain action may invoke. */
  uses: string[];
  settings: PluginSettingField[];
  tools: PluginTool[];
  homepage?: string;
}

export interface InstalledPlugin {
  id: string;
  pluginId: string;
  name: string;
  version: string;
  source: PluginSource;
  enabled: boolean;
  permissions: string[];
  settings: Record<string, string | number | boolean>;
  manifest: PluginManifest;
  installedAt: string;
  updatedAt: string;
}

export class PluginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PluginError";
  }
}

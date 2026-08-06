import { executeTool } from "@/features/tools/tool-manager";
import { PluginError, type InstalledPlugin, type PluginTool } from "./types";

/**
 * PluginSandbox — the only place a plugin action is ever carried out.
 *
 * A plugin is data, not code: it may either call a whitelisted host over HTTP
 * or chain core tools that the user has already approved. There is no eval,
 * no dynamic import and no way to reach app internals.
 */

const TEMPLATE = /\{\{\s*([\w.]+)\s*\}\}/g;

type Scalar = string | number | boolean;

function resolveToken(
  token: string,
  input: Record<string, Scalar>,
  settings: Record<string, Scalar>,
): string {
  if (token === "now") return new Date().toISOString();
  const [scope, ...rest] = token.split(".");
  const key = rest.join(".");
  if (scope === "input") return String(input[key] ?? "");
  if (scope === "setting") return String(settings[key] ?? "");
  return "";
}

export function fill(
  value: unknown,
  input: Record<string, Scalar>,
  settings: Record<string, Scalar>,
): unknown {
  if (typeof value === "string") {
    return value.replace(TEMPLATE, (_m, token: string) => resolveToken(token, input, settings));
  }
  if (Array.isArray(value)) return value.map((item) => fill(item, input, settings));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, fill(v, input, settings)]),
    );
  }
  return value;
}

function assertHostAllowed(url: string, allowed: string[]) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new PluginError("The plugin produced an invalid URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new PluginError("Plugins may only call HTTPS endpoints.");
  }
  if (!allowed.includes(parsed.hostname)) {
    throw new PluginError(`"${parsed.hostname}" is not in this plugin's allowed hosts.`);
  }
}

export interface PluginRunResult {
  ok: boolean;
  output: unknown;
  error?: string;
}

export async function runPluginTool(
  plugin: InstalledPlugin,
  tool: PluginTool,
  rawInput: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<PluginRunResult> {
  if (!plugin.enabled) throw new PluginError(`${plugin.name} is disabled.`);

  const missing = tool.scopes.filter((scope) => !plugin.permissions.includes(scope));
  if (missing.length) {
    throw new PluginError(`${plugin.name} was not granted: ${missing.join(", ")}.`);
  }

  const input = Object.fromEntries(
    Object.entries(rawInput).map(([k, v]) => [k, (v ?? "") as Scalar]),
  ) as Record<string, Scalar>;
  const settings = plugin.settings as Record<string, Scalar>;

  if (tool.action.kind === "http") {
    const url = String(fill(tool.action.url, input, settings));
    assertHostAllowed(url, plugin.manifest.allowedHosts);

    const headers = (fill(tool.action.headers ?? {}, input, settings) ?? {}) as Record<string, string>;
    const body =
      tool.action.method === "POST" && tool.action.body
        ? JSON.stringify(fill(tool.action.body, input, settings))
        : undefined;

    const response = await fetch(url, {
      method: tool.action.method,
      headers: body ? { "Content-Type": "application/json", ...headers } : headers,
      body,
      signal,
    });
    const text = await response.text();
    let payload: unknown = text;
    try {
      payload = JSON.parse(text);
    } catch {
      // Plain-text responses are returned as-is.
    }
    if (!response.ok) {
      return { ok: false, output: payload, error: `Request failed (${response.status})` };
    }
    return { ok: true, output: payload };
  }

  const results: unknown[] = [];
  for (const step of tool.action.steps) {
    if (!plugin.manifest.uses.includes(step.tool)) {
      throw new PluginError(`${plugin.name} declared no access to "${step.tool}".`);
    }
    const params = (fill(step.params, input, settings) ?? {}) as Record<string, unknown>;
    const outcome = await executeTool(step.tool, params, {
      source: `plugin:${plugin.pluginId}`,
      silent: true,
    });
    results.push(outcome.execution.result ?? null);
    if (!outcome.ok) {
      return {
        ok: false,
        output: results,
        error: outcome.execution.error ?? `${step.tool} failed`,
      };
    }
  }

  return { ok: true, output: results.length === 1 ? results[0] : results };
}

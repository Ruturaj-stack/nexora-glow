import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ok, type ApiResponse } from "@/lib/api-response";
import { PLUGIN_CATALOGUE } from "@/features/plugins/registry";
import type { InstalledPlugin, PluginManifest, PluginSource } from "@/features/plugins/types";

/**
 * REST-equivalent server functions for the plugin framework:
 *   GET  /api/v1/plugins
 *   POST /api/v1/plugins/install | /settings | /enabled | /uninstall
 *
 * Manifests are never taken from the client: only a catalogue id is accepted,
 * and the trusted manifest is looked up server-side before it is stored.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

interface PluginRow {
  id: string;
  plugin_id: string;
  name: string;
  version: string;
  source: string;
  enabled: boolean;
  permissions: string[];
  settings: any;
  manifest: any;
  installed_at: string;
  updated_at: string;
}

const SELECT =
  "id, plugin_id, name, version, source, enabled, permissions, settings, manifest, installed_at, updated_at";

function toPlugin(row: PluginRow): InstalledPlugin {
  return {
    id: row.id,
    pluginId: row.plugin_id,
    name: row.name,
    version: row.version,
    source: row.source as PluginSource,
    enabled: row.enabled,
    permissions: row.permissions ?? [],
    settings: (row.settings ?? {}) as Record<string, string | number | boolean>,
    manifest: row.manifest as PluginManifest,
    installedAt: row.installed_at,
    updatedAt: row.updated_at,
  };
}

export const listPlugins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiResponse<InstalledPlugin[]>> => {
    const { data, error } = await context.supabase
      .from("plugins")
      .select(SELECT)
      .order("installed_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ok((data ?? []).map((row) => toPlugin(row as PluginRow)));
  });

export const installPlugin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ pluginId: z.string().trim().min(1).max(60) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ApiResponse<InstalledPlugin>> => {
    const manifest = PLUGIN_CATALOGUE.find((plugin) => plugin.id === data.pluginId);
    if (!manifest) throw new Error(`Unknown plugin "${data.pluginId}".`);

    const settings = Object.fromEntries(
      manifest.settings.map((field) => [
        field.name,
        field.defaultValue ?? (field.type === "boolean" ? false : ""),
      ]),
    );

    const { data: row, error } = await context.supabase
      .from("plugins")
      .upsert(
        {
          user_id: context.userId,
          plugin_id: manifest.id,
          name: manifest.name,
          version: manifest.version,
          source: manifest.source,
          enabled: true,
          permissions: manifest.permissions,
          settings: settings as any,
          manifest: manifest as any,
        },
        { onConflict: "user_id,plugin_id" },
      )
      .select(SELECT)
      .single();
    if (error) throw new Error(error.message);
    return ok(toPlugin(row as PluginRow), `${manifest.name} installed`);
  });

export const setPluginEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ApiResponse<null>> => {
    const { error } = await context.supabase
      .from("plugins")
      .update({ enabled: data.enabled })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return ok(null, data.enabled ? "Plugin enabled" : "Plugin disabled");
  });

export const updatePluginSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        settings: z.record(z.string(), z.union([z.string().max(500), z.number(), z.boolean()])),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ApiResponse<InstalledPlugin>> => {
    const { data: row, error } = await context.supabase
      .from("plugins")
      .update({ settings: data.settings as any })
      .eq("id", data.id)
      .select(SELECT)
      .single();
    if (error) throw new Error(error.message);
    return ok(toPlugin(row as PluginRow), "Settings saved");
  });

export const uninstallPlugin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ApiResponse<null>> => {
    const { error } = await context.supabase.from("plugins").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return ok(null, "Plugin removed");
  });

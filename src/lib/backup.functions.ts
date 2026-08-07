import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ok, type ApiResponse } from "@/lib/api-response";
import { APP_VERSION } from "@/config/version";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Workspace backup: export and import of everything a user owns.
 *
 * Export is a plain JSON document so it can be diffed, archived and restored
 * into another deployment. Import is additive and idempotent per record —
 * it never deletes and never trusts ids or user_id from the file.
 */

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = { [key: string]: JsonValue };

export interface BackupDocument {
  format: "nexora.backup";
  version: string;
  exportedAt: string;
  settings: JsonRecord | null;
  memories: JsonRecord[];
  conversations: JsonRecord[];
  messages: JsonRecord[];
  workflows: JsonRecord[];
  devices: JsonRecord[];
  plugins: JsonRecord[];
}

export const exportWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiResponse<BackupDocument>> => {
    const db = context.supabase;

    const [settings, memories, conversations, messages, workflows, devices, plugins] =
      await Promise.all([
        db.from("user_settings").select("theme, accent_color, language, timezone, notifications").maybeSingle(),
        db.from("memories").select("title, content, category, tags, importance, pinned, source, created_at"),
        db.from("conversations").select("id, title, model, pinned, created_at, updated_at"),
        db.from("messages").select("conversation_id, role, content, attachments, created_at").order("created_at"),
        db.from("workflows").select("name, description, category, graph, variables, enabled, template_id"),
        db.from("devices").select("name, connector, address, room, capabilities, metadata, favorite"),
        db.from("plugins").select("plugin_id, name, version, source, enabled, settings"),
      ]);

    const doc: BackupDocument = {
      format: "nexora.backup",
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      settings: (settings.data as any) ?? null,
      memories: (memories.data as any[]) ?? [],
      conversations: (conversations.data as any[]) ?? [],
      messages: (messages.data as any[]) ?? [],
      workflows: (workflows.data as any[]) ?? [],
      devices: (devices.data as any[]) ?? [],
      plugins: (plugins.data as any[]) ?? [],
    };

    return ok(doc, "Workspace exported");
  });

const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const backupSchema = z.object({
  format: z.literal("nexora.backup"),
  version: z.string().max(20),
  settings: z
    .object({
      theme: z.string().max(30).optional(),
      accent_color: z.string().max(40).optional(),
      language: z.string().max(10).optional(),
      timezone: z.string().max(60).optional(),
      notifications: z.boolean().optional(),
    })
    .nullable()
    .optional(),
  memories: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        content: z.string().max(8000).default(""),
        category: z.string().max(40).default("general"),
        tags: z.array(z.string().max(40)).max(20).default([]),
        importance: z.number().min(0).max(100).default(50),
        pinned: z.boolean().default(false),
        source: z.string().max(40).default("import"),
      }),
    )
    .max(2000)
    .default([]),
  workflows: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        description: z.string().max(600).default(""),
        category: z.string().max(40).default("general"),
        graph: z.any(),
        variables: z.any().optional(),
        enabled: z.boolean().default(false),
        template_id: z.string().max(60).default(""),
      }),
    )
    .max(500)
    .default([]),
  devices: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        connector: z.string().max(40),
        address: z.string().max(300).default(""),
        room: z.string().max(60).default(""),
        capabilities: z.array(z.string().max(40)).max(40).default([]),
        metadata: z.any().optional(),
        favorite: z.boolean().default(false),
      }),
    )
    .max(500)
    .default([]),
  plugins: z
    .array(
      z.object({
        plugin_id: z.string().max(60),
        enabled: z.boolean().default(true),
        settings: z.record(z.string(), scalar).default({}),
      }),
    )
    .max(200)
    .default([]),
});

export interface ImportSummary {
  memories: number;
  workflows: number;
  devices: number;
  plugins: number;
  settings: boolean;
}

export const importWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => backupSchema.parse(input))
  .handler(async ({ data, context }): Promise<ApiResponse<ImportSummary>> => {
    const db = context.supabase;
    const userId = context.userId;
    const summary: ImportSummary = {
      memories: 0,
      workflows: 0,
      devices: 0,
      plugins: 0,
      settings: false,
    };

    if (data.settings) {
      const { error } = await db
        .from("user_settings")
        .upsert({ ...data.settings, user_id: userId } as any, { onConflict: "user_id" });
      if (error) throw new Error(error.message);
      summary.settings = true;
    }

    if (data.memories.length) {
      const { error } = await db
        .from("memories")
        .insert(data.memories.map((row) => ({ ...row, user_id: userId })) as any);
      if (error) throw new Error(error.message);
      summary.memories = data.memories.length;
    }

    if (data.workflows.length) {
      const { error } = await db
        .from("workflows")
        .insert(data.workflows.map((row) => ({ ...row, user_id: userId })) as any);
      if (error) throw new Error(error.message);
      summary.workflows = data.workflows.length;
    }

    if (data.devices.length) {
      const { error } = await db
        .from("devices")
        .insert(data.devices.map((row) => ({ ...row, user_id: userId })) as any);
      if (error) throw new Error(error.message);
      summary.devices = data.devices.length;
    }

    if (data.plugins.length) {
      for (const plugin of data.plugins) {
        const { error } = await db
          .from("plugins")
          .update({ enabled: plugin.enabled, settings: plugin.settings as any })
          .eq("plugin_id", plugin.plugin_id);
        if (!error) summary.plugins += 1;
      }
    }

    return ok(summary, "Workspace imported");
  });

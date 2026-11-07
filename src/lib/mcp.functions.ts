import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ok, type ApiResponse } from "@/lib/api-response";
import type { McpToolInfo } from "@/lib/mcp-client.server";

/**
 * MCP API:
 *   GET  /api/v1/mcp/servers                 — list
 *   POST /api/v1/mcp/servers                 — add
 *   POST /api/v1/mcp/servers/:id/connect     — connect + discover tools
 *   POST /api/v1/mcp/servers/:id/disconnect
 *   POST /api/v1/mcp/servers/:id/remove
 *   POST /api/v1/mcp/tools/execute           — permission-checked execution
 *   POST /api/v1/mcp/permissions             — per-tool ask/always/denied
 */

export interface McpServerRecord {
  id: string;
  name: string;
  description: string;
  url: string;
  transport: string;
  hasAuth: boolean;
  authHeaderName: string;
  status: "disconnected" | "connected" | "error" | "needs_auth" | "config_required";
  lastError: string;
  tools: McpToolInfo[];
  lastConnectedAt: string | null;
  permissions: Record<string, "ask" | "always" | "denied">;
}

interface ServerRow {
  id: string;
  name: string;
  description: string;
  url: string;
  transport: string;
  auth_header_name: string;
  auth_token_encrypted: string;
  status: string;
  last_error: string;
  tools: McpToolInfo[];
  last_connected_at: string | null;
}

function toRecord(row: ServerRow, perms: Record<string, "ask" | "always" | "denied">): McpServerRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    url: row.url,
    transport: row.transport,
    hasAuth: Boolean(row.auth_token_encrypted),
    authHeaderName: row.auth_header_name,
    status: row.status as McpServerRecord["status"],
    lastError: row.last_error,
    tools: Array.isArray(row.tools) ? row.tools : [],
    lastConnectedAt: row.last_connected_at,
    permissions: perms,
  };
}

async function decryptAuth(row: ServerRow) {
  if (!row.auth_token_encrypted) return null;
  const { decryptCredentials } = await import("@/lib/devices/credentials.server");
  const value = decryptCredentials(row.auth_token_encrypted) as { token?: string };
  return { header: row.auth_header_name || "Authorization", token: value.token ?? "" };
}

/** Never return provider/library internals — they may echo headers. */
function redact(message: string): string {
  return message.replace(/(bearer|token|authorization)[^\s,]*\s*[:=]?\s*\S+/gi, "$1 [redacted]").slice(0, 300);
}

export const listMcpServers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiResponse<McpServerRecord[]>> => {
    const [{ data, error }, { data: perms }] = await Promise.all([
      context.supabase.from("mcp_servers").select("*").order("created_at", { ascending: true }),
      context.supabase.from("mcp_tool_permissions").select("server_id, tool_name, decision"),
    ]);
    if (error) throw new Error(error.message);
    return ok(
      (data ?? []).map((row) => {
        const map: Record<string, "ask" | "always" | "denied"> = {};
        for (const p of perms ?? []) {
          if (p.server_id === row.id) map[p.tool_name] = p.decision as "ask" | "always" | "denied";
        }
        return toRecord(row as unknown as ServerRow, map);
      }),
      "Servers",
    );
  });

export const addMcpServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(80),
        description: z.string().max(300).default(""),
        url: z.string().trim().url().max(500),
        authHeaderName: z.string().trim().max(60).regex(/^[A-Za-z0-9-]*$/).default(""),
        authToken: z.string().max(4000).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ApiResponse<{ id: string }>> => {
    const { assertSafeMcpUrl } = await import("@/lib/mcp-client.server");
    assertSafeMcpUrl(data.url);
    let encrypted = "";
    if (data.authToken) {
      const { encryptCredentials } = await import("@/lib/devices/credentials.server");
      encrypted = encryptCredentials({ token: data.authToken });
    }
    const { data: row, error } = await context.supabase
      .from("mcp_servers")
      .insert({
        user_id: context.userId,
        name: data.name,
        description: data.description,
        url: data.url,
        auth_header_name: data.authToken ? data.authHeaderName || "Authorization" : "",
        auth_token_encrypted: encrypted,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return ok({ id: row.id }, "Server added");
  });

export const connectMcpServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ApiResponse<{ status: string; toolCount: number; error?: string }>> => {
    const { data: row, error } = await context.supabase
      .from("mcp_servers").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Server not found");
    const { discoverServer } = await import("@/lib/mcp-client.server");
    try {
      const discovery = await discoverServer(row.url, await decryptAuth(row as unknown as ServerRow));
      await context.supabase
        .from("mcp_servers")
        .update({
          status: "connected",
          last_error: "",
          tools: discovery.tools as unknown as never,
          last_connected_at: new Date().toISOString(),
          description: row.description || discovery.serverName,
        })
        .eq("id", data.id);
      return ok({ status: "connected", toolCount: discovery.tools.length }, "Connected");
    } catch (err) {
      const message = redact(err instanceof Error ? err.message : "Connection failed");
      const status = /401|403|unauthori[sz]ed|forbidden/i.test(message) ? "needs_auth" : "error";
      await context.supabase
        .from("mcp_servers")
        .update({ status, last_error: message })
        .eq("id", data.id);
      return ok({ status, toolCount: 0, error: message }, "Connection failed");
    }
  });

export const disconnectMcpServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ApiResponse<null>> => {
    const { error } = await context.supabase
      .from("mcp_servers")
      .update({ status: "disconnected", tools: [] as unknown as never })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return ok(null, "Disconnected");
  });

export const removeMcpServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ApiResponse<null>> => {
    const { error } = await context.supabase.from("mcp_servers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return ok(null, "Removed");
  });

export const setMcpToolPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        serverId: z.string().uuid(),
        tool: z.string().min(1).max(120),
        decision: z.enum(["ask", "always", "denied"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ApiResponse<null>> => {
    const { error } = await context.supabase.from("mcp_tool_permissions").upsert(
      { user_id: context.userId, server_id: data.serverId, tool_name: data.tool, decision: data.decision },
      { onConflict: "user_id,server_id,tool_name" },
    );
    if (error) throw new Error(error.message);
    return ok(null, "Permission saved");
  });

/**
 * MCPExecutionEngine — the server-side half of the permission gate. Denied
 * tools never run; "ask" tools run only when the client passes the user's
 * explicit confirmation. Results are untrusted data and returned verbatim.
 */
export const executeMcpTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        serverId: z.string().uuid(),
        tool: z.string().min(1).max(120),
        args: z.record(z.string(), z.unknown()).default({}),
        confirmed: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ApiResponse<{ isError: boolean; text: string; structured: unknown }>> => {
    const [{ data: row }, { data: perm }] = await Promise.all([
      context.supabase.from("mcp_servers").select("*").eq("id", data.serverId).maybeSingle(),
      context.supabase
        .from("mcp_tool_permissions")
        .select("decision")
        .eq("server_id", data.serverId)
        .eq("tool_name", data.tool)
        .maybeSingle(),
    ]);
    if (!row) throw new Error("MCP server not found");
    if (row.status !== "connected") throw new Error("This MCP server is not connected. Reconnect it first.");
    const tools = (row.tools as unknown as McpToolInfo[]) ?? [];
    const tool = tools.find((t) => t.name === data.tool);
    if (!tool) throw new Error(`"${data.tool}" is not a discovered tool on this server.`);
    const decision = perm?.decision ?? "ask";
    if (decision === "denied") throw new Error("You have denied this MCP tool. Change it on the Services page.");
    if ((decision === "ask" || tool.destructive) && !data.confirmed) {
      throw new Error("This MCP tool needs your confirmation before it runs.");
    }

    const { callServerTool } = await import("@/lib/mcp-client.server");
    const started = Date.now();
    let result: { isError: boolean; text: string; structured: unknown };
    try {
      result = await callServerTool(row.url, await decryptAuth(row as unknown as ServerRow), data.tool, data.args);
    } catch (err) {
      const message = redact(err instanceof Error ? err.message : "MCP call failed");
      await context.supabase.from("tool_executions").insert({
        user_id: context.userId, tool: `mcp.${row.name}.${data.tool}`, category: "mcp",
        params: data.args as never, status: "error", error: message,
        duration_ms: Date.now() - started, permission: decision, runtime: "browser", source: "mcp",
      });
      throw new Error(message);
    }
    await context.supabase.from("tool_executions").insert({
      user_id: context.userId, tool: `mcp.${row.name}.${data.tool}`, category: "mcp",
      params: data.args as never, status: result.isError ? "error" : "success",
      result: { text: result.text.slice(0, 2000) } as never,
      duration_ms: Date.now() - started, permission: decision, runtime: "browser", source: "mcp",
    });
    return ok(result, result.isError ? "Tool reported an error" : "Done");
  });

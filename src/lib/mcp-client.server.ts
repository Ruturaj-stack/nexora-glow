import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * MCPClient / MCPConnectionManager — backend-mediated MCP over Streamable HTTP.
 * Every operation opens a short-lived session (workers are stateless), and
 * credentials are only ever decrypted here, never sent to the browser.
 */

export interface McpToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  readOnly: boolean;
  destructive: boolean;
}

export interface McpDiscovery {
  serverName: string;
  serverVersion: string;
  tools: McpToolInfo[];
  resources: { uri: string; name: string }[];
  prompts: { name: string; description: string }[];
}

/** Blocks private/loopback hosts so a user can't point the backend at internal services. */
export function assertSafeMcpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Enter a valid MCP server URL.");
  }
  if (url.protocol !== "https:") throw new Error("Remote MCP servers must use https.");
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.startsWith("[")
  ) {
    throw new Error("Private or local network addresses are not allowed for remote MCP servers.");
  }
  return url;
}

async function withClient<T>(
  url: string,
  auth: { header: string; token: string } | null,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const target = assertSafeMcpUrl(url);
  const headers: Record<string, string> = {};
  if (auth?.token) headers[auth.header || "Authorization"] = auth.token;
  const transport = new StreamableHTTPClientTransport(target, { requestInit: { headers } });
  const client = new Client({ name: "nexora", version: "1.0.0" });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close().catch(() => undefined);
  }
}

export async function discoverServer(
  url: string,
  auth: { header: string; token: string } | null,
): Promise<McpDiscovery> {
  return withClient(url, auth, async (client) => {
    const caps = client.getServerCapabilities() ?? {};
    const info = client.getServerVersion();
    const tools = caps.tools ? (await client.listTools()).tools : [];
    const resources = caps.resources
      ? (await client.listResources().catch(() => ({ resources: [] }))).resources
      : [];
    const prompts = caps.prompts
      ? (await client.listPrompts().catch(() => ({ prompts: [] }))).prompts
      : [];
    return {
      serverName: info?.name ?? "",
      serverVersion: info?.version ?? "",
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description ?? "",
        inputSchema: (t.inputSchema ?? {}) as Record<string, unknown>,
        readOnly: Boolean(t.annotations?.readOnlyHint),
        destructive: Boolean(t.annotations?.destructiveHint),
      })),
      resources: resources.map((r) => ({ uri: r.uri, name: r.name })),
      prompts: prompts.map((p) => ({ name: p.name, description: p.description ?? "" })),
    };
  });
}

export async function callServerTool(
  url: string,
  auth: { header: string; token: string } | null,
  name: string,
  args: Record<string, unknown>,
): Promise<{ isError: boolean; text: string; structured: unknown }> {
  return withClient(url, auth, async (client) => {
    const result = await client.callTool({ name, arguments: args });
    const content = Array.isArray(result.content) ? result.content : [];
    const text = content
      .map((c: { type: string; text?: string }) => (c.type === "text" ? (c.text ?? "") : `[${c.type}]`))
      .join("\n")
      .slice(0, 20_000);
    return { isError: Boolean(result.isError), text, structured: result.structuredContent ?? null };
  });
}

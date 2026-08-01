import { ToolError } from "./types";

/**
 * Client for the optional Nexora Desktop Bridge — a small local agent the user
 * runs on their own machine. The browser can never touch the OS directly, so
 * every OS-level tool is proxied through this loopback HTTP contract.
 *
 * Contract:
 *   GET  /health              -> { ok, version, platform, capabilities[] }
 *   POST /v1/execute          -> { tool, params } => { ok, data } | { ok:false, error }
 */

const URL_KEY = "nexora-bridge-url";
const TOKEN_KEY = "nexora-bridge-token";

export const DEFAULT_BRIDGE_URL = "http://127.0.0.1:8765";

export interface BridgeStatus {
  connected: boolean;
  version?: string;
  platform?: string;
  capabilities: string[];
  checkedAt: string;
  message?: string;
}

export function getBridgeUrl(): string {
  if (typeof window === "undefined") return DEFAULT_BRIDGE_URL;
  return window.localStorage.getItem(URL_KEY) || DEFAULT_BRIDGE_URL;
}

export function setBridgeUrl(url: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(URL_KEY, url.replace(/\/$/, ""));
}

export function getBridgeToken(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TOKEN_KEY) ?? "";
}

export function setBridgeToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

function headers(): HeadersInit {
  const token = getBridgeToken();
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function probeBridge(): Promise<BridgeStatus> {
  const checkedAt = new Date().toISOString();
  try {
    const response = await withTimeout(
      (signal) => fetch(`${getBridgeUrl()}/health`, { signal, headers: headers() }),
      1500,
    );
    if (!response.ok) {
      return { connected: false, capabilities: [], checkedAt, message: `HTTP ${response.status}` };
    }
    const data = (await response.json()) as {
      version?: string;
      platform?: string;
      capabilities?: string[];
    };
    return {
      connected: true,
      version: data.version,
      platform: data.platform,
      capabilities: data.capabilities ?? [],
      checkedAt,
    };
  } catch {
    return {
      connected: false,
      capabilities: [],
      checkedAt,
      message: "No local bridge agent is listening",
    };
  }
}

/** Invokes a tool on the local agent. Throws {@link ToolError} on any failure. */
export async function bridgeCall<T>(
  tool: string,
  params: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${getBridgeUrl()}/v1/execute`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ tool, params }),
      signal,
    });
  } catch {
    throw new ToolError(
      "BRIDGE_UNAVAILABLE",
      "The Nexora Desktop Bridge is not running. Start the local agent to allow operating-system actions.",
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new ToolError("PERMISSION_DENIED", "The desktop bridge rejected this token.");
  }
  if (response.status === 404) {
    throw new ToolError("NOT_SUPPORTED", `The bridge does not implement "${tool}".`);
  }

  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    data?: T;
    error?: string;
  } | null;

  if (!response.ok || !payload?.ok) {
    throw new ToolError("EXECUTION_FAILED", payload?.error ?? `Bridge error (${response.status})`);
  }
  return payload.data as T;
}

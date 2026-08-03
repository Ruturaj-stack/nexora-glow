import { DeviceError } from "./types";

/**
 * Shared fetch helper for connectors that talk to a device over HTTP
 * (ESP32 boards, Android companion app, generic smart plugs and TVs).
 * Every failure is normalised into a `DeviceError` the UI can explain.
 */

export function normaliseBaseUrl(address: string): string {
  const trimmed = address.trim().replace(/\/+$/, "");
  if (!trimmed) throw new DeviceError("INVALID_INPUT", "This device has no address configured.");
  if (!/^https?:\/\//i.test(trimmed)) return `http://${trimmed}`;
  return trimmed;
}

export interface DeviceHttpOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  path?: string;
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function deviceRequest<T = unknown>(
  address: string,
  options: DeviceHttpOptions = {},
): Promise<T> {
  const url = `${normaliseBaseUrl(address)}${options.path ?? ""}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
  options.signal?.addEventListener("abort", () => controller.abort(), { once: true });

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new DeviceError(
      "DEVICE_OFFLINE",
      `No response from ${url}. The device may be offline or on another network.`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401 || response.status === 403) {
    throw new DeviceError("AUTH_FAILED", "The device rejected Nexora's pairing token.");
  }
  if (!response.ok) {
    throw new DeviceError("NETWORK_ERROR", `${url} returned ${response.status}`);
  }

  const text = await response.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

/** Clamps a signal/battery reading coming from an untrusted device. */
export function clampPercent(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

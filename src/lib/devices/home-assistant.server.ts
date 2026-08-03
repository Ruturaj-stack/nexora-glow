import { DeviceError } from "@/features/devices/types";

/**
 * Thin Home Assistant REST client. Runs server-side only so the long-lived
 * access token never reaches the browser.
 */

export interface HaEntity {
  entityId: string;
  domain: string;
  name: string;
  state: string;
  attributes: Record<string, unknown>;
  lastChanged: string;
}

interface HaRawState {
  entity_id: string;
  state: string;
  attributes?: Record<string, unknown>;
  last_changed?: string;
}

function normaliseBase(url: string) {
  return url.replace(/\/+$/, "");
}

async function haFetch(baseUrl: string, token: string, path: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(`${normaliseBase(baseUrl)}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new DeviceError(
      "HOME_ASSISTANT_UNAVAILABLE",
      "Home Assistant did not respond. Check that the URL is reachable from the internet.",
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new DeviceError("AUTH_FAILED", "Home Assistant rejected the access token.");
  }
  if (!response.ok) {
    const body = await response.text();
    throw new DeviceError(
      "HOME_ASSISTANT_UNAVAILABLE",
      `Home Assistant returned ${response.status}: ${body.slice(0, 200)}`,
    );
  }
  return response;
}

export async function haListEntities(baseUrl: string, token: string): Promise<HaEntity[]> {
  const response = await haFetch(baseUrl, token, "/api/states");
  const raw = (await response.json()) as HaRawState[];
  return raw.map((s) => ({
    entityId: s.entity_id,
    domain: s.entity_id.split(".")[0] ?? "unknown",
    name: String(s.attributes?.["friendly_name"] ?? s.entity_id),
    state: s.state,
    attributes: s.attributes ?? {},
    lastChanged: s.last_changed ?? new Date().toISOString(),
  }));
}

export async function haCallService(
  baseUrl: string,
  token: string,
  domain: string,
  service: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const response = await haFetch(baseUrl, token, `/api/services/${domain}/${service}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.json().catch(() => null);
}

export async function haPing(baseUrl: string, token: string): Promise<string> {
  const response = await haFetch(baseUrl, token, "/api/config");
  const config = (await response.json()) as { version?: string };
  return config.version ?? "unknown";
}

import type {
  Capability,
  ConnectionType,
  DeviceEventRecord,
  DeviceHistoryRecord,
  DeviceRecord,
  DeviceStatus,
  DeviceType,
  PairingMethod,
  PairingRecord,
} from "@/features/devices/types";

/** Row → domain mappers shared by the device server functions. */

export const DEVICE_SELECT =
  "id, name, type, platform, connector, connection, status, battery, charging, signal, firmware, address, capabilities, state, metadata, favorite, device_group, revoked, last_seen_at, paired_at";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function toDevice(row: any): DeviceRecord {
  return {
    id: row.id,
    name: row.name,
    type: row.type as DeviceType,
    platform: row.platform ?? "",
    connector: row.connector,
    connection: row.connection as ConnectionType,
    status: row.status as DeviceStatus,
    battery: row.battery ?? null,
    charging: Boolean(row.charging),
    signal: row.signal ?? null,
    firmware: row.firmware ?? "",
    address: row.address ?? "",
    capabilities: (row.capabilities ?? []) as Capability[],
    state: (row.state ?? {}) as Record<string, unknown>,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    favorite: Boolean(row.favorite),
    group: row.device_group ?? "Ungrouped",
    revoked: Boolean(row.revoked),
    lastSeenAt: row.last_seen_at ?? null,
    pairedAt: row.paired_at,
  };
}

export function toEvent(row: any): DeviceEventRecord {
  return {
    id: row.id,
    deviceId: row.device_id ?? null,
    deviceName: row.device_name ?? "",
    type: row.type,
    level: row.level,
    message: row.message ?? "",
    payload: (row.payload ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

export function toHistory(row: any): DeviceHistoryRecord {
  return {
    id: row.id,
    deviceId: row.device_id ?? null,
    deviceName: row.device_name ?? "",
    action: row.action,
    status: row.status,
    detail: row.detail ?? "",
    durationMs: row.duration_ms ?? 0,
    source: row.source ?? "manual",
    createdAt: row.created_at,
  };
}

export function toPairing(row: any): PairingRecord {
  return {
    id: row.id,
    code: row.code,
    method: row.method as PairingMethod,
    name: row.name,
    type: row.type as DeviceType,
    connector: row.connector,
    status: row.status,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Six-character, human-readable pairing code (no ambiguous glyphs). */
export function generatePairingCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${out.slice(0, 3)}-${out.slice(3)}`;
}

import type { ZodType } from "zod";

/**
 * Device Connector Framework — shared contracts.
 *
 * Every integration (MQTT, Home Assistant, Android, ESP32, …) implements the
 * same `DeviceConnector` interface, so new platforms (HomeKit, Hue, Tesla, …)
 * can be added without touching the core.
 */

export const DEVICE_TYPES = [
  "mobile",
  "computer",
  "iot",
  "media",
  "lighting",
  "sensor",
  "hub",
  "custom",
] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  mobile: "Mobile",
  computer: "Computer",
  iot: "IoT",
  media: "Media",
  lighting: "Lighting",
  sensor: "Sensor",
  hub: "Hub",
  custom: "Custom",
};

export const CAPABILITIES = [
  "battery",
  "storage",
  "notifications",
  "media",
  "location",
  "camera",
  "microphone",
  "power",
  "volume",
  "brightness",
  "sensors",
  "clipboard",
  "files",
  "gpio",
  "lights",
  "climate",
  "locks",
  "scenes",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_LABELS: Record<Capability, string> = {
  battery: "Battery",
  storage: "Storage",
  notifications: "Notifications",
  media: "Media control",
  location: "Location",
  camera: "Camera",
  microphone: "Microphone",
  power: "Power",
  volume: "Volume",
  brightness: "Brightness",
  sensors: "Sensors",
  clipboard: "Clipboard",
  files: "File transfer",
  gpio: "GPIO",
  lights: "Lights",
  climate: "Climate",
  locks: "Locks",
  scenes: "Scenes",
};

/** Capabilities that are declared but intentionally not executable yet. */
export const FUTURE_CAPABILITIES: Capability[] = ["camera", "microphone"];

export const CONNECTION_TYPES = ["local", "mqtt", "cloud", "bridge", "bluetooth", "nfc"] as const;
export type ConnectionType = (typeof CONNECTION_TYPES)[number];

export const PAIRING_METHODS = ["code", "qr", "discovery", "manual", "bluetooth", "nfc", "relay"] as const;
export type PairingMethod = (typeof PAIRING_METHODS)[number];

export const FUTURE_PAIRING_METHODS: PairingMethod[] = ["bluetooth", "nfc", "relay"];

/** JSON-safe value, matching what the database can round-trip. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type DeviceStatus = "online" | "idle" | "offline" | "error" | "pairing";

export type DeviceEventLevel = "info" | "success" | "warning" | "error";

export interface DeviceRecord {
  id: string;
  name: string;
  type: DeviceType;
  platform: string;
  connector: string;
  connection: ConnectionType;
  status: DeviceStatus;
  battery: number | null;
  charging: boolean;
  signal: number | null;
  firmware: string;
  address: string;
  capabilities: Capability[];
  state: JsonObject;
  metadata: JsonObject;
  favorite: boolean;
  group: string;
  revoked: boolean;
  lastSeenAt: string | null;
  pairedAt: string;
}

export interface DeviceEventRecord {
  id: string;
  deviceId: string | null;
  deviceName: string;
  type: string;
  level: DeviceEventLevel;
  message: string;
  payload: JsonObject;
  createdAt: string;
}

export interface DeviceHistoryRecord {
  id: string;
  deviceId: string | null;
  deviceName: string;
  action: string;
  status: string;
  detail: string;
  durationMs: number;
  source: string;
  createdAt: string;
}

export interface PairingRecord {
  id: string;
  code: string;
  method: PairingMethod;
  name: string;
  type: DeviceType;
  connector: string;
  status: "pending" | "approved" | "rejected" | "expired";
  payload: JsonObject;
  expiresAt: string;
  createdAt: string;
}

export type DeviceErrorCode =
  | "DEVICE_OFFLINE"
  | "AUTH_FAILED"
  | "NETWORK_ERROR"
  | "MQTT_DISCONNECTED"
  | "HOME_ASSISTANT_UNAVAILABLE"
  | "UNSUPPORTED"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "REVOKED";

export class DeviceError extends Error {
  constructor(
    public readonly code: DeviceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DeviceError";
  }
}

export interface DeviceActionContext {
  device: DeviceRecord;
  signal: AbortSignal;
  log: (line: string) => void;
}

export interface DeviceAction {
  /** Stable id, e.g. `light.toggle`. */
  id: string;
  label: string;
  description: string;
  capability: Capability;
  /** Destructive or physical-world actions always re-prompt for permission. */
  danger?: boolean;
  planned?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: ZodType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run: (input: any, ctx: DeviceActionContext) => Promise<unknown>;
}

export interface DeviceStatusReport {
  status: DeviceStatus;
  battery?: number | null;
  charging?: boolean;
  signal?: number | null;
  firmware?: string;
  state?: JsonObject;
}

export interface DeviceConnector {
  /** Registry key, mirrored onto `devices.connector`. */
  id: string;
  label: string;
  description: string;
  types: DeviceType[];
  connection: ConnectionType;
  capabilities: Capability[];
  pairingMethods: PairingMethod[];
  /** Fields collected during manual pairing; secret ones never reach the client again. */
  fields: Array<{
    name: string;
    label: string;
    placeholder?: string;
    secret?: boolean;
    optional?: boolean;
  }>;
  actions: DeviceAction[];
  /** Polls the device and returns its live status. */
  probe: (device: DeviceRecord, signal: AbortSignal) => Promise<DeviceStatusReport>;
  /** Optional live event stream; returns an unsubscribe handle. */
  subscribe?: (device: DeviceRecord, emit: (event: ConnectorEvent) => void) => () => void;
}

export interface ConnectorEvent {
  type: string;
  level: DeviceEventLevel;
  message: string;
  payload?: JsonObject;
}

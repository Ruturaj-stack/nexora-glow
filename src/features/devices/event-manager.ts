import { useDeviceStore } from "@/store/device-store";
import { recordDeviceEvent } from "@/lib/devices.functions";
import { pushDeviceNotification } from "./notification-bridge";
import type { DeviceEventLevel, JsonObject } from "./types";

/**
 * DeviceEventManager — fan-out point for everything a device reports.
 *
 * An event is persisted (device history/timeline), pushed into the live store
 * and, when it matters to a human, bridged into the notification centre.
 */

export interface DeviceEventInput {
  deviceId: string | null;
  deviceName: string;
  type: string;
  level?: DeviceEventLevel;
  message: string;
  payload?: JsonObject;
  /** Skip the notification centre for high-frequency telemetry. */
  silent?: boolean;
}

type Listener = (event: DeviceEventInput) => void;
const listeners = new Set<Listener>();

export function onDeviceEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const NOTIFY_TYPES = new Set([
  "device.connected",
  "device.disconnected",
  "battery.low",
  "motion.detected",
  "door.opened",
  "mqtt.error",
  "device.error",
]);

export async function emitDeviceEvent(input: DeviceEventInput): Promise<void> {
  const level = input.level ?? "info";
  for (const listener of listeners) listener({ ...input, level });

  useDeviceStore.getState().pushEvent({
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    deviceId: input.deviceId,
    deviceName: input.deviceName,
    type: input.type,
    level,
    message: input.message,
    payload: input.payload ?? {},
    createdAt: new Date().toISOString(),
  });

  if (!input.silent && (NOTIFY_TYPES.has(input.type) || level === "error" || level === "warning")) {
    pushDeviceNotification({
      title: input.deviceName || "Device",
      body: input.message,
      level,
    });
  }

  try {
    await recordDeviceEvent({
      data: {
        deviceId: input.deviceId,
        deviceName: input.deviceName,
        type: input.type,
        level,
        message: input.message.slice(0, 400),
        payload: input.payload ?? {},
      },
    });
  } catch {
    // Never let telemetry break a device interaction.
  }
}

/** Derives events from a status change (battery low, offline, back online…). */
export function diffStatusEvents(
  deviceName: string,
  deviceId: string,
  previous: { status?: string; battery?: number | null } | undefined,
  next: { status?: string; battery?: number | null },
): DeviceEventInput[] {
  const events: DeviceEventInput[] = [];
  if (previous?.status && next.status && previous.status !== next.status) {
    const offline = next.status === "offline" || next.status === "error";
    events.push({
      deviceId,
      deviceName,
      type: offline ? "device.disconnected" : "device.connected",
      level: offline ? "warning" : "success",
      message: offline ? `${deviceName} went ${next.status}` : `${deviceName} is back online`,
    });
  }
  const battery = next.battery ?? null;
  if (battery !== null && battery <= 20 && (previous?.battery ?? 100) > 20) {
    events.push({
      deviceId,
      deviceName,
      type: "battery.low",
      level: "warning",
      message: `${deviceName} battery at ${battery}%`,
      payload: { battery },
    });
  }
  return events;
}

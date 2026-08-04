import {
  listDevices,
  recordDeviceAction,
  updateDevice,
} from "@/lib/devices.functions";
import { useDeviceStore } from "@/store/device-store";
import { getConnector, getDeviceAction } from "./connector-registry";
import { diffStatusEvents, emitDeviceEvent } from "./event-manager";
import { deviceRequest } from "./http";
import { DeviceError, type DeviceRecord, type DeviceStatusReport } from "./types";

/**
 * DeviceManager — orchestrates the connector layer:
 * loading devices, probing health, running actions and logging history.
 *
 * It never talks to a transport directly; that is the connector's job.
 */

export async function loadDevices(): Promise<DeviceRecord[]> {
  const response = await listDevices();
  useDeviceStore.getState().setDevices(response.data);
  return response.data;
}

function requireDevice(deviceId: string): DeviceRecord {
  const device = useDeviceStore.getState().devices.find((d) => d.id === deviceId);
  if (!device) throw new DeviceError("NOT_FOUND", "That device is no longer paired.");
  if (device.revoked) throw new DeviceError("REVOKED", `${device.name} has been revoked.`);
  return device;
}

/** DeviceHealthMonitor — probes one device and reconciles store + database. */
export async function probeDevice(deviceId: string): Promise<DeviceStatusReport> {
  const device = requireDevice(deviceId);
  const connector = getConnector(device.connector);
  if (!connector) throw new DeviceError("UNSUPPORTED", `No connector for "${device.connector}".`);

  const store = useDeviceStore.getState();
  const previous = { status: device.status, battery: device.battery };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  let report: DeviceStatusReport;
  try {
    report = await connector.probe(device, controller.signal);
  } catch (error) {
    report = {
      status: error instanceof DeviceError && error.code === "AUTH_FAILED" ? "error" : "offline",
    };
  } finally {
    clearTimeout(timer);
  }

  store.setStatus(device.id, report);
  for (const event of diffStatusEvents(device.name, device.id, previous, report)) {
    void emitDeviceEvent(event);
  }

  try {
    await updateDevice({
      data: {
        id: device.id,
        status: report.status,
        battery: report.battery ?? null,
        charging: report.charging ?? false,
        signal: report.signal ?? null,
        ...(report.firmware ? { firmware: report.firmware } : {}),
        ...(report.state ? { state: report.state } : {}),
        touch: report.status === "online",
      },
    });
  } catch {
    // A failed sync must not hide the live reading.
  }
  return report;
}

/** Probes every paired device, sequentially, so a slow host cannot stampede. */
export async function probeAllDevices(): Promise<void> {
  for (const device of useDeviceStore.getState().devices) {
    await probeDevice(device.id).catch(() => undefined);
  }
}

let monitorTimer: ReturnType<typeof setInterval> | null = null;

export function startHealthMonitor(intervalMs = 60_000): () => void {
  stopHealthMonitor();
  void probeAllDevices();
  monitorTimer = setInterval(() => void probeAllDevices(), intervalMs);
  return stopHealthMonitor;
}

export function stopHealthMonitor(): void {
  if (monitorTimer) clearInterval(monitorTimer);
  monitorTimer = null;
}

export interface DeviceActionOutcome {
  result: unknown;
  durationMs: number;
  logs: string[];
}

/**
 * Runs a connector action. This is the low-level dispatcher — UI and AI calls
 * go through `runDeviceCommand`, which adds the permission gate.
 */
export async function dispatchDeviceAction(
  deviceId: string,
  actionId: string,
  input: Record<string, unknown> = {},
  source = "manual",
  signal?: AbortSignal,
): Promise<DeviceActionOutcome> {
  const device = requireDevice(deviceId);
  const action = getDeviceAction(device.connector, actionId);
  if (!action) throw new DeviceError("UNSUPPORTED", `${device.name} does not support "${actionId}".`);
  if (action.planned) {
    throw new DeviceError("UNSUPPORTED", `${action.label} is not available yet.`);
  }

  const parsed = action.schema.safeParse(input);
  if (!parsed.success) {
    throw new DeviceError(
      "INVALID_INPUT",
      parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; "),
    );
  }

  const logs: string[] = [];
  const controller = new AbortController();
  signal?.addEventListener("abort", () => controller.abort(), { once: true });
  const started = performance.now();

  try {
    const result = await action.run(parsed.data, {
      device,
      signal: controller.signal,
      log: (line) => logs.push(line),
    });
    const durationMs = Math.round(performance.now() - started);
    await log(device, action.label, "success", summarise(result), durationMs, source);
    return { result, durationMs, logs };
  } catch (error) {
    const durationMs = Math.round(performance.now() - started);
    const message = error instanceof Error ? error.message : "Device action failed";
    await log(device, action.label, "error", message, durationMs, source);
    void emitDeviceEvent({
      deviceId: device.id,
      deviceName: device.name,
      type: "device.error",
      level: "error",
      message,
    });
    throw error;
  }
}

function summarise(result: unknown): string {
  if (result == null) return "";
  if (typeof result === "string") return result.slice(0, 600);
  try {
    return JSON.stringify(result).slice(0, 600);
  } catch {
    return "";
  }
}

async function log(
  device: DeviceRecord,
  action: string,
  status: "success" | "error",
  detail: string,
  durationMs: number,
  source: string,
) {
  try {
    await recordDeviceAction({
      data: {
        deviceId: device.id,
        deviceName: device.name,
        action,
        status,
        detail,
        durationMs,
        source,
      },
    });
  } catch {
    // Auditing must never break the action itself.
  }
}

export interface DiscoveredHost {
  address: string;
  firmware: string;
  suggestedConnector: string;
  name: string;
}

/**
 * DeviceDiscoveryService — probes candidate hosts on the local network for the
 * Nexora device contract (`GET /status`). The browser cannot scan a subnet, so
 * discovery works on an explicit candidate list the user can extend.
 */
export async function discoverDevices(candidates: string[]): Promise<DiscoveredHost[]> {
  const found: DiscoveredHost[] = [];
  await Promise.all(
    candidates.map(async (address) => {
      try {
        const status = await deviceRequest<Record<string, unknown>>(address, {
          path: "/status",
          timeoutMs: 2500,
        });
        if (!status || typeof status !== "object") return;
        const kind = String(status["device"] ?? status["type"] ?? "generic").toLowerCase();
        found.push({
          address,
          firmware: String(status["firmware"] ?? status["appVersion"] ?? ""),
          suggestedConnector: kind.includes("esp")
            ? "esp32"
            : kind.includes("android")
              ? "android"
              : "generic",
          name: String(status["name"] ?? address.replace(/^https?:\/\//, "")),
        });
      } catch {
        // A silent host is simply not there.
      }
    }),
  );
  return found.sort((a, b) => a.address.localeCompare(b.address));
}

/** Default candidate hosts covering the common Nexora device ports. */
export function defaultDiscoveryCandidates(base = "192.168.1"): string[] {
  return [
    "http://127.0.0.1:8765",
    `http://${base}.42`,
    `http://${base}.42:80`,
    `http://${base}.24:8765`,
    `http://nexora.local`,
    `http://esp32.local`,
  ];
}

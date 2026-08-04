import { z } from "zod";
import { clampPercent, deviceRequest } from "../http";
import type { DeviceConnector } from "../types";

/**
 * GenericHttpConnector — the fallback for any device exposing a small local
 * HTTP API: smart plugs, smart lights, smart TVs, Raspberry Pi services and
 * custom hardware. It keeps the framework open without a bespoke module.
 */

export const genericHttpConnector: DeviceConnector = {
  id: "generic",
  label: "Generic HTTP device",
  description: "Smart plugs, lights, TVs, Raspberry Pi services and custom hardware over HTTP.",
  types: ["iot", "lighting", "media", "sensor", "computer", "custom"],
  connection: "local",
  capabilities: ["power", "brightness", "volume", "sensors", "notifications"],
  pairingMethods: ["manual", "discovery", "qr"],
  fields: [
    { name: "address", label: "Device address", placeholder: "http://192.168.1.60" },
    { name: "token", label: "API token", secret: true, optional: true },
  ],
  actions: [
    {
      id: "power.set",
      label: "Power on/off",
      description: "Sends the device's power command.",
      capability: "power",
      danger: true,
      schema: z.object({ on: z.boolean() }),
      run: (body, { device }) =>
        deviceRequest(device.address, { method: "POST", path: "/power", body }),
    },
    {
      id: "brightness.set",
      label: "Set brightness",
      description: "Sets brightness on a dimmable device.",
      capability: "brightness",
      schema: z.object({ level: z.number().int().min(0).max(100) }),
      run: (body, { device }) =>
        deviceRequest(device.address, { method: "POST", path: "/brightness", body }),
    },
    {
      id: "volume.set",
      label: "Set volume",
      description: "Sets output volume, or mutes a smart TV.",
      capability: "volume",
      schema: z.object({
        level: z.number().int().min(0).max(100).optional(),
        muted: z.boolean().optional(),
      }),
      run: (body, { device }) =>
        deviceRequest(device.address, { method: "POST", path: "/volume", body }),
    },
    {
      id: "request.custom",
      label: "Custom request",
      description: "Calls any path on the device with an optional JSON body.",
      capability: "sensors",
      danger: true,
      schema: z.object({
        method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET"),
        path: z.string().min(1).max(200).default("/"),
        body: z.record(z.string(), z.any()).optional(),
      }),
      run: ({ method, path, body }, { device }) =>
        deviceRequest(device.address, {
          method,
          path: path.startsWith("/") ? path : `/${path}`,
          body,
        }),
    },
  ],
  probe: async (device, signal) => {
    const status = await deviceRequest<Record<string, unknown>>(device.address, {
      path: "/status",
      signal,
      timeoutMs: 5000,
    });
    return {
      status: "online",
      battery: clampPercent(status?.["battery"]),
      signal: clampPercent(status?.["signal"]),
      firmware: String(status?.["firmware"] ?? status?.["version"] ?? ""),
      state: (status ?? {}) as Record<string, never>,
    };
  },
};

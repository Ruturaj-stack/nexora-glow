import { z } from "zod";
import { clampPercent, deviceRequest } from "../http";
import type { DeviceConnector } from "../types";

/**
 * AndroidConnector — pairs with the Nexora companion app running on the phone
 * and exposes battery, notifications, clipboard, media and ring status.
 * SMS, calls and camera are declared but intentionally not executable yet.
 */

export const androidConnector: DeviceConnector = {
  id: "android",
  label: "Android phone",
  description: "Battery, clipboard sync, notification mirroring, media control and file transfer.",
  types: ["mobile"],
  connection: "local",
  capabilities: ["battery", "storage", "notifications", "media", "clipboard", "files", "location"],
  pairingMethods: ["code", "qr", "discovery"],
  fields: [
    { name: "address", label: "Companion address", placeholder: "http://192.168.1.24:8765" },
    { name: "token", label: "Pairing token", secret: true, optional: true },
  ],
  actions: [
    {
      id: "battery.status",
      label: "Phone battery",
      description: "Reads battery level and charging state.",
      capability: "battery",
      schema: z.object({}).default({}),
      run: (_input, { device }) => deviceRequest(device.address, { path: "/battery" }),
    },
    {
      id: "notifications.push",
      label: "Send notification",
      description: "Shows a notification on the phone.",
      capability: "notifications",
      schema: z.object({ title: z.string().min(1).max(80), body: z.string().max(300).default("") }),
      run: (body, { device }) =>
        deviceRequest(device.address, { method: "POST", path: "/notify", body }),
    },
    {
      id: "clipboard.sync",
      label: "Push clipboard",
      description: "Copies text onto the phone's clipboard.",
      capability: "clipboard",
      danger: true,
      schema: z.object({ text: z.string().min(1).max(5000) }),
      run: (body, { device }) =>
        deviceRequest(device.address, { method: "POST", path: "/clipboard", body }),
    },
    {
      id: "media.control",
      label: "Media control",
      description: "Plays, pauses or skips media on the phone.",
      capability: "media",
      schema: z.object({ command: z.enum(["play", "pause", "next", "previous", "stop"]) }),
      run: (body, { device }) =>
        deviceRequest(device.address, { method: "POST", path: "/media", body }),
    },
    {
      id: "ring.status",
      label: "Ring status",
      description: "Reads ringer mode and whether a call is active.",
      capability: "notifications",
      schema: z.object({}).default({}),
      run: (_input, { device }) => deviceRequest(device.address, { path: "/ring" }),
    },
    {
      id: "files.send",
      label: "Send file",
      description: "Transfers a file to the phone by URL.",
      capability: "files",
      danger: true,
      schema: z.object({ url: z.string().url(), filename: z.string().min(1).max(120) }),
      run: (body, { device }) =>
        deviceRequest(device.address, { method: "POST", path: "/files", body }),
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
      charging: Boolean(status?.["charging"]),
      signal: clampPercent(status?.["signal"]),
      firmware: String(status?.["appVersion"] ?? ""),
      state: {
        ringer: String(status?.["ringer"] ?? "unknown"),
        storageFreeGb: Number(status?.["storageFreeGb"] ?? 0),
      },
    };
  },
};

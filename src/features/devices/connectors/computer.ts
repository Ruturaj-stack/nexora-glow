import { z } from "zod";
import { bridgeCall, probeBridge } from "@/features/tools/bridge";
import type { DeviceConnector } from "../types";

/**
 * ComputerConnector — laptops, desktops and tablets running the optional
 * Nexora desktop bridge. Every call is delegated to the existing bridge
 * client, so device control and computer control share one transport.
 */

export const computerConnector: DeviceConnector = {
  id: "computer",
  label: "Computer (Nexora bridge)",
  description: "Laptops, desktops and tablets running the Nexora desktop bridge.",
  types: ["computer"],
  connection: "bridge",
  capabilities: ["power", "volume", "brightness", "notifications", "storage", "battery", "files"],
  pairingMethods: ["code", "manual", "discovery"],
  fields: [
    { name: "address", label: "Bridge address", placeholder: "http://127.0.0.1:8787", optional: true },
    { name: "token", label: "Bridge token", secret: true, optional: true },
  ],
  actions: [
    {
      id: "system.info",
      label: "System telemetry",
      description: "Reads CPU, memory, disk and network counters.",
      capability: "storage",
      schema: z.object({}).default({}),
      run: (_input, { signal }) => bridgeCall("system.metrics", {}, signal),
    },
    {
      id: "volume.set",
      label: "Set volume",
      description: "Sets the machine's output volume.",
      capability: "volume",
      schema: z.object({ level: z.number().int().min(0).max(100) }),
      run: (body, { signal }) => bridgeCall("volume.set", body, signal),
    },
    {
      id: "brightness.set",
      label: "Set brightness",
      description: "Sets display brightness.",
      capability: "brightness",
      schema: z.object({ level: z.number().int().min(0).max(100) }),
      run: (body, { signal }) => bridgeCall("brightness.set", body, signal),
    },
    {
      id: "notify.send",
      label: "Send notification",
      description: "Shows a desktop notification on the machine.",
      capability: "notifications",
      schema: z.object({ title: z.string().min(1).max(80), body: z.string().max(300).default("") }),
      run: (body, { signal }) => bridgeCall("notification.show", body, signal),
    },
  ],
  probe: async () => {
    const bridge = await probeBridge();
    return {
      status: bridge.connected ? "online" : "offline",
      firmware: bridge.version ?? "",
      state: { bridge: bridge.connected ? "connected" : "unavailable", platform: bridge.platform ?? "" },
    };
  },
};

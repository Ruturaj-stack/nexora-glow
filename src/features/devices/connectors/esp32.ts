import { z } from "zod";
import { clampPercent, deviceRequest } from "../http";
import type { DeviceConnector } from "../types";

/**
 * ESP32Connector — talks to a board running the Nexora ESP32 firmware sketch
 * over its local HTTP API: GET /status, POST /gpio, /relay, /led, /servo,
 * POST /restart.
 */

export const esp32Connector: DeviceConnector = {
  id: "esp32",
  label: "ESP32 board",
  description: "Digital outputs, relays, sensors, servos and LEDs over the board's local HTTP API.",
  types: ["iot", "sensor"],
  connection: "local",
  capabilities: ["gpio", "sensors", "power", "brightness"],
  pairingMethods: ["manual", "discovery", "qr"],
  fields: [
    { name: "address", label: "Board address", placeholder: "http://192.168.1.42" },
    { name: "token", label: "Firmware token", secret: true, optional: true },
  ],
  actions: [
    {
      id: "gpio.write",
      label: "Set GPIO pin",
      description: "Drives a digital output high or low.",
      capability: "gpio",
      schema: z.object({ pin: z.number().int().min(0).max(39), value: z.boolean() }),
      run: ({ pin, value }, { device }) =>
        deviceRequest(device.address, { method: "POST", path: "/gpio", body: { pin, value } }),
    },
    {
      id: "relay.set",
      label: "Switch relay",
      description: "Opens or closes a relay channel.",
      capability: "power",
      danger: true,
      schema: z.object({ channel: z.number().int().min(0).max(15).default(0), on: z.boolean() }),
      run: ({ channel, on }, { device }) =>
        deviceRequest(device.address, { method: "POST", path: "/relay", body: { channel, on } }),
    },
    {
      id: "led.set",
      label: "Set LED",
      description: "Sets LED colour and brightness.",
      capability: "brightness",
      schema: z.object({
        brightness: z.number().int().min(0).max(100).default(100),
        color: z.string().regex(/^#?[0-9a-fA-F]{6}$/).default("#ffffff"),
      }),
      run: ({ brightness, color }, { device }) =>
        deviceRequest(device.address, {
          method: "POST",
          path: "/led",
          body: { brightness, color: color.startsWith("#") ? color : `#${color}` },
        }),
    },
    {
      id: "servo.set",
      label: "Move servo",
      description: "Rotates a servo to an absolute angle.",
      capability: "gpio",
      schema: z.object({ channel: z.number().int().min(0).max(15).default(0), angle: z.number().min(0).max(180) }),
      run: ({ channel, angle }, { device }) =>
        deviceRequest(device.address, { method: "POST", path: "/servo", body: { channel, angle } }),
    },
    {
      id: "sensors.read",
      label: "Read sensors",
      description: "Reads temperature, humidity and motion sensors.",
      capability: "sensors",
      schema: z.object({}).default({}),
      run: (_input, { device }) => deviceRequest(device.address, { path: "/sensors" }),
    },
    {
      id: "board.restart",
      label: "Restart board",
      description: "Reboots the ESP32.",
      capability: "power",
      danger: true,
      schema: z.object({}).default({}),
      run: (_input, { device }) => deviceRequest(device.address, { method: "POST", path: "/restart" }),
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
      signal: clampPercent(status?.["rssiPercent"] ?? status?.["signal"]),
      firmware: String(status?.["firmware"] ?? ""),
      state: {
        temperature: Number(status?.["temperature"] ?? 0),
        humidity: Number(status?.["humidity"] ?? 0),
        motion: Boolean(status?.["motion"]),
        uptime: Number(status?.["uptime"] ?? 0),
      },
    };
  },
};

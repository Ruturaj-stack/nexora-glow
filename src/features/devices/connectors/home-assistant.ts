import { z } from "zod";
import { callHomeAssistantService, probeHomeAssistant } from "@/lib/devices.functions";
import type { DeviceConnector } from "../types";

/**
 * HomeAssistantConnector — every call is proxied through an authenticated
 * server function, so the long-lived access token never reaches the browser.
 */

function service(domain: string, name: string) {
  return async (
    input: { entityId: string } & Record<string, unknown>,
    ctx: { device: { id: string } },
  ) => {
    const { entityId, ...payload } = input;
    const response = await callHomeAssistantService({
      data: { deviceId: ctx.device.id, domain, service: name, entityId, payload },
    });
    return response.data;
  };
}

const entity = z.object({ entityId: z.string().min(3).max(120) });

export const homeAssistantConnector: DeviceConnector = {
  id: "home-assistant",
  label: "Home Assistant",
  description: "Lights, switches, climate, locks, scenes, scripts and sensors from your hub.",
  types: ["hub", "lighting", "sensor", "media"],
  connection: "cloud",
  capabilities: ["lights", "power", "climate", "locks", "scenes", "sensors", "brightness"],
  pairingMethods: ["manual"],
  fields: [
    { name: "address", label: "Base URL", placeholder: "https://home.example.com:8123" },
    { name: "token", label: "Long-lived access token", secret: true },
  ],
  actions: [
    {
      id: "light.turn_on",
      label: "Turn light on",
      description: "Turns a light entity on, optionally with brightness and colour.",
      capability: "lights",
      schema: entity.extend({
        brightness_pct: z.number().int().min(1).max(100).optional(),
        color_name: z.string().max(30).optional(),
      }),
      run: service("light", "turn_on"),
    },
    {
      id: "light.turn_off",
      label: "Turn light off",
      description: "Turns a light entity off.",
      capability: "lights",
      schema: entity,
      run: service("light", "turn_off"),
    },
    {
      id: "switch.toggle",
      label: "Toggle switch",
      description: "Toggles a switch or smart plug entity.",
      capability: "power",
      schema: entity,
      run: service("switch", "toggle"),
    },
    {
      id: "climate.set_temperature",
      label: "Set temperature",
      description: "Sets the target temperature of a climate entity.",
      capability: "climate",
      schema: entity.extend({ temperature: z.number().min(5).max(35) }),
      run: service("climate", "set_temperature"),
    },
    {
      id: "lock.lock",
      label: "Lock",
      description: "Locks a lock entity.",
      capability: "locks",
      danger: true,
      schema: entity,
      run: service("lock", "lock"),
    },
    {
      id: "lock.unlock",
      label: "Unlock",
      description: "Unlocks a lock entity.",
      capability: "locks",
      danger: true,
      schema: entity,
      run: service("lock", "unlock"),
    },
    {
      id: "cover.open",
      label: "Open cover",
      description: "Opens a cover, garage door or blind.",
      capability: "power",
      danger: true,
      schema: entity,
      run: service("cover", "open_cover"),
    },
    {
      id: "cover.close",
      label: "Close cover",
      description: "Closes a cover, garage door or blind.",
      capability: "power",
      danger: true,
      schema: entity,
      run: service("cover", "close_cover"),
    },
    {
      id: "media_player.volume_mute",
      label: "Mute media player",
      description: "Mutes or unmutes a media player such as a smart TV.",
      capability: "volume",
      schema: entity.extend({ is_volume_muted: z.boolean().default(true) }),
      run: service("media_player", "volume_mute"),
    },
    {
      id: "scene.turn_on",
      label: "Run scene",
      description: "Activates a Home Assistant scene.",
      capability: "scenes",
      schema: entity,
      run: service("scene", "turn_on"),
    },
    {
      id: "script.turn_on",
      label: "Run script",
      description: "Runs a Home Assistant script.",
      capability: "scenes",
      danger: true,
      schema: entity,
      run: service("script", "turn_on"),
    },
    {
      id: "camera.snapshot",
      label: "Camera snapshot",
      description: "Camera support arrives in a later phase.",
      capability: "camera",
      planned: true,
      schema: entity,
      run: async () => {
        throw new Error("Camera support is not available yet.");
      },
    },
  ],
  probe: async (device) => {
    const response = await probeHomeAssistant({ data: { deviceId: device.id } });
    return { status: "online", firmware: response.data.version };
  },
};

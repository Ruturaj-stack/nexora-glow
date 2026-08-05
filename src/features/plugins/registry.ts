import type { PluginManifest } from "./types";

/**
 * The built-in plugin catalogue (the "store" shelf). Everything here is data:
 * declarative manifests reviewed at build time, installed per user.
 */

export const PLUGIN_CATALOGUE: PluginManifest[] = [
  {
    id: "weather",
    name: "Weather",
    version: "1.2.0",
    description: "Current conditions and a short forecast for any location, via Open-Meteo.",
    author: "Nexora",
    category: "information",
    source: "official",
    permissions: ["network"],
    allowedHosts: ["api.open-meteo.com", "geocoding-api.open-meteo.com"],
    uses: [],
    settings: [
      { name: "latitude", label: "Default latitude", type: "string", placeholder: "51.5072" },
      { name: "longitude", label: "Default longitude", type: "string", placeholder: "-0.1276" },
    ],
    tools: [
      {
        name: "current",
        title: "Current weather",
        description: "Reads temperature, wind and conditions for a coordinate pair.",
        scopes: ["network"],
        inputs: [
          { name: "latitude", label: "Latitude", type: "string", placeholder: "51.5072" },
          { name: "longitude", label: "Longitude", type: "string", placeholder: "-0.1276" },
        ],
        action: {
          kind: "http",
          method: "GET",
          url: "https://api.open-meteo.com/v1/forecast?latitude={{input.latitude}}&longitude={{input.longitude}}&current=temperature_2m,wind_speed_10m,weather_code",
        },
      },
    ],
  },
  {
    id: "focus-mode",
    name: "Focus Mode",
    version: "1.0.1",
    description: "Silences notifications, dims the display and starts a focus timer.",
    author: "Nexora",
    category: "productivity",
    source: "official",
    permissions: ["notifications", "brightness", "system"],
    allowedHosts: [],
    uses: ["notification.show", "brightness.set"],
    settings: [
      { name: "brightness", label: "Focus brightness (%)", type: "number", defaultValue: 45 },
    ],
    tools: [
      {
        name: "start",
        title: "Start focus session",
        description: "Dims the screen and announces the start of a focus block.",
        scopes: ["notifications", "brightness"],
        inputs: [{ name: "minutes", label: "Minutes", type: "number", placeholder: "45" }],
        action: {
          kind: "chain",
          steps: [
            { tool: "brightness.set", params: { level: "{{setting.brightness}}" } },
            {
              tool: "notification.show",
              params: {
                title: "Focus mode on",
                body: "Deep work for {{input.minutes}} minutes. Notifications are muted.",
              },
            },
          ],
        },
      },
    ],
  },
  {
    id: "quick-notes",
    name: "Quick Notes",
    version: "1.0.0",
    description: "Captures a thought straight to the clipboard and confirms it on screen.",
    author: "Nexora",
    category: "productivity",
    source: "official",
    permissions: ["clipboard", "notifications"],
    allowedHosts: [],
    uses: ["clipboard.write", "notification.show"],
    settings: [],
    tools: [
      {
        name: "capture",
        title: "Capture note",
        description: "Copies a note to the clipboard and confirms with a notification.",
        scopes: ["clipboard", "notifications"],
        inputs: [{ name: "text", label: "Note", type: "string", required: true }],
        action: {
          kind: "chain",
          steps: [
            { tool: "clipboard.write", params: { text: "{{input.text}}" } },
            { tool: "notification.show", params: { title: "Note captured", body: "{{input.text}}" } },
          ],
        },
      },
    ],
  },
  {
    id: "crypto-ticker",
    name: "Crypto Ticker",
    version: "0.9.2",
    description: "Spot prices for major cryptocurrencies from the public CoinGecko API.",
    author: "Community",
    category: "information",
    source: "community",
    permissions: ["network"],
    allowedHosts: ["api.coingecko.com"],
    uses: [],
    settings: [
      { name: "currency", label: "Fiat currency", type: "string", defaultValue: "usd" },
    ],
    tools: [
      {
        name: "price",
        title: "Coin price",
        description: "Reads the current spot price for a coin id such as bitcoin.",
        scopes: ["network"],
        inputs: [{ name: "coin", label: "Coin id", type: "string", placeholder: "bitcoin" }],
        action: {
          kind: "http",
          method: "GET",
          url: "https://api.coingecko.com/api/v3/simple/price?ids={{input.coin}}&vs_currencies={{setting.currency}}",
        },
      },
    ],
  },
  {
    id: "scene-runner",
    name: "Scene Runner",
    version: "1.1.0",
    description: "Runs a Home Assistant scene and reports the result back to Nexora.",
    author: "Nexora",
    category: "smart-home",
    source: "official",
    permissions: ["devices", "notifications"],
    allowedHosts: [],
    uses: ["homeassistant.service", "notification.show"],
    settings: [{ name: "deviceId", label: "Home Assistant device id", type: "string" }],
    tools: [
      {
        name: "activate",
        title: "Activate scene",
        description: "Turns on a Home Assistant scene by entity id.",
        scopes: ["devices"],
        inputs: [{ name: "entityId", label: "Scene entity", type: "string", required: true }],
        action: {
          kind: "chain",
          steps: [
            {
              tool: "homeassistant.service",
              params: {
                deviceId: "{{setting.deviceId}}",
                domain: "scene",
                service: "turn_on",
                entityId: "{{input.entityId}}",
              },
            },
            { tool: "notification.show", params: { title: "Scene activated", body: "{{input.entityId}}" } },
          ],
        },
      },
    ],
  },
  {
    id: "system-report",
    name: "System Report",
    version: "1.0.0",
    description: "Bundles CPU, memory and disk telemetry into a single clipboard-ready report.",
    author: "Nexora",
    category: "utility",
    source: "official",
    permissions: ["system", "clipboard"],
    allowedHosts: [],
    uses: ["system.info", "clipboard.write"],
    settings: [],
    tools: [
      {
        name: "snapshot",
        title: "Copy system report",
        description: "Reads system telemetry and places a summary on the clipboard.",
        scopes: ["system", "clipboard"],
        inputs: [],
        action: {
          kind: "chain",
          steps: [
            { tool: "system.info", params: {} },
            { tool: "clipboard.write", params: { text: "Nexora system report captured at {{now}}" } },
          ],
        },
      },
    ],
  },
];

export function findManifest(pluginId: string): PluginManifest | undefined {
  return PLUGIN_CATALOGUE.find((plugin) => plugin.id === pluginId);
}

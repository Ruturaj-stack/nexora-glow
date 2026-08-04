import { androidConnector } from "./connectors/android";
import { computerConnector } from "./connectors/computer";
import { esp32Connector } from "./connectors/esp32";
import { genericHttpConnector } from "./connectors/generic-http";
import { homeAssistantConnector } from "./connectors/home-assistant";
import { mqttConnector } from "./connectors/mqtt";
import type { DeviceAction, DeviceConnector } from "./types";

/**
 * ConnectorRegistry — the single place new platforms are registered.
 * Adding HomeKit, Hue, Tesla or Wear OS later means appending one module here;
 * nothing in the core, the UI or the tool engine changes.
 */

export const CONNECTORS: DeviceConnector[] = [
  androidConnector,
  computerConnector,
  esp32Connector,
  genericHttpConnector,
  homeAssistantConnector,
  mqttConnector,
];

const INDEX = new Map(CONNECTORS.map((c) => [c.id, c]));

export function getConnector(id: string): DeviceConnector | undefined {
  return INDEX.get(id);
}

export function listConnectors(): DeviceConnector[] {
  return CONNECTORS;
}

export function getDeviceAction(connectorId: string, actionId: string): DeviceAction | undefined {
  return getConnector(connectorId)?.actions.find((a) => a.id === actionId);
}

/** Compact manifest the assistant can reference — it can never invent an action. */
export function deviceManifest() {
  return CONNECTORS.map((connector) => ({
    connector: connector.id,
    label: connector.label,
    capabilities: connector.capabilities,
    actions: connector.actions.map((a) => ({
      id: a.id,
      label: a.label,
      description: a.description,
      capability: a.capability,
      danger: Boolean(a.danger),
      planned: Boolean(a.planned),
    })),
  }));
}

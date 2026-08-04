import { executeTool } from "@/features/tools/tool-manager";

/**
 * Device commands always flow through the Tool Execution Engine, so they get
 * the same permission gate, serial queue and audit log as computer control.
 */

export async function runDeviceCommand(
  deviceId: string,
  actionId: string,
  input: Record<string, unknown> = {},
  source = "manual",
) {
  return executeTool("devices.action", { deviceId, actionId, input }, { source });
}

export async function publishMqtt(
  deviceId: string,
  topic: string,
  payload: string,
  options: { qos?: 0 | 1 | 2; retain?: boolean } = {},
  source = "manual",
) {
  return executeTool(
    "mqtt.publish",
    { deviceId, topic, payload, qos: options.qos ?? 0, retain: options.retain ?? false },
    { source },
  );
}

export async function callHaService(
  deviceId: string,
  actionId: string,
  entityId: string,
  input: Record<string, unknown> = {},
  source = "manual",
) {
  return runDeviceCommand(deviceId, actionId, { entityId, ...input }, source);
}

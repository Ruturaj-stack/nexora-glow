import { z } from "zod";
import { useDeviceStore } from "@/store/device-store";
import { getMqttConnection } from "@/lib/devices.functions";
import { mqttConnect, mqttConnectedTo, mqttPublish, mqttSubscribe, mqttUnsubscribe } from "../mqtt-manager";
import type { DeviceConnector } from "../types";

/** MQTTManager-backed connector: a broker is itself a paired device. */
export const mqttConnector: DeviceConnector = {
  id: "mqtt",
  label: "MQTT broker",
  description: "Publish, subscribe and explore topics on any WebSocket-capable MQTT broker.",
  types: ["hub", "iot"],
  connection: "mqtt",
  capabilities: ["sensors", "power", "notifications"],
  pairingMethods: ["manual"],
  fields: [
    { name: "address", label: "Broker WebSocket URL", placeholder: "wss://broker.example.com:8884/mqtt" },
    { name: "username", label: "Username", secret: true, optional: true },
    { name: "password", label: "Password", secret: true, optional: true },
  ],
  actions: [
    {
      id: "mqtt.publish",
      label: "Publish message",
      description: "Publishes a payload to a topic.",
      capability: "power",
      schema: z.object({
        topic: z.string().min(1).max(200),
        payload: z.string().max(4000).default(""),
        qos: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(0),
        retain: z.boolean().default(false),
      }),
      run: async ({ topic, payload, qos, retain }, { device }) => {
        await ensureBrokerConnection(device.id);
        return mqttPublish(topic, payload, { qos, retain });
      },
    },
    {
      id: "mqtt.subscribe",
      label: "Subscribe to topic",
      description: "Subscribes to a topic filter and streams messages into the explorer.",
      capability: "sensors",
      schema: z.object({
        topic: z.string().min(1).max(200),
        qos: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(0),
      }),
      run: async ({ topic, qos }, { device }) => {
        await ensureBrokerConnection(device.id);
        await mqttSubscribe(topic, qos);
        return { topic, qos };
      },
    },
    {
      id: "mqtt.unsubscribe",
      label: "Unsubscribe",
      description: "Stops listening to a topic filter.",
      capability: "sensors",
      schema: z.object({ topic: z.string().min(1).max(200) }),
      run: async ({ topic }) => {
        await mqttUnsubscribe(topic);
        return { topic };
      },
    },
  ],
  probe: async (device) => {
    const { mqttStatus, mqttBrokerId } = useDeviceStore.getState();
    const connected = mqttBrokerId === device.id && mqttStatus === "connected";
    return { status: connected ? "online" : "offline", state: { broker: mqttStatus } };
  },
};

/** Opens the broker connection on demand, fetching credentials server-side. */
export async function ensureBrokerConnection(deviceId: string): Promise<void> {
  if (mqttConnectedTo() === deviceId) return;
  const device = useDeviceStore.getState().devices.find((d) => d.id === deviceId);
  const descriptor = await getMqttConnection({ data: { deviceId } });
  await mqttConnect({
    ...descriptor.data,
    brokerId: deviceId,
    brokerName: device?.name ?? "MQTT broker",
  });
}

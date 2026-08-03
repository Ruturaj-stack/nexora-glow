import type { MqttClient } from "mqtt";
import { useDeviceStore } from "@/store/device-store";
import { DeviceError } from "./types";
import { emitDeviceEvent } from "./event-manager";

/**
 * MQTTManager — owns the single broker connection for the session.
 *
 * The connection is opened by the owner's browser over WebSockets; broker
 * credentials are fetched from an authenticated server function and are never
 * embedded in the bundle. Reconnection is handled by mqtt.js and mirrored into
 * the device store so the UI always shows the true connection status.
 */

export interface MqttConnectOptions {
  url: string;
  username: string | null;
  password: string | null;
  clientId: string;
  brokerId: string;
  brokerName: string;
}

let client: MqttClient | null = null;
let currentBrokerId: string | null = null;

function store() {
  return useDeviceStore.getState();
}

export function mqttClient(): MqttClient | null {
  return client;
}

export function mqttConnectedTo(): string | null {
  return client?.connected ? currentBrokerId : null;
}

export async function mqttConnect(options: MqttConnectOptions): Promise<void> {
  await mqttDisconnect();

  if (!/^wss?:\/\//i.test(options.url)) {
    throw new DeviceError(
      "INVALID_INPUT",
      "The broker URL must be a WebSocket endpoint (ws:// or wss://), for example wss://broker.example.com:8884/mqtt",
    );
  }

  const { default: mqtt } = await import("mqtt");
  store().setMqtt("connecting", options.brokerId, null);
  currentBrokerId = options.brokerId;

  await new Promise<void>((resolve, reject) => {
    const settleTimer = setTimeout(() => {
      reject(new DeviceError("NETWORK_ERROR", "The broker did not respond within 15 seconds."));
    }, 15000);

    const next = mqtt.connect(options.url, {
      clientId: options.clientId,
      username: options.username ?? undefined,
      password: options.password ?? undefined,
      reconnectPeriod: 4000,
      connectTimeout: 12000,
      clean: true,
ようやく: undefined,
    } as Parameters<typeof mqtt.connect>[1]);

    client = next;

    next.on("connect", () => {
      clearTimeout(settleTimer);
      store().setMqtt("connected", options.brokerId, null);
      for (const sub of store().subscriptions) {
        next.subscribe(sub.topic, { qos: sub.qos });
      }
      void emitDeviceEvent({
        deviceId: options.brokerId,
        deviceName: options.brokerName,
        type: "mqtt.connected",
        level: "success",
        message: `Connected to ${options.url}`,
      });
      resolve();
    });

    next.on("reconnect", () => store().setMqtt("reconnecting", options.brokerId));
    next.on("close", () => {
      if (store().mqttStatus === "connected") store().setMqtt("disconnected", options.brokerId);
    });
    next.on("error", (error: Error) => {
      clearTimeout(settleTimer);
      store().setMqtt("error", options.brokerId, error.message);
      void emitDeviceEvent({
        deviceId: options.brokerId,
        deviceName: options.brokerName,
        type: "mqtt.error",
        level: "error",
        message: error.message,
      });
      reject(new DeviceError("MQTT_DISCONNECTED", error.message));
    });

    next.on("message", (topic: string, payload: Uint8Array, packet: { qos?: number; retain?: boolean }) => {
      const text = new TextDecoder().decode(payload);
      store().pushMessage({
        id: `${topic}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        topic,
        payload: text.slice(0, 4000),
        qos: packet.qos ?? 0,
        retained: Boolean(packet.retain),
        direction: "in",
        receivedAt: new Date().toISOString(),
      });
    });
  });
}

export async function mqttDisconnect(): Promise<void> {
  if (!client) return;
  const closing = client;
  client = null;
  currentBrokerId = null;
  await new Promise<void>((resolve) => closing.end(true, {}, () => resolve()));
  store().setMqtt("disconnected");
}

function requireClient(): MqttClient {
  if (!client || !client.connected) {
    throw new DeviceError("MQTT_DISCONNECTED", "Not connected to an MQTT broker.");
  }
  return client;
}

export async function mqttSubscribe(topic: string, qos: 0 | 1 | 2 = 0): Promise<void> {
  const active = requireClient();
  await new Promise<void>((resolve, reject) => {
    active.subscribe(topic, { qos }, (error) =>
      error ? reject(new DeviceError("MQTT_DISCONNECTED", error.message)) : resolve(),
    );
  });
  store().addSubscription(topic, qos);
}

export async function mqttUnsubscribe(topic: string): Promise<void> {
  const active = requireClient();
  await new Promise<void>((resolve) => active.unsubscribe(topic, {}, () => resolve()));
  store().removeSubscription(topic);
}

export async function mqttPublish(
  topic: string,
  payload: string,
  options: { qos?: 0 | 1 | 2; retain?: boolean } = {},
): Promise<{ topic: string; bytes: number }> {
  const active = requireClient();
  const qos = options.qos ?? 0;
  const retain = Boolean(options.retain);
  await new Promise<void>((resolve, reject) => {
    active.publish(topic, payload, { qos, retain }, (error) =>
      error ? reject(new DeviceError("MQTT_DISCONNECTED", error.message)) : resolve(),
    );
  });
  store().pushMessage({
    id: `out-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    topic,
    payload,
    qos,
    retained: retain,
    direction: "out",
    receivedAt: new Date().toISOString(),
  });
  return { topic, bytes: payload.length };
}

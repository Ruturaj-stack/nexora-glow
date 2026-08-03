import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  DeviceEventRecord,
  DeviceRecord,
  DeviceStatus,
  DeviceStatusReport,
  JsonObject,
} from "@/features/devices/types";
import type { HaEntity } from "@/lib/devices/home-assistant.server";

/**
 * DeviceStateManager — the single client-side source of truth for connected
 * devices, their live state, MQTT traffic and Home Assistant entities.
 */

export type MqttStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";

export interface MqttMessage {
  id: string;
  topic: string;
  payload: string;
  qos: number;
  retained: boolean;
  direction: "in" | "out";
  receivedAt: string;
}

export interface MqttSubscription {
  topic: string;
  qos: 0 | 1 | 2;
  messages: number;
  lastPayload: string | null;
  lastAt: string | null;
}

interface DeviceState {
  devices: DeviceRecord[];
  setDevices: (devices: DeviceRecord[]) => void;
  upsertDevice: (device: DeviceRecord) => void;
  removeDevice: (id: string) => void;

  /** Live probe results keyed by device id, merged over the persisted row. */
  liveStatus: Record<string, DeviceStatusReport>;
  setStatus: (id: string, report: DeviceStatusReport) => void;
  setConnectionStatus: (id: string, status: DeviceStatus) => void;

  events: DeviceEventRecord[];
  setEvents: (events: DeviceEventRecord[]) => void;
  pushEvent: (event: DeviceEventRecord) => void;

  mqttStatus: MqttStatus;
  mqttError: string | null;
  mqttBrokerId: string | null;
  setMqtt: (status: MqttStatus, brokerId?: string | null, error?: string | null) => void;

  subscriptions: MqttSubscription[];
  addSubscription: (topic: string, qos: 0 | 1 | 2) => void;
  removeSubscription: (topic: string) => void;

  messages: MqttMessage[];
  pushMessage: (message: MqttMessage) => void;
  clearMessages: () => void;

  entities: Record<string, HaEntity[]>;
  setEntities: (deviceId: string, entities: HaEntity[]) => void;
  patchEntity: (deviceId: string, entityId: string, state: string) => void;

  selectedDeviceId: string | null;
  setSelectedDevice: (id: string | null) => void;

  search: string;
  setSearch: (value: string) => void;
  groupBy: "group" | "type" | "status";
  setGroupBy: (value: "group" | "type" | "status") => void;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set) => ({
      devices: [],
      setDevices: (devices) => set({ devices }),
      upsertDevice: (device) =>
        set((s) => ({
          devices: s.devices.some((d) => d.id === device.id)
            ? s.devices.map((d) => (d.id === device.id ? device : d))
            : [device, ...s.devices],
        })),
      removeDevice: (id) => set((s) => ({ devices: s.devices.filter((d) => d.id !== id) })),

      liveStatus: {},
      setStatus: (id, report) =>
        set((s) => ({ liveStatus: { ...s.liveStatus, [id]: { ...s.liveStatus[id], ...report } } })),
      setConnectionStatus: (id, status) =>
        set((s) => ({
          liveStatus: { ...s.liveStatus, [id]: { ...s.liveStatus[id], status } },
        })),

      events: [],
      setEvents: (events) => set({ events }),
      pushEvent: (event) => set((s) => ({ events: [event, ...s.events].slice(0, 200) })),

      mqttStatus: "disconnected",
      mqttError: null,
      mqttBrokerId: null,
      setMqtt: (status, brokerId, error) =>
        set((s) => ({
          mqttStatus: status,
          mqttBrokerId: brokerId === undefined ? s.mqttBrokerId : brokerId,
          mqttError: error ?? (status === "error" ? s.mqttError : null),
        })),

      subscriptions: [],
      addSubscription: (topic, qos) =>
        set((s) =>
          s.subscriptions.some((x) => x.topic === topic)
            ? s
            : {
                subscriptions: [
                  ...s.subscriptions,
                  { topic, qos, messages: 0, lastPayload: null, lastAt: null },
                ],
              },
        ),
      removeSubscription: (topic) =>
        set((s) => ({ subscriptions: s.subscriptions.filter((x) => x.topic !== topic) })),

      messages: [],
      pushMessage: (message) =>
        set((s) => ({
          messages: [message, ...s.messages].slice(0, 300),
          subscriptions: s.subscriptions.map((sub) =>
            topicMatches(sub.topic, message.topic)
              ? {
                  ...sub,
                  messages: sub.messages + 1,
                  lastPayload: message.payload,
                  lastAt: message.receivedAt,
                }
              : sub,
          ),
        })),
      clearMessages: () => set({ messages: [] }),

      entities: {},
      setEntities: (deviceId, entities) =>
        set((s) => ({ entities: { ...s.entities, [deviceId]: entities } })),
      patchEntity: (deviceId, entityId, state) =>
        set((s) => ({
          entities: {
            ...s.entities,
            [deviceId]: (s.entities[deviceId] ?? []).map((e) =>
              e.entityId === entityId ? { ...e, state } : e,
            ),
          },
        })),

      selectedDeviceId: null,
      setSelectedDevice: (id) => set({ selectedDeviceId: id }),

      search: "",
      setSearch: (value) => set({ search: value }),
      groupBy: "group",
      setGroupBy: (value) => set({ groupBy: value }),
    }),
    {
      name: "nexora-devices",
      partialize: (state) => ({
        subscriptions: state.subscriptions,
        groupBy: state.groupBy,
      }),
    },
  ),
);

/** MQTT topic filter matching, including `+` and `#` wildcards. */
export function topicMatches(filter: string, topic: string): boolean {
  const f = filter.split("/");
  const t = topic.split("/");
  for (let i = 0; i < f.length; i += 1) {
    if (f[i] === "#") return true;
    if (f[i] === "+") {
      if (t[i] === undefined) return false;
      continue;
    }
    if (f[i] !== t[i]) return false;
  }
  return f.length === t.length;
}

/** Merges the persisted row with any live probe result. */
export function mergeDevice(device: DeviceRecord, live?: DeviceStatusReport): DeviceRecord {
  if (!live) return device;
  return {
    ...device,
    status: live.status ?? device.status,
    battery: live.battery ?? device.battery,
    charging: live.charging ?? device.charging,
    signal: live.signal ?? device.signal,
    firmware: live.firmware || device.firmware,
    state: { ...device.state, ...((live.state ?? {}) as JsonObject) },
  };
}

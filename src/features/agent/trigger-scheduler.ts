import { useWorkflowStore } from "@/store/workflow-store";
import { useDeviceStore } from "@/store/device-store";
import { runWorkflow } from "./workflow-executor";
import type { Workflow, WorkflowTrigger } from "./types";

/**
 * TriggerScheduler — a single browser-side ticker that decides when an enabled
 * workflow should fire. It never executes anything itself: it hands the
 * workflow to the executor, which still routes every step through the Tool
 * Execution Engine and its permission gate.
 */

const TICK_MS = 20_000;

/** Last fire time per trigger, so a minute-precision trigger fires once. */
const lastFired = new Map<string, number>();
let timer: ReturnType<typeof setInterval> | null = null;
let startupDone = false;

function hhmm(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function firedRecently(id: string, withinMs: number) {
  const last = lastFired.get(id);
  return last !== undefined && Date.now() - last < withinMs;
}

function batteryBelow(threshold: number, deviceId: string) {
  const state = useDeviceStore.getState();
  const devices = deviceId ? state.devices.filter((d) => d.id === deviceId) : state.devices;
  return devices.some((device) => {
    const level = state.liveStatus[device.id]?.battery ?? device.battery;
    return typeof level === "number" && level < threshold;
  });
}

export function shouldFire(trigger: WorkflowTrigger, now = new Date()): boolean {
  if (!trigger.enabled) return false;

  switch (trigger.type) {
    case "time": {
      if (!trigger.config.at) return false;
      if (trigger.config.days.length && !trigger.config.days.includes(now.getDay())) return false;
      return hhmm(now) === trigger.config.at && !firedRecently(trigger.id, 90_000);
    }
    case "date": {
      if (!trigger.config.at) return false;
      const target = new Date(trigger.config.at).getTime();
      if (Number.isNaN(target)) return false;
      return now.getTime() >= target && !firedRecently(trigger.id, 86_400_000);
    }
    case "recurring": {
      const interval = Math.max(1, trigger.config.everyMinutes) * 60_000;
      return !firedRecently(trigger.id, interval);
    }
    case "system.startup":
      return !startupDone && !lastFired.has(trigger.id);
    case "battery.level":
      return (
        batteryBelow(trigger.config.threshold, trigger.config.deviceId) &&
        !firedRecently(trigger.id, 900_000)
      );
    case "device.connected": {
      const state = useDeviceStore.getState();
      const device = state.devices.find((d) => d.id === trigger.config.deviceId);
      if (!device) return false;
      const status = state.liveStatus[device.id]?.status ?? device.status;
      return status === "online" && !firedRecently(trigger.id, 300_000);
    }
    default:
      // manual, webhook, mqtt.message, homeassistant.event and app.launched are
      // fired by their own event sources, not by the clock.
      return false;
  }
}

async function fire(workflow: Workflow, trigger: WorkflowTrigger) {
  lastFired.set(trigger.id, Date.now());
  try {
    await runWorkflow(workflow, { trigger: trigger.type });
  } catch {
    // The executor already records failures in the run history.
  }
}

function tick() {
  const now = new Date();
  const { workflows } = useWorkflowStore.getState();
  for (const workflow of workflows) {
    if (!workflow.enabled) continue;
    for (const trigger of workflow.triggers) {
      if (shouldFire(trigger, now)) void fire(workflow, trigger);
    }
  }
  startupDone = true;
}

/** Fires any workflow listening for a runtime event such as an MQTT message. */
export function dispatchEvent(
  type: WorkflowTrigger["type"],
  match: { topic?: string; entityId?: string; appName?: string; deviceId?: string } = {},
) {
  const { workflows } = useWorkflowStore.getState();
  for (const workflow of workflows) {
    if (!workflow.enabled) continue;
    for (const trigger of workflow.triggers) {
      if (trigger.type !== type || !trigger.enabled) continue;
      const config = trigger.config;
      if (match.topic && config.topic && config.topic !== match.topic) continue;
      if (match.entityId && config.entityId && config.entityId !== match.entityId) continue;
      if (match.appName && config.appName && config.appName !== match.appName) continue;
      if (match.deviceId && config.deviceId && config.deviceId !== match.deviceId) continue;
      if (firedRecently(trigger.id, 5_000)) continue;
      void fire(workflow, trigger);
    }
  }
}

export function startScheduler() {
  if (timer || typeof window === "undefined") return;
  tick();
  timer = setInterval(tick, TICK_MS);
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

export function schedulerRunning() {
  return timer !== null;
}

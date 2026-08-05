import { useDeviceStore } from "@/store/device-store";
import type { ConditionSpec } from "./types";

/**
 * ConditionEngine — evaluates a declarative condition against live app state.
 *
 * Conditions are data, never expressions: there is no eval, no function body
 * and no way for a workflow or plugin to reach beyond the cases below.
 */

export interface ConditionResult {
  passed: boolean;
  reason: string;
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function compare(operator: ConditionSpec["operator"], left: number, right: number): boolean {
  switch (operator) {
    case "gt":
      return left > right;
    case "gte":
      return left >= right;
    case "lt":
      return left < right;
    case "lte":
      return left <= right;
    case "neq":
      return left !== right;
    default:
      return left === right;
  }
}

function compareText(operator: ConditionSpec["operator"], left: string, right: string): boolean {
  const a = left.trim().toLowerCase();
  const b = right.trim().toLowerCase();
  if (operator === "contains") return a.includes(b);
  if (operator === "neq") return a !== b;
  return a === b;
}

function minutesOfDay(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function evaluateCondition(
  condition: ConditionSpec,
  variables: Record<string, unknown> = {},
): ConditionResult {
  const numeric = Number(condition.value);

  switch (condition.type) {
    case "always":
      return { passed: true, reason: "No condition set" };

    case "internet": {
      const online = typeof navigator === "undefined" ? true : navigator.onLine;
      const expected = condition.value !== "false";
      return {
        passed: online === expected,
        reason: online ? "Internet is connected" : "Internet is offline",
      };
    }

    case "weekday": {
      const today = new Date().getDay();
      const wanted = condition.value
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);
      if (!wanted.length) {
        const isWeekday = today >= 1 && today <= 5;
        return { passed: isWeekday, reason: `Today is ${WEEKDAYS[today]}` };
      }
      const passed = wanted.includes(WEEKDAYS[today]) || wanted.includes(String(today));
      return { passed, reason: `Today is ${WEEKDAYS[today]}` };
    }

    case "timeWindow": {
      const start = minutesOfDay(condition.target);
      const end = minutesOfDay(condition.value);
      if (start === null || end === null) {
        return { passed: false, reason: "Invalid time window (expected HH:MM)" };
      }
      const now = new Date();
      const current = now.getHours() * 60 + now.getMinutes();
      const passed = start <= end ? current >= start && current <= end : current >= start || current <= end;
      return { passed, reason: `Current time ${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}` };
    }

    case "battery": {
      const state = useDeviceStore.getState();
      const device = condition.target
        ? state.devices.find((d) => d.id === condition.target)
        : undefined;
      const level = device
        ? (state.liveStatus[device.id]?.battery ?? device.battery ?? null)
        : (variables["battery"] as number | undefined) ?? null;
      if (level === null || level === undefined) {
        return { passed: false, reason: "Battery level unavailable" };
      }
      return {
        passed: compare(condition.operator, Number(level), Number.isNaN(numeric) ? 0 : numeric),
        reason: `Battery is ${level}%`,
      };
    }

    case "deviceOnline": {
      const state = useDeviceStore.getState();
      const device = state.devices.find((d) => d.id === condition.target);
      if (!device) return { passed: false, reason: "Device is not paired" };
      const status = state.liveStatus[device.id]?.status ?? device.status;
      const online = status === "online";
      const expected = condition.value !== "false";
      return { passed: online === expected, reason: `${device.name} is ${status}` };
    }

    case "haEntity": {
      const state = useDeviceStore.getState();
      const entity = Object.values(state.entities)
        .flat()
        .find((e) => e.entityId === condition.target);
      if (!entity) return { passed: false, reason: `Entity ${condition.target} not loaded` };
      return {
        passed: compareText(condition.operator, entity.state, condition.value || "on"),
        reason: `${condition.target} is ${entity.state}`,
      };
    }

    case "variable": {
      const raw = variables[condition.target];
      if (raw === undefined) return { passed: false, reason: `Variable ${condition.target} is unset` };
      const asNumber = Number(raw);
      if (!Number.isNaN(asNumber) && !Number.isNaN(numeric)) {
        return {
          passed: compare(condition.operator, asNumber, numeric),
          reason: `${condition.target} = ${raw}`,
        };
      }
      return {
        passed: compareText(condition.operator, String(raw), condition.value),
        reason: `${condition.target} = ${String(raw)}`,
      };
    }

    default:
      return { passed: false, reason: "Unknown condition" };
  }
}

export function describeCondition(condition: ConditionSpec): string {
  switch (condition.type) {
    case "always":
      return "always";
    case "battery":
      return `battery ${condition.operator} ${condition.value}%`;
    case "deviceOnline":
      return `device ${condition.target || "—"} is ${condition.value === "false" ? "offline" : "online"}`;
    case "weekday":
      return `day is ${condition.value || "a weekday"}`;
    case "internet":
      return condition.value === "false" ? "internet is offline" : "internet is connected";
    case "haEntity":
      return `${condition.target || "entity"} ${condition.operator} ${condition.value || "on"}`;
    case "variable":
      return `${condition.target || "variable"} ${condition.operator} ${condition.value}`;
    case "timeWindow":
      return `time between ${condition.target} and ${condition.value}`;
    default:
      return condition.type;
  }
}

import { toast } from "sonner";
import { useAppStore } from "@/store/app-store";
import type { DeviceEventLevel } from "./types";

/**
 * NotificationBridge — the only path from a device event into the user's
 * notification centre and toast layer.
 */

const toneFor: Record<DeviceEventLevel, "info" | "success" | "warning"> = {
  info: "info",
  success: "success",
  warning: "warning",
  error: "warning",
};

export function pushDeviceNotification(input: {
  title: string;
  body: string;
  level: DeviceEventLevel;
}) {
  useAppStore.getState().pushNotification({
    id: `dev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: input.title,
    body: input.body,
    time: "just now",
    tone: toneFor[input.level],
    read: false,
  });

  if (input.level === "error") toast.error(input.title, { description: input.body });
  else if (input.level === "warning") toast.warning(input.title, { description: input.body });
}

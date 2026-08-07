import { create } from "zustand";
import { persist } from "zustand/middleware";
import { logger } from "@/lib/observability/logger";
import { increment } from "@/lib/observability/metrics";
import { releaseInfo } from "@/config/version";

/**
 * Optional, consent-gated telemetry.
 *
 * Disabled by default and inert until the user explicitly opts in. Events
 * carry no message content, no device addresses and no identifiers — only a
 * random install id, the event name and coarse numeric fields.
 */

export type TelemetryConsent = "unset" | "granted" | "denied";

export interface TelemetryEvent {
  id: string;
  name: string;
  at: string;
  props: Record<string, string | number | boolean>;
}

interface TelemetryState {
  consent: TelemetryConsent;
  installId: string;
  queue: TelemetryEvent[];
  setConsent: (consent: TelemetryConsent) => void;
  push: (event: TelemetryEvent) => void;
  clear: () => void;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id_${Math.random().toString(36).slice(2)}`;
}

export const useTelemetryStore = create<TelemetryState>()(
  persist(
    (set) => ({
      consent: "unset",
      installId: randomId(),
      queue: [],
      setConsent: (consent) => set({ consent, ...(consent === "denied" ? { queue: [] } : {}) }),
      push: (event) => set((state) => ({ queue: [...state.queue.slice(-199), event] })),
      clear: () => set({ queue: [] }),
    }),
    { name: "nexora.telemetry" },
  ),
);

const SAFE_KEY = /^[a-z][a-z0-9_]{0,30}$/;

function sanitise(props: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!SAFE_KEY.test(key)) continue;
    if (typeof value === "number" || typeof value === "boolean") out[key] = value;
    // Strings are truncated hard so free text can never leak through.
    else if (typeof value === "string") out[key] = value.slice(0, 32);
  }
  return out;
}

/** Records an event locally. No-op unless the user granted consent. */
export function track(name: string, props: Record<string, unknown> = {}) {
  const state = useTelemetryStore.getState();
  if (state.consent !== "granted") return;
  const event: TelemetryEvent = {
    id: randomId(),
    name: name.slice(0, 60),
    at: new Date().toISOString(),
    props: sanitise(props),
  };
  state.push(event);
  increment("telemetry.event", { name: event.name });
  logger.debug(`telemetry: ${event.name}`, event.props);
}

/** The exact payload that would leave the device, for user inspection. */
export function telemetryPayload() {
  const { installId, queue } = useTelemetryStore.getState();
  return { installId, release: releaseInfo(), events: queue };
}

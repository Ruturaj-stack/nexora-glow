import { describe, it, expect, beforeEach } from "vitest";
import { useTelemetryStore, track, telemetryPayload } from "@/features/telemetry/telemetry";

describe("telemetry", () => {
  beforeEach(() => {
    useTelemetryStore.setState({ consent: "unset", queue: [] });
  });

  it("is inert until consent is granted", () => {
    track("chat.sent", { tokens: 100 });
    expect(useTelemetryStore.getState().queue).toHaveLength(0);
  });

  it("records events once consent is granted", () => {
    useTelemetryStore.getState().setConsent("granted");
    track("chat.sent", { tokens: 100 });
    const [event] = useTelemetryStore.getState().queue;
    expect(event.name).toBe("chat.sent");
    expect(event.props).toEqual({ tokens: 100 });
  });

  it("drops unsafe keys and truncates free text", () => {
    useTelemetryStore.getState().setConsent("granted");
    track("chat.sent", { "user.email": "a@b.c", note: "x".repeat(100) });
    const [event] = useTelemetryStore.getState().queue;
    expect(event.props["user.email"]).toBeUndefined();
    expect(String(event.props["note"]).length).toBe(32);
  });

  it("clears the queue when consent is withdrawn", () => {
    useTelemetryStore.getState().setConsent("granted");
    track("chat.sent");
    useTelemetryStore.getState().setConsent("denied");
    expect(telemetryPayload().events).toHaveLength(0);
  });
});

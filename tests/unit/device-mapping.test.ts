import { describe, it, expect } from "vitest";
import { generatePairingCode, toDevice } from "@/lib/devices/mapping";

describe("device mapping", () => {
  it("maps a database row onto a device record", () => {
    const device = toDevice({
      id: "d1",
      name: "Desk lamp",
      connector: "mqtt",
      address: "wss://broker.local",
      status: "online",
      battery: 88,
      capabilities: ["switch"],
      metadata: {},
      revoked: false,
    });
    expect(device.id).toBe("d1");
    expect(device.name).toBe("Desk lamp");
    expect(device.connector).toBe("mqtt");
    expect(device.revoked).toBe(false);
  });

  it("generates distinct pairing codes", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generatePairingCode()));
    expect(codes.size).toBeGreaterThan(45);
  });
});

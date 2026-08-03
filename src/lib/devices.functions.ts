import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ok, type ApiResponse } from "@/lib/api-response";
import {
  DEVICE_SELECT,
  generatePairingCode,
  toDevice,
  toEvent,
  toHistory,
  toPairing,
} from "@/lib/devices/mapping";
import type {
  DeviceEventRecord,
  JsonObject,
  DeviceHistoryRecord,
  DeviceRecord,
  PairingRecord,
} from "@/features/devices/types";
import type { HaEntity } from "@/lib/devices/home-assistant.server";

/**
 * REST-equivalent server functions for the Device Connector Framework:
 *   GET    /api/v1/devices
 *   POST   /api/v1/devices/pair            (create + approve pairing)
 *   DELETE /api/v1/devices/:id             (revokeDevice)
 *   GET    /api/v1/devices/:id/status      (getDeviceStatus)
 *   POST   /api/v1/devices/:id/action      (callHomeAssistantService / recordDeviceAction)
 *   GET    /api/v1/mqtt/topics             (getMqttConnection → client subscribes)
 *   GET    /api/v1/homeassistant/entities  (listHomeAssistantEntities)
 *
 * Credentials are encrypted at rest and never returned to the browser except
 * for MQTT, where the broker connection is opened by the owner's own client.
 */

export interface MqttConnectionDescriptor {
  url: string;
  username: string | null;
  password: string | null;
  clientId: string;
  baseTopic: string;
}

export const listDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiResponse<DeviceRecord[]>> => {
    const { data, error } = await context.supabase
      .from("devices")
      .select(DEVICE_SELECT)
      .eq("revoked", false)
      .order("favorite", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ok((data ?? []).map(toDevice));
  });

export const listPairings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiResponse<PairingRecord[]>> => {
    const { data, error } = await context.supabase
      .from("device_pairings")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return ok((data ?? []).map(toPairing));
  });

/** Step 1 of pairing — records the request. Nothing is connected yet. */
export const requestPairing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(80),
        type: z.string().min(1).max(20),
        connector: z.string().min(1).max(40),
        method: z.enum(["code", "qr", "discovery", "manual"]),
        address: z.string().trim().max(300).default(""),
        capabilities: z.array(z.string().max(30)).max(24).default([]),
        platform: z.string().max(60).default(""),
        metadata: z.record(z.string(), z.any()).default({}),
        credentials: z.record(z.string(), z.string().max(4000)).default({}),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ApiResponse<PairingRecord>> => {
    const { encryptCredentials } = await import("@/lib/devices/credentials.server");
    const hasSecrets = Object.keys(data.credentials).length > 0;
    const { data: row, error } = await context.supabase
      .from("device_pairings")
      .insert({
        user_id: context.userId,
        code: generatePairingCode(),
        method: data.method,
        name: data.name,
        type: data.type,
        connector: data.connector,
        payload: {
          address: data.address,
          platform: data.platform,
          capabilities: data.capabilities,
          metadata: data.metadata,
          secret: hasSecrets ? encryptCredentials(data.credentials) : null,
        },
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return ok(toPairing(row), "Pairing request created — approve it to finish");
  });

/** Step 2 — explicit user approval creates the device and stores its secrets. */
export const approvePairing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ pairingId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ApiResponse<DeviceRecord>> => {
    const { data: pairing, error: pairErr } = await context.supabase
      .from("device_pairings")
      .select("*")
      .eq("id", data.pairingId)
      .maybeSingle();
    if (pairErr) throw new Error(pairErr.message);
    if (!pairing) throw new Error("Pairing request not found");
    if (pairing.status !== "pending") throw new Error("This pairing request is no longer pending");
    if (new Date(pairing.expires_at).getTime() < Date.now()) {
      await context.supabase
        .from("device_pairings")
        .update({ status: "expired" })
        .eq("id", pairing.id);
      throw new Error("The pairing code expired — start again");
    }

    const payload = (pairing.payload ?? {}) as JsonObject;
    const { data: device, error } = await context.supabase
      .from("devices")
      .insert({
        user_id: context.userId,
        name: pairing.name,
        type: pairing.type,
        connector: pairing.connector,
        connection:
          pairing.connector === "mqtt"
            ? "mqtt"
            : pairing.connector === "home-assistant"
              ? "cloud"
              : "local",
        platform: String(payload["platform"] ?? ""),
        address: String(payload["address"] ?? ""),
        capabilities: (payload["capabilities"] ?? []) as string[],
        metadata: (payload["metadata"] ?? {}) as JsonObject,
        status: "idle",
      })
      .select(DEVICE_SELECT)
      .single();
    if (error) throw new Error(error.message);

    if (payload["secret"]) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: credErr } = await supabaseAdmin.from("device_credentials").upsert(
        {
          device_id: device.id,
          user_id: context.userId,
          ciphertext: String(payload["secret"]),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "device_id" },
      );
      if (credErr) throw new Error(credErr.message);
    }

    await context.supabase
      .from("device_pairings")
      .update({ status: "approved", device_id: device.id, payload: { approved: true } })
      .eq("id", pairing.id);

    await context.supabase.from("device_events").insert({
      user_id: context.userId,
      device_id: device.id,
      device_name: device.name,
      type: "device.connected",
      level: "success",
      message: `${device.name} paired successfully`,
    });

    return ok(toDevice(device), `${device.name} paired`);
  });

export const rejectPairing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ pairingId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ApiResponse<null>> => {
    const { error } = await context.supabase
      .from("device_pairings")
      .update({ status: "rejected" })
      .eq("id", data.pairingId);
    if (error) throw new Error(error.message);
    return ok(null, "Pairing request rejected");
  });

export const updateDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(80).optional(),
        favorite: z.boolean().optional(),
        group: z.string().trim().max(40).optional(),
        status: z.enum(["online", "idle", "offline", "error", "pairing"]).optional(),
        battery: z.number().int().min(0).max(100).nullable().optional(),
        charging: z.boolean().optional(),
        signal: z.number().int().min(0).max(100).nullable().optional(),
        firmware: z.string().max(60).optional(),
        state: z.record(z.string(), z.any()).optional(),
        touch: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ApiResponse<DeviceRecord>> => {
    const patch: Record<string, never> = {} as Record<string, never>;
    if (data.name !== undefined) patch["name"] = data.name;
    if (data.favorite !== undefined) patch["favorite"] = data.favorite;
    if (data.group !== undefined) patch["device_group"] = data.group || "Ungrouped";
    if (data.status !== undefined) patch["status"] = data.status;
    if (data.battery !== undefined) patch["battery"] = data.battery;
    if (data.charging !== undefined) patch["charging"] = data.charging;
    if (data.signal !== undefined) patch["signal"] = data.signal;
    if (data.firmware !== undefined) patch["firmware"] = data.firmware;
    if (data.state !== undefined) patch["state"] = data.state;
    if (data.touch) patch["last_seen_at"] = new Date().toISOString();

    const { data: row, error } = await context.supabase
      .from("devices")
      .update(patch)
      .eq("id", data.id)
      .select(DEVICE_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return ok(toDevice(row), "Device updated");
  });

/** Revocation deletes the device and cascades its encrypted credentials. */
export const revokeDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ApiResponse<null>> => {
    const { error } = await context.supabase.from("devices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return ok(null, "Device revoked and credentials destroyed");
  });

/** Returns the MQTT broker descriptor for a device the caller owns. */
export const getMqttConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ deviceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ApiResponse<MqttConnectionDescriptor>> => {
    const { data: device, error } = await context.supabase
      .from("devices")
      .select("id, address, connector, metadata")
      .eq("id", data.deviceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!device || device.connector !== "mqtt") throw new Error("MQTT broker not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cred } = await supabaseAdmin
      .from("device_credentials")
      .select("ciphertext")
      .eq("device_id", device.id)
      .eq("user_id", context.userId)
      .maybeSingle();

    let secrets: Record<string, unknown> = {};
    if (cred?.ciphertext) {
      const { decryptCredentials } = await import("@/lib/devices/credentials.server");
      secrets = decryptCredentials(cred.ciphertext);
    }
    const metadata = (device.metadata ?? {}) as JsonObject;
    return ok({
      url: device.address,
      username: (secrets["username"] as string) ?? null,
      password: (secrets["password"] as string) ?? null,
      clientId: `nexora-${context.userId.slice(0, 8)}-${Math.random().toString(36).slice(2, 8)}`,
      baseTopic: String(metadata["baseTopic"] ?? "#"),
    });
  });

export const listHomeAssistantEntities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ deviceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ApiResponse<HaEntity[]>> => {
    const { data: device, error } = await context.supabase
      .from("devices")
      .select("id, address, connector")
      .eq("id", data.deviceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!device || device.connector !== "home-assistant") {
      throw new Error("Home Assistant hub not found");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cred } = await supabaseAdmin
      .from("device_credentials")
      .select("ciphertext")
      .eq("device_id", device.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!cred?.ciphertext) throw new Error("No access token stored for this hub");

    const { decryptCredentials } = await import("@/lib/devices/credentials.server");
    const { haListEntities } = await import("@/lib/devices/home-assistant.server");
    const secrets = decryptCredentials(cred.ciphertext);
    const entities = await haListEntities(device.address, String(secrets["token"] ?? ""));

    await context.supabase
      .from("devices")
      .update({ status: "online", last_seen_at: new Date().toISOString() })
      .eq("id", device.id);

    return ok(entities, `${entities.length} entities`);
  });

export const callHomeAssistantService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        deviceId: z.string().uuid(),
        domain: z.string().regex(/^[a-z_]{1,40}$/),
        service: z.string().regex(/^[a-z_]{1,60}$/),
        entityId: z.string().max(120).optional(),
        payload: z.record(z.string(), z.any()).default({}),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ApiResponse<unknown>> => {
    const { data: device, error } = await context.supabase
      .from("devices")
      .select("id, address, connector, name")
      .eq("id", data.deviceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!device || device.connector !== "home-assistant") {
      throw new Error("Home Assistant hub not found");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cred } = await supabaseAdmin
      .from("device_credentials")
      .select("ciphertext")
      .eq("device_id", device.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!cred?.ciphertext) throw new Error("No access token stored for this hub");

    const { decryptCredentials } = await import("@/lib/devices/credentials.server");
    const { haCallService } = await import("@/lib/devices/home-assistant.server");
    const secrets = decryptCredentials(cred.ciphertext);
    const body = data.entityId
      ? { entity_id: data.entityId, ...data.payload }
      : { ...data.payload };
    const result = await haCallService(
      device.address,
      String(secrets["token"] ?? ""),
      data.domain,
      data.service,
      body,
    );
    return ok(result, `${data.domain}.${data.service} called`);
  });

export const probeHomeAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ deviceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ApiResponse<{ version: string }>> => {
    const { data: device } = await context.supabase
      .from("devices")
      .select("id, address")
      .eq("id", data.deviceId)
      .maybeSingle();
    if (!device) throw new Error("Hub not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cred } = await supabaseAdmin
      .from("device_credentials")
      .select("ciphertext")
      .eq("device_id", device.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!cred?.ciphertext) throw new Error("No access token stored for this hub");

    const { decryptCredentials } = await import("@/lib/devices/credentials.server");
    const { haPing } = await import("@/lib/devices/home-assistant.server");
    const version = await haPing(device.address, String(decryptCredentials(cred.ciphertext)["token"] ?? ""));
    await context.supabase
      .from("devices")
      .update({ status: "online", firmware: version, last_seen_at: new Date().toISOString() })
      .eq("id", device.id);
    return ok({ version });
  });

export const listDeviceEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiResponse<DeviceEventRecord[]>> => {
    const { data, error } = await context.supabase
      .from("device_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return ok((data ?? []).map(toEvent));
  });

export const recordDeviceEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        deviceId: z.string().uuid().nullable().default(null),
        deviceName: z.string().max(80).default(""),
        type: z.string().min(1).max(60),
        level: z.enum(["info", "success", "warning", "error"]).default("info"),
        message: z.string().max(400).default(""),
        payload: z.record(z.string(), z.any()).default({}),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ApiResponse<DeviceEventRecord>> => {
    const { data: row, error } = await context.supabase
      .from("device_events")
      .insert({
        user_id: context.userId,
        device_id: data.deviceId,
        device_name: data.deviceName,
        type: data.type,
        level: data.level,
        message: data.message,
        payload: data.payload,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return ok(toEvent(row));
  });

export const clearDeviceEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiResponse<null>> => {
    const { error } = await context.supabase
      .from("device_events")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return ok(null, "Event stream cleared");
  });

export const listDeviceHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiResponse<DeviceHistoryRecord[]>> => {
    const { data, error } = await context.supabase
      .from("device_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return ok((data ?? []).map(toHistory));
  });

export const recordDeviceAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        deviceId: z.string().uuid().nullable().default(null),
        deviceName: z.string().max(80).default(""),
        action: z.string().min(1).max(80),
        status: z.enum(["success", "error", "cancelled"]).default("success"),
        detail: z.string().max(600).default(""),
        durationMs: z.number().int().min(0).max(3_600_000).default(0),
        source: z.string().max(40).default("manual"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ApiResponse<DeviceHistoryRecord>> => {
    const { data: row, error } = await context.supabase
      .from("device_history")
      .insert({
        user_id: context.userId,
        device_id: data.deviceId,
        device_name: data.deviceName,
        action: data.action,
        status: data.status,
        detail: data.detail,
        duration_ms: data.durationMs,
        source: data.source,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return ok(toHistory(row));
  });

export const clearDeviceHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiResponse<null>> => {
    const { error } = await context.supabase
      .from("device_history")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return ok(null, "Device history cleared");
  });

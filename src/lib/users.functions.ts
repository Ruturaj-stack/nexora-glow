import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ok, type ApiResponse } from "@/lib/api-response";
import { updateProfileSchema, updateSettingsSchema } from "@/lib/validators/auth";
import { describeDevice } from "@/lib/device";

export interface MeProfile {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeSettings {
  theme: string;
  accentColor: string;
  language: string;
  notifications: boolean;
  timezone: string;
}

export interface MePayload {
  profile: MeProfile;
  settings: MeSettings | null;
}

/** GET /api/v1/users/me */
export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiResponse<MePayload>> => {
    const { supabase, userId } = context;

    const [{ data: profile, error }, { data: settings }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    if (error) throw new Error(error.message);
    if (!profile) throw new Error("Profile not found");

    return ok(
      {
        profile: {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          avatar: profile.avatar,
          role: roles?.[0]?.role ?? "user",
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        },
        settings: settings
          ? {
              theme: settings.theme,
              accentColor: settings.accent_color,
              language: settings.language,
              notifications: settings.notifications,
              timezone: settings.timezone,
            }
          : null,
      },
      "Profile loaded",
    );
  });

/** PUT /api/v1/users/me */
export const updateMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateProfileSchema.parse(input))
  .handler(async ({ data, context }): Promise<ApiResponse<{ id: string }>> => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ name: data.name, avatar: data.avatar })
      .eq("id", context.userId);

    if (error) throw new Error(error.message);
    return ok({ id: context.userId }, "Profile updated");
  });

export const updateMySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSettingsSchema.parse(input))
  .handler(async ({ data, context }): Promise<ApiResponse<null>> => {
    const { error } = await context.supabase.from("user_settings").upsert(
      {
        user_id: context.userId,
        theme: data.theme,
        accent_color: data.accentColor,
        language: data.language,
        notifications: data.notifications,
        timezone: data.timezone,
      },
      { onConflict: "user_id" },
    );

    if (error) throw new Error(error.message);
    return ok(null, "Settings updated");
  });

/** DELETE /api/v1/users/me — removes the auth user; cascades wipe all owned rows. */
export const deleteMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiResponse<null>> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);
    return ok(null, "Account deleted");
  });

/** Records the current device/session for the signed-in user (audit trail). */
export const recordSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiResponse<null>> => {
    const request = getRequest();
    const userAgent = request?.headers.get("user-agent") ?? null;
    const ip =
      request?.headers.get("cf-connecting-ip") ??
      request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      null;

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

    await context.supabase.from("user_sessions").insert({
      user_id: context.userId,
      device: describeDevice(userAgent),
      ip_address: ip,
      user_agent: userAgent,
      expires_at: expiresAt,
    });

    return ok(null, "Session recorded");
  });

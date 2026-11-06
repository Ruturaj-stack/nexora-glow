import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ok, type ApiResponse } from "@/lib/api-response";
import { nextOccurrence, type Recurrence } from "@/lib/schedule-parser";

/**
 * Reminder engine API:
 *   GET   /api/v1/reminders         — all items, newest first
 *   POST  /api/v1/reminders         — create (alarm | reminder | timer)
 *   PATCH /api/v1/reminders/:id     — update status/snooze/edit fields
 *   DELETE /api/v1/reminders/:id    — remove
 */

export interface ScheduledReminder {
  id: string;
  kind: "alarm" | "reminder" | "timer";
  title: string;
  message: string;
  dueAt: string;
  timezone: string;
  recurrence: Recurrence;
  status: "pending" | "paused" | "completed" | "cancelled";
  snoozeCount: number;
  source: string;
  createdAt: string;
}

interface ReminderRow {
  id: string;
  kind: string;
  title: string;
  message: string;
  due_at: string;
  timezone: string;
  recurrence: Recurrence;
  status: string;
  snooze_count: number;
  source: string;
  created_at: string;
}

function toReminder(row: ReminderRow): ScheduledReminder {
  return {
    id: row.id,
    kind: row.kind as ScheduledReminder["kind"],
    title: row.title,
    message: row.message,
    dueAt: row.due_at,
    timezone: row.timezone,
    recurrence: row.recurrence ?? { type: "none" },
    status: row.status as ScheduledReminder["status"],
    snoozeCount: row.snooze_count,
    source: row.source,
    createdAt: row.created_at,
  };
}

const RECURRENCE_SCHEMA = z.object({
  type: z.enum(["none", "daily", "weekly", "interval"]),
  weekday: z.number().int().min(0).max(6).optional(),
  intervalDays: z.number().int().min(1).max(365).optional(),
});

export const listReminders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiResponse<ScheduledReminder[]>> => {
    const { data, error } = await context.supabase
      .from("scheduled_reminders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return ok((data ?? []).map((row) => toReminder(row as ReminderRow)), "Reminders");
  });

export const createReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        kind: z.enum(["alarm", "reminder", "timer"]),
        title: z.string().trim().min(1).max(200),
        message: z.string().max(500).default(""),
        dueAt: z.string().datetime(),
        timezone: z.string().min(1).max(64),
        recurrence: RECURRENCE_SCHEMA.default({ type: "none" }),
        source: z.enum(["manual", "chat", "voice", "workflow"]).default("manual"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ApiResponse<ScheduledReminder>> => {
    const due = new Date(data.dueAt);
    if (Number.isNaN(due.getTime())) throw new Error("The scheduled time is not a valid date.");
    const { data: row, error } = await context.supabase
      .from("scheduled_reminders")
      .insert({
        user_id: context.userId,
        kind: data.kind,
        title: data.title,
        message: data.message,
        due_at: due.toISOString(),
        timezone: data.timezone,
        recurrence: data.recurrence,
        source: data.source,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return ok(toReminder(row as ReminderRow), "Scheduled");
  });

export const updateReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "paused", "completed", "cancelled"]).optional(),
        dueAt: z.string().datetime().optional(),
        title: z.string().trim().min(1).max(200).optional(),
        message: z.string().max(500).optional(),
        snoozeMinutes: z.number().int().min(1).max(24 * 60).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ApiResponse<ScheduledReminder | null>> => {
    const patch: Record<string, unknown> = {};
    if (data.status) patch.status = data.status;
    if (data.title) patch.title = data.title;
    if (data.message !== undefined) patch.message = data.message;
    if (data.dueAt) patch.due_at = new Date(data.dueAt).toISOString();
    if (data.snoozeMinutes) {
      const base = data.dueAt ? new Date(data.dueAt) : new Date();
      patch.due_at = new Date(base.getTime() + data.snoozeMinutes * 60_000).toISOString();
      patch.status = "pending";
      patch.snooze_count = undefined; // incremented separately below
    }

    if (data.snoozeMinutes || data.status === "completed") {
      const { data: current } = await context.supabase
        .from("scheduled_reminders")
        .select("snooze_count, recurrence, kind, title, message, timezone, source")
        .eq("id", data.id)
        .maybeSingle();
      if (current) {
        if (data.snoozeMinutes) patch.snooze_count = (current.snooze_count ?? 0) + 1;
        if (data.status === "completed") {
          const next = nextOccurrence(new Date(), current.recurrence as Recurrence);
          if (next) {
            await context.supabase.from("scheduled_reminders").insert({
              user_id: context.userId,
              kind: current.kind,
              title: current.title,
              message: current.message,
              due_at: next.toISOString(),
              timezone: current.timezone,
              recurrence: current.recurrence,
              source: current.source,
            });
          }
        }
      }
    }

    if (Object.keys(patch).length === 0) return ok(null, "Nothing to update");

    const { data: row, error } = await context.supabase
      .from("scheduled_reminders")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return ok(row ? toReminder(row as ReminderRow) : null, "Updated");
  });

export const deleteReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ApiResponse<null>> => {
    const { error } = await context.supabase
      .from("scheduled_reminders")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return ok(null, "Removed");
  });

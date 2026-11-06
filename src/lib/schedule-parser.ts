/**
 * ScheduleParser — deterministic natural-language scheduling extraction.
 * Pure and client-safe: shared by the chat tool flow and the Alarms page.
 *
 * Returns a needsClarification reason when an essential time is ambiguous;
 * the caller must ask before scheduling in that case.
 */

export type ReminderKind = "alarm" | "reminder" | "timer";

export interface Recurrence {
  type: "none" | "daily" | "weekly" | "interval";
  /** 0 = Sunday … 6 = Saturday, for weekly */
  weekday?: number;
  intervalDays?: number;
}

export interface ParsedSchedule {
  ok: boolean;
  kind: ReminderKind;
  title: string;
  message: string;
  /** ISO UTC instant, present only when ok */
  dueAt?: string;
  /** IANA timezone the time was interpreted in */
  timezone: string;
  recurrence: Recurrence;
  /** Set when a required time/date is missing or ambiguous — ask the user */
  needsClarification?: string;
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function stripTitle(raw: string, kind: ReminderKind): string {
  const cleaned = raw
    .replace(/^(please\s+)?(can you\s+)?/i, "")
    .replace(/^remind me (to\s+|that\s+|about\s+)?/i, "")
    .replace(/^(set|create|add|schedule)\s+(an?\s+)?(alarm|reminder|timer)\s*(for|to|at)?\s*/i, "")
    .replace(/^wake me( up)?(\s+(at|for|by))?/i, "")
    .replace(/^set\s+(an?\s+)?(alarm|timer)(\s+(for|to|of))?/i, "")
    .replace(/^(an?\s+)?(alarm|reminder|timer)\s*(for|to|at)\s*/i, "")
    .replace(/\s+(every\s+\w+|daily)\s*$/i, "")
    .replace(/^(to|for)\s+/i, "")
    .replace(/\s+please\s*$/i, "")
    .trim();
  if (cleaned) return cleaned;
  return kind === "alarm" ? "Alarm" : kind === "timer" ? "Timer" : "Reminder";
}

interface TimeResult {
  hour: number;
  minute: number;
  meridiem: "am" | "pm" | "none";
}

function extractClockTime(text: string): TimeResult | null {
  const m =
    /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\b/i.exec(text) ??
    /\bat\s+(\d{1,2})([:.](\d{2}))?\s*(hours|hrs|o'clock)?\b/i.exec(text) ??
    /\b(\d{1,2})[:.](\d{2})\b/.exec(text);
  if (!m) return null;
  const meridiemRaw = (m[3] ?? "").toLowerCase().replace(".", "");
  const meridiem: TimeResult["meridiem"] =
    meridiemRaw === "am" || meridiemRaw === "a.m" ? "am" : meridiemRaw === "pm" || meridiemRaw === "p.m" ? "pm" : "none";
  return { hour: Number(m[1]), minute: m[2] ? Number(m[2]) : 0, meridiem };
}

function extractRelative(text: string): { ms: number } | null {
  const m = /\bin\s+(\d+)\s*(minutes?|mins?|hours?|hrs?|seconds?|secs?)\b/i.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const ms = unit.startsWith("sec") ? n * 1000 : unit.startsWith("min") ? n * 60_000 : n * 3_600_000;
  return { ms };
}

function detectRecurrence(text: string): Recurrence | null {
  const lower = text.toLowerCase();
  if (/\b(every|each)\s+day\b|\bdaily\b/.test(lower)) return { type: "daily" };
  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (new RegExp(`\\b(every|each)\\s+${WEEKDAYS[i]}s?\\b`).test(lower)) return { type: "weekly", weekday: i };
  }
  const interval = /\b(every|each)\s+(\d+)\s+days?\b/.exec(lower);
  if (interval) return { type: "interval", intervalDays: Number(interval[2]) };
  return null;
}

function dayQualifier(text: string): "today" | "tomorrow" | "weekday" | "none" {
  const lower = text.toLowerCase();
  if (/\btomorrow\b/.test(lower)) return "tomorrow";
  if (/\btoday\b|\btonight\b/.test(lower)) return "today";
  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (new RegExp(`\\b(on\\s+)?${WEEKDAYS[i]}\\b`).test(lower)) return "weekday";
  }
  return "none";
}

/**
 * Interprets a scheduling phrase. Times are resolved in `now`'s timezone.
 * Ambiguity policy: 12 with no meridiem → pm (noon); 24-hour (>12) → as-is;
 * 1–11 with no meridiem and no "morning/evening" qualifier → ask the user.
 */
export function parseSchedule(text: string, now = new Date()): ParsedSchedule {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const lower = text.toLowerCase();

  const recurrence = detectRecurrence(text) ?? { type: "none" as const };
  const kind: ReminderKind = /\btimer\b/.test(lower)
    ? "timer"
    : /\balarm\b|\bwake me\b/.test(lower)
      ? "alarm"
      : "reminder";
  const title = stripTitle(text, kind);

  const relative = extractRelative(text);
  const clock = extractClockTime(text);
  const day = dayQualifier(text);

  const eveningHint = /\b(evening|tonight|night|noon|afternoon)\b/.test(lower);
  const morningHint = /\b(morning|breakfast)\b/.test(lower);

  let due: Date | null = null;
  let needsClarification: string | undefined;

  if (relative) {
    if (kind === "alarm") {
      needsClarification = "Did you mean a timer for that duration, or an alarm at a clock time (for example 6 AM)?";
    } else {
      due = new Date(now.getTime() + relative.ms);
    }
  } else if (clock) {
    let hour = clock.hour;
    let meridiem = clock.meridiem;
    if (meridiem === "none") {
      if (hour === 12) meridiem = "pm";
      else if (hour > 12) {
        /* 24-hour clock */
        if (hour > 23) {
          return {
            ok: false, kind, title, message: "", timezone, recurrence,
            needsClarification: `"${clock.hour}" is not a valid hour. Try a 12-hour time like "6 PM" or 24-hour like 18:00.`,
          };
        }
      } else if (morningHint) meridiem = "am";
      else if (eveningHint) meridiem = "pm";
      else {
        return {
          ok: false, kind, title, message: "", timezone, recurrence,
          needsClarification: `Is that ${hour} in the morning or ${hour} in the evening?`,
        };
      }
    }
    if (meridiem === "am" && hour === 12) hour = 0;
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (hour > 23 || minuteInvalid(clock.minute)) {
      return {
        ok: false, kind, title, message: "", timezone, recurrence,
        needsClarification: "That time doesn't look valid. Try something like 6 AM or 17:30.",
      };
    }
    const at = new Date(now);
    at.setHours(hour, clock.minute, 0, 0);
    if (day === "tomorrow" || (day === "weekday" && recurrence.type === "none")) {
      at.setDate(at.getDate() + (day === "tomorrow" ? 1 : daysUntil(at.getDay(), recurrence.weekday ?? 0)));
    } else if (day === "weekday" && recurrence.type !== "none") {
      at.setDate(at.getDate() + daysUntil(at.getDay(), recurrence.weekday ?? 0));
    } else if (at.getTime() <= now.getTime() && day === "none") {
      at.setDate(at.getDate() + 1);
    }
    if (at.getTime() <= now.getTime() && day === "tomorrow") {
      /* tomorrow's clock time already set via +1 day */
    }
    due = at;
  } else {
    needsClarification =
      kind === "timer"
        ? "How long should the timer run?"
        : `What time should the ${kind} be set for?`;
  }

  if (!due) {
    return { ok: false, kind, title, message: "", timezone, recurrence, needsClarification };
  }
  return {
    ok: true,
    kind,
    title,
    message: "",
    dueAt: due.toISOString(),
    timezone,
    recurrence,
  };
}

function minuteInvalid(minute: number) {
  return !Number.isFinite(minute) || minute < 0 || minute > 59;
}

function daysUntil(from: number, target: number): number {
  const delta = (target - from + 7) % 7;
  return delta === 0 ? 7 : delta;
}

/** Computes the next occurrence for a recurring item, from a completion instant. */
export function nextOccurrence(from: Date, recurrence: Recurrence): Date | null {
  switch (recurrence.type) {
    case "daily": {
      const next = new Date(from);
      next.setDate(next.getDate() + 1);
      return next;
    }
    case "weekly": {
      const next = new Date(from);
      next.setDate(next.getDate() + 7);
      return next;
    }
    case "interval": {
      const next = new Date(from);
      next.setDate(next.getDate() + Math.max(recurrence.intervalDays ?? 1, 1));
      return next;
    }
    default:
      return null;
  }
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ok, type ApiResponse } from "@/lib/api-response";
import type { EmailSummary } from "@/lib/gmail.server";

/**
 * Email API (read-only):
 *   GET /api/v1/email/today      — today's received mail, classified
 *   GET /api/v1/email/important  — unread/important mail needing attention
 *   GET /api/v1/email/search     — Gmail search syntax
 *   GET /api/v1/email/status     — connection / ownership status
 */

export interface EmailResult {
  status: "ok" | "not_connected" | "not_owner" | "auth_expired" | "provider_error";
  message: string;
  mailbox?: string;
  emails: EmailSummary[];
  counts: Record<string, number>;
}

async function run(
  claims: { email?: string },
  query: string,
  max: number,
  filter?: (e: EmailSummary) => boolean,
): Promise<EmailResult> {
  const { assertMailboxOwner, listEmails, GmailAccessError } = await import("@/lib/gmail.server");
  try {
    const mailbox = await assertMailboxOwner(claims.email);
    let emails = await listEmails({ query, max });
    if (filter) emails = emails.filter(filter);
    const counts: Record<string, number> = {};
    for (const e of emails) counts[e.category] = (counts[e.category] ?? 0) + 1;
    return { status: "ok", message: `${emails.length} emails`, mailbox, emails, counts };
  } catch (error) {
    if (error instanceof GmailAccessError) {
      return { status: error.code, message: error.message, emails: [], counts: {} };
    }
    throw error;
  }
}

export const emailToday = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiResponse<EmailResult>> => {
    const result = await run(context.claims as { email?: string }, "newer_than:1d in:inbox", 25);
    return ok(result, result.message);
  });

export const emailImportant = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiResponse<EmailResult>> => {
    const result = await run(
      context.claims as { email?: string },
      "in:inbox newer_than:7d (is:important OR is:starred OR is:unread)",
      25,
      (e) => ["critical", "important", "action_required"].includes(e.category),
    );
    return ok(result, result.message);
  });

export const emailSearch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ query: z.string().trim().min(1).max(200), max: z.number().int().min(1).max(25).default(10) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ApiResponse<EmailResult>> => {
    const result = await run(context.claims as { email?: string }, data.query, data.max);
    return ok(result, result.message);
  });

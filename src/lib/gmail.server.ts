/**
 * Email Intelligence — Gmail via the gateway-backed connector (server only).
 *
 * Read-only by design: this module only issues GET requests. The connected
 * mailbox belongs to the workspace connection, so access is restricted to the
 * app user whose verified sign-in email matches the mailbox address.
 */

const GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

export type EmailCategory =
  | "critical"
  | "important"
  | "action_required"
  | "informational"
  | "promotional"
  | "low_priority";

export interface EmailSummary {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  receivedAt: string;
  snippet: string;
  unread: boolean;
  providerImportant: boolean;
  category: EmailCategory;
  reasons: string[];
  hasAttachments: boolean;
  link: string;
}

export class GmailAccessError extends Error {
  constructor(
    public readonly code: "not_connected" | "not_owner" | "auth_expired" | "provider_error",
    message: string,
  ) {
    super(message);
  }
}

function env() {
  const key = process.env["LOVABLE_API_KEY"];
  const connection = process.env["GOOGLE_MAIL_API_KEY"];
  if (!key || !connection) {
    throw new GmailAccessError("not_connected", "Gmail is not connected to Nexora yet.");
  }
  return { key, connection };
}

async function gmailGet<T>(path: string, params?: URLSearchParams): Promise<T> {
  const { key, connection } = env();
  const url = `${GATEWAY}${path}${params ? `?${params.toString()}` : ""}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, "X-Connection-Api-Key": connection },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const body = await response.text();
    console.error(`Gmail request failed [${response.status}]: ${body.slice(0, 300)}`);
    if (response.status === 401) {
      throw new GmailAccessError("auth_expired", "The Gmail connection needs to be re-authorised.");
    }
    throw new GmailAccessError("provider_error", `Gmail returned an error (status ${response.status}).`);
  }
  return (await response.json()) as T;
}

/** Throws unless the signed-in user's email matches the connected mailbox. */
export async function assertMailboxOwner(userEmail: string | undefined): Promise<string> {
  const profile = await gmailGet<{ emailAddress: string }>("/users/me/profile");
  const mailbox = profile.emailAddress.toLowerCase();
  if (!userEmail || userEmail.toLowerCase() !== mailbox) {
    throw new GmailAccessError(
      "not_owner",
      "The connected mailbox belongs to a different account. Sign in with the same email as the connected Gmail address to read it.",
    );
  }
  return mailbox;
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: { name: string; value: string }[];
    parts?: { filename?: string }[];
    mimeType?: string;
  };
}

const URGENCY = /\b(urgent|asap|immediately|action required|final notice|overdue|deadline|due (today|tomorrow)|expires?|important)\b/i;
const ACTION = /\b(please (review|confirm|respond|reply|sign|submit|complete)|rsvp|approve|your (approval|response) is needed|requires? your|kindly)\b/i;
const SECURITY = /\b(security alert|password reset|sign-?in attempt|verify your|suspicious|2-step|verification code)\b/i;

/** Pure classifier — exported for tests. Explains every decision. */
export function classifyEmail(input: {
  labels: string[];
  from: string;
  subject: string;
  snippet: string;
  priorityKeywords?: string[];
}): { category: EmailCategory; reasons: string[] } {
  const reasons: string[] = [];
  const text = `${input.subject} ${input.snippet}`;
  const labels = new Set(input.labels);
  const providerImportant = labels.has("IMPORTANT");

  if (labels.has("CATEGORY_PROMOTIONS")) {
    return { category: "promotional", reasons: ["Gmail placed this in Promotions"] };
  }
  if (labels.has("CATEGORY_SOCIAL") || labels.has("CATEGORY_FORUMS")) {
    return { category: "low_priority", reasons: ["Gmail categorised this as Social/Forums"] };
  }

  if (SECURITY.test(text)) reasons.push("Estimated: mentions account security");
  if (URGENCY.test(text)) reasons.push("Estimated: contains urgency or deadline wording");
  if (ACTION.test(text)) reasons.push("Estimated: asks you to take an action");
  const keywordHit = (input.priorityKeywords ?? []).find((k) =>
    `${input.from} ${text}`.toLowerCase().includes(k.toLowerCase()),
  );
  if (keywordHit) reasons.push(`Matches your priority keyword “${keywordHit}”`);
  if (providerImportant) reasons.push("Gmail marked this as important");
  if (labels.has("STARRED")) reasons.push("You starred this");

  if (SECURITY.test(text) && URGENCY.test(text)) return { category: "critical", reasons };
  if (ACTION.test(text)) return { category: "action_required", reasons };
  if (URGENCY.test(text) || keywordHit || (providerImportant && labels.has("STARRED"))) {
    return { category: "important", reasons };
  }
  if (providerImportant) return { category: "important", reasons };
  if (labels.has("CATEGORY_UPDATES")) {
    return { category: "informational", reasons: ["Gmail categorised this as Updates"] };
  }
  return { category: "informational", reasons: reasons.length ? reasons : ["No priority signals found"] };
}

function header(msg: GmailMessage, name: string): string {
  return msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

async function fetchMetadata(id: string): Promise<GmailMessage> {
  const params = new URLSearchParams({ format: "metadata" });
  for (const h of ["From", "Subject", "Date"]) params.append("metadataHeaders", h);
  return gmailGet<GmailMessage>(`/users/me/messages/${encodeURIComponent(id)}`, params);
}

export async function listEmails(options: {
  query: string;
  max: number;
  priorityKeywords?: string[];
}): Promise<EmailSummary[]> {
  const list = await gmailGet<{ messages?: { id: string }[] }>(
    "/users/me/messages",
    new URLSearchParams({ q: options.query, maxResults: String(Math.min(options.max, 25)) }),
  );
  const ids = (list.messages ?? []).map((m) => m.id);
  const messages = await Promise.all(ids.map((id) => fetchMetadata(id)));

  return messages.map((msg) => {
    const labels = msg.labelIds ?? [];
    const from = header(msg, "From");
    const subject = header(msg, "Subject") || "(no subject)";
    const snippet = msg.snippet ?? "";
    const { category, reasons } = classifyEmail({
      labels, from, subject, snippet, priorityKeywords: options.priorityKeywords,
    });
    return {
      id: msg.id,
      threadId: msg.threadId,
      from,
      subject,
      receivedAt: msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : "",
      snippet,
      unread: labels.includes("UNREAD"),
      providerImportant: labels.includes("IMPORTANT"),
      category,
      reasons,
      hasAttachments: (msg.payload?.parts ?? []).some((p) => Boolean(p.filename)),
      link: `https://mail.google.com/mail/u/0/#inbox/${msg.threadId}`,
    };
  });
}

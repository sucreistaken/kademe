import { and, eq, isNull } from "drizzle-orm";
import { after } from "next/server";
import nodemailer from "nodemailer";
import { db } from "@/db";
import { messageOutbox } from "@/db/schema";
import { outboxLinkPlaceholder } from "@/lib/outbox";

/**
 * Sends message_outbox rows by SMTP. Off unless the server has SMTP_HOST,
 * SMTP_USER and SMTP_PASS: then nothing is sent and the panel works as
 * before (the manager copies the links). The row is written first, in the
 * caller's transaction, and sent after the response, so a slow or broken
 * mail server never fails or delays an invitation; the outcome lands in the
 * row (`sent_at`, or `error`).
 */

export type MailConfig = { host: string; port: number; secure: boolean; user: string; pass: string; from: string };

/** The SMTP settings from the environment, or null where mail is off. Pure. */
export function mailConfig(env: Record<string, string | undefined>): MailConfig | null {
  const host = env.SMTP_HOST?.trim();
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = Number(env.SMTP_PORT) || 465;
  return { host, port, secure: port === 465, user, pass, from: env.MAIL_FROM?.trim() || user };
}

export const mailEnabled = () => mailConfig(process.env) !== null;

/** One outbox row to send; `link` replaces the row's link placeholder (src/lib/outbox.ts). */
export type OutboxSend = { id: string; assessmentId?: string; link?: string };

/**
 * The text that goes out, or why it cannot. Pure. A body that still holds a
 * link placeholder is never sent, nor is a placeholder address (`.local`).
 */
export function outgoingBody(row: { toEmail: string; body: string }, item: OutboxSend): { ok: true; body: string } | { ok: false; error: string } {
  if (/\.local$/i.test(row.toEmail.trim())) return { ok: false, error: "NO_ADDRESS" };
  let body = row.body;
  if (item.assessmentId && item.link) body = body.split(outboxLinkPlaceholder(item.assessmentId)).join(item.link);
  if (/\{\{link:[^}]*\}\}/.test(body)) return { ok: false, error: "NO_LINK" };
  return { ok: true, body };
}

/** Sends the rows now, one by one; a failure is recorded on its row and does not stop the rest. */
export async function deliverOutbox(items: OutboxSend[], config: MailConfig | null = mailConfig(process.env)): Promise<void> {
  if (!config || items.length === 0) return;
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });
  try {
    for (const item of items) {
      const [row] = await db
        .select({ toEmail: messageOutbox.toEmail, subject: messageOutbox.subject, body: messageOutbox.body })
        .from(messageOutbox)
        .where(and(eq(messageOutbox.id, item.id), isNull(messageOutbox.sentAt)));
      if (!row) continue;
      const out = outgoingBody(row, item);
      try {
        if (!out.ok) throw new Error(out.error);
        await transport.sendMail({ from: config.from, to: row.toEmail, subject: row.subject, text: out.body });
        await db.update(messageOutbox).set({ sentAt: new Date(), error: null }).where(eq(messageOutbox.id, item.id));
      } catch (e) {
        const error = (e instanceof Error ? e.message : String(e)).slice(0, 500);
        console.error(`[mail] outbox ${item.id} not sent: ${error}`);
        await db.update(messageOutbox).set({ error }).where(eq(messageOutbox.id, item.id));
      }
    }
  } finally {
    transport.close();
  }
}

/**
 * Sends the rows after the response (server actions and route handlers
 * only). Returns whether mail is on, so the panel can say the students were
 * mailed.
 */
export function sendOutboxAfterResponse(items: OutboxSend[]): boolean {
  const config = mailConfig(process.env);
  if (!config) return false;
  if (items.length) after(() => deliverOutbox(items, config));
  return true;
}

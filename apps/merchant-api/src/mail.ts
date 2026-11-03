/**
 * Outbound email. MAIL_TRANSPORT picks the provider:
 *   smtp   (default) any SMTP server; locally and on Railway that is Mailpit, which
 *          catches every address and shows them in a web inbox
 *   resend Resend over HTTPS; without a verified domain it only delivers to the
 *          account owner's address, so RESEND_TO_OVERRIDE redirects there
 * Every send is also recorded in the outbox table so the storefront can show the
 * link even if delivery fails.
 */
import nodemailer from "nodemailer";
import { Resend } from "resend";
import { db } from "./db/client.js";
import { outbox } from "./db/schema.js";
import { newId } from "./lg.js";

const FROM = process.env.MAIL_FROM ?? "Orchard & Vine <orders@orchardandvine.demo>";
const transport = process.env.MAIL_TRANSPORT ?? "smtp";

const smtp = transport === "smtp"
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "localhost",
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: false,
      ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } } : {}),
    })
  : null;
const resend = transport === "resend" && process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendMail(to: string, subject: string, body: string, link?: string) {
  const id = newId("mail");
  const target = transport === "resend" ? (process.env.RESEND_TO_OVERRIDE ?? to) : to;
  let delivered = false;
  let error: string | null = null;
  try {
    if (smtp) {
      await smtp.sendMail({ from: FROM, to: target, subject, text: body });
      delivered = true;
    } else if (resend) {
      const r = await resend.emails.send({ from: "Orchard & Vine <onboarding@resend.dev>", to: target, subject, text: body });
      delivered = !r.error;
      error = r.error ? String(r.error.message) : null;
    } else {
      error = `mail transport "${transport}" not configured; outbox only`;
    }
  } catch (e) {
    error = String(e);
  }
  await db.insert(outbox).values({ id, to: target, subject, body, link: link ?? null, delivered, error });
  return { id, delivered, error };
}

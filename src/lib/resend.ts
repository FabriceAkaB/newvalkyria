import { Resend } from "resend";

import { env } from "@/lib/env";

let resend: Resend | null = null;

interface MailPayload {
  from?: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  bcc?: string | string[];
  cc?: string | string[];
  replyTo?: string | string[];
  reply_to?: string | string[];
}

/** Envoi par la boîte Gmail / Google Workspace de l'académie (SMTP avec mot de
 *  passe d'application) — même interface que `resend.emails.send`, pour que
 *  TOUS les courriels du site (confirmations, reçus, campagne…) partent de
 *  info@newvalkyria.com sans modifier chaque appel. Actif seulement si
 *  GMAIL_SMTP_USER et GMAIL_SMTP_APP_PASSWORD sont définis. */
function createGmailMailer(user: string, pass: string) {
  return {
    emails: {
      async send(payload: MailPayload) {
        try {
          const nodemailer = await import("nodemailer");
          const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass: pass.replace(/\s+/g, "") } });
          const fromName = process.env.GMAIL_SMTP_FROM_NAME ?? "New Valkyria";
          const info = await transport.sendMail({
            from: `${fromName} <${user}>`,
            to: payload.to,
            cc: payload.cc,
            bcc: payload.bcc,
            subject: payload.subject,
            html: payload.html,
            text: payload.text,
            replyTo: payload.replyTo ?? payload.reply_to ?? user
          });
          return { data: { id: info.messageId }, error: null };
        } catch (err) {
          return { data: null, error: { name: "gmail_smtp_error", message: err instanceof Error ? err.message : "Erreur d'envoi Gmail" } };
        }
      }
    }
  };
}

export function getResendClient(): Resend {
  const gmailUser = process.env.GMAIL_SMTP_USER;
  const gmailPass = process.env.GMAIL_SMTP_APP_PASSWORD;
  if (gmailUser && gmailPass) {
    return createGmailMailer(gmailUser, gmailPass) as unknown as Resend;
  }

  if (resend) {
    return resend;
  }

  if (!env.resendApiKey) {
    throw new Error("RESEND_API_KEY is missing");
  }

  resend = new Resend(env.resendApiKey);

  return resend;
}

/** Vrai si un moyen d'envoi est configuré (Gmail ou Resend). */
export function isEmailConfigured(): boolean {
  return Boolean((process.env.GMAIL_SMTP_USER && process.env.GMAIL_SMTP_APP_PASSWORD) || env.resendApiKey);
}

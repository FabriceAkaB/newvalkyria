import { Resend } from "resend";

import { env } from "@/lib/env";
import { getMailConfig, type MailConfig } from "@/lib/mail-config";

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

async function sendViaGmail(cfg: MailConfig, payload: MailPayload) {
  try {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: cfg.user, pass: cfg.password } });
    const info = await transport.sendMail({
      from: `${cfg.fromName} <${cfg.user}>`,
      to: payload.to,
      cc: payload.cc,
      bcc: payload.bcc,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      replyTo: payload.replyTo ?? payload.reply_to ?? cfg.user
    });
    return { data: { id: info.messageId }, error: null };
  } catch (err) {
    return { data: null, error: { name: "gmail_smtp_error", message: `Gmail : ${err instanceof Error ? err.message : "Erreur d'envoi"}` } };
  }
}

function realResend(): Resend | null {
  if (resend) return resend;
  if (!env.resendApiKey) return null;
  resend = new Resend(env.resendApiKey);
  return resend;
}

/** Client d'envoi unique du site, avec la même interface que `resend.emails.send`.
 *  Si une boîte Gmail / Google Workspace est configurée (variables d'environnement
 *  ou réglage enregistré depuis l'admin), TOUS les courriels (confirmations,
 *  reçus, campagne…) partent de cette boîte ; sinon Resend. */
export function getResendClient(): Resend {
  const smart = {
    emails: {
      async send(payload: MailPayload) {
        const cfg = await getMailConfig();
        if (cfg) return sendViaGmail(cfg, payload);
        const real = realResend();
        if (real) return real.emails.send(payload as never);
        return { data: null, error: { name: "not_configured", message: "Aucune boîte d'envoi n'est configurée." } };
      }
    }
  };
  return smart as unknown as Resend;
}

/** Les garde-fous historiques (« si Resend est configuré ») ne bloquent plus :
 *  la boîte d'envoi peut venir de la base. Un échec d'envoi est renvoyé sous
 *  forme d'erreur par `send`, jamais d'exception. */
export function isEmailConfigured(): boolean {
  return true;
}

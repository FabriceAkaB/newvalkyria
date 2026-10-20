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
  /** Pièces jointes (ex. PDF de proposition). */
  attachments?: { filename: string; path?: string; content?: Buffer | string }[];
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
      replyTo: payload.replyTo ?? payload.reply_to ?? cfg.user,
      attachments: payload.attachments
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
/** Signature ajoutée à TOUS les courriels envoyés par le site (Annie Tremblay, responsable administratif). */
const SIGNATURE_HTML = `
<div style="margin-top:28px;padding-top:14px;border-top:1px solid #e6e1ee;max-width:620px">
  <a href="https://www.newvalkyria.com" style="text-decoration:none"><img src="https://www.newvalkyria.com/brand/signature-annie.png" width="560" alt="Annie Tremblay · Responsable administratif · New Valkyria · newvalkyria.com" style="display:block;width:100%;max-width:560px;height:auto;border:0" /></a>
</div>`;
const SIGNATURE_TEXT = "\n\n--\nAnnie Tremblay\nResponsable administratif\nNew Valkyria · www.newvalkyria.com";

export function withSignature(payload: MailPayload): MailPayload {
  return {
    ...payload,
    html: payload.html ? `${payload.html}${SIGNATURE_HTML}` : payload.html,
    text: payload.text ? `${payload.text}${SIGNATURE_TEXT}` : payload.text
  };
}

export function getResendClient(): Resend {
  const smart = {
    emails: {
      async send(raw: MailPayload) {
        const payload = withSignature(raw);
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

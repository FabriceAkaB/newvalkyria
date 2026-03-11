import { Resend } from "resend";

import { env } from "@/lib/env";

let resend: Resend | null = null;

export function getResendClient() {
  if (resend) {
    return resend;
  }

  if (!env.resendApiKey) {
    throw new Error("RESEND_API_KEY is missing");
  }

  resend = new Resend(env.resendApiKey);

  return resend;
}

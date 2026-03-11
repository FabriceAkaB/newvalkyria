import type { LeadFormPayload } from "@/lib/validations";

/**
 * Appends a lead row to a Google Sheet via a Google Apps Script web app webhook.
 * Setup: see README or ask the dev — takes ~2 minutes to configure.
 * Non-blocking: never throws, never fails the inscription flow.
 */
export async function appendLeadToSheet(payload: LeadFormPayload) {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: new Date().toLocaleString("fr-CA", { timeZone: "America/Toronto" }),
        parent_name: payload.parent_name,
        email: payload.email,
        phone: payload.phone,
        city: payload.city,
        player_age: payload.player_age,
        player_level: payload.player_level,
        goal: payload.goal,
        availability: payload.availability
      })
    });
  } catch {
    // Intentionally silent — Google Sheets is not critical path
  }
}

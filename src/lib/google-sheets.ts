import type { LeadFormPayload } from "@/lib/validations";

const WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL;

/**
 * Appends a new lead row to the Google Sheet (statut "En attente").
 * Non-blocking: never throws, never fails the inscription flow.
 */
export async function appendLeadToSheet(payload: LeadFormPayload) {
  if (!WEBHOOK_URL) return;

  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "lead",
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
    // Intentionally silent — Google Sheets n'est pas critique
  }
}

/**
 * Met à jour le statut d'un lead à "Payé" dans le Google Sheet.
 * Appelé depuis le webhook Stripe après confirmation du paiement.
 * Non-blocking: never throws.
 */
export async function markLeadPaidInSheet(email: string, leadId: string) {
  if (!WEBHOOK_URL) return;

  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "paid",
        email,
        leadId,
        date_paiement: new Date().toLocaleString("fr-CA", { timeZone: "America/Toronto" })
      })
    });
  } catch {
    // Intentionally silent
  }
}

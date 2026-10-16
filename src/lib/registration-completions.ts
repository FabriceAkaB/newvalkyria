import { randomBytes } from "node:crypto";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { findOrCreatePlayer } from "@/lib/players-repo";
import { enrollInAllDates, type SessionProgramSlug } from "@/lib/session-programs-repo";

function db() {
  return getSupabaseAdminClient() as any;
}

export interface RegistrationCompletion {
  id: string;
  token: string;
  program_slug: string;
  parent_name: string | null;
  parent_email: string;
  parent_city: string | null;
  amount_cents: number;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  status: "sent" | "completed" | "cancelled";
  registration_id: string | null;
}

/** Crée la demande (jeton personnel difficile à deviner) pour une famille qui a déjà payé. */
export async function createCompletion(input: {
  programSlug: string;
  parentName: string | null;
  parentEmail: string;
  parentCity: string | null;
  amountCents: number;
  checkoutSessionId: string | null;
  paymentIntentId: string | null;
}): Promise<RegistrationCompletion> {
  const token = randomBytes(24).toString("base64url");
  const { data, error } = await db()
    .from("registration_completions")
    .insert({
      token,
      program_slug: input.programSlug,
      parent_name: input.parentName,
      parent_email: input.parentEmail,
      parent_city: input.parentCity,
      amount_cents: input.amountCents,
      stripe_checkout_session_id: input.checkoutSessionId,
      stripe_payment_intent_id: input.paymentIntentId,
      sent_at: new Date().toISOString()
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as RegistrationCompletion;
}

export async function getCompletionByToken(token: string): Promise<RegistrationCompletion | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const { data } = await db().from("registration_completions").select("*").eq("token", token).maybeSingle();
  return (data as RegistrationCompletion | null) ?? null;
}

export interface CompleteInput {
  playerFirstName: string;
  playerLastName: string;
  playerDob: string | null;
  parentName: string;
  parentPhone: string;
  city: string | null;
  comments: string | null;
}

/** Remplit le formulaire : crée l'inscription interne (payée), inscrit aux séances, clôt la demande. */
export async function completeRegistration(completion: RegistrationCompletion, input: CompleteInput): Promise<string> {
  if (completion.status !== "sent") throw new Error("Ce formulaire a déjà été rempli.");
  const supabase = db();
  const playerId = await findOrCreatePlayer({
    firstName: input.playerFirstName,
    lastName: input.playerLastName,
    dob: input.playerDob,
    parentEmail: completion.parent_email,
    parentPhone: input.parentPhone
  });

  const { data, error } = await supabase
    .from("session_program_registrations")
    .insert({
      program_slug: completion.program_slug,
      player_id: playerId,
      player_first_name: input.playerFirstName,
      player_last_name: input.playerLastName,
      player_dob: input.playerDob,
      parent_name: input.parentName,
      parent_email: completion.parent_email,
      parent_phone: input.parentPhone,
      city: input.city,
      comments: input.comments,
      terms_accepted: true,
      status: "paid",
      price_cents: completion.amount_cents,
      stripe_checkout_session_id: completion.stripe_checkout_session_id,
      stripe_payment_intent_id: completion.stripe_payment_intent_id
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const registrationId = data.id as string;

  await enrollInAllDates(registrationId, completion.program_slug as SessionProgramSlug).catch((e) => console.error("enrollInAllDates failed", e));

  // Verrou : un jeton ne sert qu'une fois, même si le formulaire est envoyé deux fois en même temps.
  const { data: locked } = await supabase
    .from("registration_completions")
    .update({ status: "completed", registration_id: registrationId, completed_at: new Date().toISOString() })
    .eq("id", completion.id)
    .eq("status", "sent")
    .select("id");
  if (!locked || locked.length === 0) {
    await supabase.from("session_program_registrations").delete().eq("id", registrationId);
    throw new Error("Ce formulaire a déjà été rempli.");
  }
  return registrationId;
}

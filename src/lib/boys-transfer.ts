import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { enrollInAllActiveSessions } from "@/lib/sport-etudes-repo";
import { enrollInAllDates } from "@/lib/session-programs-repo";

function db() {
  return getSupabaseAdminClient() as any;
}

export type BoysProgram = "sport-etudes" | "intensif-garcons";

/** Déplace un garçon d'un programme à l'autre (Sport-Études ⇄ Programme Intensif)
 *  en conservant son statut, ce qu'il a payé et son plan de versements.
 *  Crée une NOUVELLE inscription dans le programme d'arrivée, copie le plan de
 *  paiement échelonné (retiré de l'ancienne inscription pour qu'aucun versement
 *  ne soit prélevé deux fois) puis annule l'ancienne inscription. */
export async function transferBoy(input: { from: BoysProgram; id: string; to: BoysProgram }): Promise<string> {
  if (input.from === input.to) throw new Error("Le programme de départ et d'arrivée sont identiques.");
  const supabase = db();

  const fromTable = input.from === "sport-etudes" ? "sport_etudes_registrations" : "session_program_registrations";
  const toPlanTable = input.to === "sport-etudes" ? "sport_etudes_payment_plans" : "session_program_payment_plans";
  const toInstTable = input.to === "sport-etudes" ? "sport_etudes_payment_plan_installments" : "session_program_payment_plan_installments";
  const fromPlanTable = input.from === "sport-etudes" ? "sport_etudes_payment_plans" : "session_program_payment_plans";

  const { data: src, error } = await supabase.from(fromTable).select("*").eq("id", input.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!src) throw new Error("Inscription introuvable.");
  if (src.status === "cancelled") throw new Error("Cette inscription est annulée.");

  const status = src.status === "paid" || src.status === "confirmed" || src.status === "pending" || src.status === "waitlist" ? src.status : "pending";
  let newId: string;

  if (input.to === "intensif-garcons") {
    const { data, error: insError } = await supabase
      .from("session_program_registrations")
      .insert({
        program_slug: "intensif-garcons",
        player_id: src.player_id ?? null,
        player_first_name: src.player_first_name,
        player_last_name: src.player_last_name,
        player_dob: src.player_dob ?? null,
        parent_name: `${src.parent_first_name ?? ""} ${src.parent_last_name ?? ""}`.trim(),
        parent_email: src.parent_email,
        parent_phone: src.parent_phone,
        city: null,
        comments: `Transféré depuis Sport-Études (inscription ${src.id})`,
        terms_accepted: true,
        status,
        price_cents: src.price_cents ?? null,
        stripe_payment_intent_id: src.stripe_payment_intent_id ?? null
      })
      .select("id")
      .single();
    if (insError) throw new Error(insError.message);
    newId = data.id as string;
    await enrollInAllDates(newId, "intensif-garcons");
  } else {
    const parts = String(src.parent_name ?? "").trim().split(/\s+/);
    const { data, error: insError } = await supabase
      .from("sport_etudes_registrations")
      .insert({
        player_id: src.player_id ?? null,
        player_first_name: src.player_first_name,
        player_last_name: src.player_last_name,
        player_dob: src.player_dob ?? null,
        parent_first_name: parts[0] ?? "",
        parent_last_name: parts.slice(1).join(" "),
        parent_email: src.parent_email,
        parent_phone: src.parent_phone,
        comments: `Transféré depuis le Programme Intensif (inscription ${src.id})`,
        terms_accepted: true,
        option_chosen: "full_program",
        status,
        price_cents: src.price_cents ?? 0,
        stripe_payment_intent_id: src.stripe_payment_intent_id ?? null
      })
      .select("id")
      .single();
    if (insError) throw new Error(insError.message);
    newId = data.id as string;
    await enrollInAllActiveSessions(newId);
  }

  // Plan de versements : copié sur la nouvelle inscription puis retiré de l'ancienne.
  const { data: plan } = await supabase.from(fromPlanTable).select("*").eq("registration_id", src.id).maybeSingle();
  if (plan) {
    const fromInstTable = input.from === "sport-etudes" ? "sport_etudes_payment_plan_installments" : "session_program_payment_plan_installments";
    const { data: insts } = await supabase.from(fromInstTable).select("*").eq("plan_id", plan.id).order("sequence_no");
    const { data: newPlan, error: planError } = await supabase
      .from(toPlanTable)
      .insert({
        registration_id: newId,
        stripe_customer_id: plan.stripe_customer_id,
        stripe_payment_method_id: plan.stripe_payment_method_id,
        total_amount_cents: plan.total_amount_cents,
        installment_count: plan.installment_count
      })
      .select("id")
      .single();
    if (planError) throw new Error(planError.message);
    if (insts?.length) {
      const { error: instError } = await supabase.from(toInstTable).insert(
        insts.map((i: any) => ({
          plan_id: newPlan.id,
          sequence_no: i.sequence_no,
          amount_cents: i.amount_cents,
          due_date: i.due_date,
          status: i.status,
          attempt_count: i.attempt_count,
          failure_notified: i.failure_notified,
          stripe_payment_intent_id: i.stripe_payment_intent_id,
          paid_at: i.paid_at
        }))
      );
      if (instError) throw new Error(instError.message);
    }
    await supabase.from(fromPlanTable).delete().eq("id", plan.id);
  }

  await supabase.from(fromTable).update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", src.id);
  return newId;
}

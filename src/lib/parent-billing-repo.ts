import { money, mergePayments, paymentLabel, totalsByYear, type Payment } from "@/lib/parent-billing";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Programmes et paiements d'une famille, retrouvés par le courriel CONFIRMÉ du compte parent (jamais un courriel non
 *  vérifié : ce sont des données de paiement). Paiements : le journal du webhook Stripe (`stripe_events`) et les
 *  versements prélevés automatiquement (tables *_payment_plan_installments). Règles : parent-billing.ts. */

function db() {
  return getSupabaseAdminClient() as any;
}

export interface FamilyProgram {
  id: string;
  kind: "saison" | "programme" | "sport-etudes";
  child: string;
  name: string;
  status: string;
  since: string;
  note: string | null;
}

export interface UpcomingInstallment {
  date: string;
  amountCents: number;
  label: string;
  child: string;
  status: string;
}

const name = (r: any) => `${String(r.player_first_name ?? "").trim()} ${String(r.player_last_name ?? "").trim()}`.trim();
const ACTIVE = ["paid", "confirmed", "active", "pending_payment", "partial"];

export async function getFamilyBilling(email: string): Promise<{ programs: FamilyProgram[]; payments: Payment[]; upcoming: UpcomingInstallment[]; years: { year: string; cents: number }[] }> {
  const e = email.trim().toLowerCase();
  const [{ data: regs }, { data: sprs }, { data: sers }, { data: programs }, { data: sessionPrograms }] = await Promise.all([
    db().from("registrations").select("id, player_first_name, player_last_name, program_id, season_id, status, is_half_season, half_season_ends_on, is_trial, stripe_payment_intent_id, created_at").ilike("parent_email", e),
    db().from("session_program_registrations").select("id, player_first_name, player_last_name, program_slug, status, stripe_payment_intent_id, created_at").ilike("parent_email", e),
    db().from("sport_etudes_registrations").select("id, player_first_name, player_last_name, target_sport_etudes_program, status, stripe_payment_intent_id, created_at").ilike("parent_email", e),
    db().from("programs").select("id, season_id, name"),
    db().from("session_programs").select("slug, name")
  ]);
  const progName = (seasonId: string, id: string) => ((programs ?? []) as any[]).find((p) => p.season_id === seasonId && p.id === id)?.name ?? id;
  const spName = (slug: string) => ((sessionPrograms ?? []) as any[]).find((p) => p.slug === slug)?.name ?? slug;

  const list: FamilyProgram[] = [
    ...((regs ?? []) as any[])
      .filter((r) => ACTIVE.includes(r.status) && !r.is_trial)
      .map((r) => ({
        id: r.id,
        kind: "saison" as const,
        child: name(r),
        name: progName(r.season_id, r.program_id),
        status: r.status,
        since: String(r.created_at).slice(0, 10),
        note: r.is_half_season && r.half_season_ends_on ? `Demi-saison jusqu'au ${new Date(r.half_season_ends_on).toLocaleDateString("fr-CA", { day: "numeric", month: "long", timeZone: "UTC" })}` : null
      })),
    ...((sprs ?? []) as any[]).filter((r) => ACTIVE.includes(r.status)).map((r) => ({ id: r.id, kind: "programme" as const, child: name(r), name: spName(r.program_slug), status: r.status, since: String(r.created_at).slice(0, 10), note: null })),
    ...((sers ?? []) as any[]).filter((r) => ACTIVE.includes(r.status)).map((r) => ({ id: r.id, kind: "sport-etudes" as const, child: name(r), name: `Sport-Études${r.target_sport_etudes_program ? ` (${r.target_sport_etudes_program})` : ""}`, status: r.status, since: String(r.created_at).slice(0, 10), note: null }))
  ].sort((a, b) => b.since.localeCompare(a.since));

  // Qui est qui : un paiement nomme son inscription (registrationId) ; on retrouve l'enfant et le programme.
  const byReg = new Map<string, { child: string; program: string }>();
  for (const r of (regs ?? []) as any[]) byReg.set(r.id, { child: name(r), program: progName(r.season_id, r.program_id) });
  for (const r of (sprs ?? []) as any[]) byReg.set(r.id, { child: name(r), program: spName(r.program_slug) });
  for (const r of (sers ?? []) as any[]) byReg.set(r.id, { child: name(r), program: "Sport-Études" });
  const regIds = [...byReg.keys()];

  const sel = "payload";
  const [{ data: byEmail }, { data: byId }] = await Promise.all([
    db().from("stripe_events").select(sel).eq("payload->>type", "checkout.session.completed").ilike("payload->data->object->customer_details->>email", e),
    regIds.length ? db().from("stripe_events").select(sel).eq("payload->>type", "checkout.session.completed").in("payload->data->object->metadata->>registrationId", regIds) : Promise.resolve({ data: [] })
  ]);
  const sessions = new Map<string, any>();
  for (const row of [...((byEmail ?? []) as any[]), ...((byId ?? []) as any[])]) {
    const o = row.payload?.data?.object;
    if (!o || o.payment_status !== "paid" || !o.amount_total) continue;
    sessions.set(o.id, o);
  }
  const checkouts: Payment[] = [...sessions.values()].map((o) => {
    const reg = byReg.get(o.metadata?.registrationId ?? "");
    return {
      id: String(o.payment_intent ?? o.id),
      date: new Date((o.created ?? 0) * 1000).toLocaleDateString("en-CA", { timeZone: "America/Toronto" }),
      amountCents: Number(o.amount_total),
      label: paymentLabel(o.metadata?.checkoutType, reg?.program ?? (o.metadata?.programSlug ? spName(o.metadata.programSlug) : null)),
      child: reg?.child ?? null,
      source: "paiement"
    };
  });

  // Versements prélevés automatiquement (et ceux à venir).
  const installments: Payment[] = [];
  const upcoming: UpcomingInstallment[] = [];
  for (const [plans, items] of [
    ["registration_payment_plans", "registration_payment_plan_installments"],
    ["session_program_payment_plans", "session_program_payment_plan_installments"],
    ["sport_etudes_payment_plans", "sport_etudes_payment_plan_installments"]
  ] as const) {
    if (!regIds.length) break;
    const { data: ps } = await db().from(plans).select("id, registration_id").in("registration_id", regIds);
    const planIds = ((ps ?? []) as any[]).map((p) => p.id);
    if (!planIds.length) continue;
    const { data: rows } = await db().from(items).select("plan_id, sequence_no, amount_cents, due_date, status, stripe_payment_intent_id, paid_at").in("plan_id", planIds);
    const plan = new Map(((ps ?? []) as any[]).map((p) => [p.id, p.registration_id]));
    const count = new Map<string, number>();
    for (const r of (rows ?? []) as any[]) count.set(r.plan_id, (count.get(r.plan_id) ?? 0) + 1);
    for (const r of (rows ?? []) as any[]) {
      const reg = byReg.get(plan.get(r.plan_id));
      const label = `Versement ${r.sequence_no} de ${count.get(r.plan_id)}${reg ? ` : ${reg.program}` : ""}`;
      if (r.status === "paid" && r.stripe_payment_intent_id) {
        installments.push({ id: r.stripe_payment_intent_id, date: String(r.paid_at ?? r.due_date).slice(0, 10), amountCents: r.amount_cents, label, child: reg?.child ?? null, source: "versement" });
      } else if (r.status !== "paid" && r.status !== "cancelled") {
        upcoming.push({ date: String(r.due_date).slice(0, 10), amountCents: r.amount_cents, label, child: reg?.child ?? "", status: r.status });
      }
    }
  }
  const payments = mergePayments(checkouts, installments);
  return { programs: list, payments, upcoming: upcoming.sort((a, b) => a.date.localeCompare(b.date)), years: totalsByYear(payments) };
}

export { money };

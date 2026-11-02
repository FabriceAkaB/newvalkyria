import type { AdminRole } from "@/lib/admin-auth";
import { unpaidStartedRegistrations } from "@/lib/academy-history";
import { isOpen } from "@/lib/mandalart-core";
import { getLiveTasks } from "@/lib/mandalart-repo";
import { getFamiliesToCall } from "@/lib/surveys-repo";
import { getOutreachSummary, type OutreachPerson } from "@/lib/outreach";
import { DISTRIBUTION_STATUS_LABELS, PROBLEM_TYPE_LABELS, type DistributionStatus, type ProblemType } from "@/lib/shop-repo";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Page « Aujourd'hui » de l'admin : tout ce qui demande une action, recalculé à chaque
 *  visite à partir des mêmes données que l'Historique et les Relances. La gérante ne voit
 *  ni les finances (versements, remboursements, offres) ni les données RH (contrats). */

function db() {
  return getSupabaseAdminClient() as any;
}

async function rows<T = any>(query: PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  try {
    const { data } = await query;
    return data ?? [];
  } catch {
    return [];
  }
}

export interface TodayItem {
  title: string;
  detail?: string | null;
  meta?: string | null;
  href?: string | null;
}

export interface TodaySection {
  key: string;
  title: string;
  level: "rouge" | "orange" | "info";
  count: number;
  /** Phrase affichée quand il n'y a rien à faire. */
  emptyText: string;
  href: string;
  hrefLabel: string;
  items: TodayItem[];
  more?: number;
}

const TZ = "America/Toronto";
const localDay = (d: Date | string) => new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });
const shortDay = (d: string) => new Date(d).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
const dayTime = (d: string) => new Date(d).toLocaleString("fr-CA", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: TZ });
const money = (c: number) => (c / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
const fullName = (r: { player_first_name?: string | null; player_last_name?: string | null }) => `${r.player_first_name ?? ""} ${r.player_last_name ?? ""}`.replace(/\s+/g, " ").trim() || "—";
const norm = (s: string | null | undefined) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const MAX_ITEMS = 12;
function section(s: Omit<TodaySection, "count" | "more"> & { count?: number }): TodaySection {
  return { ...s, count: s.count ?? s.items.length, items: s.items.slice(0, MAX_ITEMS), more: Math.max(0, s.items.length - MAX_ITEMS) };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getTodayActions(role: AdminRole): Promise<TodaySection[]> {
  const isAdmin = role === "admin";
  const now = Date.now();
  const today = localDay(new Date(now));
  const inAWeek = localDay(new Date(now + 7 * DAY_MS));

  const [seasons, regs, boysTrials, matchRequests, shopOrders, shopProblems, outreach, specialOffers, contracts, installments, boysRegs, sportEtudesRegs, refundAudit] =
    await Promise.all([
      rows(db().from("seasons").select("id, is_active")),
      rows(
        db()
          .from("registrations")
          .select("id, season_id, status, is_trial, trial_date, parent_name, parent_email, player_first_name, player_last_name, created_at, updated_at, stripe_payment_intent_id")
      ),
      rows(db().from("boys_trials").select("program_slug, status, trial_date, player_first_name, player_last_name, parent_name").eq("status", "confirmed").gte("trial_date", today)),
      rows(db().from("match_slot_requests").select("id, profile_id, status, created_at, message, profile:match_team_profiles(org_name, team_label, contact_name)").eq("status", "pending").order("created_at")),
      rows(db().from("shop_orders").select("id, customer_name, distribution_status, created_at").eq("status", "paid").neq("distribution_status", "remis").order("created_at")),
      rows(db().from("shop_order_problems").select("id, order_id, problem_type, description, created_at, order:shop_orders(customer_name)").eq("status", "ouvert").order("created_at")),
      isAdmin ? getOutreachSummary().catch(() => null) : Promise.resolve(null),
      isAdmin ? rows(db().from("special_offers").select("token, title, parent_name, expires_at, paid_at").is("paid_at", null).gt("expires_at", new Date(now).toISOString())) : Promise.resolve([]),
      isAdmin ? rows(db().from("employee_contracts").select("employee_name, title, status, created_at").eq("status", "sent")) : Promise.resolve([]),
      isAdmin ? loadUnpaidInstallments() : Promise.resolve([]),
      isAdmin ? rows(db().from("session_program_registrations").select("id, status, stripe_payment_intent_id, player_first_name, player_last_name, updated_at")) : Promise.resolve([]),
      isAdmin ? rows(db().from("sport_etudes_registrations").select("id, status, stripe_payment_intent_id, player_first_name, player_last_name, updated_at")) : Promise.resolve([]),
      isAdmin ? rows(db().from("audit_log").select("entity_id").in("action", ["full_refund", "partial_refund"])) : Promise.resolve([])
    ]);

  const activeSeason = seasons.find((s: any) => s.is_active)?.id ?? "automne-hiver-2026";
  const sections: TodaySection[] = [];

  // ── Réponses des familles (outreach_log) ──
  if (isAdmin && outreach) {
    // « refus » et « plus-tard » sont les réponses notées des familles (« reponse » = un envoi de l'académie dans le fil).
    const repliedRecently = (p: OutreachPerson) => p.history.some((h) => (h.kind === "refus" || h.kind === "plus-tard") && now - new Date(h.at).getTime() <= 14 * DAY_MS);
    const people = outreach.people.filter((p) => p.status === "plus-tard" || (repliedRecently(p) && p.status !== "inscrite" && p.status !== "deja-inscrite"));
    sections.push(
      section({
        key: "reponses",
        title: "Réponses des familles",
        level: people.some((p) => p.status === "plus-tard") ? "orange" : "info",
        emptyText: "Aucune réponse de famille à traiter.",
        href: "/admin/relances",
        hrefLabel: "Relances et suivi",
        items: people.map((p) => ({
          title: p.playerName ?? p.parentName ?? p.parentEmail,
          detail: p.status === "plus-tard" ? `À rappeler : ${p.statusDetail}` : p.statusDetail,
          meta: `Dernier échange ${shortDay(p.lastAt)}`
        }))
      })
    );
  }

  // ── Offres spéciales qui expirent bientôt (72 h) ──
  if (isAdmin) {
    const soon = specialOffers
      .filter((o: any) => new Date(o.expires_at).getTime() - now <= 3 * DAY_MS)
      .sort((a: any, b: any) => a.expires_at.localeCompare(b.expires_at));
    sections.push(
      section({
        key: "offres",
        title: "Offres spéciales qui expirent",
        level: soon.length ? "orange" : "info",
        emptyText: `Aucune offre n'expire dans les 3 prochains jours${specialOffers.length ? ` (${specialOffers.length} offre(s) encore ouverte(s))` : ""}.`,
        href: "/admin/relances",
        hrefLabel: "Relances et suivi",
        items: soon.map((o: any) => ({ title: o.title, detail: o.parent_name, meta: `Expire ${dayTime(o.expires_at)}`, href: `/offre/${o.token}` }))
      })
    );
  }

  // ── Versements en retard (et ceux des 7 prochains jours) ──
  if (isAdmin) {
    const overdue = installments.filter((i) => i.dueDay < today);
    const upcoming = installments.filter((i) => i.dueDay >= today && i.dueDay <= inAWeek);
    sections.push(
      section({
        key: "versements",
        title: overdue.length ? "Versements en retard" : "Prélèvements des 7 prochains jours",
        level: overdue.length ? "rouge" : "info",
        count: overdue.length || upcoming.length,
        emptyText: "Aucun versement en retard ni prélèvement cette semaine.",
        href: "/admin/revenus/paiements",
        hrefLabel: "Paiements échelonnés",
        items: [
          ...overdue.map((i) => ({ title: i.player, detail: `${money(i.amountCents)} · ${i.program}`, meta: `Dû le ${shortDay(`${i.dueDay}T12:00:00`)} (en retard)` })),
          ...upcoming.map((i) => ({ title: i.player, detail: `${money(i.amountCents)} · ${i.program}`, meta: `Prélèvement prévu le ${shortDay(`${i.dueDay}T12:00:00`)}` }))
        ]
      })
    );
  }

  // ── Annulées après paiement : remboursement à confirmer ──
  if (isAdmin) {
    const refunded = new Set(refundAudit.map((a: any) => String(a.entity_id)));
    const all = [
      ...regs.map((r: any) => ({ ...r, program: "Filles" })),
      ...boysRegs.map((r: any) => ({ ...r, program: "Programme garçons" })),
      ...sportEtudesRegs.map((r: any) => ({ ...r, program: "Sport-Études" }))
    ];
    // Un transfert de programme copie le paiement sur la nouvelle fiche : l'ancienne, annulée, n'est pas à rembourser.
    const livePayments = new Set(all.filter((r) => r.status !== "cancelled" && r.stripe_payment_intent_id).map((r) => r.stripe_payment_intent_id));
    const candidates = new Map<string, any>();
    for (const r of all) {
      if (r.status !== "cancelled" || !r.stripe_payment_intent_id || refunded.has(String(r.id)) || livePayments.has(r.stripe_payment_intent_id)) continue;
      const prev = candidates.get(r.stripe_payment_intent_id);
      if (!prev || prev.updated_at < r.updated_at) candidates.set(r.stripe_payment_intent_id, r);
    }
    const toConfirm = (await Promise.all([...candidates.values()].map(async (r) => ({ r, state: await stripeRefundState(r.stripe_payment_intent_id) })))).filter(
      (x) => x.state.pending
    );
    sections.push(
      section({
        key: "remboursements",
        title: "Remboursements à confirmer",
        level: toConfirm.length ? "orange" : "info",
        emptyText: "Aucune inscription annulée en attente de remboursement.",
        href: "/admin/audit",
        hrefLabel: "Journal d'audit",
        items: toConfirm.map(({ r, state }) => ({
          title: fullName(r),
          detail: `${r.program} · annulée le ${shortDay(r.updated_at)}${state.amountCents ? ` · payé ${money(state.amountCents)}` : ""}`,
          meta: state.note
        }))
      })
    );
  }

  // ── Inscriptions commencées non payées (saison en cours) ──
  {
    const relancees = new Map<string, string>();
    for (const p of outreach?.people ?? []) if (p.playerName) relancees.set(norm(p.playerName), p.lastAt);
    const pending = unpaidStartedRegistrations(regs, activeSeason).sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));
    sections.push(
      section({
        key: "non-payees",
        title: "Inscriptions commencées non payées",
        level: pending.length ? "orange" : "info",
        emptyText: "Toutes les inscriptions commencées sont payées.",
        href: `/admin/saison/${activeSeason}/inscriptions`,
        hrefLabel: "Inscriptions de la saison",
        items: pending.map((r: any) => {
          const lastRelance = relancees.get(norm(fullName(r)));
          return {
            title: fullName(r),
            detail: r.parent_name,
            meta: `Commencée le ${shortDay(r.created_at)}${lastRelance ? ` · relancée le ${shortDay(lastRelance)}` : ""}`
          };
        })
      })
    );
  }

  // ── Essais des 7 prochains jours ──
  {
    const girls = regs
      .filter((r: any) => r.is_trial && r.trial_date && r.trial_date.slice(0, 10) >= today && r.trial_date.slice(0, 10) <= inAWeek && !["cancelled", "unavailable"].includes(r.status))
      .map((r: any) => ({ date: r.trial_date.slice(0, 10), title: fullName(r), detail: "Essai filles", href: `/admin/saison/${r.season_id}/essais` }));
    const boys = boysTrials
      .filter((t: any) => String(t.trial_date).slice(0, 10) <= inAWeek)
      .map((t: any) => ({ date: String(t.trial_date).slice(0, 10), title: fullName(t), detail: `Essai gratuit garçons (${t.program_slug})`, href: "/admin/inscriptions-garcons" }));
    const trials = [...girls, ...boys].sort((a, b) => a.date.localeCompare(b.date));
    sections.push(
      section({
        key: "essais",
        title: "Essais cette semaine",
        level: "info",
        emptyText: "Aucun essai prévu dans les 7 prochains jours.",
        href: "/admin/essais-calendrier",
        hrefLabel: "Calendrier des essais",
        items: trials.map((t) => ({ title: t.title, detail: t.detail, meta: shortDay(`${t.date}T12:00:00`), href: t.href }))
      })
    );
  }

  // ── Demandes de matchs à approuver (une double cédule = une demande par plage : regroupées par équipe) ──
  const requestsByTeam = new Map<string, any[]>();
  for (const m of matchRequests) requestsByTeam.set(m.profile_id, [...(requestsByTeam.get(m.profile_id) ?? []), m]);
  sections.push(
    section({
      key: "matchs",
      title: "Demandes de matchs à approuver",
      level: matchRequests.length ? "orange" : "info",
      emptyText: "Aucune demande de match en attente.",
      href: "/admin/matchs",
      hrefLabel: "Vente de matchs",
      items: [...requestsByTeam.values()].map(([m, ...others]: any[]) => ({
        title: [m.profile?.org_name, m.profile?.team_label].filter(Boolean).join(" · ") || "Équipe",
        detail: [others.length ? `${others.length + 1} plages` : null, m.message ?? m.profile?.contact_name].filter(Boolean).join(" · ") || null,
        meta: `Reçue le ${shortDay(m.created_at)}`
      }))
    })
  );

  // ── Commandes boutique / uniformes à remettre ──
  {
    const priority: Partial<Record<DistributionStatus, number>> = { pret_a_remettre: 0, partiellement_remis: 1, recu: 2 };
    const orders = [...shopOrders].sort((a: any, b: any) => (priority[a.distribution_status as DistributionStatus] ?? 9) - (priority[b.distribution_status as DistributionStatus] ?? 9));
    const ready = orders.filter((o: any) => o.distribution_status === "pret_a_remettre" || o.distribution_status === "partiellement_remis").length;
    sections.push(
      section({
        key: "commandes",
        title: "Commandes à remettre",
        level: ready ? "orange" : "info",
        emptyText: "Toutes les commandes payées ont été remises.",
        href: "/admin/uniformes/a-remettre?saison=all",
        hrefLabel: "Uniformes à remettre",
        items: orders.map((o: any) => ({
          title: o.customer_name ?? "Commande",
          detail: DISTRIBUTION_STATUS_LABELS[o.distribution_status as DistributionStatus] ?? o.distribution_status,
          meta: `Payée le ${shortDay(o.created_at)}`,
          href: `/admin/uniformes/commande/${o.id}`
        }))
      })
    );
    sections.push(
      section({
        key: "problemes",
        title: "Problèmes de commandes",
        level: shopProblems.length ? "orange" : "info",
        emptyText: "Aucun problème de commande ouvert.",
        href: "/admin/uniformes/problemes",
        hrefLabel: "Problèmes",
        items: shopProblems.map((p: any) => ({
          title: p.order?.customer_name ?? "Commande",
          detail: [PROBLEM_TYPE_LABELS[p.problem_type as ProblemType] ?? p.problem_type, p.description].filter(Boolean).join(" — "),
          meta: `Signalé le ${shortDay(p.created_at)}`,
          href: `/admin/uniformes/commande/${p.order_id}`
        }))
      })
    );
  }

  // ── Contrats d'embauche non signés ──
  if (isAdmin) {
    sections.push(
      section({
        key: "contrats",
        title: "Contrats d'embauche non signés",
        level: contracts.length ? "orange" : "info",
        emptyText: "Tous les contrats envoyés sont signés.",
        href: "/admin/contrats",
        hrefLabel: "Contrats",
        items: contracts.map((k: any) => ({ title: k.employee_name, detail: k.title, meta: `Envoyé le ${shortDay(k.created_at)}` }))
      })
    );
  }

  // ── Mandalart : tâches en retard et ⭐ dues dans les 7 prochains jours ──
  if (isAdmin) {
    const tasks = await getLiveTasks(today).catch(() => []);
    const overdue = tasks.filter((t) => t.overdue).sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
    const soon = tasks.filter((t) => isOpen(t) && !t.overdue && t.priority === "star" && t.due && t.due <= inAWeek).sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
    const items = [...overdue, ...soon];
    sections.push(
      section({
        key: "mandalart",
        title: "Plan 1,5 M$ : tâches à faire",
        level: overdue.length ? "rouge" : soon.length ? "orange" : "info",
        emptyText: "Aucune tâche du plan en retard ni due cette semaine.",
        href: "/admin/mandalart",
        hrefLabel: "Ce mois-ci",
        items: items.map((t) => ({
          title: `${t.priority === "star" ? "⭐ " : ""}${t.title}`,
          detail: `${t.code} · ${t.objectiveName}${t.owner ? ` · ${t.owner}` : ""}`,
          meta: t.overdue ? `En retard (${shortDay(`${t.due}T12:00:00`)})` : `Pour le ${shortDay(`${t.due}T12:00:00`)}`,
          href: `/admin/mandalart/piliers/${t.pillar.toLowerCase()}#${t.objective}`
        }))
      })
    );

    // ── Sondages : familles à rappeler (note sous 7 ou demande d'appel) ──
    const toCall = await getFamiliesToCall().catch(() => []);
    sections.push(
      section({
        key: "sondages",
        title: "Familles à rappeler (sondages)",
        level: toCall.length ? "rouge" : "info",
        emptyText: "Aucune famille à rappeler suite aux sondages.",
        href: "/admin/sondages",
        hrefLabel: "Voix des familles",
        items: toCall.map((c) => ({
          title: c.parentName ?? "Famille",
          detail: `${c.playerNames ?? ""}${c.score !== null ? ` · note ${c.score}/10` : " · a demandé un appel"} · ${c.surveyTitle}`,
          meta: `Répondu ${shortDay(c.at)}`,
          href: `/admin/sondages/${c.surveyId}#r-${c.responseId}`
        }))
      })
    );
  }

  return sections;
}

interface UnpaidInstallment {
  player: string;
  program: string;
  amountCents: number;
  /** Date d'échéance (AAAA-MM-JJ, colonne date). */
  dueDay: string;
}

/** Versements non payés des trois plans de paiement (filles, programmes garçons, Sport-Études). */
async function loadUnpaidInstallments(): Promise<UnpaidInstallment[]> {
  const kinds = [
    { prefix: "registration", regTable: "registrations", program: "Filles" },
    { prefix: "session_program", regTable: "session_program_registrations", program: "Programme garçons" },
    { prefix: "sport_etudes", regTable: "sport_etudes_registrations", program: "Sport-Études" }
  ];
  const out = await Promise.all(
    kinds.map(async (k) => {
      const inst = await rows(db().from(`${k.prefix}_payment_plan_installments`).select("plan_id, amount_cents, due_date, status").not("status", "in", "(paid,cancelled)"));
      if (!inst.length) return [];
      const plans = await rows(db().from(`${k.prefix}_payment_plans`).select("id, registration_id").in("id", [...new Set(inst.map((i: any) => i.plan_id))]));
      const regs = await rows(db().from(k.regTable).select("id, player_first_name, player_last_name, status").in("id", [...new Set(plans.map((p: any) => p.registration_id))]));
      const regByPlan = new Map(plans.map((p: any) => [p.id, regs.find((r: any) => r.id === p.registration_id)]));
      return inst
        .filter((i: any) => i.due_date && regByPlan.get(i.plan_id)?.status !== "cancelled")
        .map((i: any) => ({
          player: fullName(regByPlan.get(i.plan_id) ?? {}),
          program: k.program,
          amountCents: i.amount_cents ?? 0,
          dueDay: String(i.due_date).slice(0, 10)
        }));
    })
  );
  return out.flat().sort((a, b) => a.dueDay.localeCompare(b.dueDay));
}

/** Vérifie dans Stripe qu'un paiement annulé a réellement été encaissé et pas encore remboursé. */
async function stripeRefundState(paymentIntentId: string): Promise<{ pending: boolean; amountCents?: number; note?: string }> {
  try {
    const intent = await getStripeClient().paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
    if (intent.status !== "succeeded") return { pending: false };
    const charge = intent.latest_charge && typeof intent.latest_charge === "object" ? intent.latest_charge : null;
    if (charge && charge.amount_refunded > 0) return { pending: false };
    return { pending: true, amountCents: intent.amount_received, note: "Aucun remboursement dans Stripe" };
  } catch {
    return { pending: true, note: "Vérification Stripe impossible : à confirmer" };
  }
}

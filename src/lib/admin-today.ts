import type { AdminRole } from "@/lib/admin-auth";
import { getPayrollRows, holdDetail, missingBeforePayroll } from "@/lib/coach-payroll-data";
import { activityEndMs } from "@/lib/coach-report";
import { STATUS_LABEL, fmtScore } from "@/lib/exercise-bank";
import { getBank } from "@/lib/exercises-repo";
import { isOpen } from "@/lib/mandalart-core";
import { getLiveTasks } from "@/lib/mandalart-repo";
import { cronAlerts, type CronRunRow } from "@/lib/cron-jobs";
import { getMcsStatus } from "@/lib/mcs-sync";
import { getRobotStatus } from "@/lib/mcs-robot-config";
import { getMcsRules } from "@/lib/mcs-rules-repo";
import { listPractices } from "@/lib/practices-repo";
import { dateLong, getRefereesToPay, listMatches } from "@/lib/referees-repo";
import { getFamiliesToCall } from "@/lib/surveys-repo";
import { getOutreachSummary, type OutreachPerson } from "@/lib/outreach";
import { DISTRIBUTION_STATUS_LABELS, PROBLEM_TYPE_LABELS, type DistributionStatus, type ProblemType } from "@/lib/shop-repo";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { isComplete, previousWeek, reviewWeekFor, weekLabel } from "@/lib/weekly-review";
import { getReview } from "@/lib/weekly-review-repo";
import { isLate as isLatePractice } from "@/lib/practice-history";
import { getPracticeHistory } from "@/lib/practice-history-repo";
import { getRecentPracticesForSurvey } from "@/lib/practice-survey-repo";
import { loadRosterSources, rosterForActivity } from "@/lib/coach-portal-repo";

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
      rows(db().from("shop_orders").select("id, customer_name, customer_email, registration_id, distribution_status, created_at, items:shop_order_items(product_name, variant_label, quantity, delivered_quantity)").eq("status", "paid").neq("distribution_status", "remis").order("created_at")),
      rows(db().from("shop_order_problems").select("id, order_id, problem_type, description, created_at, order:shop_orders(customer_name)").eq("status", "ouvert").order("created_at")),
      isAdmin ? getOutreachSummary().catch(() => null) : Promise.resolve(null),
      isAdmin ? rows(db().from("special_offers").select("token, title, parent_name, expires_at, paid_at").is("paid_at", null).gt("expires_at", new Date(now).toISOString())) : Promise.resolve([]),
      isAdmin ? rows(db().from("employee_contracts").select("employee_name, title, status, created_at").eq("status", "sent")) : Promise.resolve([]),
      isAdmin ? loadUnpaidInstallments() : Promise.resolve([]),
      isAdmin ? rows(db().from("session_program_registrations").select("id, status, stripe_payment_intent_id, player_first_name, player_last_name, updated_at")) : Promise.resolve([]),
      isAdmin ? rows(db().from("sport_etudes_registrations").select("id, status, stripe_payment_intent_id, player_first_name, player_last_name, updated_at")) : Promise.resolve([]),
      isAdmin ? rows(db().from("audit_log").select("entity_id").in("action", ["full_refund", "partial_refund", "refund_not_needed"])) : Promise.resolve([])
    ]);

  const sections: TodaySection[] = [];

  // ── Bilan de la semaine de JP (3 questions) et sa priorité n° 1 ──
  if (isAdmin) {
    const due = reviewWeekFor(today);
    const [dueReview, lastReview] = await Promise.all([getReview(due.weekStart).catch(() => null), getReview(previousWeek(today)).catch(() => null)]);
    const items: TodayItem[] = [];
    if (lastReview?.nextPriority) items.push({ title: `Priorité n° 1 : ${lastReview.nextPriority}`, detail: "Ta réponse au bilan de la semaine passée", href: "/admin/mandalart/semaine" });
    if (!isComplete(dueReview))
      items.push({
        title: "Faire ton bilan de la semaine",
        detail: "Ce qui a bien marché, ce que tu ferais différemment, ta priorité n° 1",
        meta: `Semaine ${weekLabel(due.weekStart)}`,
        href: `/admin/mandalart/semaine?semaine=${due.weekStart}`
      });
    sections.push(
      section({
        key: "bilan-semaine",
        title: "Bilan de la semaine",
        level: !isComplete(dueReview) && due.late ? "orange" : "info",
        emptyText: "Bilan de la semaine fait.",
        href: "/admin/mandalart/semaine",
        hrefLabel: "Bilan de la semaine",
        items
      })
    );
  }

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
    // Annulations que JP a réglées sans que ça paraisse au journal d'audit (ex. « rien à rembourser » retiré du journal).
    const { data: ignored } = await db().from("app_settings").select("value").eq("key", "remboursements_ignores").maybeSingle();
    for (const id of (() => { try { return JSON.parse(ignored?.value ?? "[]") as string[]; } catch { return []; } })()) refunded.add(String(id));
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

  // Les inscriptions commencées non payées ne sont pas ici (JP, 2 nov. 2026) : ces familles n'ont pas été
  // approchées ; elles sont listées dans Relances et suivi (/admin/relances), à relancer quand on le décide.

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

  // ── Commandes boutique / uniformes : chaque article payé et pas encore remis est une priorité du jour (demande de JP) :
  //    quoi (articles, tailles), pour qui, où en est la commande et la prochaine pratique de la joueuse pour le remettre. ──
  {
    const priority: Partial<Record<DistributionStatus, number>> = { pret_a_remettre: 0, partiellement_remis: 1, recu: 2, en_production: 3, a_commander: 4 };
    const orders = [...shopOrders].sort((a: any, b: any) => (priority[a.distribution_status as DistributionStatus] ?? 9) - (priority[b.distribution_status as DistributionStatus] ?? 9));
    const nextPractice = await nextPracticeForOrders(orders, today).catch(() => new Map<string, { player: string; when: string }>());
    sections.push(
      section({
        key: "commandes",
        title: "Articles commandés à distribuer",
        level: orders.length ? "orange" : "info",
        emptyText: "Toutes les commandes payées ont été remises.",
        href: "/admin/uniformes/a-remettre?saison=all",
        hrefLabel: "Uniformes à remettre",
        items: orders.map((o: any) => {
          const np = nextPractice.get(o.id);
          const items = ((o.items ?? []) as any[])
            .filter((i) => (i.quantity ?? 0) > (i.delivered_quantity ?? 0))
            .map((i) => `${(i.quantity ?? 1) - (i.delivered_quantity ?? 0)} × ${String(i.product_name).replace(/\s+New Valkyria$/i, "")}${i.variant_label ? ` (${i.variant_label})` : ""}`);
          return {
            title: np ? `${np.player} (${o.customer_name ?? "parent"})` : o.customer_name ?? "Commande",
            detail: `${items.join(", ") || "Articles"} · ${DISTRIBUTION_STATUS_LABELS[o.distribution_status as DistributionStatus] ?? o.distribution_status}`,
            meta: np ? `À remettre à sa pratique ${np.when}` : `Payée le ${shortDay(o.created_at)}`,
            href: `/admin/uniformes/commande/${o.id}`
          };
        })
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

  // ── Robot MonClubSportif : ce qui demande JP (compte, activation, erreur récente) ──
  if (isAdmin) {
    const [robot, rules, { data: lastRuns }, { count: lateEmails }, { count: failedEmails }] = await Promise.all([
      getRobotStatus().catch(() => null),
      getMcsRules().catch(() => null),
      db().from("audit_log").select("created_at, after").eq("action", "mcs_robot_run").gte("created_at", new Date(now - 24 * 3_600_000).toISOString()).order("created_at", { ascending: false }).limit(5),
      // Courriels programmés encore en attente plus d'une heure après leur heure : l'envoi automatique n'a pas roulé.
      db().from("scheduled_emails").select("id", { count: "exact", head: true }).eq("status", "en_attente").lt("send_at", new Date(now - 3_600_000).toISOString()),
      db().from("scheduled_emails").select("id", { count: "exact", head: true }).eq("status", "echec").gte("send_at", new Date(now - 3 * 24 * 3_600_000).toISOString())
    ]);
    const errors = ((lastRuns ?? []) as any[]).flatMap((r) => (r.after?.errors ?? []) as string[]);
    if (lateEmails) errors.push(`${lateEmails} courriel(s) programmé(s) pas encore partis plus d'une heure après l'heure prévue`);
    if (failedEmails) errors.push(`${failedEmails} courriel(s) programmé(s) en échec`);
    const items = [
      ...(!robot ? [{ title: "Enregistrer le compte robot", detail: "Accepte l'invitation reçue à info+robot@, puis entre son courriel et son mot de passe (chiffré).", href: "/admin/monclubsportif/robot" }] : []),
      ...(robot && rules && !rules.robotActive ? [{ title: "Voir ce que le robot ferait, puis l'activer", detail: "Tant qu'il n'est pas activé, rien ne se fait tout seul dans MonClubSportif.", href: "/admin/monclubsportif/robot" }] : []),
      ...[...new Set(errors)].slice(0, 5).map((e) => ({ title: "Le robot a eu un problème", detail: e, href: "/admin/monclubsportif/robot" }))
    ];
    sections.push(
      section({
        key: "monclubsportif",
        title: "Robot MonClubSportif",
        level: errors.length ? "rouge" : items.length ? "orange" : "info",
        emptyText: "Le robot tient MonClubSportif à jour tout seul.",
        href: "/admin/monclubsportif/robot",
        hrefLabel: "Robot et règles",
        items
      })
    );
  }

  // ── Tâches automatiques (cron) : une tâche qui n'a pas roulé, ou Vercel qui appelle avec un mauvais secret ──
  if (isAdmin) {
    const [{ data: runs }, { data: cfg }] = await Promise.all([
      db().from("cron_runs").select("name, source, ok, ran_at").gte("ran_at", new Date(now - 8 * 24 * 3_600_000).toISOString()).order("ran_at", { ascending: false }).limit(2000),
      db().from("cron_backup_config").select("created_at").eq("id", 1).maybeSingle()
    ]);
    const alerts = cronAlerts((runs ?? []) as CronRunRow[], new Date(now), (cfg?.created_at as string | undefined) ?? null);
    sections.push(
      section({
        key: "taches-automatiques",
        title: "Tâches automatiques",
        level: alerts.length ? "rouge" : "info",
        emptyText: "Toutes les tâches automatiques ont roulé à l'heure (Vercel, avec secours Supabase).",
        href: "/admin/audit",
        hrefLabel: "Journal",
        items: alerts.map((a) => ({ title: a.label, detail: a.detail }))
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

  // ── Présences et rapports des éducateurs à compléter avant la paie (P8.3.05, AU20) — données RH : admin ──
  if (isAdmin) {
    const missing = missingBeforePayroll(await getPayrollRows().catch(() => []), now);
    const late = missing.filter((r) => activityEndMs(String(r.activityDate).slice(0, 10), r.activityEnd) + DAY_MS <= now);
    sections.push(
      section({
        key: "presences-educateurs",
        title: "Présences des éducateurs",
        level: late.length ? "orange" : "info",
        emptyText: "Chaque éducateur a confirmé sa présence et rempli ses rapports.",
        href: "/admin/entraineurs/paie",
        hrefLabel: "Paie",
        items: missing.map((r) => ({
          title: `${r.coachName} · ${shortDay(`${String(r.activityDate).slice(0, 10)}T12:00:00`)} ${r.activityStart}`,
          detail: `${holdDetail(r)} · ${r.activityLabel}`,
          meta: r.reminderSentAt ? `Relancé ${shortDay(r.reminderSentAt)}` : r.coachHasEmail ? "Relance à 24 h" : "Pas de courriel : appeler",
          href: `/admin/entraineurs/activites/${r.activityId}`
        }))
      })
    );
  }

  // ── Photos à prendre aux pratiques d'aujourd'hui (filles sans photo sur leur fiche), groupe par groupe ──
  {
    const todays = (await listPractices({ from: today, to: today }).catch(() => [])).filter((p) => !p.organization && p.source !== "programme");
    const { slots, regs: rosterRegs } = todays.length ? await loadRosterSources().catch(() => ({ slots: [], regs: [] })) : { slots: [], regs: [] };
    const seen = new Set<string>();
    const items: TodayItem[] = [];
    for (const p of todays) {
      const missing = rosterForActivity({ activity_date: p.date, start_time: p.start, category: p.group }, slots, rosterRegs).filter((r) => !r.photoUrl && !seen.has(r.registrationId));
      missing.forEach((r) => seen.add(r.registrationId));
      if (!missing.length) continue;
      items.push({
        title: `${p.start} · ${p.group} · ${missing.length} photo${missing.length > 1 ? "s" : ""} à prendre`,
        detail: missing.map((r) => `${r.firstName} ${r.lastName.slice(0, 1)}.`).join(", "),
        meta: p.location,
        href: "/admin/photos"
      });
    }
    sections.push(
      section({
        key: "photos",
        title: "Photos des filles à prendre aujourd'hui",
        level: items.length ? "orange" : "info",
        count: seen.size,
        emptyText: "Aucune photo à prendre aux pratiques d'aujourd'hui.",
        href: "/admin/photos",
        hrefLabel: "Photos des joueuses",
        items
      })
    );
  }

  // ── Sondage de fin des pratiques d'hier et d'aujourd'hui (plaisir, fatigue) : un bouton qui l'ouvre directement ──
  {
    const recent = (await getRecentPracticesForSurvey().catch(() => [])).filter((p) => p.daysLeft >= -1 && p.daysLeft <= 0 && (!p.present || p.answered < p.present));
    sections.push(
      section({
        key: "sondage-fin",
        title: "Sondage de fin à remplir",
        level: "info",
        emptyText: "Le sondage de fin des pratiques d'hier et d'aujourd'hui est fait.",
        href: "/admin/sondage",
        hrefLabel: "Ouvrir le sondage",
        items: recent.map((p) => ({
          title: `${shortDay(`${p.date}T12:00:00`)} · ${p.start} · Filles ${p.group.replace(/^Filles /, "")}`,
          detail: p.present ? `${p.answered} sur ${p.present} présentes ont répondu` : `${p.expected} joueuses attendues : présences et sondage à faire`,
          href: p.activityId ? `/admin/coaching/sondage/${p.activityId}` : "/admin/sondage"
        }))
      })
    );
  }

  // ── Pratiques passées pas encore déposées (diapos ou plan) : l'historique exact de chaque pratique ──
  {
    const since = localDay(new Date(now - 14 * DAY_MS));
    const late = (await getPracticeHistory().catch(() => [])).filter((r) => r.date >= since && isLatePractice(r, today));
    sections.push(
      section({
        key: "pratiques-a-deposer",
        title: "Pratiques à déposer",
        level: late.length ? "orange" : "info",
        emptyText: "Les pratiques des 2 dernières semaines sont déposées.",
        href: "/admin/coaching/historique",
        hrefLabel: "Historique des pratiques",
        items: late.map((r) => ({
          title: `${shortDay(`${r.date}T12:00:00`)} · ${r.start} · Filles ${r.group}`,
          detail: "Lien des diapos ou plan de séance, puis l'analyse d'après pratique",
          href: "/admin/coaching/historique"
        }))
      })
    );
  }

  // ── Pratiques à préparer (rouge ≤ 3 jours, jaune ≤ 7, vert ≤ 14) — admin et gérante ──
  {
    const practices = (await listPractices().catch(() => [])).filter((p) => ["rouge", "jaune", "vert"].includes(p.readiness));
    const dot = { rouge: "🔴", jaune: "🟡", vert: "🟢" } as Record<string, string>;
    sections.push(
      section({
        key: "pratiques",
        title: "Pratiques à préparer",
        level: practices.some((p) => p.readiness === "rouge") ? "rouge" : practices.some((p) => p.readiness === "jaune") ? "orange" : "info",
        emptyText: "Toutes les pratiques des 2 prochaines semaines sont prêtes.",
        href: "/admin/pratiques",
        hrefLabel: "Pratiques",
        items: practices.map((p) => ({
          title: `${dot[p.readiness]} ${p.group}${p.organization ? ` (${p.organization})` : ""}`,
          detail: `${shortDay(`${p.date}T12:00:00`)} · ${p.start} · ${p.location}`,
          meta: p.daysLeft === 0 ? "Aujourd'hui" : `Dans ${p.daysLeft} jour${p.daysLeft > 1 ? "s" : ""}`,
          href: p.activityId ? `/admin/entraineurs/activites/${p.activityId}` : "/admin/pratiques"
        }))
      })
    );
  }

  // ── Banque d'exercices : à valider par JP (2 éducateurs à 8+), à changer (note sous 8) ──
  if (isAdmin) {
    const bank = await getBank().catch(() => null);
    const toDecide = (bank?.entries ?? []).filter((e) => e.bank.status === "a-valider" || e.bank.status === "a-changer");
    if (bank && bank.entries.length) {
      sections.push(
        section({
          key: "exercices",
          title: "Banque d'exercices",
          level: toDecide.length ? "orange" : "info",
          emptyText: "Aucun exercice à valider ni à changer.",
          href: "/admin/exercices",
          hrefLabel: "Banque d'exercices",
          items: toDecide.map((e) => ({
            title: e.bank.status === "a-valider" ? `Valider « ${e.title} »` : `Changer « ${e.title} »`,
            detail: e.bank.reason,
            meta: `${STATUS_LABEL[e.bank.status]} · ${fmtScore(e.bank.average)}/10`,
            href: `/admin/exercices/${e.id}`
          }))
        })
      );
    }
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

    // ── Arbitres : à payer, et matchs des 7 prochains jours sans arbitres ──
    const [toPay, soonMatches] = await Promise.all([getRefereesToPay().catch(() => []), listMatches({ from: today, to: inAWeek }).catch(() => [])]);
    const uncovered = soonMatches.filter((m) => m.bookingStatus === "paid" && m.assignments.filter((a) => a.status === "reserve").length < m.refereesNeeded);
    sections.push(
      section({
        key: "arbitres",
        title: "Arbitres",
        level: uncovered.length ? "rouge" : toPay.length ? "orange" : "info",
        emptyText: "Aucun arbitre à payer ni match de la semaine sans arbitre.",
        href: "/admin/arbitres",
        hrefLabel: "Arbitres et bilan",
        items: [
          ...uncovered.map((m) => ({
            title: `Match sans arbitre : ${dateLong(m.date)} ${m.start}`,
            detail: `${m.opponent ?? "Adversaire"} · ${m.assignments.filter((a) => a.status === "reserve").length}/${m.refereesNeeded} arbitre(s)`,
            meta: "Envoyer la liste aux arbitres",
            href: "/admin/arbitres"
          })),
          ...toPay.map((p) => ({ title: `Payer ${p.name} : ${money(p.feeCents)}`, detail: `Match du ${dateLong(p.date)} · Interac ${p.interac ?? "—"}`, meta: "Virement à faire", href: "/admin/arbitres" }))
        ]
      })
    );

    // ── MonClubSportif : nouveautés à importer, joueuses à retirer ──
    const mcs = await getMcsStatus().catch(() => null);
    if (mcs && (mcs.syncedMembers || mcs.syncedEvents)) {
      const items = [
        ...(mcs.newMembers.length ? [{ title: `${mcs.newMembers.length} nouvelle(s) inscrite(s) à importer`, detail: "Télécharger le fichier, l'importer, toucher « Importé »", href: "/admin/monclubsportif" }] : []),
        ...(mcs.newEvents.length ? [{ title: `${mcs.newEvents.length} activité(s) à importer`, detail: "Pratiques, matchs et événements à venir", href: "/admin/monclubsportif" }] : []),
        ...mcs.toRemove.map((r) => ({ title: `Retirer ${r.label}`, detail: "N'est plus inscrite", href: "/admin/monclubsportif" }))
      ];
      sections.push(section({ key: "monclubsportif", title: "MonClubSportif", level: items.length ? "orange" : "info", emptyText: "MonClubSportif est à jour.", href: "/admin/monclubsportif", hrefLabel: "À faire dans MonClubSportif", items }));
    }

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
/** État Stripe d'un paiement d'inscription annulée, gardé 15 minutes : « Aujourd'hui » n'interroge plus Stripe pour
 *  chaque annulation à chaque chargement (c'était le plus lent de la page). */
const refundStateCache = new Map<string, { at: number; value: { pending: boolean; amountCents?: number; note?: string } }>();
const REFUND_CACHE_MS = 15 * 60 * 1000;

async function stripeRefundState(paymentIntentId: string): Promise<{ pending: boolean; amountCents?: number; note?: string }> {
  const hit = refundStateCache.get(paymentIntentId);
  if (hit && Date.now() - hit.at < REFUND_CACHE_MS) return hit.value;
  const value = await stripeRefundStateLive(paymentIntentId);
  // Une erreur Stripe n'est pas gardée : on réessaie au prochain chargement.
  if (!value.note?.startsWith("Vérification Stripe impossible")) refundStateCache.set(paymentIntentId, { at: Date.now(), value });
  return value;
}

async function stripeRefundStateLive(paymentIntentId: string): Promise<{ pending: boolean; amountCents?: number; note?: string }> {
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

const DAYS_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** Pour chaque commande : la joueuse (liée à la commande, sinon trouvée par le courriel du parent) et sa prochaine
 *  pratique selon l'horaire de son groupe, pour savoir quand remettre les articles. */
async function nextPracticeForOrders(orders: any[], today: string): Promise<Map<string, { player: string; when: string }>> {
  const out = new Map<string, { player: string; when: string }>();
  if (!orders.length) return out;
  const ids = orders.map((o) => o.registration_id).filter(Boolean);
  const emails = orders.filter((o) => !o.registration_id && o.customer_email).map((o) => String(o.customer_email).trim().toLowerCase());
  const select = "id, parent_email, player_first_name, player_last_name, status, is_trial, created_at, slot:time_slot_templates(day, start_time)";
  const [byId, byEmail] = await Promise.all([
    ids.length ? rows(db().from("registrations").select(select).in("id", ids)) : Promise.resolve([]),
    emails.length ? rows(db().from("registrations").select(select).eq("status", "paid").eq("is_trial", false).order("created_at", { ascending: false })) : Promise.resolve([])
  ]);
  for (const o of orders) {
    const r: any = o.registration_id ? byId.find((x: any) => x.id === o.registration_id) : byEmail.find((x: any) => String(x.parent_email ?? "").trim().toLowerCase() === String(o.customer_email ?? "").trim().toLowerCase());
    if (!r) continue;
    const dow = DAYS_FR.indexOf(String(r.slot?.day ?? "").toLowerCase());
    let when = "";
    if (dow >= 0) {
      const base = new Date(`${today}T12:00:00Z`);
      const start = String(r.slot?.start_time ?? "23:59").slice(0, 5);
      const nowHm = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });
      // Déjà commencée aujourd'hui : on vise la semaine suivante.
      const delta = ((dow - base.getUTCDay() + 7) % 7) || (nowHm >= start ? 7 : 0);
      const d = new Date(base.getTime() + delta * 86_400_000).toISOString().slice(0, 10);
      when = `${delta === 0 ? "aujourd'hui" : `du ${shortDay(`${d}T12:00:00`)}`}${r.slot?.start_time ? ` à ${String(r.slot.start_time).slice(0, 5).replace(":", " h ")}` : ""}`;
    }
    out.set(o.id, { player: fullName(r), when: when || "suivante" });
  }
  return out;
}

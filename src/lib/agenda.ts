import type { AdminRole } from "@/lib/admin-auth";
import { isOpen } from "@/lib/mandalart-core";
import { getLiveTasks } from "@/lib/mandalart-repo";
import { listPractices } from "@/lib/practices-repo";
import { listMatches } from "@/lib/referees-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Agenda de « Aujourd'hui » : tout ce qui a une date, au même endroit, jour par jour —
 *  pratiques (prêtes ou non), matchs et arbitres, essais, tâches du plan, prélèvements,
 *  factures à payer, paies des éducateurs, sondages et offres qui se terminent. Chaque élément
 *  mène à l'écran où on le traite. La gérante ne voit pas l'argent (prélèvements, factures, paie). */

function db() {
  return getSupabaseAdminClient() as any;
}

export type AgendaKind = "pratique" | "match" | "essai" | "tache" | "prelevement" | "facture" | "paie" | "sondage" | "offre" | "arbitre";

export interface AgendaItem {
  date: string;
  time: string | null;
  kind: AgendaKind;
  title: string;
  detail: string | null;
  href: string;
  /** fait / à faire / en retard / à surveiller */
  state: "fait" | "a_faire" | "retard" | "attention";
}

export const KIND_LABEL: Record<AgendaKind, { label: string; icon: string }> = {
  pratique: { label: "Pratique", icon: "⚽" },
  match: { label: "Match", icon: "🆚" },
  essai: { label: "Essai", icon: "👋" },
  tache: { label: "Plan", icon: "⭐" },
  prelevement: { label: "Prélèvement", icon: "💳" },
  facture: { label: "À payer", icon: "🧾" },
  paie: { label: "Paie", icon: "💵" },
  sondage: { label: "Sondage", icon: "📝" },
  offre: { label: "Offre", icon: "🎁" },
  arbitre: { label: "Arbitre", icon: "🟨" }
};

const TZ = "America/Toronto";
export const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const day = (v: unknown) => String(v ?? "").slice(0, 10);
const money = (c: number) => `${(c / 100).toLocaleString("fr-CA", { maximumFractionDigits: 2 })} $`;

async function rows(q: PromiseLike<{ data: any[] | null }>): Promise<any[]> {
  try {
    return (await q).data ?? [];
  } catch {
    return [];
  }
}

/** Tous les éléments datés entre from et to (inclus). Les tâches en retard du plan sont ramenées à aujourd'hui. */
export async function getAgenda(from: string, to: string, role: AdminRole): Promise<AgendaItem[]> {
  const isAdmin = role === "admin";
  const today = todayIso();
  const items: AgendaItem[] = [];

  const [practices, matches, tasks, boysTrials, girlsTrials, surveys, offers] = await Promise.all([
    listPractices({ from, to }).catch(() => []),
    isAdmin ? listMatches({ from, to }).catch(() => []) : Promise.resolve([]),
    isAdmin ? getLiveTasks(today).catch(() => []) : Promise.resolve([]),
    rows(db().from("boys_trials").select("trial_date, player_first_name, player_last_name, program_slug, status").gte("trial_date", from).lte("trial_date", to).eq("status", "confirmed")),
    rows(db().from("registrations").select("trial_date, player_first_name, player_last_name, category_id, status, season_id").eq("is_trial", true).gte("trial_date", from).lte("trial_date", to).not("status", "in", "(cancelled,unavailable)")),
    isAdmin ? rows(db().from("surveys").select("id, title, closes_on, status").gte("closes_on", from).lte("closes_on", to).neq("status", "ferme")) : Promise.resolve([]),
    isAdmin ? rows(db().from("special_offers").select("token, title, parent_name, expires_at, paid_at").is("paid_at", null).gte("expires_at", `${from}T00:00:00Z`).lte("expires_at", `${to}T23:59:59Z`)) : Promise.resolve([])
  ]);

  for (const p of practices) {
    if (p.daysLeft < 0 && p.date !== today && p.date < from) continue;
    const ready = p.readiness === "prete";
    items.push({
      date: p.date,
      time: p.start,
      kind: p.activityType === "Match" || p.activityType === "Tournoi" ? "match" : "pratique",
      title: `${p.group}${p.organization ? ` (${p.organization})` : ""}`,
      detail: `${p.location}${ready ? " · plan prêt" : p.readiness === "passee" ? "" : " · plan à préparer"}`,
      href: p.activityId ? `/admin/entraineurs/activites/${p.activityId}` : "/admin/pratiques",
      state: ready ? "fait" : p.readiness === "rouge" ? "retard" : p.readiness === "jaune" ? "attention" : p.readiness === "passee" ? "fait" : "a_faire"
    });
  }

  for (const m of matches) {
    if (m.bookingStatus !== "paid") continue;
    const reserved = m.assignments.filter((a) => a.status === "reserve").length;
    items.push({
      date: m.date,
      time: m.start,
      kind: "match",
      title: `Match vs ${m.opponent ?? "adversaire"}`,
      detail: `${m.field ?? m.location} · arbitres ${reserved}/${m.refereesNeeded}`,
      href: "/admin/arbitres",
      state: reserved >= m.refereesNeeded ? "fait" : m.date <= addDays(today, 7) ? "retard" : "attention"
    });
    for (const a of m.assignments) {
      if (a.status !== "reserve" || a.paid_at) continue;
      const payDay = addDays(m.date, 2);
      if (payDay < from || payDay > to) continue;
      items.push({ date: payDay, time: null, kind: "arbitre", title: `Payer l'arbitre ${a.referee ? `${a.referee.first_name} ${a.referee.last_name}` : ""} : ${money(a.fee_cents)}`, detail: `Match du ${m.date}`, href: "/admin/arbitres", state: payDay < today ? "retard" : "a_faire" });
    }
  }

  for (const t of boysTrials) {
    items.push({ date: day(t.trial_date), time: null, kind: "essai", title: `Essai garçons : ${t.player_first_name ?? ""} ${t.player_last_name ?? ""}`.trim(), detail: t.program_slug, href: "/admin/inscriptions-garcons", state: "a_faire" });
  }
  for (const t of girlsTrials) {
    items.push({ date: day(t.trial_date), time: null, kind: "essai", title: `Essai : ${t.player_first_name ?? ""} ${t.player_last_name ?? ""}`.trim(), detail: t.category_id ? `Filles ${t.category_id}` : null, href: `/admin/saison/${t.season_id}/essais`, state: "a_faire" });
  }

  for (const t of tasks) {
    if (!isOpen(t) || !t.due) continue;
    const due = t.due < today ? today : t.due;
    if (due < from || due > to) continue;
    items.push({
      date: due,
      time: null,
      kind: "tache",
      title: `${t.priority === "star" ? "⭐ " : ""}${t.title}`,
      detail: `${t.code} · ${t.owner ?? ""}${t.overdue ? ` · en retard depuis le ${t.due}` : ""}`,
      href: `/admin/mandalart/piliers/${t.pillar.toLowerCase()}#${t.objective}`,
      state: t.overdue ? "retard" : t.status === "en_cours" ? "attention" : "a_faire"
    });
  }

  for (const s of surveys) items.push({ date: day(s.closes_on), time: null, kind: "sondage", title: `Fin du sondage « ${s.title} »`, detail: null, href: `/admin/sondages/${s.id}`, state: "a_faire" });
  for (const o of offers) {
    const d = new Date(o.expires_at).toLocaleDateString("en-CA", { timeZone: TZ });
    items.push({ date: d, time: new Date(o.expires_at).toLocaleTimeString("fr-CA", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }), kind: "offre", title: `Offre qui expire : ${o.title}`, detail: o.parent_name, href: "/admin/relances", state: "attention" });
  }

  if (isAdmin) {
    const [inst1, inst2, inst3, expenses, contracts] = await Promise.all([
      rows(db().from("registration_payment_plan_installments").select("amount_cents, due_date, status").in("status", ["pending", "failed"]).gte("due_date", from).lte("due_date", to)),
      rows(db().from("session_program_payment_plan_installments").select("amount_cents, due_date, status").in("status", ["pending", "failed"]).gte("due_date", from).lte("due_date", to)),
      rows(db().from("sport_etudes_payment_plan_installments").select("amount_cents, due_date, status").in("status", ["pending", "failed"]).gte("due_date", from).lte("due_date", to)),
      rows(db().from("revenue_expenses").select("label, amount_cents, due_date, status").eq("status", "due").lte("due_date", to)),
      rows(db().from("employee_contracts").select("employee_name, pay_schedule, status").neq("status", "cancelled"))
    ]);
    const byDay = new Map<string, { n: number; cents: number }>();
    for (const i of [...inst1, ...inst2, ...inst3]) {
      const d = day(i.due_date);
      const cur = byDay.get(d) ?? { n: 0, cents: 0 };
      byDay.set(d, { n: cur.n + 1, cents: cur.cents + (i.amount_cents ?? 0) });
    }
    for (const [d, v] of byDay) items.push({ date: d, time: "04:00", kind: "prelevement", title: `${v.n} prélèvement${v.n > 1 ? "s" : ""} automatique${v.n > 1 ? "s" : ""} : ${money(v.cents)}`, detail: "Versements des familles, carte enregistrée", href: "/admin/revenus/paiements", state: "a_faire" });
    for (const e of expenses) {
      const d = day(e.due_date) < today ? today : day(e.due_date);
      if (d < from) continue;
      items.push({ date: d, time: null, kind: "facture", title: `À payer : ${e.label}`, detail: money(e.amount_cents ?? 0), href: "/admin/revenus/tresorerie", state: day(e.due_date) < today ? "retard" : "a_faire" });
    }
    for (const c of contracts) {
      for (const p of c.pay_schedule ?? []) {
        if (p.payDate < from || p.payDate > to) continue;
        items.push({ date: p.payDate, time: null, kind: "paie", title: `Paie de ${c.employee_name} : ${money(p.amountCents)}`, detail: `Période ${p.period} · dépôt direct avant minuit`, href: "/admin/entraineurs/paie", state: "a_faire" });
      }
    }
  }

  const order: Record<AgendaItem["state"], number> = { retard: 0, attention: 1, a_faire: 2, fait: 3 };
  return items
    .filter((i) => i.date >= from && i.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "99").localeCompare(b.time ?? "99") || order[a.state] - order[b.state]);
}

export interface StepProject {
  key: string;
  title: string;
  done: number;
  total: number;
  next: string;
  href: string;
}

/** Projets en plusieurs étapes, suivis jusqu'au bout (ex. la photo de chaque joueuse). */
export async function getStepProjects(role: AdminRole): Promise<StepProject[]> {
  const isAdmin = role === "admin";
  const [{ data: season }, regs, contracts, coaches, referees, mcs, surveys] = await Promise.all([
    db().from("seasons").select("id").eq("is_active", true).maybeSingle(),
    rows(db().from("registrations").select("player_id, season_id, status, players(photo_url)").eq("status", "paid")),
    isAdmin ? rows(db().from("employee_contracts").select("employee_name, status")) : Promise.resolve([]),
    rows(db().from("coaches").select("first_name, email, status")),
    isAdmin ? rows(db().from("referees").select("status")) : Promise.resolve([]),
    isAdmin ? rows(db().from("mcs_sync_items").select("kind").limit(1)) : Promise.resolve([]),
    isAdmin ? rows(db().from("surveys").select("kind, status")) : Promise.resolve([])
  ]);
  const active = regs.filter((r: any) => r.season_id === (season?.id ?? "automne-hiver-2026"));
  const players = new Map<string, boolean>();
  for (const r of active) if (r.player_id) players.set(r.player_id, players.get(r.player_id) || !!r.players?.photo_url);
  const withPhoto = [...players.values()].filter(Boolean).length;
  const projects: StepProject[] = [
    { key: "photos", title: "Photo de chaque joueuse sur son profil", done: withPhoto, total: players.size, next: "Prendre les photos au début de la pratique, groupe par groupe.", href: "/admin/photos" }
  ];
  const activeCoaches = coaches.filter((c: any) => c.status === "active");
  projects.push({ key: "coachs", title: "Éducateurs avec un courriel (accès au portail, relances)", done: activeCoaches.filter((c: any) => c.email).length, total: activeCoaches.length, next: "Entrer le courriel de chaque éducateur dans Équipe → Entraîneurs.", href: "/admin/entraineurs" });
  if (isAdmin) {
    projects.push({ key: "contrats", title: "Contrats des éducateurs signés", done: contracts.filter((c: any) => c.status === "signed").length, total: contracts.filter((c: any) => c.status !== "cancelled").length, next: "Envoyer les liens de contrat qui attendent une signature.", href: "/admin/contrats" });
    projects.push({ key: "mcs", title: "Point de départ MonClubSportif fixé", done: mcs.length ? 1 : 0, total: 1, next: "Toucher « déjà dans MonClubSportif » une fois.", href: "/admin/monclubsportif" });
    projects.push({ key: "arbitres", title: "Liste d'arbitres prête (au moins 4)", done: Math.min(4, referees.filter((r: any) => r.status === "actif").length), total: 4, next: "Ajouter des arbitres ou leur envoyer le lien d'inscription.", href: "/admin/arbitres" });
    const mid = surveys.find((s: any) => s.kind === "mi-saison");
    projects.push({ key: "sondage", title: "Sondage de mi-saison (avant le 15 décembre)", done: mid ? (mid.status === "brouillon" ? 1 : 2) : 0, total: 2, next: mid ? "Choisir les familles et envoyer." : "Créer le sondage de mi-saison à partir du modèle.", href: "/admin/sondages" });
  }
  return projects.sort((a, b) => Number(a.done >= a.total) - Number(b.done >= b.total));
}

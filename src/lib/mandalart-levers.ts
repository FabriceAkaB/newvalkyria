import { unpaidStartedRegistrations } from "@/lib/academy-history";
import { CLUB_ID } from "@/lib/club";
import { addMonths } from "@/lib/mandalart-core";
import type { RealFigures } from "@/lib/mandalart-kpis";
import { PLAN } from "@/lib/mandalart-plan";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Écart et rattrapage : le Mandalart ne se contente pas de cocher. Il compare l'argent encaissé
 *  au plan (mois, trimestre), y ajoute l'argent que JP veut rattraper (ex. charges avancées),
 *  puis propose des leviers chiffrés à partir des vrais chiffres du site (places libres, plages
 *  de matchs, commandites, préventes), du plus rapide au plus lent. Les montants sont des
 *  potentiels maximums, pas des promesses. */

function db() {
  return getSupabaseAdminClient() as any;
}

export interface RecoveryItem {
  id: string;
  label: string;
  amount_cents: number;
  note: string | null;
  created_at: string;
}

export interface Lever {
  key: string;
  title: string;
  potentialCents: number;
  when: "cette semaine" | "ce mois-ci" | "le mois prochain" | "plus tard";
  how: string;
  href: string;
  task?: string;
}

export interface CashRunway {
  until: string;
  balanceCents: number | null;
  expectedCents: number | null;
  installmentsCents: number;
  expensesCents: number;
  payrollCents: number;
  shortfallCents: number;
}

export interface GapReport {
  cash: CashRunway;
  month: string;
  monthActualCents: number;
  monthTargetCents: number;
  monthFloorCents: number;
  quarterLabel: string;
  quarterActualCents: number;
  quarterTargetCents: number;
  quarterFloorCents: number;
  recovery: RecoveryItem[];
  recoveryCents: number;
  /** Ce qu'il manque pour le plancher du trimestre + l'argent à rattraper. */
  toFindCents: number;
  levers: Lever[];
  quickCents: number;
  proposal: string[];
}

const dollars = (c: number) => `${Math.round(c / 100).toLocaleString("fr-CA")} $`;

export async function getRecovery(): Promise<RecoveryItem[]> {
  const { data } = await db().from("mandalart_recovery").select("id, label, amount_cents, note, created_at").eq("club_id", CLUB_ID).is("resolved_at", null).order("created_at");
  return data ?? [];
}

export async function addRecovery(label: string, amountCents: number, note: string | null) {
  const { error } = await db().from("mandalart_recovery").insert({ club_id: CLUB_ID, label, amount_cents: amountCents, note });
  if (error) throw error;
}

export async function resolveRecovery(id: string) {
  const { error } = await db().from("mandalart_recovery").update({ resolved_at: new Date().toISOString() }).eq("id", id).eq("club_id", CLUB_ID);
  if (error) throw error;
}

export async function computeGap(figures: RealFigures, today: string): Promise<GapReport> {
  const month = today.slice(0, 7);
  const m = PLAN.trajectory.months.find((x) => x.month === month);
  const q = Math.floor((Number(month.slice(5, 7)) - 1) / 3);
  const qMonths = [0, 1, 2].map((i) => `${month.slice(0, 4)}-${String(q * 3 + i + 1).padStart(2, "0")}`);
  const planQ = PLAN.trajectory.months.filter((x) => qMonths.includes(x.month));
  const actual = (mm: string) => figures.monthsCents[mm] ?? 0;
  const quarterActual = planQ.reduce((s, x) => s + actual(x.month), 0);
  const quarterTarget = planQ.reduce((s, x) => s + x.target * 100, 0);
  const quarterFloor = planQ.reduce((s, x) => s + x.floor * 100, 0);
  const recovery = await getRecovery();
  const recoveryCents = recovery.reduce((s, r) => s + r.amount_cents, 0);

  // ── Trésorerie jusqu'à la fin avril : solde + entrées connues − dépenses connues et paie des contrats ──
  const until = `${Number(month.slice(0, 4)) + (Number(month.slice(5, 7)) > 4 ? 1 : 0)}-04-30`;
  const [{ data: kpiRows }, { data: dueExpenses }, { data: contracts }, { data: inst1 }, { data: inst2 }, { data: inst3 }] = await Promise.all([
    db().from("mandalart_kpi_values").select("kpi_id, value, measured_at").eq("club_id", CLUB_ID).in("kpi_id", ["solde_bancaire", "entrees_attendues"]).order("measured_at").order("id"),
    db().from("revenue_expenses").select("amount_cents, due_date, expense_date").eq("status", "due"),
    db().from("employee_contracts").select("pay_schedule, status").neq("status", "cancelled"),
    db().from("registration_payment_plan_installments").select("amount_cents, due_date, status").in("status", ["pending", "failed"]),
    db().from("session_program_payment_plan_installments").select("amount_cents, due_date, status").in("status", ["pending", "failed"]),
    db().from("sport_etudes_payment_plan_installments").select("amount_cents, due_date, status").in("status", ["pending", "failed"])
  ]);
  const lastKpi = (id: string) => {
    const r = (kpiRows ?? []).filter((x: any) => x.kpi_id === id).at(-1);
    return r ? Math.round(Number(r.value) * 100) : null;
  };
  const inRange = (d: unknown) => String(d ?? "").slice(0, 10) <= until;
  const expensesCents = (dueExpenses ?? []).filter((e: any) => inRange(e.due_date ?? e.expense_date)).reduce((s: number, e: any) => s + (e.amount_cents ?? 0), 0);
  const payrollCents = (contracts ?? []).flatMap((c: any) => c.pay_schedule ?? []).filter((p: any) => p.payDate >= today && p.payDate <= until).reduce((s: number, p: any) => s + (p.amountCents ?? 0), 0);
  const installmentsCents = [...(inst1 ?? []), ...(inst2 ?? []), ...(inst3 ?? [])].filter((i: any) => inRange(i.due_date)).reduce((s: number, i: any) => s + (i.amount_cents ?? 0), 0);
  const balanceCents = lastKpi("solde_bancaire");
  const expectedCents = lastKpi("entrees_attendues");
  const shortfallCents = Math.max(0, expensesCents + payrollCents - (balanceCents ?? 0) - (expectedCents ?? 0) - installmentsCents);
  const cash: CashRunway = { until, balanceCents, expectedCents, installmentsCents, expensesCents, payrollCents, shortfallCents };

  const toFind = Math.max(Math.max(0, quarterFloor - quarterActual) + recoveryCents, shortfallCents);

  // ── Leviers, à partir des vraies données ──
  const [{ data: regs }, { data: slots }, { data: programs }, { data: progRegs }, { data: matchSlots }, { data: bookings }, { data: sponsorSlots }, { data: seasons }] = await Promise.all([
    db().from("registrations").select("season_id, status, is_trial, parent_email, player_first_name, time_slot_template_id"),
    db().from("time_slot_templates").select("id, max_places, active"),
    db().from("session_programs").select("slug, name, price_cents, max_capacity, active, published, gender"),
    db().from("session_program_registrations").select("program_slug, status"),
    db().from("match_slots").select("id, slot_date, price_cents, active").gte("slot_date", today),
    db().from("match_slot_bookings").select("slot_id, status").neq("status", "cancelled"),
    db().from("sponsor_slots_2027").select("status, price_cents"),
    db().from("seasons").select("id, is_active")
  ]);
  const season = (seasons ?? []).find((s: any) => s.is_active)?.id ?? "automne-hiver-2026";
  const paid = (regs ?? []).filter((r: any) => r.season_id === season && r.status === "paid");
  const free = (slots ?? []).filter((s: any) => s.active).reduce((n: number, s: any) => n + Math.max(0, (s.max_places ?? 0) - paid.filter((r: any) => r.time_slot_template_id === s.id).length), 0);
  const HALF = 43798; // Demi-saison (TVD)
  const started = unpaidStartedRegistrations(regs ?? [], season).length;
  const lost = figures.retention.lost.length;
  const levers: Lever[] = [];

  if (free > 0) {
    levers.push({
      key: "places-filles",
      title: `Remplir les ${free} places libres des groupes filles`,
      potentialCents: free * HALF,
      when: "ce mois-ci",
      how: `Offre demi-saison (${dollars(HALF)}) d'abord aux ${started} inscriptions commencées non payées et aux ${lost} familles de l'été pas revenues ; vérifier chaque joueuse par son nom avant d'écrire (skill relance).`,
      href: "/admin/relances",
      task: "P7.4.02"
    });
  }
  const boys = (programs ?? []).filter((p: any) => p.active && p.published && p.gender === "garcons" && p.max_capacity);
  const boysFree = boys
    .map((p: any) => ({ p, free: Math.max(0, p.max_capacity - (progRegs ?? []).filter((r: any) => r.program_slug === p.slug && r.status === "paid").length) }))
    .filter((x: any) => x.free > 0);
  if (boysFree.length) {
    levers.push({
      key: "places-garcons",
      title: `Remplir les ${boysFree.reduce((s: number, x: any) => s + x.free, 0)} places des programmes garçons`,
      potentialCents: boysFree.reduce((s: number, x: any) => s + x.free * (x.p.price_cents ?? 0), 0),
      when: "ce mois-ci",
      how: boysFree.map((x: any) => `${x.p.name} : ${x.free} place(s)`).join(" · ") + ". Chaque parent d'un essai gratuit reçoit l'offre ; demander aux familles d'inviter un ami.",
      href: "/admin/inscriptions-garcons"
    });
  }
  const soldIds = new Set((bookings ?? []).filter((b: any) => b.status === "paid" || b.status === "pending").map((b: any) => b.slot_id));
  const unsold = (matchSlots ?? []).filter((s: any) => s.active && !soldIds.has(s.id));
  if (unsold.length) {
    levers.push({
      key: "plages",
      title: `Vendre les ${unsold.length} plages de match restantes`,
      potentialCents: unsold.reduce((s: number, x: any) => s + (x.price_cents ?? 0), 0),
      when: "le mois prochain",
      how: "Le terrain de Terrebonne est déjà payé : chaque plage vendue réduit cette perte. Écrire aux clubs qui ont déjà joué contre nous et aux clubs de la liste.",
      href: "/admin/matchs",
      task: "P7.3.02"
    });
  }
  const sponsorsLeft = (sponsorSlots ?? []).filter((s: any) => s.status === "available");
  if (sponsorsLeft.length) {
    levers.push({
      key: "commandites",
      title: `Vendre les ${sponsorsLeft.length} emplacements de commandite 2027`,
      potentialCents: sponsorsLeft.reduce((s: number, x: any) => s + (x.price_cents ?? 0), 0),
      when: "le mois prochain",
      how: "Commencer par les parents qui ont une entreprise, puis la liste des 100 entreprises (agent partenaires A08).",
      href: "/admin/sponsors-2027"
    });
  }
  for (const off of [1, 2]) {
    const pm = PLAN.trajectory.months.find((x) => x.month === addMonths(month, off));
    if (!pm) continue;
    levers.push({
      key: `prevente-${pm.month}`,
      title: `${pm.kind} (${pm.month}) : cible du plan`,
      potentialCents: pm.target * 100,
      when: off === 1 ? "le mois prochain" : "plus tard",
      how: `${pm.how} À préparer dès maintenant (règle d'anticipation).`,
      href: "/admin/mandalart",
      task: pm.month.endsWith("-12") ? "P5.2.01" : pm.month.endsWith("-01") ? "P2.4.05" : undefined
    });
  }
  const young = figures.cohorts.filter((c) => c.year >= 2017).reduce((s, c) => s + (c.missing ?? 0), 0);
  if (young > 0) {
    levers.push({
      key: "groupes-2017-2019",
      title: `Ouvrir des groupes 2017, 2018 et 2019 (${young} places à combler vers 40 par génération)`,
      potentialCents: Math.min(young, 30) * HALF,
      when: "plus tard",
      how: "Janvier : nouveaux groupes U8-U9 selon les gymnases libres (tâche P2.4.02). Potentiel calculé sur 30 joueuses à la demi-saison.",
      href: "/admin/mandalart/piliers/p4/retention",
      task: "P2.4.02"
    });
  }

  const order = { "cette semaine": 0, "ce mois-ci": 1, "le mois prochain": 2, "plus tard": 3 };
  levers.sort((a, b) => order[a.when] - order[b.when] || b.potentialCents - a.potentialCents);
  const quick = levers.filter((l) => l.when === "ce mois-ci" || l.when === "cette semaine");
  const quickCents = quick.reduce((s, l) => s + l.potentialCents, 0);
  const proposal: string[] = [];
  if (shortfallCents > 0) {
    proposal.push(`Trésorerie : il manque ${dollars(shortfallCents)} d'ici le 30 avril pour payer les dépenses connues (terrains, paie des contrats) avec ${balanceCents === null ? "un solde pas encore saisi" : `un solde de ${dollars(balanceCents)}`}${expectedCents ? ` et ${dollars(expectedCents)} attendus` : ""}. Ce sont les leviers de ce mois-ci et la prévente de décembre et janvier qui doivent le couvrir.`);
  }
  if (toFind > 0) {
    proposal.push(`Il faut trouver ${dollars(toFind)} : ${dollars(Math.max(0, quarterFloor - quarterActual))} pour le plancher du trimestre${recoveryCents ? ` et ${dollars(recoveryCents)} à rattraper` : ""}.`);
    proposal.push(quickCents >= toFind ? `Les leviers de ce mois-ci peuvent le couvrir (${dollars(quickCents)} possibles) : commencer par « ${quick[0]?.title} ».` : `Les leviers de ce mois-ci donnent au plus ${dollars(quickCents)} ; le reste viendra de la prévente (${levers.find((l) => l.key.startsWith("prevente"))?.title ?? "mois suivants"}).`);
  } else {
    proposal.push("Le plancher du trimestre est atteint : continuer sur la cible et préparer la prévente d'avance.");
  }

  return {
    cash,
    month,
    monthActualCents: actual(month),
    monthTargetCents: (m?.target ?? 0) * 100,
    monthFloorCents: (m?.floor ?? 0) * 100,
    quarterLabel: `T${q + 1} ${month.slice(0, 4)}`,
    quarterActualCents: quarterActual,
    quarterTargetCents: quarterTarget,
    quarterFloorCents: quarterFloor,
    recovery,
    recoveryCents,
    toFindCents: toFind,
    levers,
    quickCents,
    proposal
  };
}

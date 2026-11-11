/** Calculateur de lancement GO / NO-GO : la méthode du pilier 7 du Mandalart (P7.2, automatisation AU11).
 *
 *  F = coûts fixes (terrain, éducateurs, matériel, assurance, marketing, autres)
 *  V = coûts par participante (uniforme ou kit, frais Stripe de 2,9 % + 0,30 $ par paiement, autres)
 *  N = places, P = prix payé par la famille.
 *
 *  - Prix coûtant (groupe plein) : le prix qui couvre juste les coûts avec N inscrites.
 *  - Prix plancher de la méthode : 2 × (F ÷ (N × 80 %) + V), soit 50 % de marge à 80 % de remplissage.
 *  - Seuil de survie : le nombre minimal d'inscrites pour couvrir les coûts.
 *  - Seuil de 50 % : le nombre minimal d'inscrites pour 50 % de marge.
 *  - Scénario pessimiste : 70 % des places vendues. GO si la marge y est d'au moins 50 %,
 *    À RISQUE si elle est d'au moins 35 %, NO-GO sinon. Deux semaines avant le début, des préventes
 *    sous le seuil de survie font passer le lancement à NO-GO (reporter, fusionner ou annuler).
 *
 *  Les frais Stripe en pourcentage dépendent du prix : toutes les formules les gardent à part
 *  (V = Vbase + 2,9 % × P), ce qui donne des prix planchers exacts.
 *  Ce fichier est pur (aucun accès à la base) : la page, la route API et les tests l'utilisent tels quels. */

export const STRIPE_PERCENT = 0.029;
export const STRIPE_FIXED_CENTS = 30;
export const TARGET_MARGIN = 0.5;
export const RISK_MARGIN = 0.35;
export const PESSIMISTIC_FILL = 0.7;
export const METHOD_FILL = 0.8;
export const PRESALES_CHECK_DAYS = 14;

export type FieldMode = "hourly" | "contract";
export type Verdict = "go" | "risque" | "no-go";

export interface LaunchInputs {
  /** Prix payé par la famille pour le programme, en cents. */
  priceCents: number;
  /** Nombre de places (N). */
  capacity: number;
  /** Nombre de séances du programme. */
  sessions: number;
  /** Durée d'une séance, en heures. */
  hoursPerSession: number;
  /** Terrain : à l'heure (heures × coût horaire) ou montant du contrat. */
  fieldMode: FieldMode;
  /** Heures de terrain ; null = les heures du programme (séances × durée). */
  fieldHours: number | null;
  fieldHourlyCents: number;
  fieldContractCents: number;
  coachCount: number;
  /** Heures payées à chaque éducateur ; null = les heures du programme. */
  coachHours: number | null;
  coachHourlyCents: number;
  equipmentCents: number;
  insuranceCents: number;
  marketingCents: number;
  otherFixedCents: number;
  /** Uniforme ou kit remis à chaque participante. */
  kitCents: number;
  /** Nombre moyen de paiements Stripe par famille (1 = paiement en une fois). */
  paymentsPerFamily: number;
  otherVariableCents: number;
  /** Inscrites à ce jour (préventes) ; null = pas encore en vente. */
  presales: number | null;
  /** Date de début (AAAA-MM-JJ) ; null = pas encore fixée. */
  startDate: string | null;
}

export const EMPTY_INPUTS: LaunchInputs = {
  priceCents: 0,
  capacity: 0,
  sessions: 0,
  hoursPerSession: 0,
  fieldMode: "hourly",
  fieldHours: null,
  fieldHourlyCents: 0,
  fieldContractCents: 0,
  coachCount: 1,
  coachHours: null,
  coachHourlyCents: 0,
  equipmentCents: 0,
  insuranceCents: 0,
  marketingCents: 0,
  otherFixedCents: 0,
  kitCents: 0,
  paymentsPerFamily: 1,
  otherVariableCents: 0,
  presales: null,
  startDate: null
};

export interface FixedLine {
  key: "field" | "coaches" | "equipment" | "insurance" | "marketing" | "other";
  label: string;
  cents: number;
}

export interface FillScenario {
  key: "presales" | "half" | "pessimistic" | "method" | "full";
  label: string;
  /** Taux de remplissage (null pour les préventes). */
  rate: number | null;
  count: number;
  revenueCents: number;
  costCents: number;
  profitCents: number;
  /** Profit ÷ revenus ; null quand il n'y a aucun revenu. */
  margin: number | null;
}

export interface MethodRule {
  key: "price" | "margin-count" | "pessimistic" | "presales";
  label: string;
  /** true = respectée, false = non respectée, null = pas encore vérifiable. */
  ok: boolean | null;
  detail: string;
}

export interface LaunchResults {
  /** false tant qu'il manque le prix, le nombre de places ou tout coût : aucun verdict à afficher. */
  ready: boolean;
  /** Ce qui manque pour donner un verdict : le prix ou les places, puis au moins un coût (sinon tout serait GO). */
  missing: "price-capacity" | "costs" | null;
  programHours: number;
  fixedLines: FixedLine[];
  fixedCents: number;
  stripeCents: number;
  /** V au prix proposé (inclut les frais Stripe). */
  variableCents: number;
  /** Ce que chaque inscrite laisse pour payer les coûts fixes : P − V. */
  contributionCents: number;
  /** Prix coûtant à capacité pleine (aucun profit, groupe plein). */
  floorPriceCents: number | null;
  /** Prix plancher de la méthode : 50 % de marge à 80 % de remplissage. */
  methodFloorCents: number | null;
  /** Prix minimal pour un GO : 50 % de marge à 70 % de remplissage. */
  goPriceCents: number | null;
  /** Coûts fixes maximums pour un GO au prix proposé (null si impossible même sans coûts fixes). */
  maxFixedForGoCents: number | null;
  breakEvenCount: number | null;
  marginCount: number | null;
  pessimisticCount: number;
  methodCount: number;
  scenarios: FillScenario[];
  margin70: number | null;
  profit70Cents: number;
  /** Verdict économique (marge à 70 %), avant la vérification des préventes. */
  economicVerdict: Verdict;
  verdict: Verdict;
  /** true quand les préventes sous le seuil de survie, à moins de 2 semaines du début, imposent le NO-GO. */
  presalesBlock: boolean;
  /** Date de vérification des préventes (début − 14 jours). */
  presalesCheckDate: string | null;
  daysToStart: number | null;
  rules: MethodRule[];
  headline: string;
  sentence: string;
}

// ── Outils ──────────────────────────────────────────────────────

const num = (x: unknown, fallback = 0): number => {
  const n = typeof x === "number" ? x : typeof x === "string" ? Number(x.replace(",", ".").replace(/\s|\$/g, "")) : NaN;
  return Number.isFinite(n) ? n : fallback;
};
const nonNeg = (x: unknown) => Math.max(0, num(x));
const cents = (x: unknown) => Math.round(nonNeg(x));

/** Vraie date AAAA-MM-JJ (« 2026-13-45 » ou « 2026-02-30 » sont refusées, sinon les calculs de dates planteraient). */
export function isIsoDate(x: unknown): x is string {
  if (typeof x !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
  const d = new Date(`${x}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === x;
}

/** Jour (AAAA-MM-JJ) d'un horodatage à l'heure de Montréal : « 2026-11-07T02:30Z » est encore le 6 nov. au Québec. */
export function torontoDay(ts: string | Date): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return typeof ts === "string" ? ts.slice(0, 10) : "";
  return d.toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
}

/** Ramène des entrées venues d'un formulaire ou de la base à des valeurs sûres (jamais négatives, entiers où il faut). */
export function normalizeInputs(raw: Partial<LaunchInputs> | null | undefined): LaunchInputs {
  const r = { ...EMPTY_INPUTS, ...(raw ?? {}) };
  const optHours = (x: unknown) => (x === null || x === undefined || x === "" ? null : nonNeg(x));
  const presales = r.presales === null || r.presales === undefined || (r.presales as unknown) === "" ? null : Math.floor(nonNeg(r.presales));
  const startDate = isIsoDate(r.startDate) ? r.startDate : null;
  return {
    priceCents: cents(r.priceCents),
    capacity: Math.floor(nonNeg(r.capacity)),
    sessions: Math.floor(nonNeg(r.sessions)),
    hoursPerSession: nonNeg(r.hoursPerSession),
    fieldMode: r.fieldMode === "contract" ? "contract" : "hourly",
    fieldHours: optHours(r.fieldHours),
    fieldHourlyCents: cents(r.fieldHourlyCents),
    fieldContractCents: cents(r.fieldContractCents),
    coachCount: Math.floor(nonNeg(r.coachCount)),
    coachHours: optHours(r.coachHours),
    coachHourlyCents: cents(r.coachHourlyCents),
    equipmentCents: cents(r.equipmentCents),
    insuranceCents: cents(r.insuranceCents),
    marketingCents: cents(r.marketingCents),
    otherFixedCents: cents(r.otherFixedCents),
    kitCents: cents(r.kitCents),
    paymentsPerFamily: nonNeg(r.paymentsPerFamily),
    otherVariableCents: cents(r.otherVariableCents),
    presales,
    startDate
  };
}

/** Nombre d'inscrites à un taux de remplissage (arrondi vers le bas : on ne vend pas une demi-place). */
export function fillCount(capacity: number, rate: number): number {
  return Math.max(0, Math.floor(capacity * rate + 1e-9));
}

/** Marge arrondie au dixième de point : le verdict et l'affichage utilisent la même valeur. */
export function roundMargin(m: number): number {
  return Math.round(m * 1000) / 1000;
}

/** Pourcentage affiché (tronqué : 49,9 % s'affiche 49 %, jamais 50 % sous le seuil). */
export function marginLabel(m: number | null): string {
  if (m === null) return "—";
  const v = Math.trunc(Math.round(m * 1000) / 10);
  return v < 0 ? `−${-v} %` : `${v === 0 ? 0 : v} %`;
}

/** Montant arrondi au dollar ; `up` arrondit vers le haut (prix planchers : jamais sous le seuil). */
export function dollars(c: number, up = false): string {
  const d = up ? Math.ceil(c / 100 - 1e-9) : Math.round(c / 100);
  const sign = d < 0 ? "−" : "";
  return `${sign}${Math.abs(d).toLocaleString("fr-CA")} $`;
}

export function verdictFromMargin(margin: number | null): Verdict {
  if (margin === null) return "no-go";
  const m = roundMargin(margin);
  if (m >= TARGET_MARGIN) return "go";
  if (m >= RISK_MARGIN) return "risque";
  return "no-go";
}

export const VERDICT_LABEL: Record<Verdict, string> = { go: "GO", risque: "À RISQUE", "no-go": "NO-GO" };
export const VERDICT_TONE: Record<Verdict, "good" | "warn" | "bad"> = { go: "good", risque: "warn", "no-go": "bad" };

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T12:00:00Z`) - Date.parse(`${fromIso}T12:00:00Z`)) / 86_400_000);
}

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${MONTHS[m - 1]} ${y}`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("fr-CA")} ${n > 1 ? many : one}`;

// ── Calcul ──────────────────────────────────────────────────────

/** Calcule tout le tableau de bord du lancement. `today` (AAAA-MM-JJ) sert à la règle des préventes. */
export function computeLaunch(raw: Partial<LaunchInputs>, today?: string): LaunchResults {
  const i = normalizeInputs(raw);
  const P = i.priceCents;
  const N = i.capacity;
  const r = STRIPE_PERCENT;
  const programHours = i.sessions * i.hoursPerSession;

  const fieldCents = i.fieldMode === "contract" ? i.fieldContractCents : (i.fieldHours ?? programHours) * i.fieldHourlyCents;
  const coachesCents = i.coachCount * (i.coachHours ?? programHours) * i.coachHourlyCents;
  const fixedLines: FixedLine[] = [
    { key: "field", label: "Terrain", cents: Math.round(fieldCents) },
    { key: "coaches", label: "Éducateurs", cents: Math.round(coachesCents) },
    { key: "equipment", label: "Matériel", cents: i.equipmentCents },
    { key: "insurance", label: "Assurance", cents: i.insuranceCents },
    { key: "marketing", label: "Marketing", cents: i.marketingCents },
    { key: "other", label: "Autres coûts fixes", cents: i.otherFixedCents }
  ];
  const F = fixedLines.reduce((s, l) => s + l.cents, 0);

  // V = Vbase + r × P : la part fixe des frais Stripe (0,30 $ par paiement) va dans Vbase.
  const Vbase = i.kitCents + i.otherVariableCents + STRIPE_FIXED_CENTS * i.paymentsPerFamily;
  const stripe = r * P + STRIPE_FIXED_CENTS * i.paymentsPerFamily;
  const V = Vbase + r * P;
  const contribution = P - V;

  const profitAt = (n: number) => n * contribution - F;
  const scenarioAt = (key: FillScenario["key"], label: string, rate: number | null, n: number): FillScenario => {
    const revenue = n * P;
    const cost = F + n * V;
    const profit = revenue - cost;
    return { key, label, rate, count: n, revenueCents: Math.round(revenue), costCents: Math.round(cost), profitCents: Math.round(profit), margin: revenue > 0 ? profit / revenue : null };
  };

  /** Prix qui donne la marge m avec n inscrites : P = (F ÷ n + Vbase) ÷ (1 − m − r). */
  const priceFor = (m: number, n: number): number | null => {
    if (n <= 0) return null;
    const d = 1 - m - r;
    if (d <= 0) return null;
    return Math.ceil((F / n + Vbase) / d - 1e-9);
  };
  /** Nombre minimal d'inscrites pour la marge m au prix P. */
  const countFor = (m: number): number | null => {
    const c = P * (1 - m - r) - Vbase;
    if (c <= 1e-9) return null;
    return Math.max(m > 0 ? 1 : 0, Math.ceil(F / c - 1e-9));
  };

  const n70 = fillCount(N, PESSIMISTIC_FILL);
  const n80 = fillCount(N, METHOD_FILL);
  const pessimistic = scenarioAt("pessimistic", "Scénario pessimiste", PESSIMISTIC_FILL, n70);
  const scenarios: FillScenario[] = [
    scenarioAt("half", "Moitié des places", 0.5, fillCount(N, 0.5)),
    pessimistic,
    scenarioAt("method", "Remplissage visé par la méthode", METHOD_FILL, n80),
    scenarioAt("full", "Groupe plein", 1, N)
  ];
  if (i.presales !== null) scenarios.unshift(scenarioAt("presales", "Inscrites à ce jour", null, i.presales));

  const floorPriceCents = priceFor(0, N);
  const methodFloorCents = priceFor(TARGET_MARGIN, n80);
  const goPriceCents = priceFor(TARGET_MARGIN, n70);
  const breakEvenCount = countFor(0);
  const marginCount = countFor(TARGET_MARGIN);
  // Coûts fixes maximums pour 50 % de marge à 70 % : n70 × (P × (1 − 0,5 − r) − Vbase).
  const maxFixed = n70 * (P * (1 - TARGET_MARGIN - r) - Vbase);
  const maxFixedForGoCents = n70 > 0 && maxFixed > 0 ? Math.floor(maxFixed) : null;

  // Sans aucun coût saisi (terrain, éducateurs, kit…), tout programme serait GO : on attend au moins un coût.
  const costsEntered = F > 0 || i.kitCents + i.otherVariableCents > 0;
  const missing: LaunchResults["missing"] = !(P > 0 && N > 0) ? "price-capacity" : !costsEntered ? "costs" : null;
  const ready = missing === null;
  const margin70 = pessimistic.margin;
  const economicVerdict = ready ? verdictFromMargin(margin70) : "no-go";

  // Préventes : vérification 14 jours avant le début.
  const presalesCheckDate = i.startDate ? addDays(i.startDate, -PRESALES_CHECK_DAYS) : null;
  const daysToStart = i.startDate && today ? daysBetween(today, i.startDate) : null;
  const checkDue = presalesCheckDate !== null && today !== undefined && today >= presalesCheckDate;
  const presalesShort = i.presales !== null && (breakEvenCount === null || i.presales < breakEvenCount);
  const presalesBlock = ready && checkDue && presalesShort;
  const verdict: Verdict = presalesBlock ? "no-go" : economicVerdict;

  const rules: MethodRule[] = [
    {
      key: "price",
      label: "Le prix est au-dessus du prix plancher",
      ok: ready ? methodFloorCents !== null && P >= methodFloorCents : null,
      detail:
        methodFloorCents === null
          ? "Prix plancher impossible à calculer : il faut au moins une place."
          : `Prix plancher : 2 × (coûts fixes ÷ ${plural(n80, "inscrite")} + coût par inscrite) = ${dollars(methodFloorCents, true)} (50 % de marge à 80 % de remplissage).`
    },
    {
      key: "margin-count",
      label: "Le seuil de 50 % de marge tient dans les places",
      ok: ready ? marginCount !== null && marginCount <= N : null,
      detail: marginCount === null ? "Au prix proposé, la marge n'atteint jamais 50 %, peu importe le nombre d'inscrites." : `Il faut ${plural(marginCount, "inscrite")} pour 50 % de marge, sur ${plural(N, "place")}.`
    },
    {
      key: "pessimistic",
      label: "Le scénario pessimiste ne perd pas d'argent",
      ok: ready ? n70 > 0 && pessimistic.profitCents >= 0 : null,
      detail: n70 === 0 ? "À 70 % de remplissage, il n'y aurait aucune inscrite." : `Avec ${plural(n70, "inscrite")} (70 %) : ${pessimistic.profitCents >= 0 ? "profit" : "perte"} de ${dollars(Math.abs(pessimistic.profitCents))}.`
    },
    {
      key: "presales",
      label: "Les préventes atteignent le seuil de survie 2 semaines avant",
      ok: !ready || i.presales === null ? null : !presalesShort ? true : checkDue ? false : null,
      detail:
        i.presales === null
          ? `Entrez les inscrites à ce jour${presalesCheckDate ? ` ; vérification le ${shortDate(presalesCheckDate)}` : ""}.`
          : breakEvenCount === null
            ? `${plural(i.presales, "inscrite")} à ce jour, mais le prix ne couvre jamais les coûts.`
            : `${plural(i.presales, "inscrite")} à ce jour sur ${plural(breakEvenCount, "nécessaire")}${presalesCheckDate ? ` · vérification le ${shortDate(presalesCheckDate)}` : " · fixez la date de début pour la vérification"}.`
    }
  ];

  const { headline, sentence } = describe({
    ready,
    missing,
    N,
    P,
    F,
    n70,
    margin70,
    profit70: pessimistic.profitCents,
    economicVerdict,
    presalesBlock,
    presales: i.presales,
    breakEvenCount,
    marginCount,
    goPriceCents,
    maxFixedForGoCents,
    daysToStart
  });

  return {
    ready,
    missing,
    programHours,
    fixedLines,
    fixedCents: F,
    stripeCents: Math.round(stripe),
    variableCents: Math.round(V),
    contributionCents: Math.round(contribution),
    floorPriceCents,
    methodFloorCents,
    goPriceCents,
    maxFixedForGoCents,
    breakEvenCount,
    marginCount,
    pessimisticCount: n70,
    methodCount: n80,
    scenarios,
    margin70,
    profit70Cents: pessimistic.profitCents,
    economicVerdict,
    verdict,
    presalesBlock,
    presalesCheckDate,
    daysToStart,
    rules,
    headline,
    sentence
  };
}

function describe(x: {
  ready: boolean;
  missing: LaunchResults["missing"];
  N: number;
  P: number;
  F: number;
  n70: number;
  margin70: number | null;
  profit70: number;
  economicVerdict: Verdict;
  presalesBlock: boolean;
  presales: number | null;
  breakEvenCount: number | null;
  marginCount: number | null;
  goPriceCents: number | null;
  maxFixedForGoCents: number | null;
  daysToStart: number | null;
}): { headline: string; sentence: string } {
  if (x.missing === "costs") {
    return {
      headline: "Entrez les coûts du programme",
      sentence: "Le prix et les places sont là. Ajoutez le terrain, les éducateurs et le kit : le verdict apparaît dès le premier coût."
    };
  }
  if (!x.ready) {
    return {
      headline: "Entrez un prix et un nombre de places",
      sentence: "Partez d'un programme existant ou entrez vos chiffres : le verdict se calcule à mesure que vous tapez."
    };
  }
  const survival =
    x.breakEvenCount === null
      ? "À ce prix, chaque inscrite coûte plus qu'elle ne rapporte."
      : x.breakEvenCount === 0
        ? "Sans coûts fixes, chaque inscrite couvre déjà ses coûts."
        : `Il faut ${plural(x.breakEvenCount, "inscrite")} pour couvrir les coûts${x.marginCount !== null ? ` et ${x.marginCount.toLocaleString("fr-CA")} pour 50 % de marge` : ""}.`;

  // Sans seuil de survie (le prix ne couvre jamais les coûts), le NO-GO économique ci-dessous l'explique mieux.
  if (x.presalesBlock && x.breakEvenCount !== null) {
    const when = x.daysToStart === null ? "" : x.daysToStart > 0 ? `, à ${plural(x.daysToStart, "jour")} du début` : x.daysToStart === 0 ? ", le jour du début" : ", après la date de début";
    return {
      headline: `NO-GO : ${plural(x.presales ?? 0, "prévente")} sur ${plural(x.breakEvenCount, "nécessaire")}${when}`,
      sentence: `Les préventes n'atteignent pas le seuil de survie à moins de 2 semaines du début : reporter, fusionner avec un autre groupe ou annuler. ${survival}`
    };
  }

  if (x.n70 === 0) {
    return {
      headline: "NO-GO : trop peu de places pour le scénario pessimiste",
      sentence: `À 70 % de remplissage, ${plural(x.N, "place")} donne${x.N > 1 ? "nt" : ""} moins d'une inscrite. Ajoutez des places ou regroupez avec un autre programme.`
    };
  }

  const at70 = `à 70 % de remplissage`;
  const who = `${plural(x.n70, "inscrite")} sur ${x.N.toLocaleString("fr-CA")}`;
  const levers: string[] = [];
  if (x.goPriceCents !== null && x.goPriceCents > x.P) levers.push(`un prix d'au moins ${dollars(x.goPriceCents, true)}`);
  if (x.maxFixedForGoCents !== null && x.maxFixedForGoCents < x.F) levers.push(`des coûts fixes d'au plus ${dollars(x.maxFixedForGoCents)} (−${dollars(x.F - x.maxFixedForGoCents, true)})`);
  if (x.maxFixedForGoCents === null) levers.push("des coûts par inscrite plus bas (uniforme, autres)");
  const toGo = levers.length ? ` Pour passer GO : ${levers.join(", ou ")}.` : "";

  if (x.economicVerdict === "go") {
    return {
      headline: `GO : ${marginLabel(x.margin70)} de marge même ${at70}`,
      sentence: `Même avec ${who}, le programme dégage ${dollars(x.profit70)} de profit. ${survival}`
    };
  }
  if (x.economicVerdict === "risque") {
    return {
      headline: `À risque : ${marginLabel(x.margin70)} de marge ${at70}`,
      sentence: `Avec ${who}, la marge est sous l'objectif de 50 % (profit de ${dollars(x.profit70)}).${toGo} ${survival}`
    };
  }
  if (x.profit70 < 0) {
    return {
      headline: `NO-GO : perte de ${dollars(-x.profit70)} ${at70}`,
      sentence: `Avec ${who}, le programme coûte plus qu'il ne rapporte.${toGo} ${survival}`
    };
  }
  return {
    headline: `NO-GO : seulement ${marginLabel(x.margin70)} de marge ${at70}`,
    sentence: `Avec ${who}, la marge est sous 35 % (profit de ${dollars(x.profit70)}).${toGo} ${survival}`
  };
}

// ── Préremplissage ──────────────────────────────────────────────

/** Programme existant qui peut servir de point de départ (saison filles ou programme à dates fixes). */
export interface ProgramSource {
  kind: "saison" | "session";
  id: string;
  /** Clé unique « saison:automne-hiver-2026:TV » ou « session:garcons-2014 ». */
  key: string;
  label: string;
  group: string;
  priceCents: number;
  capacity: number | null;
  sessions: number | null;
  hoursPerSession: number | null;
  presales: number;
  otherFixedCents: number;
  startDate: string | null;
  note: string | null;
}

/** Contrat de terrain ou de gymnase (venue_rentals). */
export interface VenueSource {
  id: string;
  label: string;
  period: string;
  hours: number;
  totalCents: number;
  hourlyCents: number;
  taxIncluded: boolean;
}

/** Taux horaire d'un éducateur (coach_type_rates), pour remplir le taux en un geste. */
export interface CoachRateSource {
  label: string;
  hourlyCents: number;
}

export interface PrefillSources {
  programs: ProgramSource[];
  venues: VenueSource[];
  coachRates: CoachRateSource[];
}

/** Applique un programme existant : prix, places, séances, préventes, date de début et coûts déjà saisis. */
export function applyProgram(inputs: LaunchInputs, p: ProgramSource): LaunchInputs {
  return normalizeInputs({
    ...inputs,
    priceCents: p.priceCents,
    capacity: p.capacity ?? inputs.capacity,
    sessions: p.sessions ?? inputs.sessions,
    hoursPerSession: p.hoursPerSession ?? inputs.hoursPerSession,
    presales: p.presales,
    startDate: p.startDate ?? inputs.startDate,
    otherFixedCents: p.otherFixedCents > 0 ? p.otherFixedCents : inputs.otherFixedCents
  });
}

/** Applique un contrat de terrain : coût horaire du contrat (montant ÷ heures) et montant complet. */
export function applyVenue(inputs: LaunchInputs, v: VenueSource): LaunchInputs {
  return normalizeInputs({ ...inputs, fieldHourlyCents: v.hourlyCents, fieldContractCents: v.totalCents });
}

/** Coût horaire d'un contrat, arrondi au cent. */
export function venueHourlyCents(totalCents: number, hours: number): number {
  return hours > 0 ? Math.round(totalCents / hours) : 0;
}

/** Durée moyenne d'une séance, en heures, à partir des heures « 18:30 » / « 19:45 ». */
export function averageSessionHours(slots: { start: string | null; end: string | null }[]): number | null {
  const toMin = (t: string | null) => {
    const m = t?.trim().match(/^(\d{1,2})\s*(?:[:h]\s*)?(\d{2})?/);
    return m ? Number(m[1]) * 60 + Number(m[2] ?? 0) : null;
  };
  const durations = slots
    .map((s) => {
      const a = toMin(s.start);
      const b = toMin(s.end);
      return a !== null && b !== null && b > a ? (b - a) / 60 : null;
    })
    .filter((d): d is number => d !== null);
  if (!durations.length) return null;
  return Math.round((durations.reduce((s, d) => s + d, 0) / durations.length) * 100) / 100;
}

// ── Comparaison des scénarios et alerte des préventes ───────────

export interface ScenarioSummary {
  verdict: Verdict;
  margin70: number | null;
  profit70Cents: number;
  floorPriceCents: number | null;
  methodFloorCents: number | null;
  breakEvenCount: number | null;
  marginCount: number | null;
  fixedCents: number;
  variableCents: number;
}

/** Le meilleur scénario d'une liste : la plus forte marge à 70 % (null si aucun n'a de marge). */
export function bestScenarioIndex(list: { margin70: number | null }[]): number | null {
  let best: number | null = null;
  list.forEach((s, idx) => {
    if (s.margin70 === null) return;
    if (best === null || (list[best].margin70 ?? -Infinity) < s.margin70) best = idx;
  });
  return best;
}

export interface PresalesWatch {
  startDate: string;
  presales: number;
  breakEvenCount: number | null;
}

/** Un lancement à signaler : début dans 14 jours ou moins (pas encore commencé) et préventes sous le seuil de survie. */
export function needsPresalesAlert(w: PresalesWatch, today: string): boolean {
  const days = daysBetween(today, w.startDate);
  if (days < 0 || days > PRESALES_CHECK_DAYS) return false;
  return w.breakEvenCount === null || w.presales < w.breakEvenCount;
}

/** Scénario enregistré, vu par l'alerte des préventes. `sourceKey` = « saison:automne-hiver-2026:TV » ou « session:garcons-2014 ». */
export interface WatchedScenario {
  id: string;
  name: string;
  sourceKey: string | null;
  startDate: string | null;
  updatedAt: string;
  inputs: LaunchInputs;
}

export interface LaunchAlert {
  scenarioId: string;
  name: string;
  startDate: string;
  daysToStart: number;
  /** null = préventes inconnues (scénario non relié à un programme et préventes non saisies). */
  presales: number | null;
  breakEvenCount: number | null;
  /** true = préventes comptées en direct dans les inscriptions payées du programme relié. */
  linked: boolean;
}

/** Lancements à signaler dans Aujourd'hui. Seul le scénario le plus récent de chaque programme compte (un lancement
 *  reporté à plus tard dans un nouveau scénario n'alerte plus à l'ancienne date) ; un scénario sans prix, places ou coûts
 *  n'a pas de seuil de survie et n'alerte pas. `livePresales` donne les inscrites payées d'un programme relié (null si inconnu). */
export function selectLaunchAlerts(list: WatchedScenario[], livePresales: (sourceKey: string) => number | null, today: string): LaunchAlert[] {
  const latest = new Map<string, WatchedScenario>();
  for (const s of [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
    const key = s.sourceKey ?? `scenario:${s.id}`;
    if (!latest.has(key)) latest.set(key, s);
  }
  const alerts: LaunchAlert[] = [];
  for (const s of latest.values()) {
    if (!s.startDate) continue;
    const days = daysBetween(today, s.startDate);
    if (days < 0 || days > PRESALES_CHECK_DAYS) continue;
    const live = s.sourceKey ? livePresales(s.sourceKey) : null;
    const presales = live ?? s.inputs.presales;
    const r = computeLaunch({ ...s.inputs, presales }, today);
    if (!r.ready) continue;
    if (presales !== null && !needsPresalesAlert({ startDate: s.startDate, presales, breakEvenCount: r.breakEvenCount }, today)) continue;
    alerts.push({ scenarioId: s.id, name: s.name, startDate: s.startDate, daysToStart: days, presales, breakEvenCount: r.breakEvenCount, linked: live !== null });
  }
  return alerts.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

import { describe, expect, it } from "vitest";

import {
  addMonths,
  buildEntries,
  computeTimeline,
  contractTodayItems,
  deadlineLabel,
  parseFrenchPeriod,
  torontoDay,
  summarize,
  type ContractEntry,
  type RegistryRow,
  type RegistrySources
} from "@/lib/contracts-registry";

const TODAY = "2026-11-02";

function entry(p: Partial<ContractEntry>): ContractEntry {
  return {
    key: "manuel:x",
    registryId: "x",
    source: null,
    sourceId: null,
    kind: "assurance",
    title: "Assurance responsabilité civile",
    supplier: null,
    startDate: null,
    endDate: null,
    dateOrigin: "saisie",
    dateHint: null,
    renewal: "manuel",
    noticeDays: null,
    alertDays: 90,
    amountCents: null,
    amountPeriod: "total",
    isRevenue: false,
    status: "actif",
    decisionNote: null,
    decidedAt: null,
    notes: null,
    detail: null,
    href: null,
    origin: null,
    ...p
  };
}

function registry(p: Partial<RegistryRow>): RegistryRow {
  return {
    id: "r1",
    source_type: null,
    source_id: null,
    kind: "autre",
    title: null,
    supplier: null,
    start_date: null,
    end_date: null,
    renewal: "manuel",
    notice_days: null,
    alert_days: null,
    amount_cents: null,
    amount_period: "total",
    status: "actif",
    decision_note: null,
    decided_at: null,
    notes: null,
    ...p
  };
}

describe("parseFrenchPeriod", () => {
  it("lit les périodes des contrats de gymnases et de terrains", () => {
    expect(parseFrenchPeriod("25 mai au 18 septembre 2026")).toEqual({ start: "2026-05-25", end: "2026-09-18" });
    expect(parseFrenchPeriod("1er octobre 2026 au 1er janvier 2027")).toEqual({ start: "2026-10-01", end: "2027-01-01" });
    expect(parseFrenchPeriod("25 octobre 2026 au 18 avril 2027")).toEqual({ start: "2026-10-25", end: "2027-04-18" });
  });

  it("lit la durée d'un contrat d'embauche et ignore les dates entre parenthèses qui suivent", () => {
    expect(parseFrenchPeriod("Du 2 novembre 2026 au 18 avril 2027 (aucune séance du 20 décembre au 2 janvier) · probation de 3 mois")).toEqual({
      start: "2026-11-02",
      end: "2027-04-18"
    });
  });

  it("accepte les mois abrégés et un début sans année qui chevauche le jour de l'An", () => {
    expect(parseFrenchPeriod("11 avr. – 24 avr. 2027")).toEqual({ start: "2027-04-11", end: "2027-04-24" });
    expect(parseFrenchPeriod("15 décembre au 15 janvier 2027")).toEqual({ start: "2026-12-15", end: "2027-01-15" });
  });

  it("ne devine rien quand la fin n'a pas d'année ou qu'il n'y a pas de date", () => {
    expect(parseFrenchPeriod("Saison 2027")).toEqual({ start: null, end: null });
    expect(parseFrenchPeriod("20 décembre au 2 janvier")).toEqual({ start: null, end: null });
    expect(parseFrenchPeriod("1 h maison après chaque bloc")).toEqual({ start: null, end: null });
    expect(parseFrenchPeriod(null)).toEqual({ start: null, end: null });
  });

  it("accepte une seule date précédée de « jusqu'au »", () => {
    expect(parseFrenchPeriod("Valide jusqu'au 30 juin 2027")).toEqual({ start: null, end: "2027-06-30" });
    expect(parseFrenchPeriod("Signé le 30 juin 2027")).toEqual({ start: null, end: null });
  });
});

describe("torontoDay", () => {
  it("donne le jour à Montréal d'un horodatage, pas le jour UTC", () => {
    expect(torontoDay("2026-11-07T01:30:00.000Z")).toBe("2026-11-06");
    expect(torontoDay("2026-11-07")).toBe("2026-11-07");
    expect(torontoDay(null)).toBeNull();
  });
});

describe("addMonths", () => {
  it("garde le jour et respecte la fin du mois", () => {
    expect(addMonths("2026-01-15", 12)).toBe("2027-01-15");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
  });
});

describe("computeTimeline", () => {
  it("alerte 90 jours avant la fin", () => {
    expect(computeTimeline(entry({ endDate: "2027-01-21" }), TODAY)).toMatchObject({ state: "alerte", daysLeft: 80, alertFrom: "2026-10-23" });
    expect(computeTimeline(entry({ endDate: "2027-02-10" }), TODAY)).toMatchObject({ state: "a-venir", daysLeft: 100 });
  });

  it("alerte 60 jours avant la fin d'une commandite", () => {
    expect(computeTimeline(entry({ kind: "commandite", alertDays: 60, endDate: "2027-01-11" }), TODAY).state).toBe("a-venir");
    expect(computeTimeline(entry({ kind: "commandite", alertDays: 60, endDate: "2026-12-22" }), TODAY).state).toBe("alerte");
  });

  it("compte le préavis : l'échéance arrive avant la fin", () => {
    const t = computeTimeline(entry({ endDate: "2027-03-02", noticeDays: 60 }), TODAY);
    expect(t.deadline).toBe("2027-01-01");
    expect(t.daysLeft).toBe(60);
    expect(t.state).toBe("alerte");
    expect(deadlineLabel(t)).toContain("Préavis avant le 1er janv. 2027");
  });

  it("prolonge un renouvellement automatique dont la date est passée, d'un terme complet", () => {
    const t = computeTimeline(entry({ renewal: "automatique", startDate: "2025-01-15", endDate: "2026-01-15" }), TODAY);
    expect(t.effectiveEnd).toBe("2027-01-15");
    expect(t.rolled).toBe(1);
    expect(t.state).toBe("alerte");
    const monthly = computeTimeline(entry({ renewal: "automatique", startDate: "2026-08-01", endDate: "2026-09-01" }), TODAY);
    // Abonnement au mois : il se renouvelle seul, rien à décider à chaque mois, il reste « à venir ».
    expect(monthly).toMatchObject({ effectiveEnd: "2026-12-01", rolled: 3, state: "a-venir", alertFrom: null });
    expect(deadlineLabel(monthly)).toBe("Se renouvelle le 1er déc. 2026 (dans 29 jours)");
    const noStart = computeTimeline(entry({ renewal: "automatique", endDate: "2024-03-01" }), TODAY);
    expect(noStart.effectiveEnd).toBe("2027-03-01");
  });

  it("garde un contrat terminé depuis moins de 30 jours à décider, puis le range dans les terminés", () => {
    expect(computeTimeline(entry({ endDate: "2026-10-23" }), TODAY)).toMatchObject({ state: "echu", daysToEnd: -10 });
    expect(computeTimeline(entry({ endDate: "2026-09-18" }), TODAY)).toMatchObject({ state: "termine", autoEnded: true });
  });

  it("respecte une décision « ne pas renouveler » et les contrats sans date", () => {
    expect(computeTimeline(entry({ endDate: "2026-12-01", status: "termine" }), TODAY).state).toBe("termine");
    expect(computeTimeline(entry({ endDate: null }), TODAY).state).toBe("sans-date");
  });
});

const sources = (p: Partial<RegistrySources>): RegistrySources => ({
  registry: [],
  venueRentals: [],
  employeeContracts: [],
  sponsors: [],
  sponsorSlots: [],
  partnershipOffers: [],
  ...p
});

describe("buildEntries", () => {
  const voltige = {
    id: "v1",
    season_key: "automne-hiver-2026",
    venue: "École de la Voltige",
    space: "Gymnase (buts de futsal)",
    period: "1er octobre 2026 au 1er janvier 2027",
    schedule: "Lundi, mardi, mercredi et vendredi",
    total_cents: 539000,
    payments: null
  };

  it("lit les locations de gymnases, les contrats d'embauche et les commandites actives", () => {
    const entries = buildEntries(
      sources({
        venueRentals: [voltige],
        employeeContracts: [
          {
            id: "e1",
            employee_name: "Maeva",
            title: "Entraîneuse adjointe",
            status: "sent",
            summary: [{ label: "Durée", value: "Du 25 octobre 2026 au 18 avril 2027 (aucune séance du 20 décembre au 2 janvier)" }],
            pay_schedule: [{ period: "11 avr. – 24 avr. 2027", payDate: "2027-04-29", amountCents: 28000 }],
            signed_at: null
          },
          { id: "e2", employee_name: "Annulé", title: "x", status: "cancelled", summary: [], pay_schedule: [], signed_at: null }
        ],
        sponsors: [
          { id: "s1", company_name: "Cabane", category: "equipement", partnership_type: "Partenaire Manche — Manche droite (2027)", proposed_amount_cents: 100000, status: "paye" },
          { id: "s2", company_name: "Prospect", category: "principal", partnership_type: null, proposed_amount_cents: 200000, status: "negociation" }
        ],
        sponsorSlots: [{ slot_key: "manche-droite", tier_label: "Partenaire Manche", placement: "Manche droite", price_cents: 100000, status: "sold", sponsor_id: "s1" }]
      })
    );
    const byKey = Object.fromEntries(entries.map((e) => [e.key, e]));
    expect(byKey["venue_rental:v1"]).toMatchObject({ kind: "gymnase", endDate: "2027-01-01", dateOrigin: "texte", amountCents: 539000 });
    expect(byKey["employee_contract:e1"]).toMatchObject({ kind: "embauche", endDate: "2027-04-18", startDate: "2026-10-25", amountCents: 28000 });
    expect(byKey["employee_contract:e1"].detail).toContain("pas encore signé");
    expect(byKey["employee_contract:e2"].status).toBe("termine");
    expect(byKey["sponsor:s1"]).toMatchObject({ kind: "commandite", endDate: "2027-12-31", dateOrigin: "estimee", alertDays: 60, isRevenue: true });
    expect(byKey["sponsor:s2"]).toBeUndefined();
  });

  it("estime la fin d'un contrat d'embauche par la dernière paie quand la durée est illisible", () => {
    const [e] = buildEntries(
      sources({
        employeeContracts: [{ id: "e3", employee_name: "Noura", title: "x", status: "signed", summary: [{ label: "Durée", value: "Saison complète" }], pay_schedule: [{ period: "11 avr. – 24 avr. 2027" }], signed_at: null }]
      })
    );
    expect(e).toMatchObject({ endDate: "2027-04-24", dateOrigin: "estimee" });
  });

  it("applique les précisions saisies dans le registre et ajoute les contrats saisis à la main", () => {
    const entries = buildEntries(
      sources({
        venueRentals: [voltige],
        registry: [
          registry({ id: "r1", source_type: "venue_rental", source_id: "v1", kind: "gymnase", end_date: "2027-06-30", decision_note: "Renouvelé jusqu'au 30 juin 2027" }),
          registry({ id: "r2", kind: "logiciel", title: "Google Workspace", renewal: "automatique", end_date: "2027-03-01", amount_cents: 1800, amount_period: "mensuel" })
        ]
      })
    );
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ key: "venue_rental:v1", registryId: "r1", endDate: "2027-06-30", dateOrigin: "saisie", dateHint: null, title: "École de la Voltige · Gymnase (buts de futsal)" });
    expect(entries[0].origin).toEqual({ startDate: "2026-10-01", endDate: "2027-01-01", amountCents: 539000, supplier: "École de la Voltige" });
    expect(entries[1]).toMatchObject({ key: "manuel:r2", title: "Google Workspace", renewal: "automatique" });
  });

  it("un gymnase passé en commandite dans le registre prend l'alerte de 60 jours", () => {
    const [e] = buildEntries(sources({ venueRentals: [voltige], registry: [registry({ source_type: "venue_rental", source_id: "v1", kind: "commandite" })] }));
    expect(e).toMatchObject({ kind: "commandite", alertDays: 60 });
  });
});

describe("summarize", () => {
  it("classe les contrats et sépare dépenses engagées et commandites", () => {
    const o = summarize(
      [
        entry({ key: "a", title: "Gymnase", kind: "gymnase", endDate: "2027-01-01", amountCents: 539000 }),
        entry({ key: "b", title: "Logiciel", kind: "logiciel", endDate: "2027-08-01", amountCents: 1800, amountPeriod: "mensuel" }),
        entry({ key: "c", title: "Commandite", kind: "commandite", alertDays: 60, endDate: "2027-12-31", dateOrigin: "estimee", amountCents: 100000, isRevenue: true }),
        entry({ key: "d", title: "Assurance", endDate: null }),
        entry({ key: "e", title: "Été 2026", kind: "terrain", endDate: "2026-09-18", amountCents: 500000 })
      ],
      TODAY
    );
    expect(o.toDecide.map((c) => c.key)).toEqual(["a"]);
    expect(o.upcoming.map((c) => c.key)).toEqual(["b", "c"]);
    expect(o.toComplete.map((c) => c.key)).toEqual(["c", "d"]);
    expect(o.ended.map((c) => c.key)).toEqual(["e"]);
    expect(o.committedCents).toBe(539000 + 1800 * 12);
    expect(o.sponsorCents).toBe(100000);

    const [item] = contractTodayItems(o.toDecide);
    expect(item.title).toBe("Gymnase : fin le 1er janv. 2027");
    expect(item.meta).toBe("dans 60 jours");
    expect(item.href).toBe("/admin/registre-contrats#c-a");
  });
});

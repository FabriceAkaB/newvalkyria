"use client";

import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Pill } from "@/components/mandalart/ui";
import {
  EMPTY_INPUTS,
  METHOD_FILL,
  STRIPE_FIXED_CENTS,
  SALES_TAX_RATE,
  STRIPE_PERCENT,
  VERDICT_LABEL,
  VERDICT_TONE,
  applyProgram,
  applyVenue,
  bestScenarioIndex,
  computeLaunch,
  dollars,
  marginLabel,
  normalizeInputs,
  shortDate,
  torontoDay,
  type CoachLine,
  type FieldMode,
  type ProgramFormat,
  type LaunchAlert,
  type LaunchInputs,
  type LaunchResults,
  type PrefillSources,
  type ProgramSource,
  type Verdict
} from "@/lib/launch-calculator";
import type { LaunchScenario } from "@/lib/launch-scenarios-repo";
import { DEFAULT_SEASON_SETTINGS, NO_SEASON, SEASON_FILLS, seasonLabels, seasonOf, seasonTotals, type SeasonSettings } from "@/lib/season-budget";

/** Calculateur de lancement GO / NO-GO : le verdict se recalcule à chaque frappe (fonctions pures de
 *  launch-calculator.ts) ; l'enregistrement passe par /api/admin/calculateur, qui recalcule lui-même. */

// ── Formulaire (textes tapés) ⇄ entrées du calcul ───────────────

interface Form {
  name: string;
  format: ProgramFormat;
  season: string;
  weeks: string;
  perWeek: string;
  daysPerWeek: string;
  price: string;
  capacity: string;
  sessions: string;
  hoursPerSession: string;
  startDate: string;
  presales: string;
  fieldMode: FieldMode;
  fieldHours: string;
  fieldHourly: string;
  fieldContract: string;
  coaches: CoachRow[];
  coachBudget: string;
  equipment: string;
  insurance: string;
  marketing: string;
  otherFixed: string;
  kit: string;
  payments: string;
  otherVariable: string;
  installmentFee: string;
  installmentShare: string;
  jpHours: string;
  grant: string;
  grantCounted: boolean;
}

/** Un éducateur tel que tapé : nom, heures (vide = heures du programme), taux horaire. */
interface CoachRow {
  name: string;
  hours: string;
  hourly: string;
}

const parse = (s: string): number => {
  const n = Number(s.replace(/[\s  $]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const toCents = (s: string) => Math.round(parse(s) * 100);
const optional = (s: string) => (s.trim() === "" ? null : parse(s));
const showNum = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
const showCents = (c: number) => (c ? showNum(c / 100) : "");

function toInputs(f: Form): LaunchInputs {
  return normalizeInputs({
    format: f.format,
    season: f.season,
    weeks: parse(f.weeks),
    perWeek: parse(f.perWeek),
    daysPerWeek: f.daysPerWeek.trim() === "" ? 5 : parse(f.daysPerWeek),
    priceCents: toCents(f.price),
    capacity: parse(f.capacity),
    sessions: parse(f.sessions),
    hoursPerSession: parse(f.hoursPerSession),
    fieldMode: f.fieldMode,
    fieldHours: optional(f.fieldHours),
    fieldHourlyCents: toCents(f.fieldHourly),
    fieldContractCents: toCents(f.fieldContract),
    // Les éducateurs sont tous dans la liste : l'ancien « Nombre × taux » reste à 0.
    coachCount: 0,
    coachHours: null,
    coachHourlyCents: 0,
    coachLines: f.coaches.map((c) => ({ name: c.name, hours: optional(c.hours), hourlyCents: toCents(c.hourly) })),
    coachBudgetCents: toCents(f.coachBudget),
    equipmentCents: toCents(f.equipment),
    insuranceCents: toCents(f.insurance),
    marketingCents: toCents(f.marketing),
    otherFixedCents: toCents(f.otherFixed),
    kitCents: toCents(f.kit),
    // Vide = 1 paiement (le cas courant), pas 0 : sinon les 0,30 $ de Stripe disparaîtraient.
    paymentsPerFamily: f.payments.trim() === "" ? 1 : parse(f.payments),
    otherVariableCents: toCents(f.otherVariable),
    installmentFeeCents: toCents(f.installmentFee),
    installmentShare: parse(f.installmentShare) / 100,
    presales: f.presales.trim() === "" ? null : parse(f.presales),
    startDate: f.startDate || null,
    jpHours: parse(f.jpHours),
    grantCents: toCents(f.grant),
    grantCounted: f.grantCounted
  });
}

function toForm(i: LaunchInputs, name: string): Form {
  return {
    name,
    format: i.format,
    season: i.season,
    weeks: i.weeks ? String(i.weeks) : "",
    perWeek: i.perWeek ? String(i.perWeek) : "",
    daysPerWeek: i.daysPerWeek === 5 ? "" : showNum(i.daysPerWeek),
    price: showCents(i.priceCents),
    capacity: i.capacity ? String(i.capacity) : "",
    sessions: i.sessions ? String(i.sessions) : "",
    hoursPerSession: i.hoursPerSession ? showNum(i.hoursPerSession) : "",
    startDate: i.startDate ?? "",
    presales: i.presales === null ? "" : String(i.presales),
    fieldMode: i.fieldMode,
    fieldHours: i.fieldHours === null ? "" : showNum(i.fieldHours),
    fieldHourly: showCents(i.fieldHourlyCents),
    fieldContract: showCents(i.fieldContractCents),
    coaches: coachRowsOf(i),
    coachBudget: showCents(i.coachBudgetCents),
    equipment: showCents(i.equipmentCents),
    insurance: showCents(i.insuranceCents),
    marketing: showCents(i.marketingCents),
    otherFixed: showCents(i.otherFixedCents),
    kit: showCents(i.kitCents),
    payments: showNum(i.paymentsPerFamily),
    otherVariable: showCents(i.otherVariableCents),
    installmentFee: showCents(i.installmentFeeCents),
    installmentShare: i.installmentShare ? showNum(i.installmentShare * 100) : "",
    jpHours: i.jpHours ? showNum(i.jpHours) : "",
    grant: showCents(i.grantCents),
    grantCounted: i.grantCounted
  };
}

/** Lignes d'éducateurs d'un scénario ; un ancien scénario (Nombre × heures × taux) devient une ligne par éducateur. */
function coachRowsOf(i: LaunchInputs): CoachRow[] {
  const toRow = (l: CoachLine): CoachRow => ({ name: l.name, hours: l.hours === null ? "" : showNum(l.hours), hourly: showCents(l.hourlyCents) });
  if (i.coachLines.length) return i.coachLines.map(toRow);
  return Array.from({ length: i.coachCount }, () => toRow({ name: "", hours: i.coachHours, hourlyCents: i.coachHourlyCents }));
}

/** « Maéva · pratique » → « Maéva » : le nom de l'éducateur d'un taux connu. */
const coachNameOf = (label: string) => label.split(" · ")[0];

const money2 = (c: number) => `${(c / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("fr-CA")} ${n > 1 ? many : one}`;
const hoursLabel = (h: number) => `${showNum(h)} h`;

interface Source {
  kind: "saison" | "session";
  id: string;
  label: string;
}

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/calculateur", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Erreur réseau : réessayez.");
  return json;
}

// ── Composant principal ─────────────────────────────────────────

export function LaunchCalculator({
  today,
  sources,
  scenarios,
  alerts,
  seasons,
  accountingSeasons,
  initialSeason,
  loadError,
  initialProgramKey,
  initialScenarioId
}: {
  today: string;
  sources: PrefillSources;
  scenarios: LaunchScenario[];
  alerts: LaunchAlert[];
  seasons: Record<string, SeasonSettings>;
  accountingSeasons: { id: string; label: string }[];
  initialSeason: string | null;
  loadError: string | null;
  initialProgramKey: string | null;
  initialScenarioId: string | null;
}) {
  const router = useRouter();
  const programByKey = useMemo(() => new Map(sources.programs.map((p) => [p.key, p])), [sources.programs]);

  const [initial] = useState(() => {
    const s = initialScenarioId ? scenarios.find((x) => x.id === initialScenarioId) : undefined;
    if (s) {
      const o = opened(s, programByKey);
      return { form: o.form, source: sourceOf(s, programByKey), loadedId: s.id, programKey: s.sourceKind && s.sourceId ? `${s.sourceKind}:${s.sourceId}` : "", notice: o.notice };
    }
    const p = initialProgramKey ? programByKey.get(initialProgramKey) : undefined;
    if (p) return { form: toForm(applyProgram(EMPTY_INPUTS, p), p.label), source: { kind: p.kind, id: p.id, label: p.label }, loadedId: null, programKey: p.key, notice: p.note };
    return { form: toForm(EMPTY_INPUTS, ""), source: null as Source | null, loadedId: null as string | null, programKey: "", notice: null as string | null };
  });
  const [form, setForm] = useState<Form>(initial.form);
  const [source, setSource] = useState<Source | null>(initial.source);
  const [loadedId, setLoadedId] = useState<string | null>(initial.loadedId);
  const [programKey, setProgramKey] = useState(initial.programKey);
  const [venueId, setVenueId] = useState("");
  const [notice, setNotice] = useState<string | null>(initial.notice);
  const [venueNotice, setVenueNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const inputs = useMemo(() => toInputs(form), [form]);
  const r = useMemo(() => computeLaunch(inputs, today), [inputs, today]);
  const loaded = loadedId ? scenarios.find((s) => s.id === loadedId) ?? null : null;
  const dirty = !loaded || JSON.stringify(normalizeInputs(loaded.inputs)) !== JSON.stringify(inputs) || loaded.name !== form.name.trim();

  const set = <K extends keyof Form>(k: K) => (v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setMsg(null);
  };

  function setCoach(idx: number, k: keyof CoachRow, v: string) {
    setForm((f) => ({ ...f, coaches: f.coaches.map((c, j) => (j === idx ? { ...c, [k]: v } : c)) }));
    setMsg(null);
  }
  function addCoach(row: CoachRow = { name: "", hours: "", hourly: "" }) {
    setForm((f) => (f.coaches.length >= 20 ? f : { ...f, coaches: [...f.coaches, row] }));
    setMsg(null);
  }
  function removeCoach(idx: number) {
    setForm((f) => ({ ...f, coaches: f.coaches.filter((_, j) => j !== idx) }));
    setMsg(null);
  }

  function chooseProgram(key: string) {
    setProgramKey(key);
    const p = programByKey.get(key);
    if (!p) {
      // Les chiffres restent : on enlève seulement le lien au programme (« Tout effacer » repart de zéro).
      setNotice(source ? `Le calcul n'est plus relié à ${source.label} : les chiffres restent. « Tout effacer » repart de zéro.` : null);
      setSource(null);
      return;
    }
    const autoName = !form.name.trim() || form.name === source?.label;
    setForm(toForm(applyProgram(inputs, p), autoName ? p.label : form.name));
    setSource({ kind: p.kind, id: p.id, label: p.label });
    setNotice(p.note);
    setMsg(null);
  }

  function chooseVenue(id: string) {
    setVenueId(id);
    const v = sources.venues.find((x) => x.id === id);
    if (!v) {
      setVenueNotice(null);
      return;
    }
    setForm(toForm(applyVenue(inputs, v), form.name));
    setVenueNotice(`${v.label} : ${dollars(v.totalCents)} pour ${hoursLabel(v.hours)}, soit ${money2(v.hourlyCents)} de l'heure ${v.taxIncluded ? "(taxes incluses)" : "(avant taxes)"}. « Contrat complet » compte tout le contrat.`);
    setMsg(null);
  }

  function reset() {
    setForm(toForm(EMPTY_INPUTS, ""));
    setSource(null);
    setLoadedId(null);
    setProgramKey("");
    setVenueId("");
    setNotice(null);
    setVenueNotice(null);
    setMsg(null);
  }

  function openScenario(s: LaunchScenario) {
    const o = opened(s, programByKey);
    setForm(o.form);
    setSource(sourceOf(s, programByKey));
    setLoadedId(s.id);
    setProgramKey(s.sourceKind && s.sourceId ? `${s.sourceKind}:${s.sourceId}` : "");
    setVenueId("");
    setNotice(o.notice);
    setVenueNotice(null);
    setMsg({ ok: true, text: `Scénario « ${s.name} » ouvert.` });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(asNew: boolean) {
    const name = form.name.trim() || `Scénario du ${shortDate(today)}`;
    setBusy(true);
    setMsg(null);
    try {
      const res = await post({ action: "save", id: asNew ? null : loadedId, name, sourceKind: source?.kind ?? null, sourceId: source?.id ?? null, inputs });
      setForm((f) => ({ ...f, name }));
      setLoadedId(res.scenario.id);
      // L'avis « inscrites mises à jour » n'a plus lieu d'être une fois le nouveau compte enregistré.
      setNotice((n) => (n?.startsWith("Inscrites à ce jour mises à jour") ? null : n));
      setMsg({ ok: true, text: asNew || !loadedId ? "Scénario enregistré. Il apparaît dans la comparaison plus bas." : "Scénario mis à jour." });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: LaunchScenario) {
    if (!confirm(`Supprimer le scénario « ${s.name} » ? Cette action est définitive.`)) return;
    try {
      await post({ action: "delete", id: s.id });
      if (loadedId === s.id) setLoadedId(null);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur");
    }
  }

  const programHours = r.programHours;
  const groups = useMemo(() => {
    const m = new Map<string, ProgramSource[]>();
    for (const p of sources.programs) m.set(p.group, [...(m.get(p.group) ?? []), p]);
    return [...m.entries()];
  }, [sources.programs]);
  const tone = VERDICT_TONE[r.verdict];
  const toneColor = r.ready ? `var(--adm-${tone})` : "var(--adm-text)";
  const fieldLine = r.fixedLines.find((l) => l.key === "field")!.cents;
  const coachLine = r.fixedLines.find((l) => l.key === "coaches")!.cents;

  return (
    <div className="lc">
      <style>{CSS}</style>

      <header>
        <p className="mda-eyebrow">Calculateur de lancement · méthode du prix plancher (pilier 7)</p>
        <h1 className="mda-h1" style={{ color: r.ready ? toneColor : undefined }}>
          {r.headline}
        </h1>
        <p className="mda-lead">{r.sentence}</p>
      </header>

      {loadError ? (
        <p className="mda-card" role="alert" style={{ margin: 0, color: "var(--adm-bad)" }}>
          Les scénarios enregistrés n’ont pas pu être chargés ({loadError}). Le calcul fonctionne quand même ; réessayez dans un moment pour enregistrer.
        </p>
      ) : null}

      {alerts.length > 0 ? (
        <section className="mda-card-flush" style={{ boxShadow: "inset 3px 0 0 var(--adm-warn)" }}>
          <div className="mda-card-head">
            <div>
              <h2 className="mda-h2">Lancements à surveiller · {alerts.length}</h2>
              <p className="mda-sub" style={{ margin: 0 }}>Début dans 2 semaines ou moins, préventes sous le seuil de survie : remplir, reporter, fusionner ou annuler.</p>
            </div>
          </div>
          <ul className="mda-tasks">
            {alerts.map((a) => {
              const s = scenarios.find((x) => x.id === a.scenarioId);
              return (
                <li key={a.scenarioId} className="mda-task" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                  <div>
                    <p className="mda-task-title" style={{ fontWeight: 600 }}>{a.name}</p>
                    <div className="mda-task-meta">
                      <span>
                        Début le {shortDate(a.startDate)} ({a.daysToStart === 0 ? "aujourd’hui" : `dans ${count(a.daysToStart, "jour")}`})
                      </span>
                      <span>
                        {a.presales === null
                          ? "Préventes à entrer"
                          : a.breakEvenCount === null
                            ? `${count(a.presales, "prévente")} · le prix ne couvre jamais les coûts`
                            : `${count(a.presales, "prévente")} sur ${count(a.breakEvenCount, "nécessaire")}`}
                        {a.linked ? " · comptées en direct" : ""}
                      </span>
                    </div>
                  </div>
                  {s ? (
                    <button type="button" className="admin-btn-ghost" style={{ minHeight: 44, padding: "0 16px" }} onClick={() => openScenario(s)}>
                      Ouvrir
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="mda-card lc-start">
        <label className="lc-field">
          <span className="lc-field-label">Partir d’un programme existant</span>
          <select className="admin-input lc-select" value={programKey} onChange={(e) => chooseProgram(e.target.value)}>
            <option value="">Nouveau programme (aucun programme relié)</option>
            {groups.map(([group, list]) => (
              <optgroup key={group} label={group}>
                {list.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label} · {dollars(p.priceCents)}
                    {p.capacity ? ` · ${p.capacity} places` : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {notice ? <span className="lc-hint">{notice}</span> : <span className="lc-hint">Reprend le prix, les places, les séances, les inscrites à ce jour et la date de début.</span>}
        </label>
        <div className="lc-actions">
          <button type="button" className="admin-btn-ghost" onClick={reset}>
            Tout effacer
          </button>
        </div>
      </section>

      <div className="lc-layout">
        <div className="lc-col">
          <section className="mda-card">
            <h2 className="mda-h2">Le programme</h2>
            <p className="mda-sub">Ce que la famille paie et combien de places vous ouvrez.</p>
            <div className="lc-fields">
              <Field wide label="Nom du scénario" value={form.name} onChange={set("name")} placeholder={`Ex. Camp des Fêtes · ${shortDate(today)}`} inputMode="text" />
              <div className="lc-field" data-wide="">
                <span className="lc-field-label">Format</span>
                <div className="lc-seg" role="group" aria-label="Format du programme">
                  <button type="button" aria-pressed={form.format === "program"} onClick={() => set("format")("program")}>
                    Programme
                  </button>
                  <button type="button" aria-pressed={form.format === "camp"} onClick={() => set("format")("camp")}>
                    Camp à la semaine
                  </button>
                </div>
                <span className="lc-hint">{form.format === "camp" ? "Camps de jour et camps de haute performance : des semaines, un maximum d'enfants par semaine, un prix par semaine." : "Saison, session ou programme à dates fixes : un groupe, un prix pour tout le programme."}</span>
              </div>
              <Field
                label={form.format === "camp" ? "Prix par semaine" : "Prix par participante"}
                unit="$"
                value={form.price}
                onChange={set("price")}
                placeholder="0"
                hint={inputs.priceCents ? `Avant taxes, ce que l'académie garde. Avec TPS/TVQ, la famille paie ${money2(Math.round(inputs.priceCents * (1 + SALES_TAX_RATE)))}` : "Avant taxes, ce que l'académie garde"}
              />
              {form.format === "camp" ? (
                <>
                  <Field label="Semaines" value={form.weeks} onChange={set("weeks")} placeholder="0" inputMode="numeric" />
                  <Field label="Places par semaine" value={form.perWeek} onChange={set("perWeek")} placeholder="0" inputMode="numeric" hint={inputs.capacity ? `= ${inputs.capacity} inscriptions-semaines en tout` : "Maximum d'enfants accueillis chaque semaine"} />
                  <Field label="Jours par semaine" value={form.daysPerWeek} onChange={set("daysPerWeek")} placeholder="5" inputMode="decimal" />
                  <Field label="Heures par jour" unit="h" value={form.hoursPerSession} onChange={set("hoursPerSession")} placeholder="0" hint={programHours ? `= ${hoursLabel(programHours)} de camp` : "Ex. 7 pour 9 h à 16 h"} />
                </>
              ) : (
                <>
                  <Field label="Places" value={form.capacity} onChange={set("capacity")} placeholder="0" inputMode="numeric" hint="Capacité du groupe (N)" />
                  <Field label="Séances" value={form.sessions} onChange={set("sessions")} placeholder="0" inputMode="numeric" />
                  <Field label="Durée d'une séance" unit="h" value={form.hoursPerSession} onChange={set("hoursPerSession")} placeholder="0" hint={programHours ? `= ${hoursLabel(programHours)} de programme` : "Ex. 1,5 pour 1 h 30"} />
                </>
              )}
              <label className="lc-field">
                <span className="lc-field-label">Saison</span>
                <span className="lc-input-wrap">
                  <input className="admin-input" list="lc-seasons" value={form.season} placeholder="Ex. Été 2027" onChange={(e) => set("season")(e.target.value)} autoComplete="off" />
                </span>
                <span className="lc-hint">Pour l'additionner aux autres programmes de la saison</span>
                <datalist id="lc-seasons">
                  {[...new Set(["Été 2027", "Hiver 2027-2028", "Automne 2027", ...scenarios.map((x) => x.inputs.season).filter(Boolean)])].map((x) => (
                    <option key={x} value={x} />
                  ))}
                </datalist>
              </label>
              <Field label="Date de début" type="date" value={form.startDate} onChange={set("startDate")} inputMode="text" hint={r.presalesCheckDate ? `Préventes vérifiées le ${shortDate(r.presalesCheckDate)}` : "Pour l'alerte 2 semaines avant"} />
              <Field
                label="Inscrites à ce jour"
                value={form.presales}
                onChange={set("presales")}
                placeholder="—"
                inputMode="numeric"
                hint={source ? "Préventes du programme, comptées en direct pour l'alerte" : "Préventes (vide si pas encore en vente)"}
              />
              <Field label="Heures de JP" unit="h" value={form.jpHours} onChange={set("jpHours")} placeholder="0" hint="Préparation, vente et présence : donne le bénéfice par heure de JP" />
              <Field
                label="Subvention attendue"
                unit="$"
                value={form.grant}
                onChange={set("grant")}
                placeholder="0"
                hint={form.grantCounted ? "Comptée comme revenu : elle entre dans la marge, les seuils et le verdict" : "Montrée à part : le verdict se calcule sans elle"}
              />
            </div>
            {inputs.grantCents > 0 ? (
              <label className="lc-check">
                <input type="checkbox" checked={form.grantCounted} onChange={(e) => set("grantCounted")(e.target.checked)} />
                <span>
                  Compter la subvention dans la marge
                  <span className="lc-hint" style={{ display: "block" }}>Décochez pour voir si le projet tient sans elle.</span>
                </span>
              </label>
            ) : null}
            {source ? (
              <p className="lc-hint" style={{ marginTop: 12 }}>
                <Pill tone="info">Relié à {source.label}</Pill>
              </p>
            ) : null}
          </section>

          <section className="mda-card">
            <div className="lc-block-head" style={{ marginBottom: 4 }}>
              <h2 className="mda-h2">Coûts fixes</h2>
              <span className="lc-amount">peu importe le nombre d’inscrites</span>
            </div>
            <p className="mda-sub">Ce que le programme coûte même s’il n’a qu’une inscrite.</p>

            <div className="lc-block">
              <div className="lc-block-head">
                <h3 className="lc-block-title">Terrain</h3>
                <span className="lc-amount">{dollars(fieldLine)}</span>
              </div>
              <div className="lc-seg" role="group" aria-label="Mode de calcul du terrain">
                <button type="button" aria-pressed={form.fieldMode === "hourly"} onClick={() => set("fieldMode")("hourly")}>
                  À l’heure
                </button>
                <button type="button" aria-pressed={form.fieldMode === "contract"} onClick={() => set("fieldMode")("contract")}>
                  Contrat complet
                </button>
              </div>
              <div className="lc-fields">
                {sources.venues.length ? (
                  <label className="lc-field" data-wide="">
                    <span className="lc-field-label">Reprendre un contrat de terrain</span>
                    <select className="admin-input lc-select" value={venueId} onChange={(e) => chooseVenue(e.target.value)}>
                      <option value="">Choisir un contrat…</option>
                      {sources.venues.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label} · {money2(v.hourlyCents)}/h · {dollars(v.totalCents)}
                        </option>
                      ))}
                    </select>
                    {venueNotice ? <span className="lc-hint">{venueNotice}</span> : null}
                  </label>
                ) : null}
                {form.fieldMode === "hourly" ? (
                  <>
                    <Field label="Heures de terrain" unit="h" value={form.fieldHours} onChange={set("fieldHours")} placeholder={programHours ? showNum(programHours) : "0"} hint="Vide = heures du programme" />
                    <Field label="Coût horaire" unit="$/h" value={form.fieldHourly} onChange={set("fieldHourly")} placeholder="0" />
                  </>
                ) : (
                  <Field label="Montant du contrat" unit="$" value={form.fieldContract} onChange={set("fieldContract")} placeholder="0" hint="Tout le contrat est compté pour ce programme" />
                )}
              </div>
            </div>

            <div className="lc-block">
              <div className="lc-block-head">
                <h3 className="lc-block-title">Éducateurs</h3>
                <span className="lc-amount">{dollars(coachLine)}</span>
              </div>
              {sources.coachRates.length ? (
                <div className="lc-chips" aria-label="Ajouter un éducateur connu">
                  {sources.coachRates.map((c) => {
                    const name = coachNameOf(c.label);
                    const taken = form.coaches.some((row) => row.name === name && toCents(row.hourly) === c.hourlyCents);
                    return (
                      <button key={`${c.label}-${c.hourlyCents}`} type="button" className="lc-chip" aria-pressed={taken} onClick={() => addCoach({ name, hours: "", hourly: showCents(c.hourlyCents) })}>
                        <Plus size={14} aria-hidden="true" />
                        {c.label} · {dollars(c.hourlyCents)}/h
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {form.coaches.length ? (
                <ul className="lc-coaches">
                  <li className="lc-coach lc-coach-head" aria-hidden="true">
                    <span>Éducateur</span>
                    <span>Heures</span>
                    <span>Taux</span>
                    <span className="r">Payé</span>
                    <span />
                  </li>
                  {form.coaches.map((c, idx) => {
                    const pay = r.coachPay[idx];
                    return (
                      <li key={idx} className="lc-coach">
                        <input className="admin-input" aria-label={`Nom de l'éducateur ${idx + 1}`} value={c.name} placeholder={`Éducateur ${idx + 1}`} onChange={(e) => setCoach(idx, "name", e.target.value)} autoComplete="off" />
                        <span className="lc-input-wrap" data-unit="1">
                          <input className="admin-input" aria-label="Heures" inputMode="decimal" value={c.hours} placeholder={programHours ? showNum(programHours) : "0"} onChange={(e) => setCoach(idx, "hours", e.target.value)} autoComplete="off" />
                          <span className="lc-unit">h</span>
                        </span>
                        <span className="lc-input-wrap" data-unit="3">
                          <input className="admin-input" aria-label="Taux horaire" inputMode="decimal" value={c.hourly} placeholder="0" onChange={(e) => setCoach(idx, "hourly", e.target.value)} autoComplete="off" />
                          <span className="lc-unit">$/h</span>
                        </span>
                        <span className="lc-coach-pay">
                          <strong>{pay ? dollars(pay.cents) : "—"}</strong>
                          <span className="lc-hint">{pay?.share != null ? `${Math.round(pay.share * 100)} % des salaires` : ""}</span>
                        </span>
                        <button type="button" className="lc-icon-btn" aria-label={`Retirer ${c.name || `l'éducateur ${idx + 1}`}`} onClick={() => removeCoach(idx)}>
                          <X size={16} aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="lc-hint" style={{ margin: 0 }}>Ajoutez chaque éducateur avec son taux, ou entrez seulement un budget salaires.</p>
              )}
              <div className="lc-actions">
                <button type="button" className="admin-btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => addCoach()} disabled={form.coaches.length >= 20}>
                  <Plus size={16} aria-hidden="true" />
                  Ajouter un éducateur
                </button>
              </div>
              <p className="lc-hint" style={{ margin: 0 }}>Heures vides = les heures du programme{programHours ? ` (${hoursLabel(programHours)})` : ""}.</p>
              <div className="lc-fields">
                <Field
                  label="Budget salaires"
                  unit="$"
                  value={form.coachBudget}
                  onChange={set("coachBudget")}
                  placeholder="0"
                  hint={r.coachBudget.budgetUsed ? "Aucun éducateur chiffré : le budget compte comme coût" : "Facultatif : la cible à ne pas dépasser"}
                />
              </div>
              {r.coachBudget.leftCents !== null && !r.coachBudget.budgetUsed ? (
                <BudgetBar planned={r.coachBudget.plannedCents} budget={r.coachBudget.budgetCents} />
              ) : null}
            </div>

            <div className="lc-block">
              <h3 className="lc-block-title">Autres coûts fixes</h3>
              <div className="lc-fields">
                <Field label="Matériel" unit="$" value={form.equipment} onChange={set("equipment")} placeholder="0" />
                <Field label="Assurance" unit="$" value={form.insurance} onChange={set("insurance")} placeholder="0" />
                <Field label="Marketing" unit="$" value={form.marketing} onChange={set("marketing")} placeholder="0" />
                <Field label="Autres" unit="$" value={form.otherFixed} onChange={set("otherFixed")} placeholder="0" />
              </div>
            </div>

            <div className="lc-total">
              <span>Total des coûts fixes</span>
              <strong>{dollars(r.fixedCents)}</strong>
            </div>
          </section>

          <section className="mda-card">
            <h2 className="mda-h2">Coûts par participante</h2>
            <p className="mda-sub">Ce que chaque inscrite ajoute aux coûts.</p>
            <div className="lc-fields">
              <Field label="Uniforme ou kit" unit="$" value={form.kit} onChange={set("kit")} placeholder="0" />
              <Field label="Paiements par famille" value={form.payments} onChange={set("payments")} placeholder="1" hint="1 = en une fois ; 3 = trois versements" />
              <Field label="Autres" unit="$" value={form.otherVariable} onChange={set("otherVariable")} placeholder="0" />
              <Field label="Frais pour payer en versements" unit="$" value={form.installmentFee} onChange={set("installmentFee")} placeholder="0" hint="Ajoutés à la famille qui paie en 2 ou 3 fois : un revenu de plus" />
              <Field label="Familles en versements" unit="%" value={form.installmentShare} onChange={set("installmentShare")} placeholder="0" hint="Part des familles qui choisiront les versements" />
            </div>
            {r.installmentExtraCents > 0 ? (
              <p className="lc-hint" style={{ marginTop: 12 }}>
                Frais de versements : {money2(r.installmentExtraCents)} de plus par inscrite en moyenne. Une inscrite rapporte {money2(r.revenuePerSignupCents)}.
              </p>
            ) : null}
            <p className="lc-hint" style={{ marginTop: 12 }}>
              Frais Stripe : {showNum(STRIPE_PERCENT * 100)} % × {dollars(r.revenuePerSignupCents)} + {money2(STRIPE_FIXED_CENTS)} × {showNum(inputs.paymentsPerFamily)} paiement{inputs.paymentsPerFamily > 1 ? "s" : ""} = {money2(r.stripeCents)}
            </p>
            <div className="lc-total" style={{ marginTop: 16 }}>
              <span>Coût par participante</span>
              <strong>{money2(r.variableCents)}</strong>
            </div>
          </section>
        </div>

        <aside className="lc-col lc-aside" id="lc-results" aria-label="Résultat du calcul">
          <section className="mda-card" style={r.ready ? { boxShadow: `inset 3px 0 0 ${toneColor}` } : undefined}>
            {r.ready ? (
              <>
                <div className="lc-block-head">
                  <Pill tone={tone}>
                    <VerdictIcon verdict={r.verdict} /> {VERDICT_LABEL[r.verdict]}
                  </Pill>
                  <span className="lc-amount">scénario pessimiste · 70 % des places</span>
                </div>
                <div className="lc-hero-num">
                  <span className="mda-num-xl" style={{ color: toneColor }}>
                    {marginLabel(r.margin70)}
                  </span>
                  <span className="mda-label" style={{ marginTop: 0 }}>de marge</span>
                </div>
                <p className="mda-label" style={{ marginTop: 0 }}>
                  {r.pessimisticCount > 0 ? (
                    <>
                      Avec {count(r.pessimisticCount, "inscrite")} sur {inputs.capacity} : {r.profit70Cents >= 0 ? "profit" : "perte"} de <strong className="mda-tnum">{dollars(Math.abs(r.profit70Cents))}</strong>
                    </>
                  ) : (
                    "Aucune inscrite à 70 % de remplissage."
                  )}
                </p>
                {r.presalesBlock && r.economicVerdict !== "no-go" ? (
                  <p className="lc-msg" style={{ color: "var(--adm-bad)" }}>
                    Les chiffres seuls donneraient {VERDICT_LABEL[r.economicVerdict]}, mais les préventes sont sous le seuil de survie à moins de 2 semaines du début.
                  </p>
                ) : null}
                <FillGauge r={r} capacity={inputs.capacity} presales={inputs.presales} />
              </>
            ) : (
              <div>
                <p className="mda-h2" style={{ marginBottom: 8 }}>Le verdict apparaîtra ici</p>
                <p className="mda-sub" style={{ margin: 0 }}>
                  {r.missing === "costs"
                    ? "Il manque les coûts : entrez le terrain, les éducateurs ou le kit. Le verdict apparaît dès le premier coût, puis se met à jour à chaque chiffre."
                    : "Il faut au moins un prix et un nombre de places. Ensuite, chaque coût ajouté met à jour la marge, les seuils et le verdict."}
                </p>
              </div>
            )}
          </section>

          <div className="lc-kpis">
            <Kpi
              label="Prix plancher"
              value={r.methodFloorCents === null ? "—" : dollars(r.methodFloorCents, true)}
              detail={`50 % de marge à ${Math.round(METHOD_FILL * 100)} % des places${r.methodCount ? ` (${count(r.methodCount, "inscrite")})` : ""}`}
              tone={r.ready && r.methodFloorCents !== null ? (inputs.priceCents >= r.methodFloorCents ? "good" : "bad") : undefined}
            />
            <Kpi label="Prix coûtant" value={r.floorPriceCents === null ? "—" : dollars(r.floorPriceCents, true)} detail="Aucun profit, groupe plein" tone={r.ready && r.floorPriceCents !== null && inputs.priceCents < r.floorPriceCents ? "bad" : undefined} />
            <Kpi
              label="Seuil de survie"
              value={r.breakEvenCount === null ? "Jamais" : String(r.breakEvenCount)}
              detail={r.breakEvenCount === null ? "Le prix ne couvre pas le coût par inscrite" : r.breakEvenCount === 0 ? "Aucun coût fixe à couvrir" : `inscrite${r.breakEvenCount > 1 ? "s" : ""} pour couvrir les coûts`}
              tone={r.ready ? (r.breakEvenCount !== null && r.breakEvenCount <= inputs.capacity ? undefined : "bad") : undefined}
            />
            <Kpi
              label="Seuil de 50 %"
              value={r.marginCount === null ? "Jamais" : String(r.marginCount)}
              detail={r.marginCount === null ? "50 % hors d'atteinte à ce prix" : r.ready && r.marginCount > inputs.capacity ? `au-delà des ${inputs.capacity} places` : "inscrites pour 50 % de marge"}
              tone={r.ready ? (r.marginCount !== null && r.marginCount <= inputs.capacity ? undefined : "bad") : undefined}
            />
          </div>

          <section className="mda-card">
            <h2 className="mda-h2">Les 4 règles de la méthode</h2>
            <p className="mda-sub">Aucun programme lancé sans les respecter.</p>
            <ul className="lc-rules">
              {r.rules.map((rule) => (
                <li key={rule.key} className="lc-rule">
                  <span className="lc-icon" data-ok={String(rule.ok)} aria-label={rule.ok === true ? "Respectée" : rule.ok === false ? "Non respectée" : "À vérifier"}>
                    {rule.ok === true ? "✓" : rule.ok === false ? "✕" : "…"}
                  </span>
                  <div>
                    <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 500, color: "var(--adm-text)" }}>{rule.label}</p>
                    <p className="lc-hint" style={{ margin: "2px 0 0" }}>{rule.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="mda-card">
            <div className="lc-actions">
              <button type="button" className="admin-btn-primary" disabled={busy || !r.ready || (Boolean(loaded) && !dirty)} onClick={() => save(false)}>
                {busy ? "Enregistrement…" : loaded ? (dirty ? "Mettre à jour le scénario" : "Scénario à jour") : "Enregistrer ce scénario"}
              </button>
              {loaded ? (
                <button type="button" className="admin-btn-ghost" disabled={busy || !r.ready} onClick={() => save(true)}>
                  Enregistrer comme nouveau
                </button>
              ) : null}
            </div>
            <p className="lc-hint" style={{ marginTop: 8 }}>
              {loaded ? `Ouvert : « ${loaded.name} », enregistré le ${shortDate(torontoDay(loaded.updatedAt))}.` : "Pour le comparer à d’autres prix ou d’autres coûts."}
            </p>
            {msg ? (
              <p className="lc-msg" role="status" style={{ color: msg.ok ? "var(--adm-good)" : "var(--adm-bad)" }}>
                {msg.text}
              </p>
            ) : null}
          </section>
        </aside>
      </div>

      {r.ready ? (
        <section className="mda-card-flush">
          <div className="mda-card-head">
            <div>
              <h2 className="mda-h2">Marge selon le remplissage</h2>
              <p className="mda-sub" style={{ margin: 0 }}>
                Mêmes coûts fixes ({dollars(r.fixedCents)}), {money2(r.variableCents)} par inscrite, prix de {dollars(inputs.priceCents)}
                {r.grantCents > 0 ? ` ; les revenus comprennent la subvention de ${dollars(r.grantCents)}` : ""}.
              </p>
            </div>
          </div>
          <div className="mda-scroll">
            <table className="mda-table" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th>Remplissage</th>
                  <th className="r">Inscrites</th>
                  <th className="r">Revenus</th>
                  <th className="r">Coûts</th>
                  <th className="r">Profit</th>
                  <th className="r">Marge</th>
                </tr>
              </thead>
              <tbody>
                {r.scenarios.map((s) => (
                  <tr key={s.key} data-now={s.key === "pessimistic" ? "true" : undefined}>
                    <td>
                      {s.rate === null ? "À ce jour" : `${Math.round(s.rate * 100)} %`}
                      <span className="mda-muted" style={{ display: "block", fontSize: "0.75rem" }}>{s.label}</span>
                    </td>
                    <td className="r">{s.count}</td>
                    <td className="r">{dollars(s.revenueCents)}</td>
                    <td className="r">{dollars(s.costCents)}</td>
                    <td className="r" style={{ color: s.profitCents >= 0 ? "var(--adm-good)" : "var(--adm-bad)", fontWeight: 600 }}>
                      {s.profitCents > 0 ? "+" : ""}
                      {dollars(s.profitCents)}
                    </td>
                    <td className="r" style={{ fontWeight: 600 }}>{marginLabel(s.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <SeasonBudget scenarios={scenarios} initial={seasons} focus={initialSeason ?? (form.season.trim() || null)} accountingSeasons={accountingSeasons} />

      <ScenarioTable scenarios={scenarios} current={r.ready && dirty ? { name: form.name.trim() || "Calcul en cours", inputs, results: r } : null} loadedId={loadedId} onOpen={openScenario} onDelete={remove} />

      {r.ready ? (
        <div className="lc-dock" aria-hidden="true">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <Pill tone={tone}>{VERDICT_LABEL[r.verdict]}</Pill>
            {r.presalesBlock && r.breakEvenCount !== null ? (
              <span className="mda-tnum" style={{ fontWeight: 600, color: toneColor }}>
                {inputs.presales ?? 0} / {r.breakEvenCount} préventes
              </span>
            ) : (
              <>
                <span className="mda-tnum" style={{ fontWeight: 600, color: toneColor }}>{marginLabel(r.margin70)}</span>
                <span className="lc-amount" style={{ fontSize: "0.8rem" }}>à 70 %</span>
              </>
            )}
          </span>
          <span className="lc-amount" style={{ fontSize: "0.8rem", textAlign: "right" }}>
            Plancher {r.methodFloorCents === null ? "—" : dollars(r.methodFloorCents, true)}
            <br />
            Survie {r.breakEvenCount === null ? "jamais" : count(r.breakEvenCount, "inscrite")}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Rouvre un scénario : pour un scénario relié à un programme, les inscrites à ce jour sont remises au compte réel
 *  (le scénario garde celles du jour où il a été enregistré). */
function opened(s: LaunchScenario, programByKey: Map<string, ProgramSource>): { form: Form; notice: string | null } {
  const p = s.sourceKind && s.sourceId ? programByKey.get(`${s.sourceKind}:${s.sourceId}`) : undefined;
  if (!p || p.presales === s.inputs.presales) return { form: toForm(s.inputs, s.name), notice: null };
  return {
    form: toForm({ ...s.inputs, presales: p.presales }, s.name),
    notice: `Inscrites à ce jour mises à jour : ${p.presales} aujourd’hui (${s.inputs.presales ?? "aucune"} à l’enregistrement). « Mettre à jour le scénario » garde ce nouveau compte.`
  };
}

function sourceOf(s: LaunchScenario, programByKey: Map<string, ProgramSource>): Source | null {
  if (!s.sourceKind || !s.sourceId) return null;
  const p = programByKey.get(`${s.sourceKind}:${s.sourceId}`);
  return { kind: s.sourceKind, id: s.sourceId, label: p?.label ?? s.sourceId };
}

// ── Petits éléments ─────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  unit,
  hint,
  wide,
  type = "text",
  inputMode = "decimal"
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  unit?: string;
  hint?: string;
  wide?: boolean;
  type?: "text" | "date";
  inputMode?: "decimal" | "numeric" | "text";
}) {
  return (
    <label className="lc-field" data-wide={wide ? "" : undefined}>
      <span className="lc-field-label">{label}</span>
      <span className="lc-input-wrap" data-unit={unit ? unit.length : undefined}>
        <input className="admin-input" type={type} inputMode={type === "date" ? undefined : inputMode} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
        {unit ? <span className="lc-unit">{unit}</span> : null}
      </span>
      {hint ? <span className="lc-hint">{hint}</span> : null}
    </label>
  );
}

/** Cumul d'une saison : les scénarios cochés additionnés, puis le salaire de JP et les autres charges ;
 *  les choix s'enregistrent tout seuls (une seconde après le dernier changement). */
function SeasonBudget({
  scenarios,
  initial,
  focus,
  accountingSeasons
}: {
  scenarios: LaunchScenario[];
  initial: Record<string, SeasonSettings>;
  focus: string | null;
  accountingSeasons: { id: string; label: string }[];
}) {
  const labels = useMemo(() => seasonLabels(scenarios), [scenarios]);
  const [season, setSeason] = useState<string>(() => (focus && labels.includes(focus) ? focus : labels[0] ?? ""));
  const [all, setAll] = useState<Record<string, SeasonSettings>>(initial);
  const [salary, setSalary] = useState("");
  const [other, setOther] = useState("");
  const [hourValue, setHourValue] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty = useRef(false);
  const current = labels.includes(season) ? season : labels[0] ?? "";
  const settings = all[current] ?? DEFAULT_SEASON_SETTINGS;

  useEffect(() => {
    setSalary(showCents(settings.jpSalaryCents));
    setOther(showCents(settings.otherChargesCents));
    setHourValue(showCents(settings.jpHourValueCents));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  useEffect(() => {
    if (!dirty.current || !current) return;
    const t = setTimeout(async () => {
      setState("saving");
      try {
        await post({ action: "season", season: current, settings });
        setState("saved");
      } catch {
        setState("error");
      }
      dirty.current = false;
    }, 900);
    return () => clearTimeout(t);
  }, [settings, current]);

  if (!labels.length) return null;
  const update = (patch: Partial<SeasonSettings>) => {
    dirty.current = true;
    setState("idle");
    setAll((a) => ({ ...a, [current]: { ...(a[current] ?? DEFAULT_SEASON_SETTINGS), ...patch } }));
  };
  const list = scenarios.filter((x) => seasonOf(x.inputs) === current);
  const t = seasonTotals(list, settings);
  const fill = SEASON_FILLS.find((f) => f.key === settings.fill)!;
  const leftTone = t.leftCents >= 0 ? "var(--adm-good)" : "var(--adm-bad)";

  return (
    <section className="mda-card-flush">
      <div className="mda-card-head" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 className="mda-h2">Cumul de la saison</h2>
          <p className="mda-sub" style={{ margin: 0 }}>Cochez les programmes sur lesquels vous misez : leurs bénéfices s’additionnent, puis votre salaire et les charges de la saison.</p>
        </div>
        {labels.length > 1 ? (
          <div className="lc-seg" role="group" aria-label="Saison">
            {labels.map((l) => (
              <button key={l} type="button" aria-pressed={l === current} onClick={() => setSeason(l)}>
                {l}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="lc-season">
        <div className="lc-season-main">
          <div className="lc-block-head" style={{ padding: "0 0 12px" }}>
            <span className="lc-field-label">{current} · {count(t.included, "programme")} sur {list.length}</span>
            <div className="lc-seg" role="group" aria-label="Remplissage du cumul">
              {SEASON_FILLS.map((f) => (
                <button key={f.key} type="button" aria-pressed={settings.fill === f.key} onClick={() => update({ fill: f.key })}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mda-scroll">
            <table className="mda-table" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th style={{ width: 44 }} aria-label="Compté" />
                  <th>Programme</th>
                  <th className="r">Inscriptions</th>
                  <th className="r">Revenus</th>
                  <th className="r">Coûts</th>
                  <th className="r">Bénéfice</th>
                  <th className="r">Tes heures</th>
                </tr>
              </thead>
              <tbody>
                {t.lines.map((l) => (
                  <tr key={l.id} style={l.included ? undefined : { opacity: 0.5 }}>
                    <td>
                      <input
                        type="checkbox"
                        className="lc-box"
                        aria-label={`Compter ${l.name}`}
                        checked={l.included}
                        onChange={(e) => update({ excluded: e.target.checked ? settings.excluded.filter((x) => x !== l.id) : [...settings.excluded, l.id] })}
                      />
                    </td>
                    <td>
                      {l.name}
                      <span className="mda-muted" style={{ display: "block", fontSize: "0.75rem" }}>
                        {l.format === "camp" ? "Camp à la semaine" : "Programme"}
                        {l.grantCents > 0 ? ` · subvention ${dollars(l.grantCents)}` : ""}
                      </span>
                    </td>
                    <td className="r">
                      {l.count} / {l.capacity}
                    </td>
                    <td className="r">{dollars(l.revenueCents)}</td>
                    <td className="r">{dollars(l.costCents)}</td>
                    <td className="r" style={{ fontWeight: 600, color: l.profitCents >= 0 ? "var(--adm-good)" : "var(--adm-bad)" }}>{dollars(l.profitCents)}</td>
                    <td className="r">{l.jpHours ? hoursLabel(l.jpHours) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="lc-fields" style={{ marginTop: 16 }}>
            <Field
              label="Ton salaire pour la saison"
              unit="$"
              value={salary}
              onChange={(v) => {
                setSalary(v);
                update({ jpSalaryCents: toCents(v) });
              }}
              placeholder="0"
              hint={`Coût total pour l'entreprise. Au plus ${dollars(t.maxSalaryCents)} sans mettre la saison dans le rouge`}
            />
            <Field
              label="Autres charges de la saison"
              unit="$"
              value={other}
              onChange={(v) => {
                setOther(v);
                update({ otherChargesCents: toCents(v) });
              }}
              placeholder="0"
              hint="Ce qui n'est dans aucun programme : comptable, logiciels, assurance générale…"
            />
            <Field
              label="Ce que vaut ton heure"
              unit="$/h"
              value={hourValue}
              onChange={(v) => {
                setHourValue(v);
                update({ jpHourValueCents: toCents(v) });
              }}
              placeholder="50"
              hint="Pour le coût d'opportunité de ton temps"
            />
            <label className="lc-field">
              <span className="lc-field-label">Saison comptable liée</span>
              <select className="admin-input lc-select" value={settings.seasonKey ?? ""} onChange={(e) => update({ seasonKey: e.target.value || null })}>
                <option value="">Pas encore liée</option>
                {accountingSeasons.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
              <span className="lc-hint">Pour comparer le budget aux dépenses entrées dans Revenus</span>
            </label>
          </div>
          {current === NO_SEASON ? (
            <p className="lc-hint" style={{ margin: "8px 0 0", color: "var(--adm-text-2)" }}>
              Pour séparer l’été 2027 et l’hiver 2027-2028 : ouvrez chaque scénario, remplissez « Saison », puis « Mettre à jour le scénario ».
            </p>
          ) : null}
          <p className="lc-hint" style={{ margin: "8px 0 0" }} role="status">
            {state === "saving" ? "Enregistrement…" : state === "saved" ? "Choix enregistrés." : state === "error" ? "Pas enregistré : réessayez dans un moment." : "Les choix de chaque saison s’enregistrent tout seuls."}
          </p>
        </div>

        <aside className="lc-season-sum" aria-label="Résultat de la saison">
          <p className="lc-field-label" style={{ margin: 0 }}>Reste dans l’entreprise · {fill.label}</p>
          <p className="mda-num-xl" style={{ color: leftTone, margin: "4px 0 16px" }}>{dollars(t.leftCents)}</p>
          <dl className="lc-wf">
            <div>
              <dt>Revenus des programmes{t.grantCents > 0 ? " (subventions comprises)" : ""}</dt>
              <dd>{dollars(t.revenueCents)}</dd>
            </div>
            <div>
              <dt>Coûts des programmes</dt>
              <dd>−{dollars(t.costCents)}</dd>
            </div>
            <div data-total="">
              <dt>Bénéfice des programmes{t.margin !== null ? ` · ${marginLabel(t.margin)}` : ""}</dt>
              <dd>{dollars(t.programProfitCents)}</dd>
            </div>
            <div>
              <dt>Ton salaire</dt>
              <dd>−{dollars(t.jpSalaryCents)}</dd>
            </div>
            <div>
              <dt>Autres charges</dt>
              <dd>−{dollars(t.otherChargesCents)}</dd>
            </div>
            <div data-total="">
              <dt>Reste dans l’entreprise (avant impôts)</dt>
              <dd style={{ color: leftTone }}>{dollars(t.leftCents)}</dd>
            </div>
          </dl>
          <p className="lc-hint" style={{ margin: "12px 0 0", color: t.overOpportunityCents >= 0 ? "var(--adm-text-2)" : "var(--adm-bad)" }}>
            {t.jpHours
              ? `Coût d'opportunité : tes ${hoursLabel(t.jpHours)} valent ${dollars(t.opportunityCents)} à ${dollars(settings.jpHourValueCents)}/h. ${t.overOpportunityCents >= 0 ? `Les programmes rapportent ${dollars(t.overOpportunityCents)} de plus.` : `Les programmes rapportent ${dollars(-t.overOpportunityCents)} de moins : ton temps vaut plus ailleurs.`}`
              : "Entrez tes heures dans chaque scénario pour voir le coût d'opportunité."}
          </p>
          <p style={{ margin: "12px 0 0" }}>
            <a className="admin-btn-ghost" style={{ display: "inline-flex", alignItems: "center", minHeight: 40, padding: "0 14px" }} href={`/admin/revenus/saisons?saison=${encodeURIComponent(current)}`}>
              Voir le plan et le budget de la saison
            </a>
          </p>
          <p className="lc-hint" style={{ margin: "12px 0 0" }}>
            {count(t.signups, "inscription")} · {t.jpHours ? `${hoursLabel(t.jpHours)} de ton temps${t.profitPerJpHourCents !== null ? `, ${dollars(t.profitPerJpHourCents)} de bénéfice par heure` : ""}` : "heures de JP non entrées"}
          </p>
        </aside>
      </div>
    </section>
  );
}

/** Prévu par rapport au budget salaires : ce qui reste ou ce qui dépasse. */
function BudgetBar({ planned, budget }: { planned: number; budget: number }) {
  const left = budget - planned;
  const over = left < 0;
  const pct = budget > 0 ? Math.min(100, (planned / budget) * 100) : 100;
  return (
    <div className="lc-budget">
      <div className="lc-budget-track" role="img" aria-label={`Salaires prévus ${dollars(planned)} sur un budget de ${dollars(budget)}`}>
        <span style={{ width: `${pct}%`, background: over ? "var(--adm-bad)" : "var(--adm-accent)" }} />
      </div>
      <p className="lc-hint" style={{ margin: 0, color: over ? "var(--adm-bad)" : "var(--adm-text-2)" }}>
        {dollars(planned)} prévus sur un budget de {dollars(budget)} : {over ? `dépasse de ${dollars(-left)}` : left === 0 ? "budget pile atteint" : `il reste ${dollars(left)}`}
      </p>
    </div>
  );
}

function Kpi({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: "good" | "bad" }) {
  return (
    <div className="lc-kpi" style={tone ? { boxShadow: `inset 3px 0 0 var(--adm-${tone})` } : undefined}>
      <p className="mda-label" style={{ marginTop: 0, color: "var(--adm-text-3)" }}>{label}</p>
      <p className="mda-num" style={{ margin: "4px 0 2px" }}>{value}</p>
      <p className="lc-hint" style={{ margin: 0 }}>{detail}</p>
    </div>
  );
}

function VerdictIcon({ verdict }: { verdict: Verdict }) {
  return <span aria-hidden="true">{verdict === "go" ? "✓" : verdict === "risque" ? "!" : "✕"}</span>;
}

/** Barre des places : zone de perte (sous le seuil de survie), zone de profit sous 50 %, zone de 50 % et plus ;
 *  repère du scénario pessimiste (70 %) et point des inscrites à ce jour. */
function FillGauge({ r, capacity, presales }: { r: LaunchResults; capacity: number; presales: number | null }) {
  if (!r.ready || capacity <= 0) return null;
  const pos = (n: number) => Math.max(0, Math.min(100, (n / capacity) * 100));
  const be = r.breakEvenCount;
  const mc = r.marginCount;
  const lossEnd = be === null ? 100 : pos(be);
  const goodStart = mc === null ? 100 : Math.max(lossEnd, pos(mc));
  const zones = [
    { z: "loss", w: lossEnd, title: be === null ? "Perte à tout remplissage" : `Perte sous ${count(be, "inscrite")}` },
    { z: "mid", w: goodStart - lossEnd, title: "Profit, mais marge sous 50 %" },
    { z: "good", w: 100 - goodStart, title: mc === null ? "" : `50 % de marge et plus dès ${count(mc, "inscrite")}` }
  ].filter((x) => x.w > 0.01);

  const legend: { sw: string; text: string }[] = [];
  if (be === null) legend.push({ sw: "loss", text: "Perte à tout remplissage : le prix ne couvre pas le coût par inscrite" });
  else if (be > 0) legend.push({ sw: "loss", text: be > capacity ? `Perte sur toutes les places (seuil de survie : ${be})` : `Perte sous ${count(be, "inscrite")}` });
  const firstProfit = be === null ? null : Math.max(be, 1);
  if (firstProfit !== null && firstProfit <= capacity && (mc === null || mc > firstProfit)) {
    const text =
      mc === null || mc > capacity
        ? `Profit sous 50 % de marge dès ${count(firstProfit, "inscrite")}`
        : mc - 1 === firstProfit
          ? `Profit sous 50 % de marge avec ${count(firstProfit, "inscrite")}`
          : `Profit sous 50 % de marge de ${firstProfit} à ${mc - 1} inscrites`;
    legend.push({ sw: "mid", text });
  }
  if (mc !== null && mc <= capacity) legend.push({ sw: "good", text: `50 % de marge et plus dès ${count(mc, "inscrite")}` });

  return (
    <div className="lc-gauge">
      <div className="lc-track" role="img" aria-label={`Places : ${capacity}. ${legend.map((l) => l.text).join(". ")}. Scénario pessimiste : ${r.pessimisticCount} inscrites.`}>
        {zones.map((z, idx) => (
          <span key={z.z} className="lc-zone" data-z={z.z} data-first={idx === 0 ? "" : undefined} data-last={idx === zones.length - 1 ? "" : undefined} style={{ width: `${z.w}%` }} title={z.title} />
        ))}
        <span className="lc-mark" style={{ left: `${pos(r.pessimisticCount)}%` }} title={`Scénario pessimiste : ${count(r.pessimisticCount, "inscrite")} (70 %)`} />
        {presales !== null ? <span className="lc-dot" style={{ left: `${pos(presales)}%` }} title={`Inscrites à ce jour : ${presales}`} /> : null}
      </div>
      <div className="lc-axis">
        <span>0</span>
        <span>{count(capacity, "place")}</span>
      </div>
      <ul className="lc-legend">
        {legend.map((l) => (
          <li key={l.sw}>
            <span className="lc-sw lc-zone" data-z={l.sw} />
            {l.text}
          </li>
        ))}
        <li>
          <span className="lc-sw" style={{ width: 2, height: 14, borderRadius: 2, background: "var(--adm-text)", margin: "0 4px" }} />
          Scénario pessimiste : {count(r.pessimisticCount, "inscrite")} (70 %)
        </li>
        {presales !== null ? (
          <li>
            <span className="lc-sw" style={{ borderRadius: 999, background: "var(--adm-accent)" }} />
            Inscrites à ce jour : {presales}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function ScenarioTable({
  scenarios,
  current,
  loadedId,
  onOpen,
  onDelete
}: {
  scenarios: LaunchScenario[];
  current: { name: string; inputs: LaunchInputs; results: LaunchResults } | null;
  loadedId: string | null;
  onOpen: (s: LaunchScenario) => void;
  onDelete: (s: LaunchScenario) => void;
}) {
  const best = bestScenarioIndex(scenarios.map((s) => ({ margin70: s.results.margin70 })));
  return (
    <section className="mda-card-flush">
      <div className="mda-card-head">
        <div>
          <h2 className="mda-h2">Scénarios enregistrés · {scenarios.length}</h2>
          <p className="mda-sub" style={{ margin: 0 }}>
            {scenarios.length
              ? "Côte à côte pour choisir le prix et les coûts. Les résultats sont recalculés aujourd’hui à partir des chiffres enregistrés."
              : "Aucun scénario pour l’instant. Enregistrez le calcul en cours pour le comparer à d’autres prix ou d’autres coûts."}
          </p>
        </div>
      </div>
      {scenarios.length || current ? (
        <div className="mda-scroll">
          <table className="mda-table" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th>Scénario</th>
                <th className="r">Prix</th>
                <th className="r">Places</th>
                <th className="r">Coûts fixes</th>
                <th className="r">Prix plancher</th>
                <th className="r">Survie</th>
                <th className="r">Marge à 70 %</th>
                <th>Verdict</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {current ? (
                <Row name={current.name} meta="Calcul en cours, pas encore enregistré" inputs={current.inputs} results={current.results} highlight />
              ) : null}
              {scenarios.map((s, idx) => (
                <Row
                  key={s.id}
                  name={s.name}
                  meta={`${s.id === loadedId ? "Ouvert · " : ""}${shortDate(torontoDay(s.updatedAt))}${idx === best && scenarios.length > 1 ? " · meilleure marge" : ""}`}
                  inputs={s.inputs}
                  results={s.results}
                  actions={
                    <span style={{ display: "inline-flex", gap: 8 }}>
                      <button type="button" className="admin-btn-ghost" style={{ minHeight: 36, padding: "0 12px" }} onClick={() => onOpen(s)}>
                        Ouvrir
                      </button>
                      <button type="button" className="admin-btn-ghost" style={{ minHeight: 36, padding: "0 12px", color: "var(--adm-text-3)" }} onClick={() => onDelete(s)} aria-label={`Supprimer ${s.name}`}>
                        Supprimer
                      </button>
                    </span>
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function Row({ name, meta, inputs, results, actions, highlight }: { name: string; meta: string; inputs: LaunchInputs; results: LaunchResults; actions?: React.ReactNode; highlight?: boolean }) {
  return (
    <tr data-now={highlight ? "true" : undefined}>
      <td style={{ minWidth: 200, maxWidth: 280 }}>
        <span style={{ fontWeight: 600 }}>{name}</span>
        <span className="mda-muted" style={{ display: "block", fontSize: "0.75rem" }}>{meta}</span>
      </td>
      <td className="r">{dollars(inputs.priceCents)}</td>
      <td className="r">{inputs.capacity}</td>
      <td className="r">{dollars(results.fixedCents)}</td>
      <td className="r">{results.methodFloorCents === null ? "—" : dollars(results.methodFloorCents, true)}</td>
      <td className="r">{results.breakEvenCount === null ? "jamais" : results.breakEvenCount}</td>
      <td className="r" style={{ fontWeight: 600 }}>{marginLabel(results.margin70)}</td>
      <td>
        <Pill tone={VERDICT_TONE[results.verdict]}>{VERDICT_LABEL[results.verdict]}</Pill>
      </td>
      <td className="r">{actions ?? null}</td>
    </tr>
  );
}

// ── Mise en page propre au calculateur (couleurs : jetons --adm-* de l'admin) ──

const CSS = `
.admin-shell .lc { display: flex; flex-direction: column; gap: 24px; }
.admin-shell .lc-start { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px; align-items: start; }
.admin-shell .lc-start .lc-actions { padding-top: 26px; }
.admin-shell .lc-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 400px); gap: 24px; align-items: start; }
.admin-shell .lc-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.admin-shell .lc-aside { position: sticky; top: 16px; }
.admin-shell .lc-fields { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px; }
.admin-shell .lc-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.admin-shell .lc-field[data-wide] { grid-column: 1 / -1; }
.admin-shell .lc-field-label { font-size: 0.8rem; font-weight: 500; color: var(--adm-text-2); }
.admin-shell .lc-hint { font-size: 0.75rem; line-height: 1.4; color: var(--adm-text-3); }
.admin-shell .lc-input-wrap { position: relative; display: block; }
.admin-shell .lc-input-wrap .admin-input, .admin-shell .lc-select { width: 100%; min-height: 44px; padding: 0 12px; font-size: 0.95rem; font-variant-numeric: tabular-nums; }
.admin-shell .lc-input-wrap[data-unit="1"] .admin-input { padding-right: 28px; }
.admin-shell .lc-input-wrap[data-unit="3"] .admin-input { padding-right: 44px; }
.admin-shell .lc-input-wrap[data-unit="1"] .admin-input, .admin-shell .lc-input-wrap[data-unit="3"] .admin-input { text-align: right; }
.admin-shell .lc-unit { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font-size: 0.8rem; color: var(--adm-text-3); pointer-events: none; }
.admin-shell .lc-block { display: flex; flex-direction: column; gap: 12px; padding: 16px 0; border-top: 1px solid var(--adm-line); }
.admin-shell .lc-block-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.admin-shell .lc-block-title { font-size: 0.95rem; font-weight: 600; color: var(--adm-text); margin: 0; }
.admin-shell .lc-amount { font-size: 0.85rem; color: var(--adm-text-3); font-variant-numeric: tabular-nums; }
.admin-shell .lc-block-head > .lc-amount:last-child { color: var(--adm-text-2); }
.admin-shell .lc-total { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding-top: 16px; border-top: 1px solid var(--adm-line); font-size: 0.9rem; font-weight: 500; color: var(--adm-text-2); }
.admin-shell .lc-total strong { font-size: 1.2rem; font-weight: 600; color: var(--adm-text); font-variant-numeric: tabular-nums; }
.admin-shell .lc-seg { display: inline-flex; flex-wrap: wrap; align-self: flex-start; gap: 2px; padding: 3px; border-radius: var(--adm-radius-sm); background: var(--adm-surface-2); border: 1px solid var(--adm-border); }
.admin-shell .lc-seg button { min-height: 38px; padding: 0 14px; border: 0; border-radius: 6px; background: transparent; color: var(--adm-text-2); font-size: 0.85rem; cursor: pointer; }
.admin-shell .lc-seg button[aria-pressed="true"] { background: var(--adm-surface-3); color: var(--adm-text); font-weight: 600; }
.admin-shell .lc-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.admin-shell .lc-chip { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; min-height: 36px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--adm-border); background: transparent; color: var(--adm-text-2); font-size: 0.8rem; cursor: pointer; font-variant-numeric: tabular-nums; }
.admin-shell .lc-chip[aria-pressed="true"] { border-color: transparent; background: var(--adm-accent-soft); color: var(--adm-text); }
.admin-shell .lc-coaches { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.admin-shell .lc-coach { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(72px, 0.8fr) minmax(88px, 0.9fr) minmax(96px, 0.9fr) 44px; gap: 8px; align-items: center; }
.admin-shell .lc-coach > .admin-input { width: 100%; min-height: 44px; padding: 0 12px; font-size: 0.95rem; }
.admin-shell .lc-coach-head { font-size: 0.75rem; font-weight: 500; color: var(--adm-text-3); }
.admin-shell .lc-coach-head .r, .admin-shell .lc-coach-pay { text-align: right; }
.admin-shell .lc-coach-pay { display: flex; flex-direction: column; font-variant-numeric: tabular-nums; }
.admin-shell .lc-coach-pay strong { font-size: 0.95rem; font-weight: 600; color: var(--adm-text); }
.admin-shell .lc-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border: 0; border-radius: var(--adm-radius-sm); background: transparent; color: var(--adm-text-3); cursor: pointer; }
.admin-shell .lc-icon-btn:hover { background: var(--adm-surface-2); color: var(--adm-text); }
.admin-shell .lc-budget { display: flex; flex-direction: column; gap: 8px; }
.admin-shell .lc-budget-track { height: 8px; border-radius: 999px; background: var(--adm-surface-3); overflow: hidden; }
.admin-shell .lc-budget-track span { display: block; height: 100%; border-radius: 999px; }
.admin-shell .lc-check { display: flex; gap: 12px; align-items: flex-start; margin-top: 16px; font-size: 0.88rem; color: var(--adm-text); cursor: pointer; }
.admin-shell .lc-check input { width: 18px; height: 18px; margin-top: 2px; accent-color: var(--adm-accent); }
.admin-shell .lc-season { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 340px); gap: 24px; padding: 0 20px 20px; align-items: start; }
.admin-shell .lc-season-sum { padding: 20px; border-radius: var(--adm-radius); background: var(--adm-surface-2); border: 1px solid var(--adm-line); }
.admin-shell .lc-wf { margin: 0; display: flex; flex-direction: column; }
.admin-shell .lc-wf > div { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid var(--adm-line); font-size: 0.85rem; color: var(--adm-text-2); }
.admin-shell .lc-wf > div:first-child { border-top: 0; }
.admin-shell .lc-wf > div[data-total] { font-weight: 600; color: var(--adm-text); }
.admin-shell .lc-wf dt { margin: 0; }
.admin-shell .lc-wf dd { margin: 0; font-variant-numeric: tabular-nums; white-space: nowrap; }
.admin-shell .lc-box { width: 18px; height: 18px; accent-color: var(--adm-accent); }
.admin-shell .lc-hero-num { display: flex; align-items: baseline; gap: 8px; margin: 16px 0 4px; }
.admin-shell .lc-gauge { margin-top: 24px; }
.admin-shell .lc-track { position: relative; display: flex; gap: 2px; height: 12px; }
.admin-shell .lc-zone { display: block; height: 100%; border-radius: 3px; }
.admin-shell .lc-zone[data-first] { border-top-left-radius: 999px; border-bottom-left-radius: 999px; }
.admin-shell .lc-zone[data-last] { border-top-right-radius: 999px; border-bottom-right-radius: 999px; }
.admin-shell .lc-zone[data-z="loss"] { background: color-mix(in srgb, var(--adm-bad) 65%, transparent); }
.admin-shell .lc-zone[data-z="mid"] { background: color-mix(in srgb, var(--adm-warn) 65%, transparent); }
.admin-shell .lc-zone[data-z="good"] { background: color-mix(in srgb, var(--adm-good) 65%, transparent); }
.admin-shell .lc-mark { position: absolute; top: -6px; bottom: -6px; width: 2px; margin-left: -1px; border-radius: 2px; background: var(--adm-text); }
.admin-shell .lc-dot { position: absolute; top: 50%; width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 999px; background: var(--adm-accent); box-shadow: 0 0 0 2px var(--adm-surface); }
.admin-shell .lc-axis { display: flex; justify-content: space-between; margin-top: 8px; font-size: 0.75rem; color: var(--adm-text-3); font-variant-numeric: tabular-nums; }
.admin-shell .lc-legend { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 6px; font-size: 0.8rem; color: var(--adm-text-2); }
.admin-shell .lc-legend li { display: flex; align-items: center; gap: 8px; }
.admin-shell .lc-sw { flex: none; width: 10px; height: 10px; border-radius: 3px; }
.admin-shell .lc-kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.admin-shell .lc-kpi { min-width: 0; padding: 16px; border-radius: var(--adm-radius); background: var(--adm-surface); border: 1px solid var(--adm-line); }
.admin-shell .lc-kpi .mda-num { font-size: 1.4rem; }
.admin-shell .lc-rules { list-style: none; margin: 0; padding: 0; }
.admin-shell .lc-rule { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 12px; padding: 12px 0; border-top: 1px solid var(--adm-line); }
.admin-shell .lc-rule:first-child { border-top: 0; padding-top: 4px; }
.admin-shell .lc-icon { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 999px; font-size: 0.75rem; font-weight: 700; }
.admin-shell .lc-icon[data-ok="true"] { background: var(--adm-good-soft); color: var(--adm-good); }
.admin-shell .lc-icon[data-ok="false"] { background: var(--adm-bad-soft); color: var(--adm-bad); }
.admin-shell .lc-icon[data-ok="null"] { background: var(--adm-surface-3); color: var(--adm-text-3); }
.admin-shell .lc-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.admin-shell .lc-actions .admin-btn-primary, .admin-shell .lc-actions .admin-btn-ghost { min-height: 44px; padding: 0 18px; }
.admin-shell .lc-actions .admin-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; filter: none; }
.admin-shell .lc-msg { margin: 8px 0 0; font-size: 0.82rem; }
.admin-shell .lc .mda-table th, .admin-shell .lc .mda-table td.r { white-space: nowrap; font-variant-numeric: tabular-nums; }
.admin-shell .lc-dock { display: none; }
@media (max-width: 960px) {
  .admin-shell .lc-layout { grid-template-columns: minmax(0, 1fr); }
  .admin-shell .lc-aside { position: static; }
  .admin-shell .lc-season { grid-template-columns: minmax(0, 1fr); padding: 0 16px 16px; }
  .admin-shell .lc { padding-bottom: 72px; }
  .admin-shell .lc-dock { display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px calc(10px + env(safe-area-inset-bottom)); background: var(--adm-surface); border-top: 1px solid var(--adm-border); box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.35); }
}
@media (max-width: 560px) {
  .admin-shell .lc-start { grid-template-columns: minmax(0, 1fr); }
  .admin-shell .lc-start .lc-actions { padding-top: 0; }
  .admin-shell .lc-kpis { grid-template-columns: 1fr 1fr; gap: 8px; }
  .admin-shell .lc-kpi { padding: 12px; }
  .admin-shell .lc-coach { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 44px; padding-bottom: 12px; border-bottom: 1px solid var(--adm-line); }
  .admin-shell .lc-coach > :nth-child(1) { grid-column: 1 / 3; grid-row: 1; }
  .admin-shell .lc-coach > :nth-child(5) { grid-column: 3; grid-row: 1; }
  .admin-shell .lc-coach > :nth-child(2) { grid-column: 1; grid-row: 2; }
  .admin-shell .lc-coach > :nth-child(3) { grid-column: 2; grid-row: 2; }
  .admin-shell .lc-coach > :nth-child(4) { grid-column: 1 / 4; grid-row: 3; flex-direction: row; justify-content: space-between; align-items: baseline; }
  .admin-shell .lc-coach-head { display: none; }
}
`;

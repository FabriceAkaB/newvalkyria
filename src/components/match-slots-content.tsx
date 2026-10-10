"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Container } from "@/components/container";
import { checkEligibility, type SlotRules, type TeamCategory, type TeamGender } from "@/lib/match-slots-core";
import { formatMoney } from "@/lib/private-programs";

interface Slot {
  id: string;
  date: string;
  start: string;
  end: string;
  location: string;
  field: string | null;
  depositCents: number;
  balanceDueCents: number;
  format: string | null;
  opponent: string | null;
  rules: SlotRules;
  restriction: string | null;
  preferred: string | null;
  doubleGroup: string | null;
  notes: string | null;
  available: boolean;
}

/** Une unité réservable : une plage seule, ou une double cédule (plages réservées en bloc). */
interface Unit {
  key: string;
  date: string;
  slots: Slot[];
}

const GENDERS: { value: TeamGender; label: string }[] = [
  { value: "filles", label: "Filles" },
  { value: "garcons", label: "Garçons" },
  { value: "mixte", label: "Mixte" }
];

function monthKey(date: string) {
  return date.slice(0, 7);
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("fr-CA", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function dayLabel(date: string) {
  const label = new Date(date + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function MatchSlotsContent({ cancelled }: { cancelled: boolean }) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [max, setMax] = useState(2);
  const [selected, setSelected] = useState<string[]>([]);
  const [category, setCategory] = useState<{ gender: TeamGender | ""; birthYear: string }>({ gender: "", birthYear: "" });
  const [form, setForm] = useState({ orgName: "", teamLabel: "", contactName: "", contactEmail: "", contactPhone: "", notes: "" });
  const [terms, setTerms] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const scrolledRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(cancelled ? "Le paiement a été annulé. Vos plages ne sont pas réservées." : null);

  const load = useCallback(async () => {
    const res = await fetch("/api/prive/matchs");
    const json = await res.json();
    setSlots(json.slots ?? []);
    setMax(json.maxPerTeam ?? 2);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const team: TeamCategory | null = useMemo(() => {
    const year = Number(category.birthYear);
    if (!category.gender || !Number.isInteger(year) || year < 2000 || year > 2026) return null;
    return { gender: category.gender, birthYear: year };
  }, [category]);

  const units: Unit[] = useMemo(() => {
    const out: Unit[] = [];
    const seen = new Set<string>();
    for (const s of slots ?? []) {
      if (s.doubleGroup) {
        if (seen.has(s.doubleGroup)) continue;
        seen.add(s.doubleGroup);
        const members = (slots ?? []).filter((o) => o.doubleGroup === s.doubleGroup).sort((a, b) => a.start.localeCompare(b.start));
        out.push({ key: s.doubleGroup, date: members[0].date, slots: members });
      } else {
        out.push({ key: s.id, date: s.date, slots: [s] });
      }
    }
    return out;
  }, [slots]);

  const unitState = (u: Unit): { available: boolean; reason: string | null } => {
    if (u.slots.some((s) => !s.available)) return { available: false, reason: "Réservée" };
    const restricted = u.slots.some((s) => s.restriction);
    if (restricted && !team) return { available: true, reason: null };
    for (const s of u.slots) {
      const elig = checkEligibility(s.rules, team);
      if (!elig.ok) return { available: false, reason: elig.reason };
    }
    return { available: true, reason: null };
  };

  // Dès que la catégorie est connue, on ne montre d'abord que les plages qui lui conviennent.
  const stateOf = new Map(units.map((u) => [u.key, unitState(u)]));
  const fits = (u: Unit) => stateOf.get(u.key)?.available === true;
  const matching = team ? units.filter(fits) : units;
  const hiddenCount = team ? units.length - matching.length : 0;
  const shownUnits = team && !showAll ? matching : units;
  const byMonth = (() => {
    const map = new Map<string, Unit[]>();
    for (const u of shownUnits) {
      const k = monthKey(u.date);
      map.set(k, [...(map.get(k) ?? []), u]);
    }
    return Array.from(map.entries());
  })();

  // Première fois que la catégorie est complète : on amène le visiteur vers ses plages.
  useEffect(() => {
    if (team && slots && !scrolledRef.current) {
      scrolledRef.current = true;
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [team, slots]);

  const selectedIds = new Set(selected);
  const chosen = (slots ?? []).filter((s) => selectedIds.has(s.id));
  const deposit = chosen.reduce((n, s) => n + s.depositCents, 0);
  const balance = chosen.reduce((n, s) => n + s.balanceDueCents, 0);

  const toggle = (u: Unit) => {
    setError(null);
    const ids = u.slots.map((s) => s.id);
    const on = ids.every((id) => selectedIds.has(id));
    if (on) return setSelected((prev) => prev.filter((id) => !ids.includes(id)));
    if (u.slots.some((s) => s.restriction) && !team) return setError("Indiquez d'abord le genre et l'année de naissance de votre équipe pour vérifier l'admissibilité.");
    if (selected.length + ids.length > max) {
      return setError(`Une équipe peut réserver au maximum ${max} plages (une double cédule compte pour ${u.slots.length}).`);
    }
    setSelected((prev) => [...prev, ...ids]);
  };

  // Si la catégorie change, on retire les plages devenues non admissibles.
  useEffect(() => {
    setSelected((prev) => {
      const next = prev.filter((id) => {
        const s = (slots ?? []).find((x) => x.id === id);
        if (!s) return false;
        return checkEligibility(s.rules, team).ok;
      });
      return next.length === prev.length ? prev : next;
    });
  }, [team, slots]);

  const submit = async () => {
    setError(null);
    if (chosen.length === 0) return setError("Choisissez au moins une plage.");
    if (!team) return setError("Indiquez le genre et l'année de naissance de votre équipe.");
    if (!form.orgName || !form.teamLabel || !form.contactName || !form.contactEmail || !form.contactPhone) return setError("Merci de remplir tous les champs obligatoires.");
    if (!terms) return setError("Vous devez accepter les conditions de réservation.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/prive/matchs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotIds: selected, ...form, teamGender: team.gender, teamBirthYear: team.birthYear, termsAccepted: terms })
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        if (json?.code === "conflict") {
          setSelected([]);
          await load();
        }
        throw new Error(json?.error ?? "Erreur de réservation");
      }
      window.location.href = json.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setSubmitting(false);
    }
  };

  const card: React.CSSProperties = { background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "1rem 1.1rem", marginBottom: "1.25rem" };
  // Une seule adresse pour tous les matchs → affichée une fois en haut plutôt que sur chaque carte.
  const commonLocation = slots && slots.length > 0 && slots.every((s) => s.location === slots[0].location) ? slots[0].location : null;
  const depositEach = slots?.[0]?.depositCents ?? 5000;
  const balanceEach = slots?.[0]?.balanceDueCents ?? 15000;

  return (
    <>
      <section className="insc-hero se-hero">
        <Container>
          <div className="insc-hero-inner" style={{ textAlign: "center" }}>
            <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Académies, clubs et équipes</p>
            <h1 className="insc-hero-title">Réservez votre match</h1>
            <p className="insc-hero-sub">
              Jouez contre New Valkyria au Complexe sportif de Terrebonne. Chaque plage d&apos;une heure coûte {formatMoney(depositEach + balanceEach)} au total : un acompte de {formatMoney(depositEach)} pour la réserver, puis {formatMoney(balanceEach)} le jour du match.
            </p>
          </div>
        </Container>
      </section>

      <section className="section-band">
        <Container className="max-w-2xl">
          <div style={{ ...card, borderColor: "#3a2f4d" }}>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#c3c2c8", lineHeight: 1.65 }}>
              <strong style={{ color: "#fff" }}>Comment ça marche</strong>
              <br />1) Indiquez la catégorie de votre équipe : certains matchs sont réservés à un genre ou à des années de naissance précises.
              <br />2) Choisissez jusqu&apos;à <strong>{max} plages</strong> d&apos;une heure (maximum par équipe).
              <br />3) Payez l&apos;acompte de <strong>{formatMoney(depositEach)} par plage</strong> pour la réserver (coût total : <strong>{formatMoney(depositEach + balanceEach)} par plage</strong>).
              <br />4) Réglez le solde de <strong>{formatMoney(balanceEach)} par plage</strong> sur place, le jour du match.
            </p>
            <p style={{ margin: "0.7rem 0 0", fontSize: "0.82rem", color: "#c3c2c8", lineHeight: 1.6 }}>
              <strong style={{ color: "#c4a4e4" }}>Double cédule :</strong> deux matchs consécutifs le même jour. Elle se réserve en bloc : votre équipe joue les deux matchs, ou vous pouvez aligner deux équipes.
            </p>
          </div>

          {commonLocation && (
            <div style={card}>
              <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.2rem" }}>Lieu des matchs</p>
              <p style={{ fontSize: "0.82rem", color: "#c3c2c8", margin: 0, lineHeight: 1.55 }}>{commonLocation}</p>
            </div>
          )}

          <div style={card}>
            <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.2rem" }}>Votre catégorie</p>
            <p style={{ fontSize: "0.78rem", color: "#9d9da0", margin: "0 0 0.7rem" }}>Sert à vérifier que vous êtes admissible aux matchs choisis.</p>
            <div className="nv27-grid2">
              <label className="insc-field">
                <span>Genre de l&apos;équipe *</span>
                <select className="insc-input" value={category.gender} onChange={(e) => setCategory({ ...category, gender: e.target.value as TeamGender | "" })}>
                  <option value="">Choisir…</option>
                  {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </label>
              <label className="insc-field">
                <span>Année de naissance des joueurs *</span>
                <input className="insc-input" inputMode="numeric" placeholder="ex. 2014" maxLength={4} value={category.birthYear} onChange={(e) => setCategory({ ...category, birthYear: e.target.value.replace(/\D/g, "") })} />
              </label>
            </div>
          </div>

          <div ref={listRef} style={{ scrollMarginTop: "1rem" }} />
          {team && slots !== null && slots.length > 0 && (
            <div style={{ ...card, borderColor: matching.length > 0 ? "#2f5a3b" : "#5a2f2f" }}>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#e5e4ea", lineHeight: 1.55 }}>
                {matching.length > 0 ? (
                  <>✓ <strong>{matching.length} plage{matching.length > 1 ? "s" : ""}</strong> correspond{matching.length > 1 ? "ent" : ""} à votre équipe ({GENDERS.find((g) => g.value === team.gender)?.label.toLowerCase()}, nés en {team.birthYear}).</>
                ) : (
                  <>Aucune plage ne correspond à votre catégorie pour le moment. Écrivez-nous à info@newvalkyria.com : nous pourrons peut-être ajouter un match pour votre équipe.</>
                )}
              </p>
              {hiddenCount > 0 && (
                <button type="button" onClick={() => setShowAll((v) => !v)} style={{ marginTop: "0.5rem", background: "none", border: "none", padding: 0, color: "#c4a4e4", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>
                  {showAll ? "Masquer les plages qui ne conviennent pas" : `Voir aussi les ${hiddenCount} autre${hiddenCount > 1 ? "s" : ""} plage${hiddenCount > 1 ? "s" : ""} (non admissibles pour votre catégorie)`}
                </button>
              )}
            </div>
          )}

          {slots === null && <p style={{ color: "#9d9da0" }}>Chargement des plages…</p>}
          {slots !== null && slots.length === 0 && (
            <div style={card}><p style={{ margin: 0, color: "#c3c2c8" }}>Aucune plage n&apos;est offerte pour le moment. Écrivez-nous à info@newvalkyria.com.</p></div>
          )}

          {byMonth.map(([key, list]) => (
            <div key={key} style={{ marginBottom: "1.2rem" }}>
              <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "#c4a4e4", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 0.5rem" }}>{monthLabel(key)}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {list.map((u) => {
                  const state = unitState(u);
                  const active = u.slots.every((s) => selectedIds.has(s.id));
                  const disabled = !state.available;
                  const isDouble = u.slots.length > 1;
                  const unitDeposit = u.slots.reduce((n, s) => n + s.depositCents, 0);
                  const unitBalance = u.slots.reduce((n, s) => n + s.balanceDueCents, 0);
                  const muted = disabled ? "#5d5a66" : "#c3c2c8";
                  return (
                    <button
                      key={u.key}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggle(u)}
                      aria-pressed={active}
                      style={{
                        textAlign: "left",
                        padding: "0.8rem 0.9rem",
                        borderRadius: "12px",
                        border: active ? "2px solid #c4a4e4" : isDouble ? "1px solid #5a4575" : "1px solid #302e36",
                        background: disabled ? "#0d0b13" : active ? "#2a1f3a" : "#17151e",
                        color: disabled ? "#5d5a66" : "#fff",
                        cursor: disabled ? "not-allowed" : "pointer",
                        width: "100%"
                      }}
                    >
                      <span style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "baseline", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.92rem", textDecoration: state.reason === "Réservée" ? "line-through" : "none" }}>{dayLabel(u.date)}</span>
                        {isDouble && (
                          <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: disabled ? "#5d5a66" : "#e9d7ff", background: disabled ? "#1a1822" : "#3d2c57", borderRadius: "999px", padding: "0.15rem 0.55rem" }}>
                            Double cédule · {u.slots.length} matchs
                          </span>
                        )}
                      </span>

                      {u.slots.map((s, i) => (
                        <span key={s.id} style={{ display: "block", marginTop: "0.5rem", paddingTop: i > 0 ? "0.5rem" : 0, borderTop: i > 0 ? "1px dashed #3a3545" : "none", fontSize: "0.8rem", color: muted, lineHeight: 1.55 }}>
                          <strong style={{ color: disabled ? "#5d5a66" : "#fff" }}>{isDouble ? `Match ${i + 1} · ` : ""}{s.start} – {s.end}</strong>
                          <br />Format : {s.format ?? "à confirmer"}
                          <br />Adversaire : {s.opponent ?? "New Valkyria — équipe à confirmer"}
                          <br />Lieu : {commonLocation ? (s.field ?? "Complexe sportif de Terrebonne") : `${s.field ? `${s.field} · ` : ""}${s.location}`}
                          {s.restriction && (
                            <>
                              <br /><span style={{ color: disabled ? "#7a5a5a" : "#f0c878", fontWeight: 600 }}>Admissibilité : {s.restriction}</span>
                            </>
                          )}
                          {s.preferred && (
                            <>
                              <br /><span style={{ color: disabled ? "#5d5a66" : "#8fce9f", fontWeight: 600 }}>{s.preferred}</span>
                            </>
                          )}
                          {s.notes && <><br />{s.notes}</>}
                        </span>
                      ))}

                      <span style={{ display: "block", fontSize: "0.76rem", marginTop: "0.6rem", color: disabled ? "#7a5a5a" : "#8fce9f" }}>
                        {state.reason
                          ? state.reason
                          : active
                            ? `✓ Sélectionnée · acompte ${formatMoney(unitDeposit)} · solde ${formatMoney(unitBalance)} le jour du match`
                            : `Acompte ${formatMoney(unitDeposit)} pour réserver · solde ${formatMoney(unitBalance)} le jour du match`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {slots && slots.length > 0 && (
            <div style={card}>
              <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.2rem" }}>Votre équipe</p>
              <p style={{ fontSize: "0.8rem", color: "#9d9da0", margin: "0 0 0.9rem" }}>
                {chosen.length}/{max} plage{max > 1 ? "s" : ""} choisie{chosen.length > 1 ? "s" : ""}
                {chosen.length > 0 ? ` · acompte ${formatMoney(deposit)} maintenant, solde ${formatMoney(balance)} le jour du match` : ""}
              </p>
              <div className="nv27-form-fields">
                <label className="insc-field"><span>Académie / club *</span><input className="insc-input" value={form.orgName} onChange={(e) => setForm({ ...form, orgName: e.target.value })} /></label>
                <label className="insc-field"><span>Nom ou catégorie de l&apos;équipe *</span><input className="insc-input" placeholder="ex. U12 féminin A" value={form.teamLabel} onChange={(e) => setForm({ ...form, teamLabel: e.target.value })} /></label>
                <label className="insc-field"><span>Responsable (nom complet) *</span><input className="insc-input" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></label>
                <div className="nv27-grid2">
                  <label className="insc-field"><span>Courriel *</span><input type="email" className="insc-input" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></label>
                  <label className="insc-field"><span>Téléphone *</span><input type="tel" className="insc-input" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></label>
                </div>
                <label className="insc-field"><span>Précisions (niveau, nombre de joueurs…)</span><textarea className="insc-input insc-textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
                <label className="insc-consent" style={{ marginTop: "0.5rem" }}>
                  <div className="insc-checkbox-wrap"><input type="checkbox" className="insc-checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /><span className="insc-checkbox-custom" aria-hidden /></div>
                  <span>
                    Je comprends que l&apos;acompte réserve la plage et qu&apos;un solde de {formatMoney(balanceEach)} par plage est payable le jour du match. L&apos;acompte n&apos;est pas remboursable après confirmation, sauf annulation par New Valkyria.
                  </span>
                </label>
                {error && <p className="nv27-pay-error">{error}</p>}
                <button type="button" className="nv27-btn-primary" onClick={submit} disabled={submitting || chosen.length === 0} style={{ padding: "0.75rem", marginTop: "0.8rem" }}>
                  {submitting ? "..." : chosen.length === 0 ? "Choisissez une plage" : `Réserver — payer l'acompte de ${formatMoney(deposit)}`}
                </button>
                <p style={{ fontSize: "0.7rem", color: "#6d6b71", margin: "0.5rem 0 0" }}>Vos plages sont gardées 30 minutes le temps du paiement.</p>
              </div>
            </div>
          )}
        </Container>
      </section>
    </>
  );
}

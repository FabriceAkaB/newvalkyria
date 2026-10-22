"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Container } from "@/components/container";
import { checkEligibility, parseTeamYears, TEAM_LEVELS, teamYearsLabel, teamYearsValue, type SlotRules, type TeamCategory, type TeamGender } from "@/lib/match-slots-core";
import { formatMoney } from "@/lib/private-programs";

const TEAM_TOKEN_KEY = "nv_match_team";

/** Choix d'année : une seule année, ou un groupe de deux années (ex. 2014-2015). */
const YEAR_SINGLE = Array.from({ length: 13 }, (_, i) => String(2020 - i));
const YEAR_GROUPS = Array.from({ length: 12 }, (_, i) => `${2019 - i}-${2020 - i}`);

function shortDay(date: string) {
  const label = new Date(date + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function hhmm(t: string) {
  const [h, m] = t.split(":");
  return `${Number(h)} h ${m}`;
}

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
  /** Les équipes non admissibles d'office peuvent faire une demande. */
  allowRequests: boolean;
  /** Demande de MON équipe pour cette plage (si elle en a fait une). */
  request: "pending" | "approved" | "declined" | null;
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
  const [form, setForm] = useState({
    orgName: "",
    teamLabel: "",
    gender: "" as TeamGender | "",
    birthYear: "",
    level: "",
    players: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    notes: ""
  });
  // Le formulaire « Votre équipe » doit être enregistré avant de pouvoir choisir une plage.
  const [profileId, setProfileId] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [terms, setTerms] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const scrolledRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(cancelled ? "Le paiement a été annulé. Vos plages ne sont pas réservées." : null);

  const [teamToken, setTeamToken] = useState<string | null>(null);
  const load = useCallback(async () => {
    const res = await fetch(`/api/prive/matchs${teamToken ? `?equipe=${encodeURIComponent(teamToken)}` : ""}`);
    const json = await res.json();
    setSlots(json.slots ?? []);
    setMax(json.maxPerTeam ?? 2);
  }, [teamToken]);

  useEffect(() => {
    load();
  }, [load]);

  // Équipe déjà enregistrée : lien personnel (?equipe=…) ou ce navigateur s'en souvient → pas de formulaire à refaire.
  const applyProfile = (p: any) => {
    setForm({
      orgName: p.orgName ?? "",
      teamLabel: p.teamLabel ?? "",
      gender: p.teamGender ?? "",
      birthYear: p.teamBirthYear ? teamYearsValue({ birthYear: p.teamBirthYear, birthYearTo: p.teamBirthYearTo }) : "",
      level: p.teamLevel ?? "",
      players: p.teamPlayers ? String(p.teamPlayers) : "",
      contactName: p.contactName ?? "",
      contactEmail: p.contactEmail ?? "",
      contactPhone: p.contactPhone ?? "",
      notes: p.notes ?? ""
    });
    setProfileId(p.profileId);
    setTeamToken(p.token);
  };
  useEffect(() => {
    let token: string | null = null;
    try {
      token = new URLSearchParams(window.location.search).get("equipe") || window.localStorage.getItem(TEAM_TOKEN_KEY);
    } catch {
      /* stockage indisponible */
    }
    if (!token) return;
    fetch(`/api/prive/matchs/equipe?token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.profile) {
          applyProfile(json.profile);
          try {
            window.localStorage.setItem(TEAM_TOKEN_KEY, json.profile.token);
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {});
  }, []);

  const team: TeamCategory | null = useMemo(() => {
    if (!profileId) return null;
    const years = parseTeamYears(form.birthYear);
    if (!form.gender || !years || years.from < 2000 || years.to > 2026) return null;
    return { gender: form.gender, birthYear: years.from, birthYearTo: years.to, level: form.level || null };
  }, [profileId, form.gender, form.birthYear, form.level]);

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

  type UnitState = { available: boolean; reason: string | null; requestable?: boolean; request?: Slot["request"] };
  const unitState = (u: Unit): UnitState => {
    if (u.slots.some((s) => !s.available)) return { available: false, reason: "Réservée" };
    const restricted = u.slots.some((s) => s.restriction);
    if (restricted && !team) return { available: true, reason: null };
    // Admissible d'office, ou demande approuvée par l'académie pour cette plage.
    if (u.slots.every((s) => checkEligibility(s.rules, team).ok || s.request === "approved")) return { available: true, reason: null };
    if (u.slots.every((s) => s.allowRequests)) {
      const request = u.slots.find((s) => s.request)?.request ?? null;
      return { available: false, requestable: true, request, reason: null };
    }
    const failing = u.slots.map((s) => checkEligibility(s.rules, team)).find((e) => !e.ok);
    return { available: false, reason: failing && !failing.ok ? failing.reason : "Non admissible" };
  };

  // Dès que la catégorie est connue, on montre les plages qui lui conviennent… et celles « sur demande ».
  const stateOf = new Map(units.map((u) => [u.key, unitState(u)]));

  const [requesting, setRequesting] = useState<string | null>(null);
  const requestUnit = async (u: Unit) => {
    if (!teamToken) return setError("Remplissez d'abord le formulaire de votre équipe.");
    setError(null);
    setRequesting(u.key);
    try {
      const res = await fetch("/api/prive/matchs/demande", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: teamToken, slotIds: u.slots.map((s) => s.id) }) });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Demande impossible");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setRequesting(null);
    }
  };

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
    if (!team) return setError("Remplissez d'abord le formulaire de votre équipe.");
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
        return checkEligibility(s.rules, team).ok || s.request === "approved";
      });
      return next.length === prev.length ? prev : next;
    });
  }, [team, slots]);

  const saveProfile = async () => {
    setError(null);
    const f = form;
    if (!f.orgName || !f.teamLabel || !f.gender || !f.birthYear || !f.level || !f.contactName || !f.contactEmail || !f.contactPhone) {
      return setError("Merci de remplir tous les champs obligatoires du formulaire de l'équipe.");
    }
    setSavingProfile(true);
    try {
      const res = await fetch("/api/prive/matchs/equipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: f.orgName,
          teamLabel: f.teamLabel,
          teamGender: f.gender,
          teamBirthYear: parseTeamYears(f.birthYear)?.from,
          teamBirthYearTo: parseTeamYears(f.birthYear)?.to,
          teamLevel: f.level,
          teamPlayers: f.players ? Number(f.players) : null,
          contactName: f.contactName,
          contactEmail: f.contactEmail,
          contactPhone: f.contactPhone,
          notes: f.notes
        })
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Impossible d'enregistrer le formulaire");
      setSelected([]);
      scrolledRef.current = false;
      setProfileId(json.profileId);
      if (json.token) {
        setTeamToken(json.token);
        try {
          window.localStorage.setItem(TEAM_TOKEN_KEY, json.token);
          window.history.replaceState(null, "", `${window.location.pathname}?equipe=${json.token}`);
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSavingProfile(false);
    }
  };

  const submit = async () => {
    setError(null);
    if (!profileId || !team) return setError("Remplissez d'abord le formulaire de votre équipe.");
    if (chosen.length === 0) return setError("Choisissez au moins une plage.");
    if (!terms) return setError("Vous devez accepter les conditions de réservation.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/prive/matchs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          slotIds: selected,
          orgName: form.orgName,
          teamLabel: form.teamLabel,
          teamGender: team.gender,
          teamBirthYear: team.birthYear,
          teamBirthYearTo: team.birthYearTo ?? team.birthYear,
          contactName: form.contactName,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone,
          notes: form.notes,
          termsAccepted: terms
        })
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

  // Une seule adresse pour tous les matchs → affichée une fois en haut plutôt que sur chaque carte.
  const commonLocation = slots && slots.length > 0 && slots.every((s) => s.location === slots[0].location) ? slots[0].location : null;
  const commonField = slots && slots.length > 0 && slots.every((s) => s.field === slots[0].field) ? slots[0].field : null;
  const depositEach = slots?.[0]?.depositCents ?? 5000;
  const balanceEach = slots?.[0]?.balanceDueCents ?? 10000;
  const step = !profileId ? 1 : chosen.length === 0 ? 2 : 3;
  const payRef = useRef<HTMLDivElement | null>(null);

  // Onglets : matchs ouverts à l'équipe / sur demande / tous.
  const openUnits = units.filter((u) => stateOf.get(u.key)?.available);
  const requestUnits = units.filter((u) => stateOf.get(u.key)?.requestable);
  const [tabChoice, setTab] = useState<"open" | "request" | "all" | null>(null);
  const tab = tabChoice ?? (openUnits.length > 0 || requestUnits.length === 0 ? "open" : "request");
  const tabUnits = tab === "open" ? openUnits : tab === "request" ? requestUnits : units;
  const tabMonths = (() => {
    const map = new Map<string, Unit[]>();
    for (const u of tabUnits) map.set(monthKey(u.date), [...(map.get(monthKey(u.date)) ?? []), u]);
    return Array.from(map.entries());
  })();

  const card: React.CSSProperties = { background: "#100e17", border: "1px solid #251f30", borderRadius: "14px", padding: "1rem 1.1rem", marginBottom: "1rem" };
  const h2: React.CSSProperties = { fontWeight: 700, color: "#fff", margin: "0 0 0.25rem", fontSize: "1rem" };
  const link: React.CSSProperties = { background: "none", border: "none", padding: 0, color: "#c4a4e4", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", textDecoration: "underline" };
  const chip = (bg: string, fg: string): React.CSSProperties => ({ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.03em", color: fg, background: bg, borderRadius: "999px", padding: "0.18rem 0.6rem", whiteSpace: "nowrap" });

  const resetTeam = () => {
    try {
      window.localStorage.removeItem(TEAM_TOKEN_KEY);
      window.history.replaceState(null, "", window.location.pathname);
    } catch {
      /* ignore */
    }
    setTeamToken(null);
    setProfileId(null);
    setSelected([]);
    setForm({ orgName: "", teamLabel: "", gender: "", birthYear: "", level: "", players: "", contactName: "", contactEmail: "", contactPhone: "", notes: "" });
  };

  return (
    <>
      <section className="insc-hero se-hero">
        <Container>
          <div className="insc-hero-inner" style={{ textAlign: "center" }}>
            <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Académies, clubs et équipes</p>
            <h1 className="insc-hero-title">Réservez un match</h1>
            <p className="insc-hero-sub">
              Venez jouer contre New Valkyria. Réservez en 3 étapes : {formatMoney(depositEach)} maintenant, {formatMoney(balanceEach)} sur place le jour du match.
            </p>
          </div>
        </Container>
      </section>

      <section className="section-band" style={{ paddingBottom: profileId ? "6rem" : undefined }}>
        <Container className="max-w-2xl">
          {/* ── Les 3 étapes ── */}
          <ol style={{ listStyle: "none", padding: 0, margin: "0 0 1rem", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.4rem" }}>
            {["Votre équipe", "Vos matchs", "Paiement"].map((label, i) => {
              const n = i + 1;
              const done = n < step;
              const current = n === step;
              return (
                <li key={label} style={{ textAlign: "center", padding: "0.55rem 0.3rem", borderRadius: "10px", background: current ? "#2a1f3a" : "#100e17", border: `1px solid ${current ? "#c4a4e4" : "#251f30"}`, color: current ? "#fff" : done ? "#8fce9f" : "#6d6b71", fontSize: "0.78rem", fontWeight: 700 }}>
                  {done ? "✓" : n} · {label}
                </li>
              );
            })}
          </ol>

          {/* ── L'essentiel en un coup d'œil ── */}
          <div style={{ ...card, display: "grid", gap: "0.45rem", fontSize: "0.82rem", color: "#c3c2c8", lineHeight: 1.5 }}>
            {commonLocation && (
              <span>📍 <strong style={{ color: "#fff" }}>{commonField ? `${commonField} — ` : ""}Complexe sportif de Terrebonne</strong><br /><span style={{ color: "#9d9da0" }}>{commonLocation}</span></span>
            )}
            <span>⏱ Matchs d&apos;une heure, le dimanche · maximum {max} par équipe</span>
            <span>💳 {formatMoney(depositEach + balanceEach)} par match : {formatMoney(depositEach)} en ligne pour réserver, {formatMoney(balanceEach)} sur place</span>
            <span>🔁 <strong style={{ color: "#c4a4e4" }}>Double cédule</strong> = 2 matchs de suite, réservés ensemble (votre équipe joue les deux, ou vous alignez deux équipes)</span>
          </div>

          {/* ── Étape 1 : votre équipe ── */}
          <div style={{ ...card, borderColor: step === 1 ? "#3a2f4d" : "#251f30" }}>
            <p style={h2}>1. Votre équipe</p>
            {profileId && team ? (
              <>
                <p style={{ fontSize: "0.86rem", color: "#c3c2c8", margin: "0.3rem 0 0.5rem", lineHeight: 1.6 }}>
                  <strong style={{ color: "#fff" }}>{form.orgName}</strong> — {form.teamLabel}
                  <br />
                  {GENDERS.find((g) => g.value === team.gender)?.label} · {teamYearsLabel(team)} · {form.level}
                  <br />
                  <span style={{ color: "#9d9da0" }}>{form.contactName} · {form.contactEmail} · {form.contactPhone}</span>
                </p>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  <button type="button" style={link} onClick={() => { setProfileId(null); setSelected([]); scrolledRef.current = false; }}>Modifier</button>
                  {teamToken && <button type="button" style={link} onClick={resetTeam}>Ce n&apos;est pas mon équipe</button>}
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: "0.8rem", color: "#9d9da0", margin: "0 0 0.9rem" }}>Une seule fois : ensuite, votre équipe est reconnue et vous recevez votre lien personnel par courriel.</p>
                <div className="nv27-form-fields">
                  <p style={{ fontSize: "0.7rem", color: "#9f85ba", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Responsable</p>
                  <label className="insc-field"><span>Académie / club *</span><input className="insc-input" value={form.orgName} onChange={(e) => setForm({ ...form, orgName: e.target.value })} /></label>
                  <label className="insc-field"><span>Nom du responsable *</span><input className="insc-input" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></label>
                  <div className="nv27-grid2">
                    <label className="insc-field"><span>Courriel *</span><input type="email" className="insc-input" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></label>
                    <label className="insc-field"><span>Téléphone *</span><input type="tel" className="insc-input" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></label>
                  </div>

                  <p style={{ fontSize: "0.7rem", color: "#9f85ba", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0.8rem 0 0" }}>Équipe</p>
                  <label className="insc-field"><span>Nom de l&apos;équipe *</span><input className="insc-input" placeholder="ex. U12 féminin A" value={form.teamLabel} onChange={(e) => setForm({ ...form, teamLabel: e.target.value })} /></label>
                  <div className="nv27-grid2">
                    <label className="insc-field">
                      <span>Genre *</span>
                      <select className="insc-input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as TeamGender | "" })}>
                        <option value="">Choisir…</option>
                        {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                      </select>
                    </label>
                    <label className="insc-field">
                      <span>Année de naissance *</span>
                      <select className="insc-input" value={form.birthYear} onChange={(e) => setForm({ ...form, birthYear: e.target.value })}>
                        <option value="">Choisir…</option>
                        <optgroup label="Une année">
                          {YEAR_SINGLE.map((y) => <option key={y} value={y}>Nés en {y}</option>)}
                        </optgroup>
                        <optgroup label="Groupe de deux années">
                          {YEAR_GROUPS.map((y) => <option key={y} value={y}>Groupe {y}</option>)}
                        </optgroup>
                      </select>
                    </label>
                  </div>
                  <div className="nv27-grid2">
                    <label className="insc-field">
                      <span>Calibre *</span>
                      <select className="insc-input" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                        <option value="">Choisir…</option>
                        {TEAM_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </label>
                    <label className="insc-field">
                      <span>Nombre de joueurs (facultatif)</span>
                      <input className="insc-input" inputMode="numeric" placeholder="ex. 12" maxLength={2} value={form.players} onChange={(e) => setForm({ ...form, players: e.target.value.replace(/\D/g, "") })} />
                    </label>
                  </div>
                  <label className="insc-field"><span>Précisions (facultatif)</span><textarea className="insc-input insc-textarea" placeholder="Style de jeu, disponibilités, remarques…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
                  {error && <p className="nv27-pay-error">{error}</p>}
                  <button type="button" className="nv27-btn-primary" onClick={saveProfile} disabled={savingProfile} style={{ padding: "0.8rem", marginTop: "0.6rem" }}>
                    {savingProfile ? "..." : "Continuer — voir les matchs"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ── Étape 2 : vos matchs ── */}
          <div ref={listRef} style={{ scrollMarginTop: "1rem" }} />
          {!profileId && slots !== null && slots.length > 0 && (
            <p style={{ color: "#9d9da0", fontSize: "0.85rem", margin: "0 0 1.2rem", textAlign: "center" }}>
              {slots.length} matchs sont offerts. Remplissez l&apos;étape 1 pour voir ceux qui conviennent à votre équipe.
            </p>
          )}
          {profileId && (
            <div style={{ marginBottom: "1rem" }}>
              <p style={{ ...h2, marginBottom: "0.6rem" }}>2. Choisissez vos matchs</p>
              {slots === null && <p style={{ color: "#9d9da0" }}>Chargement des matchs…</p>}
              {slots !== null && slots.length === 0 && (
                <div style={card}><p style={{ margin: 0, color: "#c3c2c8" }}>Aucun match n&apos;est offert pour le moment. Écrivez-nous à info@newvalkyria.com.</p></div>
              )}
              {slots !== null && slots.length > 0 && (
                <>
                  <div role="tablist" style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.8rem" }}>
                    {(
                      [
                        ["open", `Ouverts à votre équipe (${openUnits.length})`],
                        ["request", `Sur demande (${requestUnits.length})`],
                        ["all", "Tous"]
                      ] as const
                    )
                      .filter(([k]) => k !== "request" || requestUnits.length > 0)
                      .map(([k, label]) => (
                        <button
                          key={k}
                          type="button"
                          role="tab"
                          aria-selected={tab === k}
                          onClick={() => setTab(k)}
                          style={{ padding: "0.45rem 0.85rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", border: `1px solid ${tab === k ? "#c4a4e4" : "#302e36"}`, background: tab === k ? "#2a1f3a" : "#100e17", color: tab === k ? "#fff" : "#c3c2c8" }}
                        >
                          {label}
                        </button>
                      ))}
                  </div>
                  {tab === "open" && openUnits.length === 0 && (
                    <div style={card}>
                      <p style={{ margin: 0, color: "#c3c2c8", fontSize: "0.85rem" }}>
                        Aucun match n&apos;est ouvert d&apos;office à votre catégorie.{" "}
                        {requestUnits.length > 0 ? <button type="button" style={link} onClick={() => setTab("request")}>Voir les matchs possibles sur demande</button> : "Écrivez-nous à info@newvalkyria.com : nous pourrons peut-être ajouter un match pour votre équipe."}
                      </p>
                    </div>
                  )}
                  {tab === "request" && (
                    <p style={{ fontSize: "0.8rem", color: "#f0c878", margin: "0 0 0.8rem" }}>Ces matchs ne sont pas ouverts d&apos;office à votre catégorie : faites une demande, nous vous répondrons par courriel. Une fois approuvée, vous pourrez payer.</p>
                  )}
                  {error && <p className="nv27-pay-error">{error}</p>}

                  {tabMonths.map(([key, list]) => (
                    <div key={key} style={{ marginBottom: "1rem" }}>
                      <p style={{ fontSize: "0.74rem", fontWeight: 700, color: "#c4a4e4", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.45rem" }}>{monthLabel(key)}</p>
                      <div style={{ display: "grid", gap: "0.55rem" }}>
                        {list.map((u) => {
                          const state = unitState(u);
                          const active = u.slots.every((sl) => selectedIds.has(sl.id));
                          const isDouble = u.slots.length > 1;
                          const first = u.slots[0];
                          const last = u.slots[u.slots.length - 1];
                          const unitDeposit = u.slots.reduce((n, sl) => n + sl.depositCents, 0);
                          const unitBalance = u.slots.reduce((n, sl) => n + sl.balanceDueCents, 0);
                          const opponents = Array.from(new Set(u.slots.map((sl) => sl.opponent ?? "New Valkyria — équipe à confirmer")));
                          const reserved = state.reason === "Réservée";
                          return (
                            <div
                              key={u.key}
                              style={{
                                borderRadius: "14px",
                                border: active ? "2px solid #c4a4e4" : "1px solid #302e36",
                                background: active ? "#2a1f3a" : reserved ? "#0d0b13" : "#17151e",
                                padding: "0.85rem 0.95rem",
                                opacity: reserved ? 0.6 : 1
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.6rem" }}>
                                <div>
                                  <p style={{ margin: 0, fontSize: "1.02rem", fontWeight: 800, color: "#fff" }}>{shortDay(u.date)}</p>
                                  <p style={{ margin: "0.1rem 0 0", fontSize: "0.85rem", color: "#e5e4ea" }}>{hhmm(first.start)} à {hhmm(last.end)}{isDouble ? " · 2 matchs" : ""}</p>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.3rem" }}>
                                  {state.available && <span style={chip("#1d3a26", "#8fce9f")}>Ouvert à votre équipe</span>}
                                  {state.requestable && <span style={chip("#3a2f10", "#f0c878")}>{state.request === "pending" ? "Demande envoyée" : state.request === "declined" ? "Demande refusée" : "Sur demande"}</span>}
                                  {!state.available && !state.requestable && <span style={chip("#2a1a1a", "#ff9999")}>{reserved ? "Réservé" : "Non admissible"}</span>}
                                  {isDouble && <span style={chip("#3d2c57", "#e9d7ff")}>Double cédule</span>}
                                </div>
                              </div>

                              <p style={{ margin: "0.55rem 0 0", fontSize: "0.84rem", color: "#c3c2c8", lineHeight: 1.55 }}>
                                <span style={{ color: "#9d9da0" }}>Contre :</span> <strong style={{ color: "#fff" }}>{opponents.join(" puis ")}</strong>
                                {first.format && <><br /><span style={{ color: "#9d9da0" }}>Format :</span> {first.format}</>}
                                {!commonLocation && <><br /><span style={{ color: "#9d9da0" }}>Terrain :</span> {first.field ? `${first.field} · ` : ""}{first.location}</>}
                                {first.preferred && <><br /><span style={{ color: "#8fce9f" }}>{first.preferred}</span></>}
                              </p>
                              {first.restriction && (
                                <details style={{ marginTop: "0.35rem" }}>
                                  <summary style={{ cursor: "pointer", fontSize: "0.74rem", color: "#9d9da0" }}>Qui peut jouer ce match ?</summary>
                                  <p style={{ margin: "0.3rem 0 0", fontSize: "0.76rem", color: "#c3c2c8" }}>{first.restriction}{first.allowRequests ? " · Autres équipes : sur demande." : ""}</p>
                                </details>
                              )}

                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem", marginTop: "0.7rem", flexWrap: "wrap" }}>
                                <span style={{ fontSize: "0.78rem", color: "#9d9da0" }}>{formatMoney(unitDeposit)} maintenant · {formatMoney(unitBalance)} sur place</span>
                                {state.available && (
                                  <button
                                    type="button"
                                    onClick={() => toggle(u)}
                                    aria-pressed={active}
                                    style={{ padding: "0.5rem 1rem", borderRadius: "999px", fontSize: "0.82rem", fontWeight: 800, cursor: "pointer", border: "none", background: active ? "#8fce9f" : "#c4a4e4", color: "#120c1c" }}
                                  >
                                    {active ? "✓ Choisi" : "Choisir"}
                                  </button>
                                )}
                                {state.requestable && !state.request && (
                                  <button
                                    type="button"
                                    onClick={() => requestUnit(u)}
                                    disabled={requesting === u.key}
                                    style={{ padding: "0.5rem 1rem", borderRadius: "999px", fontSize: "0.82rem", fontWeight: 800, cursor: "pointer", border: "1px solid #f0c878", background: "transparent", color: "#f0c878" }}
                                  >
                                    {requesting === u.key ? "..." : "Faire une demande"}
                                  </button>
                                )}
                                {state.requestable && state.request === "pending" && <span style={{ fontSize: "0.76rem", color: "#f0c878" }}>En attente d&apos;approbation</span>}
                                {!state.available && !state.requestable && !reserved && state.reason && <span style={{ fontSize: "0.74rem", color: "#ff9999" }}>{state.reason}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── Étape 3 : paiement ── */}
          {profileId && chosen.length > 0 && (
            <div ref={payRef} style={{ ...card, borderColor: "#3a2f4d", scrollMarginTop: "1rem" }}>
              <p style={h2}>3. Confirmer et payer l&apos;acompte</p>
              <div style={{ margin: "0.4rem 0 0.8rem", display: "grid", gap: "0.3rem" }}>
                {units
                  .filter((u) => u.slots.every((sl) => selectedIds.has(sl.id)))
                  .map((u) => (
                    <div key={u.key} style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", fontSize: "0.84rem", color: "#e5e4ea" }}>
                      <span>{shortDay(u.date)} · {hhmm(u.slots[0].start)} à {hhmm(u.slots[u.slots.length - 1].end)}{u.slots.length > 1 ? " (double cédule)" : ""}</span>
                      <button type="button" style={{ ...link, fontSize: "0.74rem" }} onClick={() => toggle(u)}>Retirer</button>
                    </div>
                  ))}
              </div>
              <div style={{ background: "#17151e", borderRadius: "10px", padding: "0.7rem 0.8rem", fontSize: "0.84rem", color: "#c3c2c8", marginBottom: "0.8rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>À payer maintenant (acompte)</span><strong style={{ color: "#fff" }}>{formatMoney(deposit)}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.2rem" }}><span>Sur place, le jour du match</span><span>{formatMoney(balance)}</span></div>
              </div>
              <div className="nv27-form-fields">
                <label className="insc-consent">
                  <div className="insc-checkbox-wrap"><input type="checkbox" className="insc-checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /><span className="insc-checkbox-custom" aria-hidden /></div>
                  <span>J&apos;accepte : l&apos;acompte réserve le match et n&apos;est pas remboursable après confirmation (sauf annulation par New Valkyria) ; le solde de {formatMoney(balanceEach)} par match est payable sur place.</span>
                </label>
                {error && <p className="nv27-pay-error">{error}</p>}
                <button type="button" className="nv27-btn-primary" onClick={submit} disabled={submitting} style={{ padding: "0.85rem", marginTop: "0.8rem" }}>
                  {submitting ? "..." : `Payer l'acompte — ${formatMoney(deposit)}`}
                </button>
                <p style={{ fontSize: "0.72rem", color: "#6d6b71", margin: "0.5rem 0 0" }}>Paiement sécurisé par Stripe. Vos matchs sont gardés 30 minutes le temps du paiement.</p>
              </div>
            </div>
          )}
        </Container>
      </section>

      {/* ── Barre fixe : sélection et accès direct au paiement ── */}
      {profileId && slots && slots.length > 0 && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40, background: "rgba(13,11,19,0.97)", borderTop: "1px solid #302e36", padding: "0.7rem 1rem calc(0.7rem + env(safe-area-inset-bottom))" }}>
          <div style={{ maxWidth: "42rem", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.8rem" }}>
            <span style={{ fontSize: "0.82rem", color: "#c3c2c8" }}>
              {chosen.length === 0 ? "Choisissez un match" : <><strong style={{ color: "#fff" }}>{chosen.length} match{chosen.length > 1 ? "s" : ""}</strong> · acompte {formatMoney(deposit)}</>}
              <span style={{ color: "#6d6b71" }}> (max. {max})</span>
            </span>
            <button
              type="button"
              className="nv27-btn-primary"
              disabled={chosen.length === 0}
              onClick={() => payRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              style={{ padding: "0.6rem 1.1rem", width: "auto", opacity: chosen.length === 0 ? 0.5 : 1 }}
            >
              Continuer
            </button>
          </div>
        </div>
      )}
    </>
  );
}

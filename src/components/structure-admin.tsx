"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { moneyCents } from "@/components/mandalart/ui";
import {
  EMPLOYMENTS,
  EMPLOYMENT_LABEL,
  NEED_STATUSES,
  NEED_STATUS_LABEL,
  STAGES,
  STAGE_LABEL,
  TEAMS,
  TEAM_LABEL,
  WEEKDAYS,
  WEEKDAY_LABEL,
  WEEKDAY_SHORT,
  nextStage,
  runScenario,
  type DayPlan,
  type Employment,
  type NeedStatus,
  type Stage,
  type Team,
  type Weekday
} from "@/lib/structure-core";

/** Structure de l'Académie et recrutement : formulaires et actions de /admin/structure (admin seulement). */

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/structure", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Erreur");
  return json;
}

function useSubmit() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (body: Record<string, unknown>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await post(body);
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

const caption: React.CSSProperties = { fontSize: "0.78rem", color: "var(--adm-text-3)" };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 };
const btnSm: React.CSSProperties = { padding: "8px 12px", whiteSpace: "nowrap" };
const gridTight: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 };

function Field({ label, hint, wide, children }: { label: string; hint?: string | null; wide?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4, alignContent: "start", gridColumn: wide ? "1 / -1" : undefined }}>
      <span style={caption}>{label}</span>
      {children}
      {hint ? <span style={{ ...caption, fontSize: "0.74rem" }}>{hint}</span> : null}
    </label>
  );
}

function ErrorLine({ text }: { text: string | null }) {
  return text ? <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--adm-bad)" }}>{text}</p> : null;
}

/** « 30 », « 30,50 », « 30 $ » ou « 30 $/h » → cents ; vide ou illisible → null. */
const toCents = (dollars: string) => {
  const clean = dollars.replace(/[^\d,.-]/g, "").replace(",", ".");
  const v = Number(clean);
  return clean && Number.isFinite(v) ? Math.round(v * 100) : null;
};
const toDollars = (cents: number | null | undefined) => (cents === null || cents === undefined ? "" : String(cents / 100).replace(".", ","));

/* ── Personne : ajout et modification ──────────────────────── */

export interface StaffFormValue {
  staffId: string | null;
  coachId: string | null;
  fullName: string;
  role: string;
  team: Team;
  employment: Employment | "";
  email: string;
  phone: string;
  diplomas: string;
  certifications: { name: string; issuedOn: string; expiresOn: string }[];
  startedOn: string;
  notes: string;
  onField: boolean;
  availableDays: Weekday[];
  rate: string;
  sortOrder: number | null;
}

export const EMPTY_STAFF: StaffFormValue = {
  staffId: null,
  coachId: null,
  fullName: "",
  role: "",
  team: "terrain",
  employment: "",
  email: "",
  phone: "",
  diplomas: "",
  certifications: [],
  startedOn: "",
  notes: "",
  onField: true,
  availableDays: [],
  rate: "",
  sortOrder: null
};

const CERT_SUGGESTIONS = ["Vérification des antécédents judiciaires", "Formation Sport sécuritaire (Respect et sport)", "Premiers soins - RCR", "Licence C", "Licence B", "Licence A"];

/** Bouton qui ouvre la fiche d'une personne (ajout ou modification) ; la fiche se referme une fois enregistrée. */
export function StaffEditor({
  initial,
  label,
  primary,
  hints,
  coachHref
}: {
  initial: StaffFormValue;
  label: string;
  primary?: boolean;
  /** Valeur actuelle venant du contrat ou du portail, affichée sous un champ laissé vide. */
  hints?: { employment?: string | null; days?: string | null; rate?: string | null };
  coachHref?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<StaffFormValue>(initial);
  const [rateError, setRateError] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  const set = <K extends keyof StaffFormValue>(k: K, v: StaffFormValue[K]) => setF((x) => ({ ...x, [k]: v }));
  const text = (k: "fullName" | "role" | "email" | "phone" | "diplomas" | "startedOn" | "notes" | "rate") => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value);

  if (!open) {
    return (
      <button type="button" className={primary ? "admin-btn-primary" : "admin-btn-ghost"} style={primary ? undefined : btnSm} onClick={() => { setF(initial); setOpen(true); }}>
        {label}
      </button>
    );
  }
  return (
    <form
      style={{ display: "grid", gap: 12, width: "100%", padding: 16, borderRadius: 12, background: "var(--adm-surface-2)", marginTop: 8 }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (f.rate.trim() && toCents(f.rate) === null) {
          setRateError("Taux horaire illisible : écrire un montant comme 30 ou 27,50.");
          return;
        }
        setRateError(null);
        const ok = await run({
          action: "save-staff",
          id: f.staffId,
          coachId: f.coachId,
          fullName: f.fullName,
          role: f.role,
          team: f.team,
          employment: f.employment || null,
          email: f.email || null,
          phone: f.phone || null,
          diplomas: f.diplomas || null,
          certifications: f.coachId ? [] : f.certifications.filter((c) => c.name.trim()).map((c) => ({ name: c.name, issuedOn: c.issuedOn || null, expiresOn: c.expiresOn || null })),
          startedOn: f.startedOn || null,
          notes: f.notes || null,
          onField: f.onField,
          availableDays: f.availableDays,
          hourlyRateCents: toCents(f.rate),
          sortOrder: f.sortOrder
        });
        if (ok) setOpen(false);
      }}
    >
      <div style={grid}>
        <Field label="Nom complet">
          <input className="admin-input" value={f.fullName} onChange={text("fullName")} required maxLength={120} />
        </Field>
        <Field label="Rôle">
          <input className="admin-input" value={f.role} onChange={text("role")} required maxLength={120} placeholder="Ex. Éducatrice, caméra, comptable" />
        </Field>
        <Field label="Place dans l'organigramme">
          <select className="admin-input" value={f.team} onChange={(e) => set("team", e.target.value as Team)}>
            {TEAMS.map((t) => (
              <option key={t} value={t}>
                {TEAM_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Statut" hint={!f.employment && hints?.employment ? `Actuellement : ${hints.employment}` : null}>
          <select className="admin-input" value={f.employment} onChange={(e) => set("employment", e.target.value as Employment | "")}>
            <option value="">{hints?.employment ? "Selon le contrat" : "À préciser"}</option>
            {EMPLOYMENTS.map((x) => (
              <option key={x} value={x}>
                {EMPLOYMENT_LABEL[x]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Courriel">
          <input className="admin-input" type="email" value={f.email} onChange={text("email")} maxLength={160} />
        </Field>
        <Field label="Téléphone">
          <input className="admin-input" type="tel" value={f.phone} onChange={text("phone")} maxLength={40} />
        </Field>
        <Field label="Taux horaire ($)" hint={!f.rate && hints?.rate ? `Actuellement : ${hints.rate}` : null}>
          <input className="admin-input" inputMode="decimal" value={f.rate} onChange={text("rate")} placeholder={hints?.rate ? "Selon le contrat" : "Ex. 30"} />
        </Field>
        <Field label="Avec nous depuis">
          <input className="admin-input" type="date" value={f.startedOn} onChange={text("startedOn")} />
        </Field>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.88rem", color: "var(--adm-text)", minHeight: 32 }}>
          <input type="checkbox" checked={f.onField} onChange={(e) => set("onField", e.target.checked)} style={{ width: 18, height: 18 }} />
          Sur le terrain avec les joueuses (compte dans les 2 adultes par séance)
        </label>
        {f.onField ? (
          <>
            <span style={caption}>Jours où elle ou il travaille{!f.availableDays.length && hints?.days ? ` · actuellement : ${hints.days}` : ""}</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {WEEKDAYS.map((d) => {
                const on = f.availableDays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set("availableDays", on ? f.availableDays.filter((x) => x !== d) : WEEKDAYS.filter((x) => x === d || f.availableDays.includes(x)))}
                    className="mda-pill"
                    data-tone={on ? "accent" : undefined}
                    style={{ minHeight: 36, minWidth: 52, justifyContent: "center", border: "none", cursor: "pointer", fontSize: "0.82rem" }}
                  >
                    {WEEKDAY_SHORT[d]}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
      </div>

      <Field label="Diplômes et formation" wide>
        <textarea className="admin-input" rows={2} value={f.diplomas} onChange={text("diplomas")} maxLength={2000} placeholder="Ex. Baccalauréat en intervention sportive, Licence C (2024)" />
      </Field>

      {f.coachId ? (
        <p style={{ ...caption, margin: 0 }}>
          Les certifications (antécédents, sport sécuritaire, licences, premiers soins) se gèrent dans sa{" "}
          {coachHref ? (
            <Link href={coachHref} style={{ color: "var(--adm-accent)" }}>
              fiche entraîneur
            </Link>
          ) : (
            "fiche entraîneur"
          )}
          , avec leurs dates d’expiration.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          <span style={caption}>Certifications et dates d’expiration</span>
          <datalist id="structure-cert-names">
            {CERT_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {f.certifications.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                className="admin-input"
                style={{ flex: "2 1 220px" }}
                list="structure-cert-names"
                placeholder="Certification"
                value={c.name}
                onChange={(e) => set("certifications", f.certifications.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              <input className="admin-input" style={{ flex: "1 1 140px" }} type="date" aria-label="Obtenue le" title="Obtenue le" value={c.issuedOn} onChange={(e) => set("certifications", f.certifications.map((x, j) => (j === i ? { ...x, issuedOn: e.target.value } : x)))} />
              <input className="admin-input" style={{ flex: "1 1 140px" }} type="date" aria-label="Expire le" title="Expire le" value={c.expiresOn} onChange={(e) => set("certifications", f.certifications.map((x, j) => (j === i ? { ...x, expiresOn: e.target.value } : x)))} />
              <button type="button" className="mda-task-more" onClick={() => set("certifications", f.certifications.filter((_, j) => j !== i))}>
                Retirer
              </button>
            </div>
          ))}
          {f.certifications.length < 20 ? (
            <button type="button" className="mda-task-more" style={{ justifySelf: "start" }} onClick={() => set("certifications", [...f.certifications, { name: "", issuedOn: "", expiresOn: "" }])}>
              + Ajouter une certification (obtenue le · expire le)
            </button>
          ) : null}
        </div>
      )}

      <Field label="Notes" wide>
        <textarea className="admin-input" rows={2} value={f.notes} onChange={text("notes")} maxLength={2000} />
      </Field>

      <ErrorLine text={rateError ?? error} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="submit" className="admin-btn-primary" disabled={busy}>
          {busy ? "…" : f.staffId || f.coachId ? "Enregistrer la fiche" : "Ajouter à l'équipe"}
        </button>
        <button type="button" className="admin-btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
          Annuler
        </button>
      </div>
    </form>
  );
}

export function StaffActiveButton({ staffId, active, name }: { staffId: string; active: boolean; name: string }) {
  const { busy, error, run } = useSubmit();
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <button
        type="button"
        className="mda-task-more"
        disabled={busy}
        onClick={() => {
          if (active && !confirm(`Retirer ${name} de l'équipe ? La fiche est gardée (bouton « Remettre » plus bas).`)) return;
          void run({ action: "staff-active", id: staffId, active: !active });
        }}
      >
        {busy ? "…" : active ? "Retirer de l'équipe" : "Remettre dans l'équipe"}
      </button>
      <ErrorLine text={error} />
    </span>
  );
}

/* ── Postes à combler ──────────────────────────────────────── */

export interface NeedFormValue {
  id: string | null;
  position: string;
  employment: Employment;
  headcount: number;
  dueOn: string;
  status: NeedStatus;
  season: string;
  notes: string;
}

export function NeedEditor({ initial, label, primary }: { initial: NeedFormValue; label: string; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<NeedFormValue>(initial);
  const { busy, error, run } = useSubmit();
  const set = <K extends keyof NeedFormValue>(k: K, v: NeedFormValue[K]) => setF((x) => ({ ...x, [k]: v }));
  if (!open) {
    return (
      <button type="button" className={primary ? "admin-btn-primary" : "admin-btn-ghost"} style={primary ? undefined : btnSm} onClick={() => { setF(initial); setOpen(true); }}>
        {label}
      </button>
    );
  }
  return (
    <form
      style={{ display: "grid", gap: 12, width: "100%", padding: 16, borderRadius: 12, background: "var(--adm-surface-2)", marginTop: 8 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run({ action: "save-need", id: f.id, position: f.position, employment: f.employment, headcount: Number(f.headcount) || 1, dueOn: f.dueOn || null, status: f.status, season: f.season || null, notes: f.notes || null });
        if (ok) setOpen(false);
      }}
    >
      <div style={grid}>
        <Field label="Poste">
          <input className="admin-input" value={f.position} onChange={(e) => set("position", e.target.value)} required maxLength={160} placeholder="Ex. Éducatrice certifiée, lundi et samedi" />
        </Field>
        <Field label="Statut d'emploi">
          <select className="admin-input" value={f.employment} onChange={(e) => set("employment", e.target.value as Employment)}>
            {EMPLOYMENTS.map((x) => (
              <option key={x} value={x}>
                {EMPLOYMENT_LABEL[x]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Combien de personnes">
          <input className="admin-input" type="number" min={1} max={50} value={f.headcount} onChange={(e) => set("headcount", Number(e.target.value))} required />
        </Field>
        <Field label="À combler avant le">
          <input className="admin-input" type="date" value={f.dueOn} onChange={(e) => set("dueOn", e.target.value)} />
        </Field>
        <Field label="Où en est le poste">
          <select className="admin-input" value={f.status} onChange={(e) => set("status", e.target.value as NeedStatus)}>
            {NEED_STATUSES.map((x) => (
              <option key={x} value={x}>
                {NEED_STATUS_LABEL[x]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Saison">
          <input className="admin-input" value={f.season} onChange={(e) => set("season", e.target.value)} maxLength={80} placeholder="Ex. Hiver 2027" />
        </Field>
      </div>
      <Field label="Notes (diplômes demandés, jours, où publier l'annonce)" wide>
        <textarea className="admin-input" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} maxLength={2000} />
      </Field>
      <ErrorLine text={error} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="submit" className="admin-btn-primary" disabled={busy}>
          {busy ? "…" : f.id ? "Enregistrer" : "Ajouter ce poste"}
        </button>
        <button type="button" className="admin-btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
          Annuler
        </button>
      </div>
    </form>
  );
}

export function NeedStatusSelect({ id, status }: { id: string; status: NeedStatus }) {
  const { busy, error, run } = useSubmit();
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <select className="admin-input" style={{ width: "auto", padding: "6px 10px", fontSize: "0.85rem" }} value={status} disabled={busy} aria-label="Où en est le poste" onChange={(e) => void run({ action: "need-status", id, status: e.target.value })}>
        {NEED_STATUSES.map((x) => (
          <option key={x} value={x}>
            {NEED_STATUS_LABEL[x]}
          </option>
        ))}
      </select>
      <ErrorLine text={error} />
    </span>
  );
}

export function DeleteNeedButton({ id, position }: { id: string; position: string }) {
  const { busy, error, run } = useSubmit();
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <button type="button" className="mda-task-more" disabled={busy} onClick={() => confirm(`Supprimer le poste « ${position} » ? Les candidats restent dans le suivi.`) && void run({ action: "delete-need", id })}>
        {busy ? "…" : "Supprimer"}
      </button>
      <ErrorLine text={error} />
    </span>
  );
}

/* ── Candidats ─────────────────────────────────────────────── */

export interface CandidateFormValue {
  id: string | null;
  needId: string;
  position: string;
  fullName: string;
  email: string;
  phone: string;
  stage: Stage;
  interviewOn: string;
  notes: string;
}

export const EMPTY_CANDIDATE: CandidateFormValue = { id: null, needId: "", position: "", fullName: "", email: "", phone: "", stage: "candidat", interviewOn: "", notes: "" };

export function CandidateEditor({ initial, label, primary, needs }: { initial: CandidateFormValue; label: string; primary?: boolean; needs: { id: string; position: string }[] }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<CandidateFormValue>(initial);
  const { busy, error, run } = useSubmit();
  const set = <K extends keyof CandidateFormValue>(k: K, v: CandidateFormValue[K]) => setF((x) => ({ ...x, [k]: v }));
  if (!open) {
    return (
      <button type="button" className={primary ? "admin-btn-primary" : "mda-task-more"} onClick={() => { setF(initial); setOpen(true); }}>
        {label}
      </button>
    );
  }
  return (
    <form
      style={{ display: "grid", gap: 12, width: "100%", padding: 16, borderRadius: 12, background: "var(--adm-surface-2)", marginTop: 8 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run({ action: "save-candidate", id: f.id, needId: f.needId || null, position: f.position, fullName: f.fullName, email: f.email || null, phone: f.phone || null, stage: f.stage, interviewOn: f.interviewOn || null, notes: f.notes || null });
        if (ok) setOpen(false);
      }}
    >
      <div style={grid}>
        <Field label="Nom de la personne">
          <input className="admin-input" value={f.fullName} onChange={(e) => set("fullName", e.target.value)} required maxLength={120} />
        </Field>
        <Field label="Pour quel poste">
          <select
            className="admin-input"
            value={f.needId}
            onChange={(e) => {
              const n = needs.find((x) => x.id === e.target.value);
              setF((x) => ({ ...x, needId: e.target.value, position: n ? n.position : x.position }));
            }}
          >
            <option value="">Aucun poste précis</option>
            {needs.map((n) => (
              <option key={n.id} value={n.id}>
                {n.position}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Poste visé">
          <input className="admin-input" value={f.position} onChange={(e) => set("position", e.target.value)} required maxLength={160} placeholder="Ex. Éducatrice" />
        </Field>
        <Field label="Étape">
          <select className="admin-input" value={f.stage} onChange={(e) => set("stage", e.target.value as Stage)}>
            {STAGES.map((x) => (
              <option key={x} value={x}>
                {STAGE_LABEL[x]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Téléphone">
          <input className="admin-input" type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} maxLength={40} />
        </Field>
        <Field label="Courriel">
          <input className="admin-input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} maxLength={160} />
        </Field>
        <Field label="Date de l'entrevue">
          <input className="admin-input" type="date" value={f.interviewOn} onChange={(e) => set("interviewOn", e.target.value)} />
        </Field>
      </div>
      <Field label="Notes (expérience, disponibilités, références)" wide>
        <textarea className="admin-input" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} maxLength={2000} />
      </Field>
      <ErrorLine text={error} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="submit" className="admin-btn-primary" disabled={busy}>
          {busy ? "…" : f.id ? "Enregistrer" : "Ajouter au suivi"}
        </button>
        <button type="button" className="admin-btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
          Annuler
        </button>
      </div>
    </form>
  );
}

export function CandidateActions({ id, name, stage }: { id: string; name: string; stage: Stage }) {
  const { busy, error, run } = useSubmit();
  const next = nextStage(stage);
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
      <span style={{ display: "inline-flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
        {next ? (
          <button type="button" className="admin-btn-ghost" style={btnSm} disabled={busy} onClick={() => void run({ action: "candidate-stage", id, stage: next })}>
            {busy ? "…" : `Passer à : ${STAGE_LABEL[next]}`}
          </button>
        ) : null}
        {stage !== "refuse" && stage !== "contrat" ? (
          <button type="button" className="mda-task-more" disabled={busy} onClick={() => confirm(`Fermer la candidature de ${name} (refusée) ?`) && void run({ action: "candidate-stage", id, stage: "refuse" })}>
            Refuser
          </button>
        ) : null}
        {stage === "refuse" ? (
          <>
            <button type="button" className="mda-task-more" disabled={busy} onClick={() => void run({ action: "candidate-stage", id, stage: "candidat" })}>
              Rouvrir
            </button>
            <button
              type="button"
              className="mda-task-more"
              disabled={busy}
              onClick={() => confirm(`Effacer définitivement la candidature de ${name} ? (Loi 25 : on ne garde pas de renseignements personnels sans raison.)`) && void run({ action: "erase-candidate", id })}
            >
              Effacer
            </button>
          </>
        ) : null}
      </span>
      <ErrorLine text={error} />
    </span>
  );
}

/* ── Scénario « Et si j'ajoute des groupes ? » ─────────────── */

export function GrowthScenario({
  plan,
  teamByDay,
  defaults
}: {
  plan: DayPlan[];
  teamByDay: Record<Weekday, number>;
  defaults: { hourlyRateCents: number; pricePerPlayerCents: number; priceLabel: string; fieldCostPerHourCents: number; fieldNote: string; sessionMinutes: number; practices: number };
}) {
  const [s, setS] = useState({
    groups: "2",
    playersPerGroup: "10",
    day: "samedi" as Weekday,
    together: false,
    practices: String(defaults.practices),
    sessionMinutes: String(defaults.sessionMinutes),
    rate: toDollars(defaults.hourlyRateCents),
    price: toDollars(defaults.pricePerPlayerCents),
    field: toDollars(defaults.fieldCostPerHourCents)
  });
  const num = (v: string) => Math.max(0, Number(v.replace(",", ".")) || 0);
  const r = runScenario(plan, teamByDay, {
    groups: num(s.groups),
    playersPerGroup: num(s.playersPerGroup),
    day: s.day,
    together: s.together,
    practices: num(s.practices),
    sessionMinutes: num(s.sessionMinutes),
    hourlyRateCents: toCents(s.rate) ?? 0,
    pricePerPlayerCents: toCents(s.price) ?? 0,
    fieldCostPerHourCents: toCents(s.field) ?? 0
  });
  const input = (k: keyof typeof s, extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input className="admin-input" inputMode="decimal" value={String(s[k])} onChange={(e) => setS((x) => ({ ...x, [k]: e.target.value }))} {...extra} />
  );
  const marginTone = r.marginCents >= 0 ? "var(--adm-good)" : "var(--adm-bad)";
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={gridTight}>
        <Field label="Nouveaux groupes">{input("groups", { type: "number", min: 0, max: 20 })}</Field>
        <Field label="Joueuses par groupe">{input("playersPerGroup", { type: "number", min: 0, max: 40 })}</Field>
        <Field label="Jour">
          <select className="admin-input" value={s.day} onChange={(e) => setS((x) => ({ ...x, day: e.target.value as Weekday }))}>
            {WEEKDAYS.map((d) => (
              <option key={d} value={d}>
                {WEEKDAY_LABEL[d]} (équipe prévue : {teamByDay[d]})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pratiques vendues" hint={defaults.priceLabel}>{input("practices", { type: "number", min: 0, max: 60 })}</Field>
        <Field label="Durée d'une séance (min)">{input("sessionMinutes", { type: "number", min: 30, max: 240 })}</Field>
        <Field label="Prix par joueuse ($)">{input("price")}</Field>
        <Field label="Taux des éducateurs ($/h)" hint="moyenne de l'équipe actuelle">{input("rate")}</Field>
        <Field label="Terrain ($/h)" hint={defaults.fieldNote}>{input("field")}</Field>
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.88rem", color: "var(--adm-text)", minHeight: 32 }}>
        <input type="checkbox" checked={s.together} onChange={(e) => setS((x) => ({ ...x, together: e.target.checked }))} style={{ width: 18, height: 18 }} />
        Tous les nouveaux groupes en même temps, dans le même gymnase (sinon l’un après l’autre)
      </label>

      <div className="mda-cols-4">
        <div className="mda-card" style={{ boxShadow: r.extraRecruits ? "inset 3px 0 0 var(--adm-warn)" : undefined }}>
          <p className="mda-num" style={{ color: r.extraRecruits ? "var(--adm-warn)" : undefined }}>{r.extraRecruits ? `+${r.extraRecruits}` : "0"}</p>
          <p className="mda-label">
            Éducateur{r.extraRecruits > 1 ? "s" : ""} à recruter en plus (total : {r.recruitsAfter})
          </p>
        </div>
        <div className="mda-card">
          <p className="mda-num">{r.adultsPerBlock}</p>
          <p className="mda-label">
            Adultes par séance · {r.players} joueuse{r.players > 1 ? "s" : ""} en {r.blocks} séance{r.blocks > 1 ? "s" : ""}
          </p>
        </div>
        <div className="mda-card">
          <p className="mda-num">{moneyCents(r.revenueCents)}</p>
          <p className="mda-label">Revenus (avant taxes)</p>
        </div>
        <div className="mda-card" style={{ boxShadow: `inset 3px 0 0 ${marginTone}` }}>
          <p className="mda-num" style={{ color: marginTone }}>{moneyCents(r.marginCents)}</p>
          <p className="mda-label">
            Marge après éducateurs ({moneyCents(r.payrollCents)}) et terrain ({moneyCents(r.fieldCents)})
          </p>
        </div>
      </div>
      <p style={{ ...caption, margin: 0 }}>
        Éducateurs payés pour la séance + 30 min d’arrivée : {r.educatorHoursPerWeek.toLocaleString("fr-CA", { maximumFractionDigits: 1 })} h par semaine. Le {WEEKDAY_LABEL[s.day].toLowerCase()}, il faut {r.dayNeedAfter} adulte{r.dayNeedAfter > 1 ? "s" : ""} en même temps (aujourd’hui {r.dayNeedBefore}) pour {r.teamThatDay} prévu{r.teamThatDay > 1 ? "s" : ""}. Marge avant uniformes, frais Stripe et taxes.
      </p>
    </div>
  );
}

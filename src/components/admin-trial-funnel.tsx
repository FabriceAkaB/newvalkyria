"use client";

import { Check, ChevronDown, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { STEP_DEFS, type FunnelRow, type TrialStep } from "@/lib/trial-funnel";

const DAY_FR = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."][m - 1]}`;
};
const stamp = (iso: string) => new Date(iso).toLocaleString("fr-CA", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

/** Ordre des étapes affichées dans « Noter autre chose ». */
const OTHER_STEPS: TrialStep[] = ["contact", "rappel", "offre", "relance-3", "relance-7", "relance-14", "absente", "liste-chaude", "refus"];

/** Une ligne de l'entonnoir : qui, où elle en est, la prochaine action en un bouton et les autres étapes repliées. */
export function TrialFunnelRow({ row, planHref, showStage }: { row: FunnelRow; planHref: string | null; showStage?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);

  async function record(step: TrialStep) {
    setBusy(step);
    setError(null);
    try {
      const res = await fetch("/api/admin/acquisition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "trial-step", ref: row.ref, step, notes: note.trim() || null }) });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Erreur");
      setNote("");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  }

  const next = row.next;
  const done = (Object.keys(row.steps) as TrialStep[]).sort((a, b) => row.steps[a]!.localeCompare(row.steps[b]!));
  const nextStep = next && next.step !== "planifier" ? next.step : null;

  return (
    <li className="mda-task" style={{ display: "block" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: "1 1 260px" }}>
          <p className="mda-task-title" style={{ fontWeight: 600 }}>
            {row.playerName || "Joueuse"}
            <span className="mda-muted" style={{ fontWeight: 400 }}> · {row.program}</span>
          </p>
          <div className="mda-task-meta">
            <span>{row.parentName || row.parentEmail}</span>
            {row.parentPhone ? (
              <a href={telHref(row.parentPhone)} style={{ color: "var(--adm-accent)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Phone size={13} aria-hidden /> {row.parentPhone}
              </a>
            ) : null}
            {row.parentEmail ? (
              <a href={`mailto:${row.parentEmail}`} style={{ color: "var(--adm-text-2)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Mail size={13} aria-hidden /> {row.parentEmail}
              </a>
            ) : null}
          </div>
          <div className="mda-task-meta">
            {showStage ? <span className="mda-pill">{showStage}</span> : null}
            <span>Demande le {stamp(row.createdAt)}</span>
            {row.trialDate ? <span>Essai le {DAY_FR(row.trialDate)}</span> : null}
            {row.contactedIn24h === false ? <span className="mda-late">Pas contactée dans les 24 h</span> : null}
            {done.map((s) => (
              <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--adm-text-2)" }}>
                <Check size={12} aria-hidden style={{ color: "var(--adm-good)" }} /> {STEP_DEFS[s].done} ({DAY_FR(row.steps[s]!)})
              </span>
            ))}
          </div>
          {row.lastNote ? (
            <p className="mda-muted" style={{ margin: "6px 0 0", fontSize: "0.8rem" }}>
              « {row.lastNote} »
            </p>
          ) : null}
        </div>
        {next ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flex: "0 0 auto" }}>
            {nextStep ? (
              <button type="button" className={next.dueNow ? "admin-btn-primary" : "admin-btn-ghost"} disabled={busy !== null} onClick={() => record(nextStep)} style={{ minHeight: 44 }}>
                {busy === nextStep ? "…" : STEP_DEFS[nextStep].label}
              </button>
            ) : planHref ? (
              <Link href={planHref} className={next.dueNow ? "admin-btn-primary" : "admin-btn-ghost"} style={{ minHeight: 44, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                Fixer la date
              </Link>
            ) : null}
            <span style={{ fontSize: "0.76rem", color: next.late ? "var(--adm-bad)" : next.dueNow ? "var(--adm-warn)" : "var(--adm-text-3)", textAlign: "right", maxWidth: 240 }}>
              {next.label}
              {next.late ? ` · en retard (${DAY_FR(next.due)})` : next.dueNow ? " · aujourd'hui" : ` · le ${DAY_FR(next.due)}`}
            </span>
          </div>
        ) : null}
      </div>
      <div style={{ marginTop: 8 }}>
        <button type="button" className="mda-task-more" onClick={() => setOpen((o) => !o)} aria-expanded={open} style={{ display: "inline-flex", alignItems: "center", gap: 4, minHeight: 32 }}>
          Noter autre chose <ChevronDown size={13} aria-hidden style={{ transform: open ? "rotate(180deg)" : undefined }} />
        </button>
        {open ? (
          <div className="mda-task-edit">
            <input className="admin-input" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Ce que la famille a dit (facultatif)" style={{ minHeight: 44 }} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {OTHER_STEPS.filter((s) => s !== nextStep).map((s) => (
                <button key={s} type="button" className="admin-btn-ghost" disabled={busy !== null} onClick={() => record(s)} style={{ minHeight: 40, fontSize: "0.82rem" }}>
                  {busy === s ? "…" : STEP_DEFS[s].label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {error ? <p style={{ margin: "6px 0 0", fontSize: "0.8rem", color: "var(--adm-bad)" }}>{error}</p> : null}
      </div>
    </li>
  );
}

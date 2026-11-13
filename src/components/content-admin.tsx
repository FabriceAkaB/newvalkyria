"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { DEFAULT_FILMER, INTERVIEW_STATUS, type InterviewSlot, type InterviewStatus } from "@/lib/content-core";

/** Espace Création de contenu : les petites actions (cocher une captation, journées d'entrevues, entrevues, invitations). */

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/contenu", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Erreur d'enregistrement");
  return json;
}

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    setBusy(true);
    setError(null);
    try {
      const r = await fn();
      router.refresh();
      return r;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

const small: React.CSSProperties = { fontSize: "0.78rem", color: "var(--adm-text-3)" };
const errStyle: React.CSSProperties = { fontSize: "0.8rem", color: "var(--adm-bad)", margin: 0 };

/* ── Captation : ball mastery à 360° (pratique) ou photos des joueuses (match) ── */

export function CaptureToggle({ activityId, kind, captured, url, filmedBy }: { activityId: string; kind: "ball_mastery_360" | "photos_match"; captured: boolean; url: string | null; filmedBy: string | null }) {
  const { busy, error, run } = useAction();
  const [link, setLink] = useState(url ?? "");
  const [who, setWho] = useState(filmedBy ?? DEFAULT_FILMER);
  const save = (done: boolean) => run(() => post({ action: "capture", activityId, kind, done, url: link || null, filmedBy: who || null }));
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <input className="admin-input" style={{ flex: "1 1 200px", minWidth: 0 }} placeholder={kind === "photos_match" ? "Lien du dossier de photos" : "Lien de la vidéo 360°"} value={link} onChange={(e) => setLink(e.target.value)} />
        <input className="admin-input" style={{ width: 110 }} value={who} onChange={(e) => setWho(e.target.value)} aria-label="Qui a filmé" />
        {captured ? (
          <>
            <button type="button" className="admin-btn-ghost" disabled={busy} onClick={() => save(true)}>
              Enregistrer
            </button>
            <button type="button" className="admin-btn-ghost" disabled={busy} onClick={() => save(false)}>
              Décocher
            </button>
          </>
        ) : (
          <button type="button" className="admin-btn-primary" disabled={busy} onClick={() => save(true)}>
            {kind === "photos_match" ? "Photos prises ✓" : "Filmé ✓"}
          </button>
        )}
      </div>
      {error ? <p style={errStyle}>{error}</p> : null}
    </div>
  );
}

/* ── Journées d'entrevues ── */

export function SlotForm({ defaultDay, defaultPlace }: { defaultDay: string; defaultPlace: string }) {
  const { busy, error, run } = useAction();
  const [f, setF] = useState({ day: defaultDay, startTime: "09:00", endTime: "11:00", place: defaultPlace, capacity: "8", note: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
        <label style={{ ...small, display: "grid", gap: 4 }}>
          Jour
          <input className="admin-input" type="date" value={f.day} onChange={set("day")} />
        </label>
        <label style={{ ...small, display: "grid", gap: 4 }}>
          De
          <input className="admin-input" type="time" value={f.startTime} onChange={set("startTime")} />
        </label>
        <label style={{ ...small, display: "grid", gap: 4 }}>
          À
          <input className="admin-input" type="time" value={f.endTime} onChange={set("endTime")} />
        </label>
        <label style={{ ...small, display: "grid", gap: 4 }}>
          Places (filles)
          <input className="admin-input" type="number" min={1} max={40} value={f.capacity} onChange={set("capacity")} />
        </label>
      </div>
      <label style={{ ...small, display: "grid", gap: 4 }}>
        Lieu
        <input className="admin-input" value={f.place} onChange={set("place")} />
      </label>
      <label style={{ ...small, display: "grid", gap: 4 }}>
        Note (facultatif)
        <input className="admin-input" value={f.note} onChange={set("note")} placeholder="Ex. avant le match de 8 h 15, coin près des gradins" />
      </label>
      <div>
        <button
          type="button"
          className="admin-btn-primary"
          disabled={busy || !f.day || f.place.trim().length < 2}
          onClick={() => run(() => post({ action: "slot-add", day: f.day, startTime: f.startTime, endTime: f.endTime, place: f.place, capacity: Number(f.capacity) || 1, note: f.note || null }))}
        >
          Ajouter cette journée d&apos;entrevues
        </button>
      </div>
      {error ? <p style={errStyle}>{error}</p> : null}
    </div>
  );
}

export function SlotDelete({ id }: { id: string }) {
  const { busy, run } = useAction();
  return (
    <button type="button" className="admin-btn-ghost" disabled={busy} onClick={() => confirm("Retirer cette journée ? Les familles qui l'avaient choisie devront en choisir une autre.") && run(() => post({ action: "slot-delete", id }))}>
      Retirer
    </button>
  );
}

/* ── Choisir les filles à interviewer ── */

export function CandidatePicker({ candidates }: { candidates: { registrationId: string; player: string; group: string; taken: boolean }[] }) {
  const { busy, error, run } = useAction();
  const [picked, setPicked] = useState<string[]>([]);
  const [kind, setKind] = useState<"debut" | "fin">("debut");
  const [withParent, setWithParent] = useState(true);
  const [q, setQ] = useState("");
  const shown = useMemo(() => candidates.filter((c) => !c.taken && `${c.player} ${c.group}`.toLowerCase().includes(q.toLowerCase())), [candidates, q]);
  const groups = [...new Set(shown.map((c) => c.group))];
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input className="admin-input" style={{ flex: "1 1 200px" }} placeholder="Chercher une joueuse ou un groupe" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="admin-input" style={{ width: "auto" }} value={kind} onChange={(e) => setKind(e.target.value as "debut" | "fin")}>
          <option value="debut">Entrevue de début</option>
          <option value="fin">Entrevue de fin</option>
        </select>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "0.85rem", color: "var(--adm-text)" }}>
          <input type="checkbox" checked={withParent} onChange={(e) => setWithParent(e.target.checked)} /> Avec un parent
        </label>
      </div>
      <div style={{ maxHeight: 320, overflow: "auto", border: "1px solid var(--adm-line)", borderRadius: 12, padding: 10, display: "grid", gap: 10 }}>
        {groups.map((g) => (
          <div key={g}>
            <p style={{ ...small, margin: "0 0 4px", fontWeight: 600 }}>{g || "Sans groupe"}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {shown
                .filter((c) => c.group === g)
                .map((c) => {
                  const on = picked.includes(c.registrationId);
                  return (
                    <button
                      key={c.registrationId}
                      type="button"
                      onClick={() => setPicked(on ? picked.filter((x) => x !== c.registrationId) : [...picked, c.registrationId])}
                      style={{ padding: "6px 10px", borderRadius: 99, border: "1px solid var(--adm-line)", background: on ? "var(--adm-accent-strong, #8b5cf6)" : "transparent", color: on ? "#fff" : "var(--adm-text)", fontSize: "0.82rem", cursor: "pointer" }}
                    >
                      {c.player}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
        {!shown.length ? <p style={{ ...small, margin: 0 }}>Toutes les joueuses de la recherche sont déjà dans la liste.</p> : null}
      </div>
      <div>
        <button
          type="button"
          className="admin-btn-primary"
          disabled={busy || !picked.length}
          onClick={() => run(() => post({ action: "interview-add", registrationIds: picked, kind, withParent })).then((r) => r && setPicked([]))}
        >
          Ajouter {picked.length || ""} à la liste des entrevues
        </button>
      </div>
      {error ? <p style={errStyle}>{error}</p> : null}
    </div>
  );
}

/* ── Liste des entrevues : statut, journée, vidéo, invitations ── */

export interface InterviewRow {
  id: string;
  player_name: string;
  parent_email: string | null;
  kind: "debut" | "fin";
  with_parent: boolean;
  slot_id: string | null;
  status: InterviewStatus;
  video_url: string | null;
  slotLabel: string | null;
}

export function InterviewTable({ rows, slots }: { rows: InterviewRow[]; slots: (InterviewSlot & { label: string })[] }) {
  const { busy, error, run } = useAction();
  const [picked, setPicked] = useState<string[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const invitable = rows.filter((r) => (r.status === "a_inviter" || r.status === "invitee") && r.parent_email);
  const toInvite = picked.filter((id) => invitable.some((r) => r.id === id));
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="admin-btn-ghost" onClick={() => setPicked(rows.filter((r) => r.status === "a_inviter" && r.parent_email).map((r) => r.id))}>
          Cocher toutes les « à inviter »
        </button>
        <button
          type="button"
          className="admin-btn-primary"
          disabled={busy || !toInvite.length || !slots.length}
          onClick={() =>
            confirm(`Envoyer l'invitation à ${toInvite.length} joueuse(s) (un courriel par famille, Christine reçoit une copie) ?`) &&
            run(() => post({ action: "interview-invite", ids: toInvite })).then((r) => {
              if (r) {
                setResult(`${r.sent} courriel(s) envoyé(s)${r.failed?.length ? `, échecs : ${r.failed.join(", ")}` : ""}.`);
                setPicked([]);
              }
            })
          }
        >
          Envoyer l&apos;invitation ({toInvite.length})
        </button>
        {!slots.length ? <span style={small}>Ajoute d&apos;abord une journée d&apos;entrevues : les familles choisissent leur heure parmi elles.</span> : null}
        {result ? <span style={{ fontSize: "0.82rem", color: "var(--adm-good)" }}>{result}</span> : null}
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th />
              <th>Joueuse</th>
              <th>Entrevue</th>
              <th>Statut</th>
              <th>Journée</th>
              <th>Vidéo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <input type="checkbox" checked={picked.includes(r.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, r.id] : picked.filter((x) => x !== r.id))} aria-label={`Choisir ${r.player_name}`} />
                </td>
                <td>
                  <strong>{r.player_name}</strong>
                  {!r.parent_email ? <div style={{ ...small, color: "var(--adm-warn)" }}>Pas de courriel</div> : null}
                </td>
                <td style={small}>
                  {r.kind === "debut" ? "Début" : "Fin"}
                  {r.with_parent ? " + parent" : ""}
                </td>
                <td>
                  <select className="admin-input" style={{ width: "auto" }} value={r.status} disabled={busy} onChange={(e) => run(() => post({ action: "interview-update", id: r.id, status: e.target.value }))}>
                    {INTERVIEW_STATUS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select className="admin-input" style={{ width: "auto", maxWidth: 220 }} value={r.slot_id ?? ""} disabled={busy} onChange={(e) => run(() => post({ action: "interview-update", id: r.id, slotId: e.target.value || null }))}>
                    <option value="">—</option>
                    {slots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <VideoLink id={r.id} url={r.video_url} />
                </td>
                <td>
                  <button type="button" className="admin-btn-ghost" disabled={busy} onClick={() => confirm(`Retirer ${r.player_name} de la liste ?`) && run(() => post({ action: "interview-delete", id: r.id }))}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error ? <p style={errStyle}>{error}</p> : null}
    </div>
  );
}

function VideoLink({ id, url }: { id: string; url: string | null }) {
  const { busy, run } = useAction();
  const [v, setV] = useState(url ?? "");
  return (
    <input
      className="admin-input"
      style={{ minWidth: 140 }}
      placeholder="Lien de la vidéo"
      value={v}
      disabled={busy}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== (url ?? "") && run(() => post({ action: "interview-update", id, videoUrl: v || null }))}
    />
  );
}

/* ── Page famille : choisir son heure ── */

export function InterviewSlotPicker({ token, slots, current }: { token: string; slots: { id: string; label: string; remaining: number }[]; current: string | null }) {
  const [chosen, setChosen] = useState<string | null>(current);
  const [state, setState] = useState<"idle" | "busy" | "ok" | "decline">("idle");
  const [error, setError] = useState<string | null>(null);
  const send = async (slotId: string | null) => {
    setState("busy");
    setError(null);
    const res = await fetch(`/api/entrevue/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slotId }) });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error ?? "Erreur, réessayez.");
      setState("idle");
      return;
    }
    setChosen(slotId);
    setState(slotId ? "ok" : "decline");
  };
  if (state === "ok") return <p style={{ color: "#1d7a46", fontWeight: 600 }}>Merci ! Votre moment est réservé. On vous attend.</p>;
  if (state === "decline") return <p style={{ color: "#5d566b" }}>C&apos;est noté, merci de nous avoir répondu.</p>;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {slots.map((s) => {
        const full = s.remaining <= 0 && chosen !== s.id;
        return (
          <button
            key={s.id}
            type="button"
            disabled={full || state === "busy"}
            onClick={() => send(s.id)}
            style={{ textAlign: "left", padding: "14px 16px", borderRadius: 12, border: `2px solid ${chosen === s.id ? "#5b2a86" : "#e6e0ee"}`, background: full ? "#f3f1f6" : "#fff", color: full ? "#9b95a6" : "#1d1730", fontSize: "1rem", cursor: full ? "not-allowed" : "pointer" }}
          >
            <strong>{s.label}</strong>
            <span style={{ display: "block", fontSize: "0.85rem", color: "#5d566b", marginTop: 2 }}>{full ? "Complet" : chosen === s.id ? "Votre choix actuel" : `${s.remaining} place${s.remaining > 1 ? "s" : ""}`}</span>
          </button>
        );
      })}
      <button type="button" onClick={() => send(null)} disabled={state === "busy"} style={{ background: "none", border: "none", color: "#5d566b", textDecoration: "underline", cursor: "pointer", fontSize: "0.9rem", justifySelf: "start" }}>
        Aucun de ces moments ne nous convient
      </button>
      {error ? <p style={{ color: "#b3261e", margin: 0 }}>{error}</p> : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Avatar } from "@/components/admin-avatar";
import { dequeue, enqueue, sendOutcome } from "@/lib/kiosk-queue";
import {
  type Criteria,
  type PresenceState,
  type QueuedSheet,
  POSITION_LABELS,
  SCALE,
  familyAverages,
  isSheetComplete,
  matchCriteria,
  parseSheetQueue,
  presenceOf,
  ratedCount,
  scoreOn10,
  sheetQueueKey
} from "@/lib/match-evaluation";

export interface SheetPlayer {
  registrationId: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  convocation: string | null;
  lineupPosition: string | null;
  inLineup: boolean;
  /** Ma fiche déjà enregistrée sur le serveur, s'il y en a une. */
  saved: { positionCode: string | null; criteria: Criteria; strengths: string; toImprove: string; comment: string } | null;
}

const SCALE_COLOR = ["var(--adm-bad)", "var(--adm-warn)", "var(--adm-text-2)", "var(--adm-good)", "var(--adm-accent)"];
const PRESENCE_LABEL: Record<PresenceState, string> = { presente: "Présentes", a_confirmer: "Présence à confirmer", absente: "Absentes" };

/** « Évaluer le match » : une fiche en 10 points par joueuse présente, remplie même sans réseau
 *  (gardée sur l'appareil, envoyée dès que le réseau revient), comme la borne de sondage. */
export function MatchEvaluationSheet({ activityId, title, subtitle, players }: { activityId: string; title: string; subtitle: string; players: SheetPlayer[] }) {
  const [queue, setQueue] = useState<QueuedSheet[]>([]);
  const queueRef = useRef<QueuedSheet[]>([]);
  const flushing = useRef(false);
  const [online, setOnline] = useState(true);
  const [sentNow, setSentNow] = useState<Record<string, QueuedSheet>>({});
  const [rejected, setRejected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const persist = useCallback(
    (q: QueuedSheet[]) => {
      queueRef.current = q;
      setQueue(q);
      try {
        localStorage.setItem(sheetQueueKey(activityId), JSON.stringify(q));
      } catch {
        /* stockage indisponible : la fiche reste en mémoire tant que la page est ouverte */
      }
    },
    [activityId]
  );

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      for (const item of [...queueRef.current]) {
        const res = await fetch(`/api/coach/activities/${activityId}/match/evaluations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheet: true, ...item })
        }).catch(() => null);
        const outcome = sendOutcome(res ? res.status : null);
        if (outcome === "retry") break;
        if (outcome === "rejected") {
          const data = await res?.json().catch(() => null);
          const p = players.find((x) => x.registrationId === item.registrationId);
          setRejected((r) => [...r, `${p?.firstName ?? "Une joueuse"} : ${data?.error ?? "fiche refusée"}${res?.status === 401 ? " (reconnecte-toi au portail, la fiche reste gardée ici)" : ""}`]);
          if (res?.status === 401) break;
        } else {
          setSentNow((s) => ({ ...s, [item.registrationId]: item }));
        }
        persist(dequeue(queueRef.current, item));
      }
    } finally {
      flushing.current = false;
    }
  }, [activityId, players, persist]);

  useEffect(() => {
    let saved: QueuedSheet[] = [];
    try {
      saved = parseSheetQueue(localStorage.getItem(sheetQueueKey(activityId)));
    } catch {
      saved = [];
    }
    if (saved.length) persist(saved);
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    const up = () => {
      setOnline(true);
      void flush();
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    const timer = window.setInterval(() => void flush(), 30000);
    void flush();
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      window.clearInterval(timer);
    };
  }, [activityId, persist, flush]);

  /** La fiche la plus récente d'une joueuse : en attente d'envoi, envoyée à l'instant, ou celle du serveur. */
  const current = useCallback(
    (p: SheetPlayer): QueuedSheet | null => {
      const q = queue.find((x) => x.registrationId === p.registrationId) ?? sentNow[p.registrationId];
      if (q) return q;
      if (!p.saved) return null;
      return { registrationId: p.registrationId, present: true, at: 0, ...p.saved };
    },
    [queue, sentNow]
  );

  const groups = useMemo(() => {
    const by: Record<PresenceState, SheetPlayer[]> = { presente: [], a_confirmer: [], absente: [] };
    for (const p of players) {
      const c = current(p);
      by[presenceOf({ convocation: p.convocation, inLineup: p.inLineup, evaluated: !!p.saved, queuedPresent: c && c.at > 0 ? c.present : null })].push(p);
    }
    return by;
  }, [players, current]);

  const save = (sheet: QueuedSheet) => {
    persist(enqueue(queueRef.current, sheet));
    void flush();
  };

  const presentDone = groups.presente.filter((p) => {
    const c = current(p);
    return c && c.present && isSheetComplete(c);
  }).length;
  const open = players.find((p) => p.registrationId === openId) ?? null;
  const order = [...groups.presente, ...groups.a_confirmer];

  if (open) {
    const idx = order.findIndex((p) => p.registrationId === open.registrationId);
    const next = idx >= 0 ? order[idx + 1] ?? null : null;
    return (
      <SheetForm
        key={open.registrationId}
        player={open}
        initial={current(open)}
        nextName={next ? next.firstName : null}
        onCancel={() => setOpenId(null)}
        onSave={(sheet, goNext) => {
          save(sheet);
          setOpenId(goNext && next ? next.registrationId : null);
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  return (
    <div>
      <Link href={`/entraineur/activites/${activityId}`} className="admin-btn-ghost" style={{ textDecoration: "none", display: "inline-block", marginBottom: 16 }}>
        ← Retour au match
      </Link>
      <p className="coach-eyebrow">{subtitle}</p>
      <h1 className="coach-title">Évaluer le match</h1>
      <p className="coach-sub">{title}</p>

      <div className="coach-card" style={{ margin: "16px 0", display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <p className="coach-card__label" style={{ margin: 0 }}>
            {presentDone} sur {groups.presente.length} fiches complètes
          </p>
          <p className="coach-sub" style={{ margin: "4px 0 0" }}>
            Touche une joueuse pour ouvrir sa fiche : 10 points de 1 à 5, puis un mot. Ça marche aussi sans réseau.
          </p>
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: online ? (queue.length ? "var(--adm-warn)" : "var(--adm-good)") : "var(--adm-warn)" }}>
          {online ? (queue.length ? `${queue.length} fiche${queue.length > 1 ? "s" : ""} en cours d'envoi` : "Tout est envoyé") : `Hors réseau · ${queue.length} fiche${queue.length > 1 ? "s" : ""} gardée${queue.length > 1 ? "s" : ""} sur l'appareil`}
        </span>
      </div>
      {rejected.length > 0 && (
        <div className="coach-card" style={{ borderColor: "var(--adm-bad)", marginBottom: 16 }}>
          {rejected.map((r) => (
            <p key={r} className="coach-sub" style={{ margin: 0, color: "var(--adm-bad)" }}>
              {r}
            </p>
          ))}
        </div>
      )}

      {players.length === 0 && <p className="coach-sub">Aucune joueuse trouvée pour ce match.</p>}
      {(["presente", "a_confirmer", "absente"] as PresenceState[]).map((g) =>
        groups[g].length ? (
          <section key={g} style={{ marginBottom: 20 }}>
            <p className="coach-card__label" style={{ marginBottom: 8 }}>
              {PRESENCE_LABEL[g]} · {groups[g].length}
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {groups[g].map((p) => {
                const c = current(p);
                const pos = c?.positionCode ?? p.lineupPosition;
                const n = c ? ratedCount(c.criteria) : 0;
                const note = c ? scoreOn10(c.criteria) : null;
                const complete = !!c && c.present && isSheetComplete(c);
                const waiting = queue.some((q) => q.registrationId === p.registrationId);
                return (
                  <button
                    key={p.registrationId}
                    type="button"
                    onClick={() => setOpenId(p.registrationId)}
                    className="coach-card"
                    style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", cursor: "pointer", width: "100%", minHeight: 64, opacity: g === "absente" ? 0.6 : 1 }}
                  >
                    <Avatar firstName={p.firstName} lastName={p.lastName} photoUrl={p.photoUrl} size={48} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ display: "block", color: "var(--adm-text)" }}>
                        {p.firstName} {p.lastName}
                      </strong>
                      <span style={{ fontSize: 13, color: "var(--adm-text-2)" }}>
                        {pos ? POSITION_LABELS[pos] ?? pos : "Poste à choisir"}
                        {g === "absente" ? " · absente" : n ? ` · ${n}/10 points notés` : " · à évaluer"}
                        {waiting ? " · en attente d'envoi" : ""}
                      </span>
                    </span>
                    <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: complete ? "var(--adm-good)" : "var(--adm-text-3)" }}>{note !== null && c?.present ? `${note.toLocaleString("fr-CA")}/10` : complete ? "✓" : "›"}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null
      )}
    </div>
  );
}

function SheetForm({ player, initial, nextName, onCancel, onSave }: { player: SheetPlayer; initial: QueuedSheet | null; nextName: string | null; onCancel: () => void; onSave: (s: QueuedSheet, goNext: boolean) => void }) {
  const [present, setPresent] = useState(initial ? initial.present : true);
  const [position, setPosition] = useState<string>(initial?.positionCode ?? player.lineupPosition ?? "");
  const [criteria, setCriteria] = useState<Criteria>(initial?.criteria ?? {});
  const [strengths, setStrengths] = useState(initial?.strengths ?? "");
  const [toImprove, setToImprove] = useState(initial?.toImprove ?? "");
  const [comment, setComment] = useState(initial?.comment ?? "");
  const list = matchCriteria(position || null);
  const note = scoreOn10(criteria);
  const sheet: QueuedSheet = { registrationId: player.registrationId, present, positionCode: position || null, criteria, strengths, toImprove, comment, at: 0 };
  const complete = isSheetComplete(sheet);
  const families = familyAverages(criteria);

  return (
    <div>
      <button type="button" className="admin-btn-ghost" onClick={onCancel} style={{ marginBottom: 16 }}>
        ← Toutes les joueuses
      </button>
      <div className="coach-card" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <Avatar firstName={player.firstName} lastName={player.lastName} photoUrl={player.photoUrl} size={88} />
        <div style={{ flex: 1, minWidth: 180 }}>
          <h1 className="coach-title" style={{ margin: 0 }}>
            {player.firstName} {player.lastName}
          </h1>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" className={present ? "admin-btn-primary" : "admin-btn-ghost"} onClick={() => setPresent(true)} style={{ minHeight: 44 }}>
              Présente
            </button>
            <button type="button" className={!present ? "admin-btn-primary" : "admin-btn-ghost"} onClick={() => setPresent(false)} style={{ minHeight: 44 }}>
              Absente
            </button>
          </div>
        </div>
        {present && (
          <div style={{ textAlign: "right" }}>
            <p className="coach-card__label" style={{ margin: 0 }}>Note du match</p>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--adm-text)" }}>{note !== null ? note.toLocaleString("fr-CA") : "–"}<span style={{ fontSize: 16, color: "var(--adm-text-3)" }}>/10</span></p>
          </div>
        )}
      </div>

      {present ? (
        <>
          <div className="coach-card" style={{ marginTop: 12 }}>
            <label className="coach-card__label" htmlFor="poste">
              Poste joué
            </label>
            <select id="poste" className="admin-input" value={position} onChange={(e) => setPosition(e.target.value)} style={{ minHeight: 44, marginTop: 6 }}>
              <option value="">Choisir le poste</option>
              {Object.entries(POSITION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <p className="coach-sub" style={{ margin: "8px 0 0" }}>
              {families.map((f) => `${f.family} ${f.avg !== null ? `${f.avg.toLocaleString("fr-CA")}/5` : "–"}`).join(" · ")}
            </p>
          </div>

          {list.map((c, i) => (
            <div key={c.key} className="coach-card" style={{ marginTop: 12 }}>
              <p className="coach-card__label" style={{ margin: 0 }}>
                {i + 1}. {c.label} <span style={{ fontWeight: 400, color: "var(--adm-text-3)" }}>· {c.family}</span>
              </p>
              <p className="coach-sub" style={{ margin: "4px 0 10px" }}>{c.help}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                {SCALE.map((s) => {
                  const on = criteria[c.key] === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setCriteria((prev) => ({ ...prev, [c.key]: s.value }))}
                      style={{
                        minHeight: 52,
                        borderRadius: 8,
                        border: `2px solid ${on ? SCALE_COLOR[s.value - 1] : "var(--adm-line)"}`,
                        background: on ? "var(--adm-surface-2, var(--adm-surface))" : "var(--adm-surface)",
                        color: on ? SCALE_COLOR[s.value - 1] : "var(--adm-text-2)",
                        fontWeight: on ? 700 : 500,
                        cursor: "pointer",
                        padding: "4px 2px",
                        lineHeight: 1.2
                      }}
                    >
                      <span style={{ display: "block", fontSize: 18 }}>{s.value}</span>
                      <span style={{ display: "block", fontSize: 10 }}>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {[
            { id: "forts", label: "Points forts", value: strengths, set: setStrengths, ph: "Ce qu'elle a bien fait dans ce match." },
            { id: "travailler", label: "À travailler", value: toImprove, set: setToImprove, ph: "Le geste ou le comportement à travailler aux prochaines pratiques." },
            { id: "commentaire", label: "Commentaire", value: comment, set: setComment, ph: "Observation pour l'équipe d'éducateurs (moment clé, blessure, attitude…)." }
          ].map((f) => (
            <div key={f.id} className="coach-card" style={{ marginTop: 12 }}>
              <label className="coach-card__label" htmlFor={f.id}>
                {f.label}
              </label>
              <textarea id={f.id} className="admin-input" rows={3} value={f.value} placeholder={f.ph} onChange={(e) => f.set(e.target.value)} style={{ marginTop: 6, width: "100%" }} />
            </div>
          ))}
        </>
      ) : (
        <p className="coach-sub" style={{ marginTop: 16 }}>
          Absente : rien à remplir. Elle ne sera pas comptée dans ce match.
        </p>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", position: "sticky", bottom: 0, padding: "12px 0", background: "var(--adm-bg)" }}>
        <button type="button" className="admin-btn-primary" onClick={() => onSave({ ...sheet, at: Date.now() }, true)} style={{ minHeight: 48, flex: "1 1 200px" }}>
          {nextName ? `Enregistrer et passer à ${nextName}` : "Enregistrer"}
        </button>
        <button type="button" className="admin-btn-ghost" onClick={() => onSave({ ...sheet, at: Date.now() }, false)} style={{ minHeight: 48 }}>
          Enregistrer et revenir à la liste
        </button>
      </div>
      {present && !complete && <p className="coach-sub" style={{ margin: 0 }}>Il manque {10 - ratedCount(criteria)} point{10 - ratedCount(criteria) > 1 ? "s" : ""} ou un mot : tu peux enregistrer quand même et revenir plus tard.</p>}
    </div>
  );
}

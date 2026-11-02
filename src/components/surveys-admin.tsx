"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Family, SurveyQuestion } from "@/lib/surveys-repo";

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/sondages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Erreur");
  return json;
}

const Msg = ({ msg }: { msg: { ok: boolean; text: string } | null }) =>
  msg ? <p style={{ fontSize: "0.82rem", margin: "8px 0 0", color: msg.ok ? "var(--adm-good)" : "var(--adm-bad)" }}>{msg.text}</p> : null;

export function NewSurveyForm({ templates }: { templates: { kind: string; title: string; label: string; count: number }[] }) {
  const router = useRouter();
  const [kind, setKind] = useState(templates[0]?.kind ?? "mi-saison");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await post({ action: "create", kind });
          router.push(`/admin/sondages/${r.id}`);
        } catch (err) {
          setMsg({ ok: false, text: err instanceof Error ? err.message : "Erreur" });
          setBusy(false);
        }
      }}
    >
      <select className="admin-input" style={{ width: "auto", minWidth: 260 }} value={kind} onChange={(e) => setKind(e.target.value)}>
        {templates.map((t) => (
          <option key={t.kind} value={t.kind}>
            {t.label} — « {t.title} » ({t.count} questions)
          </option>
        ))}
      </select>
      <button className="admin-btn-primary" disabled={busy}>Créer le brouillon</button>
      <Msg msg={msg} />
    </form>
  );
}

const TYPES: { v: SurveyQuestion["type"]; l: string }[] = [
  { v: "note10", l: "Note sur 10" },
  { v: "echelle5", l: "Échelle de 1 à 5" },
  { v: "choix", l: "Un seul choix" },
  { v: "choix_multiple", l: "Plusieurs choix" },
  { v: "oui_non", l: "Oui / non" },
  { v: "texte", l: "Texte libre" }
];

/** Modifier le titre, l'introduction et les questions (tant que c'est un brouillon ou en tout temps pour le texte). */
export function SurveyEditor({ id, title, intro, questions, projectLabel, locked }: { id: string; title: string; intro: string; questions: SurveyQuestion[]; projectLabel: string | null; locked: boolean }) {
  const router = useRouter();
  const [t, setT] = useState(title);
  const [i, setI] = useState(intro);
  const [p, setP] = useState(projectLabel ?? "");
  const [qs, setQs] = useState<SurveyQuestion[]>(questions);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const upd = (idx: number, patch: Partial<SurveyQuestion>) => setQs(qs.map((q, k) => (k === idx ? { ...q, ...patch } : q)));
  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await post({ action: "update", id, title: t, intro: i, projectLabel: p || null, questions: locked ? undefined : qs });
      setMsg({ ok: true, text: "Enregistré." });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label className="mda-label" style={{ marginTop: 0 }}>Titre (objet du courriel)</label>
      <input className="admin-input" value={t} onChange={(e) => setT(e.target.value)} />
      <label className="mda-label">Introduction (dans le courriel et en haut du sondage)</label>
      <textarea className="admin-input" rows={3} value={i} onChange={(e) => setI(e.target.value)} />
      <label className="mda-label">Projet visé (pour un sondage d'intérêt : sert à retrouver les familles intéressées)</label>
      <input className="admin-input" value={p} onChange={(e) => setP(e.target.value)} placeholder="Ex. Camp spécialisé avec un club professionnel, été 2027" />
      <p className="mda-label" style={{ fontWeight: 600, color: "var(--adm-text)", marginTop: 12 }}>
        Questions {locked ? "(verrouillées : le sondage a déjà des réponses)" : ""}
      </p>
      {qs.map((q, idx) => (
        <div key={idx} style={{ padding: 12, borderRadius: 10, background: "var(--adm-surface-2)", display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span className="mda-muted mda-tnum" style={{ fontSize: "0.8rem" }}>{idx + 1}.</span>
            <input className="admin-input" style={{ flex: "1 1 260px" }} value={q.label} disabled={locked} onChange={(e) => upd(idx, { label: e.target.value })} />
            <select className="admin-input" style={{ width: "auto" }} value={q.type} disabled={locked} onChange={(e) => upd(idx, { type: e.target.value as SurveyQuestion["type"] })}>
              {TYPES.map((x) => (
                <option key={x.v} value={x.v}>
                  {x.l}
                </option>
              ))}
            </select>
          </div>
          {q.type === "choix" || q.type === "choix_multiple" ? (
            <input
              className="admin-input"
              disabled={locked}
              value={(q.options ?? []).join(" ; ")}
              placeholder="Choix séparés par ;"
              onChange={(e) => upd(idx, { options: e.target.value.split(";").map((x) => x.trim()).filter(Boolean) })}
            />
          ) : null}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: "0.8rem", color: "var(--adm-text-2)" }}>
            <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" disabled={locked} checked={!!q.required} onChange={(e) => upd(idx, { required: e.target.checked })} /> Obligatoire
            </label>
            {q.type === "note10" ? (
              <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <input type="checkbox" disabled={locked} checked={q.role === "recommandation"} onChange={(e) => upd(idx, { role: e.target.checked ? "recommandation" : undefined })} /> Compte comme note de recommandation
              </label>
            ) : null}
            {q.type === "choix" || q.type === "choix_multiple" || q.type === "oui_non" ? (
              <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <input type="checkbox" disabled={locked} checked={q.role === "interet"} onChange={(e) => upd(idx, { role: e.target.checked ? "interet" : undefined })} /> Classe les familles intéressées
              </label>
            ) : null}
            {!locked ? (
              <button type="button" className="mda-task-more" onClick={() => setQs(qs.filter((_, k) => k !== idx))}>
                Retirer
              </button>
            ) : null}
          </div>
        </div>
      ))}
      {!locked ? (
        <button type="button" className="admin-btn-ghost" style={{ justifySelf: "start" }} onClick={() => setQs([...qs, { id: `q${Date.now().toString(36)}`, type: "texte", label: "Nouvelle question" }])}>
          + Ajouter une question
        </button>
      ) : null}
      <div>
        <button type="button" className="admin-btn-primary" disabled={busy} onClick={save}>Enregistrer</button>
        <Msg msg={msg} />
      </div>
    </div>
  );
}

const AUDIENCES = [
  { v: "saison", l: "Saison filles en cours" },
  { v: "garcons", l: "Programmes garçons" },
  { v: "sport-etudes", l: "Sport-Études" },
  { v: "ete", l: "Familles de l'été 2026" }
];

/** Choisir les familles : on voit la liste complète (et on peut en retirer) avant de les ajouter. */
export function AudiencePicker({ id }: { id: string }) {
  const router = useRouter();
  const [aud, setAud] = useState<string[]>(["saison"]);
  const [families, setFamilies] = useState<Family[] | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const preview = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await post({ action: "audience", audience: aud });
      setFamilies(r.families);
      setExcluded(new Set());
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setBusy(false);
    }
  };
  const add = async () => {
    setBusy(true);
    try {
      const r = await post({ action: "add-invites", id, audience: aud, exclude: [...excluded] });
      setMsg({ ok: true, text: `${r.added} famille${r.added > 1 ? "s" : ""} ajoutée${r.added > 1 ? "s" : ""}. Rien n'est envoyé tant que vous n'appuyez pas sur « Envoyer ».` });
      setFamilies(null);
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {AUDIENCES.map((a) => (
          <label key={a.v} style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: "0.88rem", color: "var(--adm-text-2)" }}>
            <input type="checkbox" checked={aud.includes(a.v)} onChange={(e) => setAud(e.target.checked ? [...aud, a.v] : aud.filter((x) => x !== a.v))} /> {a.l}
          </label>
        ))}
      </div>
      <div>
        <button type="button" className="admin-btn-ghost" disabled={busy || aud.length === 0} onClick={preview}>Voir la liste des familles</button>
      </div>
      {families ? (
        <div style={{ border: "1px solid var(--adm-line)", borderRadius: 10, maxHeight: 360, overflow: "auto" }}>
          <p style={{ margin: 0, padding: "10px 12px", fontSize: "0.82rem", color: "var(--adm-text-2)", borderBottom: "1px solid var(--adm-line)", position: "sticky", top: 0, background: "var(--adm-surface)" }}>
            {families.length - excluded.size} famille{families.length - excluded.size > 1 ? "s" : ""} (un seul lien par famille, regroupé par courriel). Décochez celles à exclure.
          </p>
          {families.map((f) => (
            <label key={f.email} style={{ display: "flex", gap: 10, padding: "8px 12px", borderBottom: "1px solid var(--adm-line)", fontSize: "0.85rem", alignItems: "flex-start" }}>
              <input type="checkbox" checked={!excluded.has(f.email)} onChange={(e) => { const n = new Set(excluded); if (e.target.checked) n.delete(f.email); else n.add(f.email); setExcluded(n); }} />
              <span>
                <strong style={{ color: "var(--adm-text)" }}>{f.parentName ?? f.email}</strong>
                <span className="mda-muted"> · {f.playerNames.join(", ") || "—"} · {f.segment}</span>
                <span className="mda-muted" style={{ display: "block", fontSize: "0.78rem" }}>{f.email}</span>
              </span>
            </label>
          ))}
        </div>
      ) : null}
      {families ? (
        <div>
          <button type="button" className="admin-btn-primary" disabled={busy || families.length - excluded.size === 0} onClick={add}>
            Ajouter ces {families.length - excluded.size} familles au sondage
          </button>
        </div>
      ) : null}
      <Msg msg={msg} />
    </div>
  );
}

export function SendControls({ id, notSent, toRemind }: { id: string; notSent: number; toRemind: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const send = async (reminder: boolean, n: number) => {
    if (!confirm(reminder ? `Relancer ${n} famille(s) qui n'ont pas répondu ?` : `Envoyer le sondage par courriel à ${n} famille(s) ?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await post({ action: "send", id, reminder });
      setMsg({ ok: r.failed === 0, text: `${r.sent} courriel${r.sent > 1 ? "s" : ""} envoyé${r.sent > 1 ? "s" : ""}${r.failed ? `, ${r.failed} en échec` : ""}.` });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="admin-btn-primary" disabled={busy || notSent === 0} onClick={() => send(false, notSent)}>
          Envoyer à {notSent} famille{notSent > 1 ? "s" : ""}
        </button>
        <button type="button" className="admin-btn-ghost" disabled={busy || toRemind === 0} onClick={() => send(true, toRemind)}>
          Relancer les {toRemind} sans réponse
        </button>
      </div>
      <Msg msg={msg} />
    </div>
  );
}

export function SurveyStatusButton({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const next = status === "ferme" ? "envoye" : "ferme";
  return (
    <button
      type="button"
      className="admin-btn-ghost"
      disabled={busy || status === "brouillon"}
      onClick={async () => {
        setBusy(true);
        await post({ action: "update", id, status: next }).catch(() => null);
        router.refresh();
        setBusy(false);
      }}
    >
      {status === "ferme" ? "Rouvrir le sondage" : "Fermer le sondage"}
    </button>
  );
}

export function RemoveInviteButton({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="mda-task-more"
      onClick={async () => {
        if (!confirm("Retirer cette famille du sondage ?")) return;
        await post({ action: "remove-invite", inviteId }).catch(() => null);
        router.refresh();
      }}
    >
      Retirer
    </button>
  );
}

const FOLLOWUP = [
  { v: "aucun", l: "Rien à faire" },
  { v: "a_appeler", l: "À rappeler" },
  { v: "appele", l: "Appelée" },
  { v: "regle", l: "Réglé" }
];

export function FollowupForm({ responseId, status, note }: { responseId: string; status: string; note: string | null }) {
  const router = useRouter();
  const [s, setS] = useState(status);
  const [n, setN] = useState(note ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await post({ action: "followup", responseId, status: s, note: n || null });
          setMsg({ ok: true, text: "Suivi enregistré." });
          router.refresh();
        } catch (err) {
          setMsg({ ok: false, text: err instanceof Error ? err.message : "Erreur" });
        } finally {
          setBusy(false);
        }
      }}
    >
      <select className="admin-input" style={{ width: "auto" }} value={s} onChange={(e) => setS(e.target.value)}>
        {FOLLOWUP.map((f) => (
          <option key={f.v} value={f.v}>
            {f.l}
          </option>
        ))}
      </select>
      <input className="admin-input" style={{ flex: "1 1 220px" }} placeholder="Décision prise, ce qui a été dit…" value={n} onChange={(e) => setN(e.target.value)} />
      <button className="admin-btn-ghost" disabled={busy}>Enregistrer</button>
      <Msg msg={msg} />
    </form>
  );
}

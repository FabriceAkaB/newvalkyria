"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { categoryLabel, IDEA_CATEGORIES, IDEA_STATUS, MESSAGE_MAX, MESSAGE_MIN, statusOf } from "@/lib/idea-box-core";

/* ── Formulaire : site public et espace parent (thème foncé du site) ── */

const field: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "0.75rem 0.9rem", color: "#fff", fontSize: "1rem" };
const lab: React.CSSProperties = { display: "grid", gap: 6, fontSize: "0.85rem", color: "rgba(255,255,255,0.75)" };

export function IdeaForm({ askIdentity, players = [] }: { askIdentity: boolean; players?: string[] }) {
  const router = useRouter();
  const [f, setF] = useState({ category: "pratiques", message: "", authorName: "", authorEmail: "", playerName: players[0] ?? "", site: "" });
  const [state, setState] = useState<"idle" | "busy" | "ok">("idle");
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const send = async () => {
    setState("busy");
    setError(null);
    const res = await fetch("/api/idees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) }).catch(() => null);
    if (!res?.ok) {
      const data = await res?.json().catch(() => null);
      setError(data?.error ?? "Erreur, réessayez dans un instant.");
      setState("idle");
      return;
    }
    setState("ok");
    setF({ ...f, message: "" });
    router.refresh();
  };

  if (state === "ok") {
    return (
      <div style={{ display: "grid", gap: 10, textAlign: "center", padding: "1.4rem 0" }}>
        <p style={{ fontSize: "2.4rem", margin: 0 }}>💡</p>
        <p style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "#fff" }}>Merci ! Votre idée est bien reçue.</p>
        <p style={{ margin: 0, color: "rgba(255,255,255,0.7)" }}>L&apos;équipe la lit et vous répond{askIdentity ? " si vous avez laissé votre courriel" : " dans votre espace"}.</p>
        <button type="button" onClick={() => setState("idle")} style={{ justifySelf: "center", marginTop: 6, background: "none", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", borderRadius: 999, padding: "0.6rem 1.2rem", cursor: "pointer" }}>
          Proposer une autre idée
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <label style={lab}>
        Votre idée touche…
        <select style={field} value={f.category} onChange={set("category")}>
          {IDEA_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id} style={{ color: "#1d1730" }}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label style={lab}>
        Votre idée
        <textarea style={{ ...field, minHeight: 130, resize: "vertical" }} maxLength={MESSAGE_MAX} value={f.message} onChange={set("message")} placeholder="Ex. un tournoi entre les groupes avant Noël, une pratique de gardiennes de but, un horaire plus tôt le samedi…" />
      </label>
      {players.length > 0 ? (
        <label style={lab}>
          Pour quelle joueuse ? (facultatif)
          <select style={field} value={f.playerName} onChange={set("playerName")}>
            <option value="" style={{ color: "#1d1730" }}>Toute la famille</option>
            {players.map((p) => (
              <option key={p} value={p} style={{ color: "#1d1730" }}>
                {p}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {askIdentity ? (
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <label style={lab}>
            Votre nom (facultatif)
            <input style={field} value={f.authorName} onChange={set("authorName")} />
          </label>
          <label style={lab}>
            Votre courriel, pour recevoir notre réponse (facultatif)
            <input style={field} type="email" value={f.authorEmail} onChange={set("authorEmail")} />
          </label>
        </div>
      ) : null}
      {/* Piège à robots : invisible pour les personnes. */}
      <input tabIndex={-1} autoComplete="off" aria-hidden value={f.site} onChange={set("site")} style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} />
      <button
        type="button"
        disabled={state === "busy" || f.message.trim().length < MESSAGE_MIN}
        onClick={send}
        style={{ justifySelf: "start", background: "#8b5cf6", color: "#fff", border: "none", borderRadius: 999, padding: "0.85rem 1.6rem", fontWeight: 700, fontSize: "1rem", cursor: "pointer", opacity: f.message.trim().length < MESSAGE_MIN ? 0.5 : 1 }}
      >
        {state === "busy" ? "Envoi…" : "Envoyer mon idée"}
      </button>
      {error ? <p style={{ margin: 0, color: "#f4a3a3" }}>{error}</p> : null}
    </div>
  );
}

export function MyIdeas({ ideas }: { ideas: { id: string; category: string; message: string; status: string; response: string | null; created_at: string }[] }) {
  if (!ideas.length) return <p style={{ margin: 0, color: "rgba(255,255,255,0.6)" }}>Vous n&apos;avez pas encore proposé d&apos;idée.</p>;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {ideas.map((i) => (
        <div key={i.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "0.9rem 1rem", display: "grid", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: "0.8rem", color: "rgba(255,255,255,0.6)" }}>
            <span>
              {categoryLabel(i.category)} · {new Date(i.created_at).toLocaleDateString("fr-CA", { day: "numeric", month: "long" })}
            </span>
            <span style={{ fontWeight: 700, color: i.status === "realisee" || i.status === "retenue" ? "#7ee2a8" : "#fff" }}>{statusOf(i.status).family}</span>
          </div>
          <p style={{ margin: 0, color: "#fff", whiteSpace: "pre-line" }}>{i.message}</p>
          {i.response ? <p style={{ margin: 0, color: "rgba(255,255,255,0.8)", borderLeft: "3px solid #8b5cf6", paddingLeft: 10, whiteSpace: "pre-line" }}>{i.response}</p> : null}
        </div>
      ))}
    </div>
  );
}

/* ── Admin : lire, répondre, faire avancer ── */

export interface AdminIdea {
  id: string;
  source: string;
  author_name: string | null;
  author_email: string | null;
  player_name: string | null;
  category: string;
  message: string;
  status: string;
  response: string | null;
  shown_publicly: boolean;
  created_at: string;
}

export function AdminIdeas({ ideas }: { ideas: AdminIdea[] }) {
  const [filter, setFilter] = useState<string>("ouvertes");
  const shown = ideas.filter((i) => (filter === "ouvertes" ? ["nouvelle", "a_l_etude", "retenue"].includes(i.status) : filter === "toutes" ? true : i.status === filter));
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[{ id: "ouvertes", label: "À traiter" }, ...IDEA_STATUS.map((s) => ({ id: s.id, label: s.label })), { id: "toutes", label: "Toutes" }].map((b) => (
          <button key={b.id} type="button" className={filter === b.id ? "admin-btn-primary" : "admin-btn-ghost"} onClick={() => setFilter(b.id)}>
            {b.label} ({b.id === "ouvertes" ? ideas.filter((i) => ["nouvelle", "a_l_etude", "retenue"].includes(i.status)).length : b.id === "toutes" ? ideas.length : ideas.filter((i) => i.status === b.id).length})
          </button>
        ))}
      </div>
      {shown.length === 0 ? <p style={{ margin: 0, color: "var(--adm-text-2)" }}>Aucune idée ici.</p> : null}
      {shown.map((i) => (
        <AdminIdeaCard key={i.id} idea={i} />
      ))}
    </div>
  );
}

function AdminIdeaCard({ idea }: { idea: AdminIdea }) {
  const router = useRouter();
  const [response, setResponse] = useState(idea.response ?? "");
  const [notify, setNotify] = useState(Boolean(idea.author_email));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const save = async (patch: Record<string, unknown>) => {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/idees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: idea.id, ...patch }) }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) return setMsg(data?.error ?? "Erreur");
    setMsg(data?.notified ? "Enregistré et envoyé par courriel." : "Enregistré.");
    router.refresh();
  };
  return (
    <div className="mda-card" style={{ margin: 0, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: "0.8rem", color: "var(--adm-text-3)" }}>
        <span>
          {categoryLabel(idea.category)} · {new Date(idea.created_at).toLocaleDateString("fr-CA", { day: "numeric", month: "short" })} · {idea.source === "espace" ? "espace parent" : "site"}
          {idea.author_name ? ` · ${idea.author_name}` : " · anonyme"}
          {idea.player_name ? ` (${idea.player_name})` : ""}
          {idea.author_email ? ` · ${idea.author_email}` : ""}
        </span>
        <select className="admin-input" style={{ width: "auto" }} value={idea.status} disabled={busy} onChange={(e) => save({ status: e.target.value })}>
          {IDEA_STATUS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <p style={{ margin: 0, color: "var(--adm-text)", whiteSpace: "pre-line" }}>{idea.message}</p>
      <textarea className="admin-input" rows={2} placeholder="Votre réponse à l'auteur (visible dans son espace)" value={response} onChange={(e) => setResponse(e.target.value)} />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="admin-btn-primary" disabled={busy} onClick={() => save({ response, notify: notify && Boolean(idea.author_email) })}>
          Enregistrer la réponse
        </button>
        {idea.author_email ? (
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "0.82rem", color: "var(--adm-text-2)" }}>
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Envoyer aussi par courriel
          </label>
        ) : null}
        {idea.status === "retenue" || idea.status === "realisee" ? (
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "0.82rem", color: "var(--adm-text-2)" }}>
            <input type="checkbox" checked={idea.shown_publicly} disabled={busy} onChange={(e) => save({ shownPublicly: e.target.checked })} /> Montrer sur le site (« grâce à vous »)
          </label>
        ) : null}
        {msg ? <span style={{ fontSize: "0.8rem", color: "var(--adm-good)" }}>{msg}</span> : null}
      </div>
    </div>
  );
}

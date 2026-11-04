"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Item {
  id: string;
  fee: number;
  date: string;
  label: string;
  start: string;
  end: string | null;
  place: string;
  teams: string;
  format: string | null;
  left?: number;
  /** Double plage : 2 matchs de suite, le tarif des deux si l'arbitre les fait tous les deux. */
  doubleFee?: number | null;
}

const money = (c: number) => `${(c / 100).toLocaleString("fr-CA", { maximumFractionDigits: 2 })} $`;
const hour = (t: string) => t.replace(":", " h ");
const card: React.CSSProperties = { background: "#fff", borderRadius: 16, padding: "1rem 1.1rem", border: "1px solid #e6e0ee", marginTop: "0.8rem" };
const btn = (primary: boolean): React.CSSProperties => ({ minHeight: 44, padding: "0.6rem 1rem", borderRadius: 10, border: primary ? "none" : "2px solid #e0d8ea", background: primary ? "#5b2a86" : "#fff", color: primary ? "#fff" : "#1d1730", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer" });

/** Postes réservés et ouverts, avec réservation en un geste (gros boutons, utilisable au téléphone). */
export function RefereeBoard({ token, mine, open }: { token: string; mine: Item[]; open: Item[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const act = async (action: "reserve" | "withdraw", id: string) => {
    if (action === "withdraw" && !confirm("Vous retirer de ce match ?")) return;
    setBusy(id);
    setMsg(null);
    try {
      const res = await fetch(`/api/arbitres/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, assignmentId: id }) });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Erreur");
      setMsg({ ok: true, text: action === "reserve" ? "C'est réservé ! La confirmation est envoyée par courriel." : "Vous êtes retiré de ce match." });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Erreur" });
      router.refresh();
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      {msg ? <p style={{ ...card, background: msg.ok ? "#eef8f0" : "#fdeeee", color: msg.ok ? "#1e6b34" : "#b3261e", fontWeight: 600 }}>{msg.text}</p> : null}
      <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "1.4rem 0 0", color: "#1d1730" }}>Mes matchs · {mine.length}</h2>
      {mine.length === 0 ? <p style={{ color: "#6b6478", margin: "0.4rem 0 0" }}>Aucun match réservé.</p> : null}
      {mine.map((m) => (
        <div key={m.id} style={{ ...card, borderLeft: "4px solid #2e7d32" }}>
          <p style={{ margin: 0, fontWeight: 800, color: "#1d1730" }}>
            {m.label} · {hour(m.start)}
          </p>
          <p style={{ margin: "0.3rem 0 0", color: "#5d566b", lineHeight: 1.5 }}>
            Arrivée 30 min avant · {m.place}
            <br />
            {m.teams}
            {m.format ? ` · ${m.format}` : ""} · <strong>{money(m.fee)}</strong>
          </p>
          <button type="button" style={{ ...btn(false), marginTop: "0.7rem" }} disabled={busy === m.id} onClick={() => act("withdraw", m.id)}>
            Me retirer
          </button>
        </div>
      ))}
      <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "1.6rem 0 0", color: "#1d1730" }}>Matchs à arbitrer · {open.length}</h2>
      {open.length === 0 ? <p style={{ color: "#6b6478", margin: "0.4rem 0 0" }}>Aucun poste ouvert pour l&apos;instant. Vous recevrez un courriel quand de nouveaux matchs s&apos;ajoutent.</p> : null}
      {open.map((m) => (
        <div key={m.id} style={card}>
          <p style={{ margin: 0, fontWeight: 800, color: "#1d1730" }}>
            {m.label} · {hour(m.start)}
          </p>
          <p style={{ margin: "0.3rem 0 0", color: "#5d566b", lineHeight: 1.5 }}>
            {m.place}
            <br />
            {m.teams}
            {m.format ? ` · ${m.format}` : ""} · <strong>{money(m.fee)}</strong>
            {m.left && m.left > 1 ? ` · ${m.left} postes ouverts` : ""}
            {m.doubleFee ? <><br /><span style={{ color: "#5b2a86", fontWeight: 700 }}>Double plage : {money(m.doubleFee)} si vous arbitrez les 2 matchs de suite</span></> : null}
          </p>
          <button type="button" style={{ ...btn(true), marginTop: "0.7rem", width: "100%" }} disabled={busy === m.id} onClick={() => act("reserve", m.id)}>
            {busy === m.id ? "…" : "Réserver ce match"}
          </button>
        </div>
      ))}
    </>
  );
}

const input: React.CSSProperties = { width: "100%", minHeight: 44, borderRadius: 10, border: "2px solid #e0d8ea", padding: "0.6rem 0.8rem", fontSize: "1rem", color: "#1d1730", background: "#fff", boxSizing: "border-box" };

export function RefereeSignup() {
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", phone: "", level: "", interacEmail: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  if (done) return <p style={{ color: "#1e6b34", fontWeight: 700 }}>✓ Merci ! Votre inscription est reçue. Vous recevrez votre lien par courriel une fois approuvé.</p>;
  return (
    <form
      style={{ display: "grid", gap: 10 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const res = await fetch("/api/arbitres/inscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
          const json = await res.json().catch(() => null);
          if (!res.ok) throw new Error(json?.error ?? "Erreur");
          setDone(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Erreur");
        } finally {
          setBusy(false);
        }
      }}
    >
      <input style={input} placeholder="Prénom" value={f.firstName} onChange={set("firstName")} required autoComplete="given-name" />
      <input style={input} placeholder="Nom" value={f.lastName} onChange={set("lastName")} required autoComplete="family-name" />
      <input style={input} type="email" placeholder="Courriel" value={f.email} onChange={set("email")} required autoComplete="email" />
      <input style={input} type="tel" placeholder="Téléphone" value={f.phone} onChange={set("phone")} required autoComplete="tel" />
      <input style={input} placeholder="Niveau ou certification d'arbitre (facultatif)" value={f.level} onChange={set("level")} />
      <input style={input} type="email" placeholder="Courriel Interac pour le paiement (si différent)" value={f.interacEmail} onChange={set("interacEmail")} />
      <input type="text" name="website" value={f.website} onChange={set("website")} style={{ display: "none" }} tabIndex={-1} autoComplete="off" />
      {error ? <p style={{ color: "#b3261e", fontWeight: 600, margin: 0 }}>{error}</p> : null}
      <button type="submit" disabled={busy} style={{ minHeight: 52, borderRadius: 12, border: "none", background: "#5b2a86", color: "#fff", fontWeight: 800, fontSize: "1.05rem", cursor: "pointer" }}>
        {busy ? "Envoi…" : "M'inscrire comme arbitre"}
      </button>
    </form>
  );
}

/** « J'ai perdu mon lien » : l'arbitre déjà approuvé reçoit son lien personnel par courriel. */
export function RefereeLinkRequest() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (sent) return <p style={{ color: "#1e6b34", fontWeight: 700, margin: 0 }}>✓ Si ce courriel est celui d&apos;un arbitre approuvé, votre lien vient de vous être envoyé.</p>;
  return (
    <form
      style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const res = await fetch("/api/arbitres/lien", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
          if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Erreur");
          setSent(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Erreur");
        } finally {
          setBusy(false);
        }
      }}
    >
      <input style={{ ...input, flex: "1 1 220px", width: "auto" }} type="email" placeholder="Votre courriel" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      <button type="submit" disabled={busy} style={{ ...btn(true), flex: "0 0 auto" }}>
        {busy ? "Envoi…" : "Recevoir mon lien"}
      </button>
      {error ? <p style={{ color: "#b3261e", fontWeight: 600, margin: 0, width: "100%" }}>{error}</p> : null}
    </form>
  );
}

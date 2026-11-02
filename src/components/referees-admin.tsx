"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/arbitres", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Erreur");
  return json;
}

/** Bouton d'action : confirmation facultative, message de résultat, rafraîchissement de la page. */
const DONE = {
  opened: (r: any) => `${r.opened} poste(s) ouvert(s).`,
  sent: (r: any) => (r.openPositions ? `${r.sent} courriel(s) envoyé(s) · ${r.openPositions} poste(s) ouvert(s).` : "Aucun poste ouvert : rien envoyé.")
};

export function ActionButton({ body, label, confirmText, primary, done }: { body: Record<string, unknown>; label: string; confirmText?: string; primary?: boolean; done?: keyof typeof DONE }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <button
        type="button"
        className={primary ? "admin-btn-primary" : "admin-btn-ghost"}
        disabled={busy}
        onClick={async () => {
          if (confirmText && !confirm(confirmText)) return;
          setBusy(true);
          setMsg(null);
          try {
            const r = await post(body);
            setMsg(done ? { ok: true, text: DONE[done](r) } : null);
            router.refresh();
          } catch (err) {
            setMsg({ ok: false, text: err instanceof Error ? err.message : "Erreur" });
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "…" : label}
      </button>
      {msg ? <span style={{ fontSize: "0.78rem", color: msg.ok ? "var(--adm-good)" : "var(--adm-bad)" }}>{msg.text}</span> : null}
    </span>
  );
}

export function CopyLink({ url, label = "Copier le lien" }: { url: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="mda-task-more" onClick={() => navigator.clipboard.writeText(url).then(() => setOk(true))}>
      {ok ? "Lien copié ✓" : label}
    </button>
  );
}

export function AddRefereeForm() {
  const router = useRouter();
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", phone: "", level: "", interacEmail: "" });
  const [send, setSend] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      style={{ display: "grid", gap: 8 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        try {
          await post({ action: "add-referee", ...f, phone: f.phone || null, level: f.level || null, interacEmail: f.interacEmail || null, sendLink: send });
          setMsg({ ok: true, text: send ? "Arbitre ajouté : il a reçu son lien." : "Arbitre ajouté." });
          setF({ firstName: "", lastName: "", email: "", phone: "", level: "", interacEmail: "" });
          router.refresh();
        } catch (err) {
          setMsg({ ok: false, text: err instanceof Error ? err.message : "Erreur" });
        } finally {
          setBusy(false);
        }
      }}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input className="admin-input" style={{ flex: "1 1 140px" }} placeholder="Prénom" value={f.firstName} onChange={set("firstName")} required />
        <input className="admin-input" style={{ flex: "1 1 140px" }} placeholder="Nom" value={f.lastName} onChange={set("lastName")} required />
        <input className="admin-input" style={{ flex: "1 1 200px" }} type="email" placeholder="Courriel" value={f.email} onChange={set("email")} required />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input className="admin-input" style={{ flex: "1 1 140px" }} placeholder="Téléphone" value={f.phone} onChange={set("phone")} />
        <input className="admin-input" style={{ flex: "1 1 160px" }} placeholder="Niveau / certification" value={f.level} onChange={set("level")} />
        <input className="admin-input" style={{ flex: "1 1 200px" }} placeholder="Courriel Interac (si différent)" value={f.interacEmail} onChange={set("interacEmail")} />
      </div>
      <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
        <input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} /> Lui envoyer son lien personnel tout de suite
      </label>
      <div>
        <button className="admin-btn-primary" disabled={busy}>Ajouter l'arbitre</button>
      </div>
      {msg ? <p style={{ fontSize: "0.8rem", margin: 0, color: msg.ok ? "var(--adm-good)" : "var(--adm-bad)" }}>{msg.text}</p> : null}
    </form>
  );
}

const toCents = (s: string) => Math.round(Number(s.replace(",", ".").replace(/\s|\$/g, "")) * 100);

export function CostsForm({ slotId, refereesNeeded, refereeFeeCents, fieldCostCents, coachCostCents }: { slotId: string; refereesNeeded: number; refereeFeeCents: number; fieldCostCents: number; coachCostCents: number }) {
  const router = useRouter();
  const [n, setN] = useState(String(refereesNeeded));
  const [fee, setFee] = useState(String(refereeFeeCents / 100));
  const [field, setField] = useState(String(fieldCostCents / 100));
  const [coach, setCoach] = useState(String(coachCostCents / 100));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", fontSize: "0.8rem", color: "var(--adm-text-2)" }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await post({ action: "costs", slotId, refereesNeeded: Number(n), refereeFeeCents: toCents(fee), fieldCostCents: toCents(field), coachCostCents: toCents(coach) });
          setMsg("Enregistré.");
          router.refresh();
        } catch (err) {
          setMsg(err instanceof Error ? err.message : "Erreur");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label style={{ display: "grid", gap: 2 }}>Arbitres<input className="admin-input" style={{ width: 70 }} inputMode="numeric" value={n} onChange={(e) => setN(e.target.value)} /></label>
      <label style={{ display: "grid", gap: 2 }}>$ par arbitre<input className="admin-input" style={{ width: 90 }} inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} /></label>
      <label style={{ display: "grid", gap: 2 }}>Terrain ($)<input className="admin-input" style={{ width: 90 }} inputMode="decimal" value={field} onChange={(e) => setField(e.target.value)} /></label>
      <label style={{ display: "grid", gap: 2 }}>Éducateurs ($)<input className="admin-input" style={{ width: 90 }} inputMode="decimal" value={coach} onChange={(e) => setCoach(e.target.value)} /></label>
      <button className="admin-btn-ghost" disabled={busy}>Enregistrer</button>
      {msg ? <span>{msg}</span> : null}
    </form>
  );
}

export function PaidButton({ assignmentId, name, amount }: { assignmentId: string; name: string; amount: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="admin-btn-primary"
      style={{ padding: "6px 12px" }}
      disabled={busy}
      onClick={async () => {
        const note = prompt(`Virement de ${amount} à ${name} fait ? Note (ex. numéro de virement), facultative :`, "Virement Interac");
        if (note === null) return;
        setBusy(true);
        await post({ action: "paid", assignmentId, note: note || null }).catch((e) => alert(e.message));
        router.refresh();
        setBusy(false);
      }}
    >
      Payé
    </button>
  );
}

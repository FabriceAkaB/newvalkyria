"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/mandalart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Erreur");
  return json;
}

function useSubmit() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (body: Record<string, unknown>, okText: string, after?: () => void) => {
    setBusy(true);
    setMsg(null);
    try {
      await post(body);
      setMsg({ ok: true, text: okText });
      after?.();
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setBusy(false);
    }
  };
  return { busy, msg, run };
}

const Msg = ({ msg }: { msg: { ok: boolean; text: string } | null }) =>
  msg ? <p style={{ fontSize: "0.8rem", margin: "8px 0 0", color: msg.ok ? "var(--adm-good)" : "var(--adm-bad)" }}>{msg.text}</p> : null;

/** Ajouter une tâche à un objectif (code P1.3.X01…) : elle compte dans la progression comme les autres. */
export function AddTaskForm({ objective, defaultLevel }: { objective: string; defaultLevel: number }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState(defaultLevel);
  const [star, setStar] = useState(false);
  const [due, setDue] = useState("");
  const [owner, setOwner] = useState("JP");
  const { busy, msg, run } = useSubmit();
  if (!open)
    return (
      <button type="button" className="mda-task-more" style={{ padding: "12px 20px", display: "block" }} onClick={() => setOpen(true)}>
        + Ajouter une tâche à {objective}
      </button>
    );
  return (
    <form
      style={{ padding: "12px 20px 16px", borderTop: "1px solid var(--adm-line)", display: "grid", gap: 8 }}
      onSubmit={(e) => {
        e.preventDefault();
        run({ action: "add-task", objective, title, level, priority: star ? "star" : "progressive", due: due || null, owner: owner || null }, "Tâche ajoutée.", () => setTitle(""));
      }}
    >
      <input className="admin-input" placeholder="Ce qu'il faut faire" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select className="admin-input" style={{ width: "auto" }} value={level} onChange={(e) => setLevel(Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              Niveau {n}
            </option>
          ))}
        </select>
        <input className="admin-input" type="date" style={{ width: "auto" }} value={due} onChange={(e) => setDue(e.target.value)} aria-label="Échéance" />
        <input className="admin-input" style={{ width: 140 }} placeholder="Responsable" value={owner} onChange={(e) => setOwner(e.target.value)} />
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
          <input type="checkbox" checked={star} onChange={(e) => setStar(e.target.checked)} /> ⭐ priorité absolue
        </label>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="admin-btn-primary" disabled={busy}>Ajouter</button>
        <button type="button" className="admin-btn-ghost" onClick={() => setOpen(false)}>Fermer</button>
      </div>
      <Msg msg={msg} />
    </form>
  );
}

/** Saisie rapide d'un indicateur manuel. */
export function KpiEntryForm({ kpiId, unit }: { kpiId: string; unit: string }) {
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const { busy, msg, run } = useSubmit();
  return (
    <form
      style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(value.replace(/\s/g, "").replace(",", "."));
        if (!Number.isFinite(n)) return;
        run({ action: "kpi", kpiId, value: n, note: note || null }, "Valeur enregistrée.", () => {
          setValue("");
          setNote("");
        });
      }}
    >
      <input className="admin-input" style={{ width: 130 }} inputMode="decimal" placeholder={`Valeur${unit ? ` (${unit})` : ""}`} value={value} onChange={(e) => setValue(e.target.value)} required />
      <input className="admin-input" style={{ flex: "1 1 160px" }} placeholder="Note (facultatif)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="admin-btn-ghost" disabled={busy}>Enregistrer</button>
      <Msg msg={msg} />
    </form>
  );
}

const STATUS = [
  { v: "a_creer", l: "À créer" },
  { v: "en_construction", l: "En construction" },
  { v: "actif", l: "Actif" },
  { v: "pause", l: "En pause" }
];

/** État d'un agent IA ou d'une automatisation. */
export function AgentStateForm({ itemId, status, mode, hours, isAgent }: { itemId: string; status: string; mode: string | null; hours: number | null; isAgent: boolean }) {
  const [s, setS] = useState(status);
  const [m, setM] = useState(mode ?? "");
  const [h, setH] = useState(hours === null ? "" : String(hours));
  const { busy, msg, run } = useSubmit();
  return (
    <form
      style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
      onSubmit={(e) => {
        e.preventDefault();
        run({ action: "agent", itemId, status: s, mode: isAgent ? m || null : undefined, hoursSavedWeek: isAgent && h !== "" ? Number(h) : isAgent ? null : undefined }, "Enregistré.");
      }}
    >
      <select className="admin-input" style={{ width: "auto" }} value={s} onChange={(e) => setS(e.target.value)} aria-label="État">
        {STATUS.map((x) => (
          <option key={x.v} value={x.v}>
            {x.l}
          </option>
        ))}
      </select>
      {isAgent ? (
        <>
          <select className="admin-input" style={{ width: "auto" }} value={m} onChange={(e) => setM(e.target.value)} aria-label="Mode">
            <option value="">Mode…</option>
            <option value="assistant">Assistant</option>
            <option value="semi-automatique">Semi-automatique</option>
            <option value="autonome">Autonome sur règles</option>
          </select>
          <input className="admin-input" style={{ width: 120 }} inputMode="decimal" placeholder="Heures sauvées / sem." value={h} onChange={(e) => setH(e.target.value)} />
        </>
      ) : null}
      <button className="admin-btn-ghost" disabled={busy}>Enregistrer</button>
      <Msg msg={msg} />
    </form>
  );
}

const CHANNELS = [
  { id: "instagram", label: "Instagram", ads: false },
  { id: "facebook", label: "Facebook", ads: false },
  { id: "youtube", label: "YouTube", ads: false },
  { id: "tiktok", label: "TikTok", ads: false },
  { id: "pub_meta", label: "Publicité Meta", ads: true },
  { id: "pub_google", label: "Publicité Google", ads: true }
];

/** Saisie des chiffres d'un réseau social ou d'une campagne de publicité. */
export function ChannelStatForm() {
  const [channel, setChannel] = useState("instagram");
  const [f, setF] = useState({ followers: "", posts: "", views: "", spend: "", leads: "", note: "" });
  const { busy, msg, run } = useSubmit();
  const ads = CHANNELS.find((c) => c.id === channel)?.ads;
  const num = (s: string) => (s.trim() === "" ? null : Math.round(Number(s.replace(/\s/g, "").replace(",", "."))));
  return (
    <form
      style={{ display: "grid", gap: 8 }}
      onSubmit={(e) => {
        e.preventDefault();
        run(
          { action: "channel", channel, followers: num(f.followers), posts: num(f.posts), views: num(f.views), spendCents: f.spend ? Math.round(Number(f.spend.replace(",", ".")) * 100) : null, leads: num(f.leads), note: f.note || null },
          "Chiffres enregistrés.",
          () => setF({ followers: "", posts: "", views: "", spend: "", leads: "", note: "" })
        );
      }}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select className="admin-input" style={{ width: "auto" }} value={channel} onChange={(e) => setChannel(e.target.value)}>
          {CHANNELS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        {!ads ? <input className="admin-input" style={{ width: 120 }} inputMode="numeric" placeholder="Abonnés" value={f.followers} onChange={(e) => setF({ ...f, followers: e.target.value })} /> : null}
        <input className="admin-input" style={{ width: 150 }} inputMode="numeric" placeholder={ads ? "Annonces actives" : "Publications (2 sem.)"} value={f.posts} onChange={(e) => setF({ ...f, posts: e.target.value })} />
        <input className="admin-input" style={{ width: 120 }} inputMode="numeric" placeholder="Vues" value={f.views} onChange={(e) => setF({ ...f, views: e.target.value })} />
        {ads ? <input className="admin-input" style={{ width: 120 }} inputMode="decimal" placeholder="Dépensé ($)" value={f.spend} onChange={(e) => setF({ ...f, spend: e.target.value })} /> : null}
        <input className="admin-input" style={{ width: 150 }} inputMode="numeric" placeholder="Contacts / essais" value={f.leads} onChange={(e) => setF({ ...f, leads: e.target.value })} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input className="admin-input" style={{ flex: "1 1 220px" }} placeholder="Note (ex. vidéo avant-après très vue)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        <button className="admin-btn-primary" disabled={busy}>Enregistrer</button>
      </div>
      <Msg msg={msg} />
    </form>
  );
}

/** Argent à rattraper (ex. « charges avancées par JP ») : s'ajoute à l'écart du plan. */
export function RecoveryForm() {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const { busy, msg, run } = useSubmit();
  return (
    <form
      style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
      onSubmit={(e) => {
        e.preventDefault();
        const cents = Math.round(Number(amount.replace(/\s|\$/g, "").replace(",", ".")) * 100);
        if (!cents) return;
        run({ action: "recovery-add", label, amountCents: cents }, "Ajouté : le plan en tient compte.", () => {
          setLabel("");
          setAmount("");
        });
      }}
    >
      <input className="admin-input" style={{ flex: "1 1 240px" }} placeholder="Ex. 3 mois de charges avancés par JP" value={label} onChange={(e) => setLabel(e.target.value)} required minLength={2} />
      <input className="admin-input" style={{ width: 130 }} inputMode="decimal" placeholder="Montant ($)" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      <button className="admin-btn-ghost" disabled={busy}>Ajouter</button>
      <Msg msg={msg} />
    </form>
  );
}

export function ResolveRecoveryButton({ id }: { id: string }) {
  const { busy, run } = useSubmit();
  return (
    <button type="button" className="mda-task-more" disabled={busy} onClick={() => confirm("Marquer cet argent comme rattrapé ?") && run({ action: "recovery-resolve", id }, "Rattrapé.")}>
      Rattrapé ✓
    </button>
  );
}

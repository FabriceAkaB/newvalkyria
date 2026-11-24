"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ACQUISITION_SOURCES, sourceDef, type AcqTable, type AcquisitionSource } from "@/lib/acquisition-core";

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/acquisition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Erreur");
  return json;
}

/** JP choisit d'où vient une famille déjà inscrite (la réponse d'un parent n'est jamais écrasée). */
export function SetSourceForm({ refs, familyLabel }: { refs: { table: AcqTable; id: string }[]; familyLabel: string }) {
  const router = useRouter();
  const [source, setSource] = useState<AcquisitionSource | "">("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const def = sourceDef(source);
  return (
    <form
      style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!source) return;
        setBusy(true);
        setErr(null);
        try {
          const res = await post({ action: "set-source", refs, source, detail: detail.trim() || null, familyLabel });
          // 0 ligne : le parent a répondu entre-temps (sa réponse n'est jamais remplacée).
          if (!res?.updated) setErr("Cette famille a déjà une source.");
          router.refresh();
        } catch (error) {
          setErr(error instanceof Error ? error.message : "Erreur");
        } finally {
          setBusy(false);
        }
      }}
    >
      <select
        className="admin-input"
        aria-label={`D'où vient ${familyLabel}`}
        value={source}
        onChange={(e) => setSource(e.target.value as AcquisitionSource | "")}
        style={{ minHeight: 44, flex: "1 1 200px", maxWidth: 280 }}
      >
        <option value="">D&apos;où vient cette famille ?</option>
        {ACQUISITION_SOURCES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.short}
          </option>
        ))}
      </select>
      {def?.detail ? (
        <input
          className="admin-input"
          value={detail}
          maxLength={200}
          placeholder={def.detail.options ? def.detail.options.join(", ") : def.id === "parrainage" ? "Code ou famille qui parraine" : "Précision (facultatif)"}
          onChange={(e) => setDetail(e.target.value)}
          style={{ minHeight: 44, flex: "1 1 180px", maxWidth: 260 }}
        />
      ) : null}
      <button type="submit" className="admin-btn-ghost" disabled={!source || busy} style={{ minHeight: 44 }}>
        {busy ? "…" : "Enregistrer"}
      </button>
      {err ? <span style={{ fontSize: "0.78rem", color: "var(--adm-bad)" }}>{err}</span> : null}
    </form>
  );
}

/** Ajoute l'entreprise d'une famille au suivi des commanditaires (statut « Prospect »). */
export function AddSponsorButton({ business }: { business: { businessName: string; parentName: string; parentEmail: string; parentPhone: string | null; players: string[] } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
      <button
        type="button"
        className="admin-btn-ghost"
        disabled={busy || msg?.ok}
        style={{ minHeight: 44, whiteSpace: "nowrap" }}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            await post({ action: "add-sponsor", ...business });
            setMsg({ ok: true, text: "Ajoutée aux commanditaires (Prospect)." });
            router.refresh();
          } catch (error) {
            setMsg({ ok: false, text: error instanceof Error ? error.message : "Erreur" });
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "…" : "Ajouter aux commanditaires"}
      </button>
      {msg ? <span style={{ fontSize: "0.78rem", color: msg.ok ? "var(--adm-good)" : "var(--adm-bad)" }}>{msg.text}</span> : null}
    </span>
  );
}

/** Objectifs d'acquisition (P3.8.20) : prospects reçus hors du site (message Instagram, appel, kiosque), par canal. */
export function ManualProspectsForm({ today }: { today: string }) {
  const router = useRouter();
  const [dayIso, setDay] = useState(today);
  const [source, setSource] = useState<AcquisitionSource | "">("");
  const [count, setCount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const n = Number(count);
  return (
    <form
      style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!Number.isInteger(n) || n < 1) return;
        setBusy(true);
        setMsg(null);
        try {
          await post({ action: "manual-prospects", day: dayIso, source: source || null, count: n, note: note.trim() || null });
          setMsg({ ok: true, text: `${n} prospect${n > 1 ? "s" : ""} noté${n > 1 ? "s" : ""}.` });
          setCount("");
          setNote("");
          router.refresh();
        } catch (error) {
          setMsg({ ok: false, text: error instanceof Error ? error.message : "Erreur" });
        } finally {
          setBusy(false);
        }
      }}
    >
      <input className="admin-input" type="date" aria-label="Jour" value={dayIso} max={today} onChange={(e) => setDay(e.target.value)} style={{ minHeight: 44, flex: "0 0 150px" }} />
      <select className="admin-input" aria-label="Canal" value={source} onChange={(e) => setSource(e.target.value as AcquisitionSource | "")} style={{ minHeight: 44, flex: "1 1 170px", maxWidth: 240 }}>
        <option value="">Canal (facultatif)</option>
        {ACQUISITION_SOURCES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.short}
          </option>
        ))}
      </select>
      <input className="admin-input" type="number" inputMode="numeric" min={1} max={500} aria-label="Nombre de prospects" placeholder="Nombre" value={count} onChange={(e) => setCount(e.target.value)} style={{ minHeight: 44, flex: "0 0 100px" }} />
      <input className="admin-input" aria-label="Précision" placeholder="ex. messages Instagram, kiosque école" maxLength={160} value={note} onChange={(e) => setNote(e.target.value)} style={{ minHeight: 44, flex: "1 1 200px" }} />
      <button type="submit" className="admin-btn-ghost" disabled={busy || !Number.isInteger(n) || n < 1} style={{ minHeight: 44 }}>
        {busy ? "…" : "Noter"}
      </button>
      {msg ? <span style={{ fontSize: "0.78rem", color: msg.ok ? "var(--adm-good)" : "var(--adm-bad)" }}>{msg.text}</span> : null}
    </form>
  );
}

/** Total d'avis Google de la fiche, noté chaque lundi (indicateur avis_google_total du Mandalart). */
export function GoogleReviewsForm({ today, last }: { today: string; last: number | null }) {
  const router = useRouter();
  const [total, setTotal] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const n = Number(total);
  const valid = total !== "" && Number.isInteger(n) && n >= 0;
  return (
    <form
      style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid) return;
        setBusy(true);
        setMsg(null);
        try {
          await post({ action: "google-reviews", day: today, total: n });
          setMsg({ ok: true, text: "Total noté." });
          setTotal("");
          router.refresh();
        } catch (error) {
          setMsg({ ok: false, text: error instanceof Error ? error.message : "Erreur" });
        } finally {
          setBusy(false);
        }
      }}
    >
      <input
        className="admin-input"
        type="number"
        inputMode="numeric"
        min={0}
        aria-label="Total d'avis Google aujourd'hui"
        placeholder={last === null ? "Total d'avis aujourd'hui" : `Total aujourd'hui (dernier : ${last})`}
        value={total}
        onChange={(e) => setTotal(e.target.value)}
        style={{ minHeight: 44, flex: "1 1 220px", maxWidth: 280 }}
      />
      <button type="submit" className="admin-btn-ghost" disabled={busy || !valid} style={{ minHeight: 44 }}>
        {busy ? "…" : "Noter le total"}
      </button>
      {msg ? <span style={{ fontSize: "0.78rem", color: msg.ok ? "var(--adm-good)" : "var(--adm-bad)" }}>{msg.text}</span> : null}
    </form>
  );
}

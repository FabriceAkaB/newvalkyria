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

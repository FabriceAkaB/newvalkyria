"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";

import { RULE_OF_TWO_ITEMS, RULE_OF_TWO_TITLE } from "@/lib/rule-of-two";

const when = (iso: string) => new Date(iso).toLocaleString("fr-CA", { timeZone: "America/Toronto", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Mon dossier : la règle de deux (P8.3.01), lue puis signée par l'éducateur (nom tapé, date, IP). */
export function CoachRuleOfTwo({ signed, expectedName }: { signed: { name: string; at: string } | null; expectedName: string }) {
  const [done, setDone] = useState(signed);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sign = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/coach/regle-de-deux", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }).catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    setBusy(false);
    if (res?.ok) setDone({ name: name.trim(), at: json?.signedAt ?? new Date().toISOString() });
    else setError(json?.error ?? "Pas enregistré : réessaie.");
  };

  return (
    <div className="coach-card" style={{ marginTop: 16 }}>
      <p className="coach-card__label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <ShieldCheck size={15} strokeWidth={1.75} aria-hidden /> {RULE_OF_TWO_TITLE}
      </p>
      <p className="coach-sub" style={{ marginTop: 0 }}>
        Pour protéger les joueuses et te protéger toi aussi : un adulte n&apos;est jamais seul avec une mineure.
      </p>
      <ol style={{ margin: "12px 0 0", paddingLeft: 20, display: "grid", gap: 8 }}>
        {RULE_OF_TWO_ITEMS.map((it) => (
          <li key={it.title} className="coach-sub" style={{ margin: 0 }}>
            <strong style={{ color: "var(--adm-text)" }}>{it.title}.</strong> {it.text}
          </li>
        ))}
      </ol>
      {done ? (
        <p className="coach-ok" style={{ margin: "14px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
          <ShieldCheck size={16} strokeWidth={2} aria-hidden /> Engagement signé par {done.name}, le {when(done.at)}.
        </p>
      ) : (
        <div className="coach-field">
          <label className="coach-field__label" htmlFor="regle-de-deux-nom">
            Ta signature <span>ton nom complet : {expectedName}</span>
          </label>
          <input
            id="regle-de-deux-nom"
            className="coach-time"
            style={{ width: "100%" }}
            value={name}
            autoComplete="name"
            maxLength={120}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder={expectedName}
          />
          <button type="button" className="coach-primary" style={{ marginTop: 10 }} disabled={busy || name.trim().length < 3} onClick={sign}>
            {busy ? "Enregistrement…" : "J'ai lu et je m'engage"}
          </button>
          <p className="coach-muted" style={{ margin: "8px 0 0" }}>Ton nom, la date et l&apos;adresse IP sont gardés comme signature électronique. JP voit qui a signé.</p>
          {error ? <p className="coach-error" role="alert">{error}</p> : null}
        </div>
      )}
    </div>
  );
}

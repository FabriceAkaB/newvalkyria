"use client";

import { useState } from "react";

import { frTime, type PickupOption } from "@/lib/shop-pickup-core";

/** Choix de la séance de remise d'une commande de la boutique, et case « C'est un cadeau » (lien personnel du parent). */

const frDay = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return d.charAt(0).toUpperCase() + d.slice(1);
};

export function ShopPickupChoice({
  token,
  options,
  initialKey,
  initialGift,
  initialWhen
}: {
  token: string;
  options: PickupOption[];
  initialKey: string | null;
  initialGift: boolean;
  /** Séance déjà choisie (texte), même si elle n'est plus dans la liste. */
  initialWhen: string | null;
}) {
  const [key, setKey] = useState<string | null>(initialKey);
  const [gift, setGift] = useState(initialGift);
  const [saved, setSaved] = useState<{ key: string | null; gift: boolean; when: string } | null>(initialWhen ? { key: initialKey, gift: initialGift, when: initialWhen } : null);
  const [editing, setEditing] = useState(!initialWhen);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!key) return setError("Choisissez une séance.");
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/remise/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, isGift: gift }) }).catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    setBusy(false);
    if (!res?.ok) return setError(json?.error ?? "Le choix n'est pas passé. Réessayez dans un instant.");
    const o = options.find((x) => x.key === key);
    setSaved({ key, gift, when: `${json.when}${o ? ` · ${o.group}${o.location ? ` · ${o.location}` : ""}` : ""}` });
    setEditing(false);
  };

  if (saved && !editing) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ background: "#eef8f1", border: "1px solid #cfe9d8", borderRadius: 12, padding: "14px 16px" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#1f6b3a" }}>C&apos;est noté : votre colis sera prêt</p>
          <p style={{ margin: "4px 0 0", color: "#1d1730" }}>{saved.when.charAt(0).toUpperCase() + saved.when.slice(1)}</p>
        </div>
        <p style={{ margin: 0, color: "#3d3650", lineHeight: 1.6 }}>
          {saved.gift
            ? "C'est un cadeau : présentez-vous au responsable sur le terrain en lui disant votre nom. Il vous remettra le colis discrètement, sans que la joueuse le voie."
            : "Présentez-vous au responsable sur le terrain en lui disant votre nom : il vous remettra votre colis."}
        </p>
        <p style={{ margin: 0, color: "#6b6478", fontSize: ".9rem" }}>Un courriel de rappel vous a été envoyé.</p>
        {options.length > 0 && (
          <button type="button" onClick={() => setEditing(true)} style={{ justifySelf: "start", background: "#fff", color: "#3b1d5e", border: "1px solid #cfc5dd", borderRadius: 10, padding: "10px 16px", fontWeight: 600, cursor: "pointer", minHeight: 44 }}>
            Changer de séance
          </button>
        )}
      </div>
    );
  }

  if (options.length === 0) {
    return <p style={{ margin: 0, color: "#3d3650", lineHeight: 1.6 }}>Aucune séance n&apos;est prévue dans les deux prochaines semaines. Nous vous écrirons pour convenir de la remise.</p>;
  }

  const days = Array.from(new Set(options.map((o) => o.date)));
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <fieldset style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: 14 }}>
        <legend style={{ fontWeight: 700, marginBottom: 8, color: "#1d1730" }}>Quand passerez-vous le récupérer ?</legend>
        {days.map((d) => (
          <div key={d} style={{ display: "grid", gap: 8 }}>
            <p style={{ margin: 0, fontSize: ".85rem", fontWeight: 700, color: "#5b2a86" }}>{frDay(d)}</p>
            {options
              .filter((o) => o.date === d)
              .map((o) => {
                const on = key === o.key;
                return (
                  <label
                    key={o.key}
                    style={{ display: "flex", gap: 12, alignItems: "flex-start", border: on ? "2px solid #5b2a86" : "1px solid #e6e0ee", background: on ? "#f6f0fc" : "#fff", borderRadius: 12, padding: on ? "11px 13px" : "12px 14px", cursor: "pointer", minHeight: 44 }}
                  >
                    <input type="radio" name="seance" checked={on} onChange={() => setKey(o.key)} style={{ marginTop: 4, accentColor: "#5b2a86" }} />
                    <span>
                      <strong style={{ color: "#1d1730" }}>{frTime(o.start)}{o.end ? ` à ${frTime(o.end)}` : ""}</strong>
                      <span style={{ display: "block", color: "#5d566b", fontSize: ".92rem" }}>{o.group}{o.location ? ` · ${o.location}` : ""}</span>
                    </span>
                  </label>
                );
              })}
          </div>
        ))}
      </fieldset>

      <label style={{ display: "flex", gap: 12, alignItems: "flex-start", border: "1px solid #e6e0ee", background: gift ? "#fbf7ff" : "#fff", borderRadius: 12, padding: "12px 14px", cursor: "pointer" }}>
        <input type="checkbox" checked={gift} onChange={(e) => setGift(e.target.checked)} style={{ marginTop: 4, accentColor: "#5b2a86", width: 18, height: 18 }} />
        <span>
          <strong style={{ color: "#1d1730" }}>C&apos;est un cadeau (remise discrète)</strong>
          <span style={{ display: "block", color: "#5d566b", fontSize: ".92rem", lineHeight: 1.5 }}>
            Vous irez voir le responsable sur le terrain ce jour-là : il vous remettra le colis discrètement, pas devant la joueuse.
          </span>
        </span>
      </label>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" disabled={busy || !key} onClick={save} style={{ background: "#5b2a86", color: "#fff", border: 0, borderRadius: 12, padding: "14px 20px", fontSize: "1.02rem", fontWeight: 700, cursor: busy || !key ? "default" : "pointer", opacity: busy || !key ? 0.6 : 1, minHeight: 48, flex: "1 1 220px" }}>
          {busy ? "Enregistrement…" : "Confirmer cette séance"}
        </button>
        {saved && (
          <button type="button" onClick={() => { setKey(saved.key); setGift(saved.gift); setEditing(false); }} style={{ background: "#fff", color: "#3b1d5e", border: "1px solid #cfc5dd", borderRadius: 12, padding: "14px 20px", fontWeight: 600, cursor: "pointer", minHeight: 48 }}>
            Annuler
          </button>
        )}
      </div>
      {error && <p role="alert" style={{ margin: 0, color: "#a3261b" }}>{error}</p>}
    </div>
  );
}

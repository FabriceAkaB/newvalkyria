"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { Pill } from "@/components/mandalart/ui";
import type { InventoryCategory, InventoryCondition } from "@/lib/inventory-repo";

/** Inventaire du matériel (/admin/inventaire) : ajout rapide au téléphone, quantité en un geste,
 *  modification, « remplacé », retrait. Tout passe par /api/admin/inventaire puis router.refresh(). */

export interface CategoryOption {
  value: InventoryCategory;
  label: string;
  lifespanMonths: number;
  example: string;
}
export interface ConditionOption {
  value: InventoryCondition;
  label: string;
}

/** Article tel que la page serveur le passe. */
export interface ItemView {
  id: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  location: string | null;
  assignedTo: string | null;
  condition: InventoryCondition;
  purchasedOn: string | null;
  unitCostCents: number | null;
  /** Durée de vie propre à l'article (null = celle de la catégorie). */
  customLifespan: number | null;
  notes: string | null;
}

export interface ReplacementView {
  label: string;
  reason: string;
  due: boolean;
}

interface Shared {
  categories: CategoryOption[];
  conditions: ConditionOption[];
  locations: string[];
  assignees: string[];
}

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/inventaire", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Erreur : réessayez dans un instant.");
  return json;
}

const toCents = (s: string): number | null => {
  const t = s.replace(",", ".").replace(/\s|\$/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};
const centsToInput = (c: number | null) => (c === null ? "" : String(c / 100).replace(".", ","));

const CONDITION_TONE: Record<InventoryCondition, "good" | "warn" | "bad" | undefined> = { neuf: "good", bon: undefined, use: "warn", a_remplacer: "bad" };

// ───────────── Petits éléments de formulaire ─────────────

/** 44 px de haut et 16 px de texte : pas de zoom automatique sur iPhone. */
const inputStyle: React.CSSProperties = { width: "100%", minHeight: 44, padding: "10px 12px", fontSize: "1rem", boxSizing: "border-box" };
const tapStyle: React.CSSProperties = { minHeight: 44 };

function Field({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6, alignContent: "start", gridColumn: wide ? "1 / -1" : undefined }}>
      <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--adm-text-2)" }}>{label}</span>
      {children}
      {hint ? <span style={{ fontSize: "0.75rem", color: "var(--adm-text-3)", lineHeight: 1.4 }}>{hint}</span> : null}
    </label>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
      <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--adm-text-2)" }}>{label}</span>
      <div role="radiogroup" aria-label={label} style={{ display: "flex", gap: 4, padding: 4, background: "var(--adm-surface-2)", border: "1px solid var(--adm-border)", borderRadius: 10 }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              style={{
                flex: "1 1 0",
                minHeight: 36,
                borderRadius: 7,
                border: "none",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: on ? 600 : 500,
                background: on ? "var(--adm-surface-3)" : "transparent",
                color: on ? "var(--adm-text)" : "var(--adm-text-2)",
                boxShadow: on ? "0 1px 2px rgba(0,0,0,0.35)" : "none"
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Message({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <p role="status" style={{ margin: 0, fontSize: "0.82rem", color: msg.ok ? "var(--adm-good)" : "var(--adm-bad)" }}>
      {msg.text}
    </p>
  );
}

// ───────────── Champs d'un article ─────────────

interface Draft {
  name: string;
  category: InventoryCategory;
  quantity: string;
  location: string;
  assignedTo: string;
  condition: InventoryCondition;
  purchasedOn: string;
  unitCost: string;
  lifespan: string;
  notes: string;
}

const emptyDraft = (keep?: Partial<Draft>): Draft => ({
  name: "",
  category: "ballons",
  quantity: "1",
  location: "",
  assignedTo: "",
  condition: "neuf",
  purchasedOn: "",
  unitCost: "",
  lifespan: "",
  notes: "",
  ...keep
});

const draftFrom = (i: ItemView): Draft => ({
  name: i.name,
  category: i.category,
  quantity: String(i.quantity),
  location: i.location ?? "",
  assignedTo: i.assignedTo ?? "",
  condition: i.condition,
  purchasedOn: i.purchasedOn ?? "",
  unitCost: centsToInput(i.unitCostCents),
  lifespan: i.customLifespan ? String(i.customLifespan) : "",
  notes: i.notes ?? ""
});

const digits = (s: string) => s.replace(/\s/g, "");

/** Champ rempli mais illisible : on le dit au lieu d'enregistrer 0 ou rien. */
function draftError(d: Draft): string | null {
  if (!d.name.trim()) return "Donnez un nom à l'article.";
  if (!/^\d+$/.test(digits(d.quantity))) return "Quantité : un nombre entier, ex. 20.";
  if (d.unitCost.trim() && toCents(d.unitCost) === null) return "Coût unitaire illisible : écrivez seulement le nombre, ex. 32,50.";
  const life = digits(d.lifespan);
  if (life && (!/^\d+$/.test(life) || Number(life) < 1 || Number(life) > 240)) return "Durée de vie : un nombre de mois entre 1 et 240.";
  return null;
}

function payload(d: Draft) {
  const quantity = Number(digits(d.quantity)) || 0;
  const lifespan = Number(digits(d.lifespan));
  return {
    name: d.name.trim(),
    category: d.category,
    quantity,
    location: d.location.trim() || null,
    assignedTo: d.assignedTo.trim() || null,
    condition: d.condition,
    purchasedOn: d.purchasedOn || null,
    unitCostCents: toCents(d.unitCost),
    lifespanMonths: d.lifespan && lifespan >= 1 && lifespan <= 240 ? lifespan : null,
    notes: d.notes.trim() || null
  };
}

function ItemFields({ draft, setDraft, shared, nameRef }: { draft: Draft; setDraft: (d: Draft) => void; shared: Shared; nameRef?: React.Ref<HTMLInputElement> }) {
  const uid = useId();
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setDraft({ ...draft, [k]: e.target.value });
  const cat = shared.categories.find((c) => c.value === draft.category);
  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
      <Field label="Article">
        <input ref={nameRef} className="admin-input" style={inputStyle} value={draft.name} onChange={set("name")} placeholder={cat?.example ?? "Ballons taille 4"} required maxLength={120} autoComplete="off" />
      </Field>
      <Field label="Catégorie">
        <select className="admin-input" style={inputStyle} value={draft.category} onChange={set("category")}>
          {shared.categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Quantité">
        <input className="admin-input" style={inputStyle} inputMode="numeric" pattern="[0-9]*" value={draft.quantity} onChange={set("quantity")} required />
      </Field>
      <Field label="Emplacement ou site">
        <input className="admin-input" style={inputStyle} value={draft.location} onChange={set("location")} placeholder="Ex. Gymnase Chambéry, remise" list={`${uid}-loc`} maxLength={120} autoComplete="off" />
        <datalist id={`${uid}-loc`}>
          {shared.locations.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </Field>
      <Field label="Confié à">
        <input className="admin-input" style={inputStyle} value={draft.assignedTo} onChange={set("assignedTo")} placeholder="Éducateur ou responsable" list={`${uid}-who`} maxLength={120} autoComplete="off" />
        <datalist id={`${uid}-who`}>
          {shared.assignees.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </Field>
      <Segmented label="État" value={draft.condition} options={shared.conditions} onChange={(v) => setDraft({ ...draft, condition: v })} />
      <Field label="Date d'achat" hint="Laisser vide si inconnue : l'année de remplacement sera estimée selon l'état.">
        <input className="admin-input" style={inputStyle} type="date" value={draft.purchasedOn} onChange={set("purchasedOn")} />
      </Field>
      <Field label="Coût unitaire ($)">
        <input className="admin-input" style={inputStyle} inputMode="decimal" value={draft.unitCost} onChange={set("unitCost")} placeholder="Ex. 32,50" />
      </Field>
      <Field label="Durée de vie (mois)" hint={`Vide = ${cat?.lifespanMonths ?? 36} mois, la durée habituelle pour : ${cat?.label.toLowerCase() ?? "cette catégorie"}.`}>
        <input className="admin-input" style={inputStyle} inputMode="numeric" pattern="[0-9]*" value={draft.lifespan} onChange={set("lifespan")} placeholder={String(cat?.lifespanMonths ?? 36)} />
      </Field>
      <Field label="Note" wide>
        <input className="admin-input" style={inputStyle} value={draft.notes} onChange={set("notes")} placeholder="Facultatif : marque, couleur, numéro de facture…" maxLength={1000} />
      </Field>
    </div>
  );
}

// ───────────── Ajout rapide ─────────────

export function InventoryAddForm({ startOpen, ...shared }: Shared & { startOpen: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  if (!open) {
    return (
      <section className="mda-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: "1 1 240px" }}>
          <h2 className="mda-h2">Ajouter du matériel</h2>
          <p className="mda-sub" style={{ margin: 0 }}>
            Une ligne par lot : même article, même état, même endroit.
          </p>
        </div>
        <button
          type="button"
          className="admin-btn-primary"
          style={tapStyle}
          onClick={() => {
            setOpen(true);
            setTimeout(() => nameRef.current?.focus(), 0);
          }}
        >
          Ajouter du matériel
        </button>
        <Message msg={msg} />
      </section>
    );
  }

  return (
    <section className="mda-card">
      <form
        style={{ display: "grid", gap: 16 }}
        onSubmit={async (e) => {
          e.preventDefault();
          const problem = draftError(draft);
          if (problem) return setMsg({ ok: false, text: problem });
          const p = payload(draft);
          setBusy(true);
          setMsg(null);
          try {
            await post({ action: "item-add", ...p });
            setMsg({ ok: true, text: `Ajouté : ${p.quantity} × ${p.name}. Vous pouvez enchaîner avec le suivant.` });
            // On garde l'endroit, la catégorie, l'état et la date : on ajoute souvent plusieurs lots du même coup.
            setDraft(emptyDraft({ category: draft.category, location: draft.location, assignedTo: draft.assignedTo, condition: draft.condition, purchasedOn: draft.purchasedOn }));
            nameRef.current?.focus();
            router.refresh();
          } catch (err) {
            setMsg({ ok: false, text: err instanceof Error ? err.message : "Erreur" });
          } finally {
            setBusy(false);
          }
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h2 className="mda-h2" style={{ margin: 0 }}>
            Ajouter du matériel
          </h2>
          <span style={{ fontSize: "0.8rem", color: "var(--adm-text-3)" }}>Une ligne par lot : même article, même état, même endroit.</span>
        </div>
        <ItemFields draft={draft} setDraft={setDraft} shared={shared} nameRef={nameRef} />
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className="admin-btn-primary" style={tapStyle} disabled={busy}>
            {busy ? "Ajout…" : "Ajouter à l'inventaire"}
          </button>
          <button type="button" className="admin-btn-ghost" style={tapStyle} onClick={() => setOpen(false)}>
            Fermer
          </button>
        </div>
        <Message msg={msg} />
      </form>
    </section>
  );
}

// ───────────── Quantité en un geste ─────────────

/** − et + : la quantité change tout de suite à l'écran, l'enregistrement part quand on arrête de toucher. */
export function QtyStepper({ id, quantity, name }: { id: string; quantity: number; name: string }) {
  const router = useRouter();
  const [q, setQ] = useState(quantity);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pending = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pending.current === 0) setQ(quantity);
  }, [quantity]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const flush = async () => {
    timer.current = null;
    const delta = pending.current;
    pending.current = 0;
    if (!delta) return;
    setSaving(true);
    try {
      const r = await post({ action: "item-qty", id, delta });
      setQ(r.quantity + pending.current);
      setErr(null);
      router.refresh();
    } catch (e) {
      setQ((x) => x - delta);
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };
  const bump = (d: number) => {
    if (q + d < 0) return;
    setQ(q + d);
    pending.current += d;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  };
  const btn: React.CSSProperties = { width: 44, height: 44, border: "none", background: "transparent", color: "var(--adm-text)", fontSize: "1.25rem", lineHeight: 1, cursor: "pointer" };
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <span
        style={{ display: "inline-flex", alignItems: "center", background: "var(--adm-surface-2)", border: "1px solid var(--adm-border)", borderRadius: 10, opacity: saving ? 0.85 : 1 }}
        aria-label={`Quantité de ${name}`}
      >
        <button type="button" style={{ ...btn, opacity: q === 0 ? 0.35 : 1 }} onClick={() => bump(-1)} disabled={q === 0} aria-label={`Retirer un ${name}`}>
          −
        </button>
        <span className="mda-tnum" aria-live="polite" style={{ minWidth: 40, textAlign: "center", fontWeight: 600, fontSize: "1rem" }}>
          {q}
        </span>
        <button type="button" style={btn} onClick={() => bump(1)} aria-label={`Ajouter un ${name}`}>
          +
        </button>
      </span>
      {err ? <span style={{ fontSize: "0.75rem", color: "var(--adm-bad)" }}>{err}</span> : null}
    </span>
  );
}

// ───────────── Une ligne de l'inventaire ─────────────

export function InventoryItemRow({ item, replacement, unitCostLabel, conditionLabel, ...shared }: Shared & { item: ItemView; replacement: ReplacementView; unitCostLabel: string | null; conditionLabel: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(item));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (body: Record<string, unknown>, done: string, close = true) => {
    setBusy(true);
    setMsg(null);
    try {
      await post(body);
      setMsg({ ok: true, text: done });
      if (close) setEditing(false);
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <li id={`i-${item.id}`} className="mda-task" style={{ display: "block", scrollMarginTop: 96 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <p className="mda-task-title" style={{ fontWeight: 600 }}>
            {item.name}
          </p>
          <div className="mda-task-meta">
            <Pill tone={CONDITION_TONE[item.condition]}>{conditionLabel}</Pill>
            <span>{item.location ?? "Emplacement à préciser"}</span>
            {item.assignedTo ? <span>Confié à {item.assignedTo}</span> : null}
            <span style={replacement.due ? { color: "var(--adm-bad)", fontWeight: 600 } : undefined}>{replacement.label}</span>
            {unitCostLabel ? <span>{unitCostLabel}</span> : null}
          </div>
          {/* Date d'achat et durée de vie à la vue, aussi au téléphone (pas d'infobulle au toucher). */}
          <p className="mda-muted" style={{ margin: "4px 0 0", fontSize: "0.78rem" }}>
            {replacement.reason}
          </p>
        </div>
        <span style={{ display: "inline-flex", gap: 8, alignItems: "flex-start" }}>
          <QtyStepper id={item.id} quantity={item.quantity} name={item.name} />
          <button
            type="button"
            className="admin-btn-ghost"
            style={tapStyle}
            aria-expanded={editing}
            onClick={() => {
              setDraft(draftFrom(item));
              setEditing(!editing);
              setMsg(null);
            }}
          >
            {editing ? "Fermer" : "Modifier"}
          </button>
        </span>
      </div>
      {!editing ? <Message msg={msg} /> : null}
      {editing ? (
        <form
          style={{ display: "grid", gap: 16, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--adm-line)" }}
          onSubmit={(e) => {
            e.preventDefault();
            const problem = draftError(draft);
            if (problem) return setMsg({ ok: false, text: problem });
            void run({ action: "item-update", id: item.id, ...payload(draft) }, "Enregistré.");
          }}
        >
          <ItemFields draft={draft} setDraft={setDraft} shared={shared} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button className="admin-btn-primary" style={tapStyle} disabled={busy}>
              Enregistrer
            </button>
            <ReplacedButton id={item.id} name={item.name} quantity={item.quantity} unitCostCents={item.unitCostCents} />
            <button
              type="button"
              className="admin-btn-ghost"
              style={{ ...tapStyle, color: "var(--adm-bad)" }}
              disabled={busy}
              onClick={() => {
                if (!confirm(`Retirer « ${item.name} » de l'inventaire (perdu, jeté ou donné) ?`)) return;
                void run({ action: "item-archive", id: item.id }, "Retiré de l'inventaire.");
              }}
            >
              Retirer de l’inventaire
            </button>
          </div>
          <Message msg={msg} />
        </form>
      ) : null}
    </li>
  );
}

// ───────────── Remplacé ─────────────

/** Le lot a été racheté : il redevient neuf, acheté aujourd'hui, au nouveau prix s'il est donné. */
export function ReplacedButton({ id, name, quantity, unitCostCents, primary }: { id: string; name: string; quantity: number; unitCostCents: number | null; primary?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
      <button
        type="button"
        className={primary ? "admin-btn-primary" : "admin-btn-ghost"}
        style={tapStyle}
        disabled={busy}
        onClick={async () => {
          const v = prompt(`${quantity} × ${name} remplacés aujourd'hui ?\nCoût unitaire payé ($), facultatif :`, centsToInput(unitCostCents));
          if (v === null) return;
          setBusy(true);
          setErr(null);
          try {
            await post({ action: "item-replaced", id, unitCostCents: toCents(v) });
            router.refresh();
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Erreur");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "…" : "Remplacé"}
      </button>
      {err ? <span style={{ fontSize: "0.75rem", color: "var(--adm-bad)" }}>{err}</span> : null}
    </span>
  );
}

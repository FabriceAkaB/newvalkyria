"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import type { AmountPeriod, ContractKind, ContractOrigin, ContractSource, ContractState, RenewalMode } from "@/lib/contracts-registry";

/** Registre des contrats (/admin/registre-contrats) : renouvelé, non renouvelé, précisions d'un contrat
 *  existant, contrat saisi à la main. Tout passe par /api/admin/inventaire (contrôle des dépenses, P7.6). */

export interface ContractView {
  key: string;
  registryId: string | null;
  source: ContractSource | null;
  sourceId: string | null;
  kind: ContractKind;
  title: string;
  supplier: string | null;
  startDate: string | null;
  endDate: string | null;
  effectiveEnd: string | null;
  renewal: RenewalMode;
  noticeDays: number | null;
  /** Alerte propre au contrat (null = 90 jours, 60 pour une commandite). */
  customAlertDays: number | null;
  amountCents: number | null;
  amountPeriod: AmountPeriod;
  notes: string | null;
  state: ContractState;
  status: "actif" | "termine";
  /** Terminé par une décision notée dans le registre : peut être remis dans le suivi. */
  reopenable: boolean;
  origin: ContractOrigin | null;
  href: string | null;
}

export interface Option<T extends string> {
  value: T;
  label: string;
}
export interface Options {
  kinds: Option<ContractKind>[];
  renewals: Option<RenewalMode>[];
  periods: Option<AmountPeriod>[];
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
const intOrNull = (s: string) => {
  const t = s.replace(/\s/g, "");
  return /^\d+$/.test(t) ? Number(t) : null;
};

function addYear(iso: string | null): string {
  const base = iso ?? new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const [y, m, d] = base.split("-").map(Number);
  const last = new Date(Date.UTC(y + 1, m, 0)).getUTCDate();
  return `${y + 1}-${String(m).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

const refOf = (c: Pick<ContractView, "registryId" | "source" | "sourceId">) => (c.source ? { sourceType: c.source, sourceId: c.sourceId } : { id: c.registryId });

const inputStyle: React.CSSProperties = { width: "100%", minHeight: 44, padding: "10px 12px", fontSize: "1rem", boxSizing: "border-box" };
const tap: React.CSSProperties = { minHeight: 44 };

function Field({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6, alignContent: "start", gridColumn: wide ? "1 / -1" : undefined }}>
      <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--adm-text-2)" }}>{label}</span>
      {children}
      {hint ? <span style={{ fontSize: "0.75rem", color: "var(--adm-text-3)", lineHeight: 1.4 }}>{hint}</span> : null}
    </label>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Option<T>[]; onChange: (v: T) => void }) {
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

// ───────────── Formulaire d'un contrat ─────────────

interface Draft {
  kind: ContractKind;
  title: string;
  supplier: string;
  startDate: string;
  endDate: string;
  renewal: RenewalMode;
  noticeDays: string;
  alertDays: string;
  amount: string;
  amountPeriod: AmountPeriod;
  notes: string;
}

export interface Preset {
  kind: ContractKind;
  title: string;
  renewal: RenewalMode;
  amountPeriod: AmountPeriod;
}

const blankDraft = (p?: Partial<Draft>): Draft => ({
  kind: "assurance",
  title: "",
  supplier: "",
  startDate: "",
  endDate: "",
  renewal: "manuel",
  noticeDays: "",
  alertDays: "",
  amount: "",
  amountPeriod: "total",
  notes: "",
  ...p
});

const draftOf = (c: ContractView): Draft => ({
  kind: c.kind,
  title: c.title,
  supplier: c.supplier ?? "",
  startDate: c.startDate ?? "",
  endDate: c.endDate ?? "",
  renewal: c.renewal,
  noticeDays: c.noticeDays === null ? "" : String(c.noticeDays),
  alertDays: c.customAlertDays === null ? "" : String(c.customAlertDays),
  amount: centsToInput(c.amountCents),
  amountPeriod: c.amountPeriod,
  notes: c.notes ?? ""
});

/** Champ rempli mais illisible : on le dit au lieu de l'ignorer. */
function draftError(d: Draft, manual: boolean): string | null {
  if (manual && !d.title.trim()) return "Donnez un nom au contrat.";
  if (d.amount.trim() && toCents(d.amount) === null) return "Montant illisible : écrivez seulement le nombre, ex. 1 250,50.";
  if (d.noticeDays.trim() && intOrNull(d.noticeDays) === null) return "Préavis : un nombre de jours, ex. 30.";
  if (d.alertDays.trim() && !intOrNull(d.alertDays)) return "Alerte : un nombre de jours d’au moins 1, ex. 90.";
  if (d.startDate && d.endDate && d.startDate > d.endDate) return "La date de fin est avant la date de début.";
  return null;
}

/** Corps envoyé : pour un contrat relié, une valeur identique au contrat d'origine n'est pas recopiée
 *  (si le contrat d'origine change, le registre suit). */
function contractBody(d: Draft, origin: ContractOrigin | null, manual: boolean) {
  const same = (v: string, o: string | null) => origin !== null && v === (o ?? "");
  const amountCents = toCents(d.amount);
  return {
    kind: d.kind,
    title: manual ? d.title.trim() : null,
    supplier: same(d.supplier.trim(), origin?.supplier ?? null) ? null : d.supplier.trim() || null,
    startDate: same(d.startDate, origin?.startDate ?? null) ? null : d.startDate || null,
    endDate: same(d.endDate, origin?.endDate ?? null) ? null : d.endDate || null,
    renewal: d.renewal,
    noticeDays: intOrNull(d.noticeDays),
    alertDays: intOrNull(d.alertDays),
    // Le montant d'origine est toujours « pour la durée du contrat » : changer seulement la période l'enregistre aussi.
    amountCents: origin && amountCents === origin.amountCents && d.amountPeriod === "total" ? null : amountCents,
    amountPeriod: d.amountPeriod,
    notes: d.notes.trim() || null
  };
}

function ContractFields({ draft, setDraft, options, manual, titleRef }: { draft: Draft; setDraft: (d: Draft) => void; options: Options; manual: boolean; titleRef?: React.Ref<HTMLInputElement> }) {
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft({ ...draft, [k]: e.target.value });
  const defaultAlert = draft.kind === "commandite" ? 60 : 90;
  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
      {manual ? (
        <>
          <Field label="Contrat">
            <input ref={titleRef} className="admin-input" style={inputStyle} value={draft.title} onChange={set("title")} placeholder="Ex. Assurance responsabilité civile" maxLength={160} required />
          </Field>
          <Field label="Type">
            <select className="admin-input" style={inputStyle} value={draft.kind} onChange={set("kind")}>
              {options.kinds.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </Field>
        </>
      ) : null}
      <Field label={draft.kind === "commandite" ? "Commanditaire" : "Fournisseur ou autre partie"}>
        <input className="admin-input" style={inputStyle} value={draft.supplier} onChange={set("supplier")} placeholder="Ex. Intact Assurance" maxLength={160} />
      </Field>
      <Field label="Début">
        <input className="admin-input" style={inputStyle} type="date" value={draft.startDate} onChange={set("startDate")} />
      </Field>
      <Field label="Fin" hint={draft.renewal === "automatique" ? "La date du prochain renouvellement. Un abonnement au mois reste dans « À venir »." : "La date qui déclenche l'alerte."}>
        <input className="admin-input" style={inputStyle} type="date" value={draft.endDate} onChange={set("endDate")} />
      </Field>
      <Segmented label="À la fin du contrat" value={draft.renewal} options={options.renewals} onChange={(v) => setDraft({ ...draft, renewal: v })} />
      <Field label="Préavis (jours)" hint={draft.renewal === "automatique" ? "Délai pour annuler avant le renouvellement automatique." : "Si le contrat exige un avis avant la fin."}>
        <input className="admin-input" style={inputStyle} inputMode="numeric" pattern="[0-9]*" value={draft.noticeDays} onChange={set("noticeDays")} placeholder="Aucun" />
      </Field>
      <Field label="Alerte (jours avant l'échéance)" hint={`Vide = ${defaultAlert} jours.`}>
        <input className="admin-input" style={inputStyle} inputMode="numeric" pattern="[0-9]*" value={draft.alertDays} onChange={set("alertDays")} placeholder={String(defaultAlert)} />
      </Field>
      <Field label="Montant ($)">
        <input className="admin-input" style={inputStyle} inputMode="decimal" value={draft.amount} onChange={set("amount")} placeholder="Ex. 1 250" />
      </Field>
      <Field label="Le montant est">
        <select className="admin-input" style={inputStyle} value={draft.amountPeriod} onChange={set("amountPeriod")}>
          {options.periods.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Note" wide>
        <input className="admin-input" style={inputStyle} value={draft.notes} onChange={set("notes")} placeholder="Numéro de police, conditions, personne-ressource…" maxLength={1000} />
      </Field>
    </div>
  );
}

// ───────────── Actions d'une ligne ─────────────

/** Boutons d'un contrat : renouvelé, ne pas renouveler, modifier (ou confirmer les dates), remettre dans le suivi. */
export function ContractActions({ c, options, decide, editLabel = "Modifier" }: { c: ContractView; options: Options; decide?: boolean; editLabel?: string }) {
  const router = useRouter();
  const [panel, setPanel] = useState<"renew" | "edit" | null>(null);
  const [newEnd, setNewEnd] = useState(() => addYear(c.effectiveEnd));
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState<Draft>(() => draftOf(c));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const manual = c.source === null;

  const run = async (body: Record<string, unknown>, done: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await post(body);
      setMsg({ ok: true, text: done });
      setPanel(null);
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setBusy(false);
    }
  };
  const toggle = (p: "renew" | "edit") => {
    setMsg(null);
    if (p === "edit") setDraft(draftOf(c));
    setPanel(panel === p ? null : p);
  };

  return (
    <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {c.status === "termine" ? (
          c.reopenable ? (
            <button type="button" className="admin-btn-ghost" style={tap} disabled={busy} onClick={() => run({ action: "contract-reopen", ref: refOf(c), kind: c.kind }, "Remis dans le suivi.")}>
              Remettre dans le suivi
            </button>
          ) : null
        ) : (
          <>
            {decide || c.state !== "sans-date" ? (
              <button type="button" className="admin-btn-ghost" style={{ ...tap, ...(panel === "renew" ? { borderColor: "var(--adm-accent)" } : {}) }} aria-expanded={panel === "renew"} onClick={() => toggle("renew")}>
                Renouvelé
              </button>
            ) : null}
            {decide ? (
              <button
                type="button"
                className="admin-btn-ghost"
                style={tap}
                disabled={busy}
                onClick={() => {
                  const why = prompt(`Ne pas renouveler « ${c.title} » ? Il sortira des alertes.\nRaison (facultative) :`, "");
                  if (why === null) return;
                  void run({ action: "contract-end", ref: refOf(c), kind: c.kind, note: why.trim() ? `Non renouvelé : ${why.trim()}` : null }, "Noté : non renouvelé.");
                }}
              >
                Ne pas renouveler
              </button>
            ) : null}
          </>
        )}
        <button type="button" className="admin-btn-ghost" style={{ ...tap, ...(panel === "edit" ? { borderColor: "var(--adm-accent)" } : {}) }} aria-expanded={panel === "edit"} onClick={() => toggle("edit")}>
          {editLabel}
        </button>
        {c.href ? (
          <a href={c.href} style={{ fontSize: "0.82rem", color: "var(--adm-text-3)", padding: "12px 4px", textUnderlineOffset: 2 }}>
            Contrat d’origine
          </a>
        ) : null}
      </div>

      {panel === "renew" ? (
        <form
          style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", alignItems: "end", padding: 16, borderRadius: 10, background: "var(--adm-surface-2)" }}
          onSubmit={(e) => {
            e.preventDefault();
            void run({ action: "contract-renew", ref: refOf(c), kind: c.kind, previousEnd: c.effectiveEnd, newEnd, note: note.trim() || null }, "Renouvellement noté.");
          }}
        >
          <Field label="Nouvelle date de fin">
            <input className="admin-input" style={inputStyle} type="date" value={newEnd} min={c.effectiveEnd ?? undefined} onChange={(e) => setNewEnd(e.target.value)} required />
          </Field>
          <Field label="Note (facultative)">
            <input className="admin-input" style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. même prix, signé le 12 nov." maxLength={300} />
          </Field>
          <div>
            <button className="admin-btn-ghost" style={{ ...tap, width: "100%" }} disabled={busy}>
              {busy ? "…" : "Enregistrer le renouvellement"}
            </button>
          </div>
        </form>
      ) : null}

      {panel === "edit" ? (
        <form
          style={{ display: "grid", gap: 16, padding: 16, borderRadius: 10, background: "var(--adm-surface-2)" }}
          onSubmit={(e) => {
            e.preventDefault();
            const problem = draftError(draft, manual);
            if (problem) return setMsg({ ok: false, text: problem });
            void run({ action: "contract-save", ref: refOf(c), contract: contractBody(draft, c.origin, manual) }, "Enregistré.");
          }}
        >
          {!manual ? (
            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--adm-text-3)" }}>
              Ces précisions s’ajoutent au contrat d’origine sans le modifier. Une valeur laissée telle quelle suit le contrat d’origine.
            </p>
          ) : null}
          <ContractFields draft={draft} setDraft={setDraft} options={options} manual={manual} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="admin-btn-ghost" style={{ ...tap, borderColor: "var(--adm-accent)" }} disabled={busy}>
              {busy ? "…" : "Enregistrer"}
            </button>
            {c.registryId ? (
              <button
                type="button"
                className="admin-btn-ghost"
                style={{ ...tap, color: "var(--adm-bad)" }}
                disabled={busy}
                onClick={() => {
                  const q = manual ? `Supprimer « ${c.title} » du registre ?` : `Effacer les précisions et décisions notées pour « ${c.title} » ? Il reprendra les valeurs du contrat d'origine.`;
                  if (!confirm(q)) return;
                  void run({ action: "contract-delete", id: c.registryId }, manual ? "Supprimé." : "Précisions effacées.");
                }}
              >
                {manual ? "Supprimer ce contrat" : "Revenir au contrat d'origine"}
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
      <Message msg={msg} />
    </div>
  );
}

// ───────────── Ajouter un contrat ─────────────

export function AddContract({ options, presets }: { options: Options; presets: Preset[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(blankDraft());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const start = (p?: Preset) => {
    setDraft(blankDraft(p ? { kind: p.kind, title: p.title, renewal: p.renewal, amountPeriod: p.amountPeriod } : undefined));
    setOpen(true);
    setMsg(null);
    setTimeout(() => titleRef.current?.focus(), 0);
  };

  return (
    <section className="mda-card" aria-labelledby="ajouter">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: "1 1 260px" }}>
          <h2 className="mda-h2" id="ajouter">
            Ajouter un contrat
          </h2>
          <p className="mda-sub" style={{ margin: 0 }}>
            Assurances, logiciels, fournisseurs : tout ce qui n’est pas déjà dans le site. Les gymnases, l’embauche et les commandites s’ajoutent tout seuls.
          </p>
        </div>
        {!open ? (
          <button type="button" className="admin-btn-primary" style={tap} onClick={() => start()}>
            Ajouter un contrat
          </button>
        ) : null}
      </div>

      {!open && presets.length ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
          {presets.map((p) => (
            <button key={p.title} type="button" className="mda-pill" style={{ minHeight: 44, padding: "0 16px", border: "1px dashed var(--adm-border)", cursor: "pointer", alignSelf: "center" }} onClick={() => start(p)}>
              + {p.title}
            </button>
          ))}
        </div>
      ) : null}

      {open ? (
        <form
          style={{ display: "grid", gap: 16, marginTop: 16 }}
          onSubmit={async (e) => {
            e.preventDefault();
            const problem = draftError(draft, true);
            if (problem) return setMsg({ ok: false, text: problem });
            setBusy(true);
            setMsg(null);
            try {
              await post({ action: "contract-save", ref: {}, contract: contractBody(draft, null, true) });
              setMsg({ ok: true, text: `Ajouté : ${draft.title.trim()}.` });
              setDraft(blankDraft({ kind: draft.kind }));
              setOpen(false);
              router.refresh();
            } catch (err) {
              setMsg({ ok: false, text: err instanceof Error ? err.message : "Erreur" });
            } finally {
              setBusy(false);
            }
          }}
        >
          <ContractFields draft={draft} setDraft={setDraft} options={options} manual titleRef={titleRef} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="admin-btn-primary" style={tap} disabled={busy}>
              {busy ? "Ajout…" : "Ajouter au registre"}
            </button>
            <button type="button" className="admin-btn-ghost" style={tap} onClick={() => setOpen(false)}>
              Annuler
            </button>
          </div>
        </form>
      ) : null}
      <div style={{ marginTop: msg ? 12 : 0 }}>
        <Message msg={msg} />
      </div>
    </section>
  );
}

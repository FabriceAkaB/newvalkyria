"use client";

import { Copy, Plus, Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ANSWERS, answerLabel, deadlineLabel, money, type OfferStatus, type Tally, type TournamentAnswer, type TournamentSettings } from "@/lib/tournaments-core";

/** Admin des tournois (JP, 25 nov. 2026) : créer, régler, voir qui est intéressée, disponible, pas cette fois,
 *  sans réponse ou payée, donner le go, retirer une place. Rôle admin seulement (il y a de l'argent). */

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/tournois", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const data = await res?.json().catch(() => null);
  if (!res?.ok) throw new Error(data?.error ?? "Erreur");
  return data;
}

const dollars = (c: number) => (c ? String(Math.round(c / 100)) : "");
const cents = (v: string) => Math.max(0, Math.round(Number(v.replace(",", ".")) * 100) || 0);

export function NewTournament() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open)
    return (
      <div>
        <button type="button" className="admin-btn-primary" onClick={() => setOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Plus size={16} aria-hidden /> Nouveau tournoi
        </button>
      </div>
    );
  return (
    <form
      className="mda-card"
      style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const { slug } = await post({ action: "creer", name });
          router.push(`/admin/tournois/${slug}`);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Erreur");
          setBusy(false);
        }
      }}
    >
      <label style={{ flex: "1 1 280px", display: "grid", gap: 4, fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
        Nom du tournoi et de l&apos;équipe
        <input className="admin-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Family Day Cup 2027 · 2015 AV" autoFocus />
      </label>
      <button type="submit" className="admin-btn-primary" disabled={busy || !name.trim()}>{busy ? "Création…" : "Créer en brouillon"}</button>
      <button type="button" className="admin-btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
      {error ? <p style={{ color: "var(--adm-bad)", margin: 0, width: "100%" }}>{error}</p> : null}
    </form>
  );
}

interface Row {
  key: string;
  firstName: string;
  lastName: string;
  birthYear: number | null;
  parentName: string;
  parentEmail: string;
  inRoster: boolean;
  response: { id: string; answer: TournamentAnswer; source: string; respondedAt: string; offerStatus: OfferStatus | null; payDeadline: string | null } | null;
}

type Group = "payee" | "offerte" | "disponible" | "interessee" | "pas_cette_fois" | "aucune";
const GROUPS: { key: Group; label: string; tone?: string }[] = [
  { key: "payee", label: "Payées", tone: "good" },
  { key: "offerte", label: "Place offerte, paiement attendu", tone: "accent" },
  { key: "disponible", label: "Disponibles", tone: "accent" },
  { key: "interessee", label: "Intéressées" },
  { key: "pas_cette_fois", label: "Pas cette fois" },
  { key: "aucune", label: "Pas de réponse", tone: "warn" }
];

const groupOf = (r: Row): Group => {
  const s = r.response?.offerStatus;
  if (s === "payee") return "payee";
  if (s === "offerte") return "offerte";
  return r.response?.answer ?? "aucune";
};

const SOURCE: Record<string, string> = { famille: "la famille", sondage: "le sondage", admin: "toi" };
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "short", timeZone: "America/Toronto" });

export function AdminTournament(props: {
  slug: string;
  name: string;
  published: boolean;
  datesLabel: string;
  dates: string[];
  birthYears: string[];
  minPlayers: number;
  maxPlayers: number;
  settings: TournamentSettings;
  tally: Tally;
  progress: { count: number; min: number; pct: number; reached: boolean };
  cost: { high: number | null; low: number | null; now: number | null };
  goPreview: { players: number; waiting: number; priceCents: number | null };
  collectedCents: number;
  rows: Row[];
  privateUrl: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const s = props.settings;
  const go = s.go;

  const run = async (label: string, body: Record<string, unknown>, done?: (d: any) => string) => {
    setBusy(label);
    setMsg(null);
    try {
      const d = await post({ slug: props.slug, ...body });
      setMsg({ ok: true, text: done ? done(d) : "Enregistré." });
      // Après le go, toute la page change (prix figé, places offertes) : on la recharge.
      if (label === "go") window.location.reload();
      else router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setBusy(null);
    }
  };

  const grouped = useMemo(() => {
    const m = new Map<Group, Row[]>();
    for (const r of props.rows) m.set(groupOf(r), [...(m.get(groupOf(r)) ?? []), r]);
    return m;
  }, [props.rows]);
  const noAnswer = grouped.get("aucune")?.length ?? 0;

  const state = go ? { tone: "good", label: `Go donné le ${shortDate(go.at)}` } : props.progress.reached ? { tone: "accent", label: "Minimum atteint : prêt pour le go" } : props.published ? { tone: undefined, label: "Publié, en attente du minimum" } : { tone: "warn", label: "Brouillon : pas encore visible par les familles" };
  const fees = s.entryFeeCents + s.coachFeeCents;

  const giveGo = () => {
    const p = props.goPreview;
    const text = `Donner le go pour ${props.name} ?\n\n${p.players} famille${p.players > 1 ? "s" : ""} disponible${p.players > 1 ? "s" : ""} reçoi${p.players > 1 ? "vent" : "t"} maintenant un courriel avec son lien de paiement de ${money(p.priceCents)} (à payer en ${s.payDays} jours, rappel ${s.reminderHours} h avant la fin).${p.waiting ? `\n${p.waiting} autre${p.waiting > 1 ? "s" : ""} attend${p.waiting > 1 ? "ent" : ""} sur la liste.` : ""}${!props.progress.reached ? `\n\nAttention : le minimum de ${props.minPlayers} n'est pas atteint, le prix par joueuse est donc plus élevé.` : ""}`;
    if (!window.confirm(text)) return;
    run("go", { action: "go" }, (d) => `Go donné : ${d.offered} lien${d.offered > 1 ? "s" : ""} de paiement envoyé${d.offered > 1 ? "s" : ""} à ${money(d.priceCents)}. Rappels programmés.`);
  };

  return (
    <div className="admin-section mda">
      <header>
        <p className="mda-eyebrow">{[s.teamLabel, props.datesLabel, s.location].filter(Boolean).join(" · ")}</p>
        <h1 className="mda-h1">{props.name}</h1>
        <span className="mda-pill" data-tone={state.tone}>{state.label}</span>
      </header>

      <section className="mda-card" style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="mda-num-xl">
              {props.progress.count} <span style={{ fontSize: "1.1rem", fontWeight: 500, color: "var(--adm-text-2)" }}>sur un minimum de {props.minPlayers}</span>
            </div>
            <p className="mda-label">Disponibles (et payées). Équipe complète : {props.maxPlayers} joueuses.</p>
          </div>
          {go ? null : (
            <button type="button" className={props.progress.reached ? "admin-btn-primary" : "admin-btn-ghost"} disabled={!!busy || !props.goPreview.players || !fees} onClick={giveGo} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Rocket size={16} aria-hidden /> {busy === "go" ? "Envoi des liens…" : props.progress.reached ? "Donner le go" : "Donner le go quand même"}
            </button>
          )}
        </div>
        <div className="mda-bar">
          <div className="mda-fill" style={{ width: `${props.progress.pct}%`, background: props.progress.reached ? "var(--adm-good)" : undefined }} />
        </div>
        <p className="mda-sub" style={{ margin: 0 }}>
          {go
            ? `Prix fixé au go : ${money(go.priceCents)} par joueuse (${go.players} place${go.players > 1 ? "s" : ""} offerte${go.players > 1 ? "s" : ""}). Chaque famille a jusqu'au ${deadlineLabel(go.deadline)} ; une place non payée passe à la suivante toute seule.`
            : fees
              ? `Au go maintenant : ${props.goPreview.players} lien${props.goPreview.players > 1 ? "s" : ""} à ${money(props.goPreview.priceCents)} = (${money(s.entryFeeCents)} d'inscription + ${money(s.coachFeeCents)} de coach)${s.teams > 1 ? ` × ${s.teams} équipes` : ""} ÷ ${props.goPreview.players || "?"} joueuse${props.goPreview.players > 1 ? "s" : ""}.`
              : "Indique le prix d'inscription du tournoi et le salaire du coach dans les réglages pour calculer le coût par joueuse."}
        </p>
      </section>

      <div className="mda-cols-4">
        {[
          { n: props.tally.disponible, l: "Disponibles" },
          { n: props.tally.interessee, l: "Intéressées" },
          { n: noAnswer, l: "Pas de réponse" },
          { n: props.tally.paid, l: `Payées · ${money(props.collectedCents)}` }
        ].map((x) => (
          <div key={x.l} className="mda-card">
            <div className="mda-num">{x.n}</div>
            <div className="mda-label">{x.l}</div>
          </div>
        ))}
      </div>

      {msg ? <p role="status" style={{ margin: 0, color: msg.ok ? "var(--adm-good)" : "var(--adm-bad)" }}>{msg.text}</p> : null}

      <section className="mda-card-flush">
        <div className="mda-card-head">
          <div>
            <h2 className="mda-h2">Les joueuses</h2>
            <p className="mda-sub" style={{ margin: 0 }}>Inscrites de la saison visées par ce tournoi{props.birthYears.length ? ` (${props.birthYears.join(", ")}${s.advancedOnly ? ", groupe avancé" : ""})` : ""}. Une réponse donnée de vive voix se note ici.</p>
          </div>
          {s.survey ? (
            <button type="button" className="admin-btn-ghost" disabled={!!busy} onClick={() => run("sondage", { action: "sondage" }, (d) => `${d.added} intéressée${d.added > 1 ? "s" : ""} reprise${d.added > 1 ? "s" : ""} du sondage.${d.skipped?.length ? ` Pas retrouvées dans l'équipe : ${d.skipped.join(", ")}.` : ""}`)}>
              Reprendre le sondage
            </button>
          ) : null}
        </div>
        {props.rows.length ? (
          GROUPS.filter((g) => grouped.get(g.key)?.length).map((g) => (
            <div key={g.key}>
              <p style={{ margin: 0, padding: "10px 20px", background: "var(--adm-surface-2)", fontSize: "0.82rem", fontWeight: 600, color: "var(--adm-text-2)", borderTop: "1px solid var(--adm-line)" }}>
                {g.label} · {grouped.get(g.key)!.length}
              </p>
              <div className="admin-table-wrap" style={{ margin: 0, border: 0, boxShadow: "none", borderRadius: 0 }}>
                <table className="admin-table">
                  <tbody>
                    {grouped.get(g.key)!.map((r) => (
                      <tr key={r.key}>
                        <td style={{ width: "34%" }}>
                          <strong>{r.firstName} {r.lastName}</strong>
                          <span style={{ display: "block", fontSize: "0.8rem", color: "var(--adm-text-3)" }}>
                            {r.birthYear ?? "année ?"}
                            {r.inRoster ? "" : " · hors de la liste visée"}
                          </span>
                        </td>
                        <td style={{ fontSize: "0.85rem" }}>
                          {r.parentName || "—"}
                          <span style={{ display: "block", color: "var(--adm-text-3)" }}>{r.parentEmail}</span>
                        </td>
                        <td style={{ fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
                          {r.response ? (
                            <>
                              {answerLabel(r.response.answer)} · par {SOURCE[r.response.source] ?? r.response.source}, {shortDate(r.response.respondedAt)}
                              {r.response.offerStatus === "offerte" && r.response.payDeadline ? <span style={{ display: "block", color: "var(--adm-text)" }}>À payer avant le {deadlineLabel(r.response.payDeadline)}</span> : null}
                              {r.response.offerStatus === "expiree" ? <span style={{ display: "block", color: "var(--adm-warn)" }}>Date limite passée : place donnée à la suivante</span> : null}
                              {r.response.offerStatus === "retiree" ? <span style={{ display: "block" }}>Place rendue</span> : null}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          {r.response?.offerStatus === "payee" ? (
                            <span className="mda-pill" data-tone="good">Payée</span>
                          ) : r.response?.offerStatus === "offerte" ? (
                            <button type="button" className="admin-btn-ghost" disabled={!!busy} onClick={() => window.confirm(`Retirer la place de ${r.firstName} ? Elle passera à la suivante.`) && run("retirer", { action: "retirer", responseId: r.response!.id }, () => "Place retirée et offerte à la suivante.")}>
                              Retirer la place
                            </button>
                          ) : (
                            <select
                              className="admin-input"
                              aria-label={`Réponse pour ${r.firstName}`}
                              value={r.response?.answer ?? ""}
                              disabled={!!busy}
                              onChange={(e) => e.target.value && run("reponse", { action: "reponse", firstName: r.firstName, lastName: r.lastName, birthYear: r.birthYear, parentEmail: r.parentEmail, parentName: r.parentName, answer: e.target.value })}
                              style={{ width: "auto", minWidth: 150 }}
                            >
                              <option value="">Noter une réponse…</option>
                              {ANSWERS.map((a) => (
                                <option key={a.key} value={a.key}>{a.label}</option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        ) : (
          <p className="mda-sub" style={{ padding: 20, margin: 0 }}>Aucune joueuse visée pour l&apos;instant : indique les années de naissance (et le groupe avancé si c&apos;est l&apos;équipe AV) dans les réglages.</p>
        )}
      </section>

      <section className="mda-card" style={{ display: "grid", gap: 10 }}>
        <h2 className="mda-h2">Lien à partager</h2>
        <p className="mda-sub" style={{ margin: 0 }}>
          Page non répertoriée : les familles y répondent avec le nom de leur fille et le courriel de son inscription. Le tournoi apparaît aussi dans l&apos;onglet Tournois de leur espace famille. {props.published ? "" : "Publie-le d'abord : en brouillon, les familles ne le voient pas."}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <code style={{ padding: "8px 10px", borderRadius: 8, background: "var(--adm-surface-2)", fontSize: "0.85rem", wordBreak: "break-all" }}>{props.privateUrl}</code>
          <button type="button" className="admin-btn-ghost" onClick={() => navigator.clipboard?.writeText(props.privateUrl).then(() => setMsg({ ok: true, text: "Lien copié." }))} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Copy size={14} aria-hidden /> Copier
          </button>
          <button type="button" className={props.published ? "admin-btn-ghost" : "admin-btn-primary"} disabled={!!busy} onClick={() => run("publier", { action: "regler", published: !props.published }, () => (props.published ? "Remis en brouillon." : "Publié : les familles visées le voient."))}>
            {props.published ? "Remettre en brouillon" : "Publier pour les familles"}
          </button>
        </div>
      </section>

      <Settings {...props} busy={busy} run={run} />
    </div>
  );
}

function Settings(props: { slug: string; name: string; dates: string[]; birthYears: string[]; minPlayers: number; maxPlayers: number; settings: TournamentSettings; busy: string | null; run: (label: string, body: Record<string, unknown>, done?: (d: any) => string) => Promise<void> }) {
  const s = props.settings;
  const [f, setF] = useState({
    name: props.name,
    teamLabel: s.teamLabel,
    birthYears: props.birthYears.join(", "),
    advancedOnly: s.advancedOnly,
    dates: props.dates.join(", "),
    location: s.location,
    venue: s.venue ?? "",
    organizer: s.organizer ?? "",
    organizerUrl: s.organizerUrl ?? "",
    imageUrl: s.imageUrl ?? "",
    info: s.info,
    entryFee: dollars(s.entryFeeCents),
    coachFee: dollars(s.coachFeeCents),
    teams: String(s.teams),
    min: String(props.minPlayers),
    max: String(props.maxPlayers),
    payDays: String(s.payDays),
    surveyId: s.survey?.id ?? "",
    surveyOption: s.survey?.option ?? ""
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const field = (label: string, k: keyof typeof f, opts: { type?: string; placeholder?: string; wide?: boolean; area?: boolean; disabled?: boolean } = {}) => (
    <label style={{ display: "grid", gap: 4, fontSize: "0.85rem", color: "var(--adm-text-2)", gridColumn: opts.wide ? "1 / -1" : undefined }}>
      {label}
      {opts.area ? (
        <textarea className="admin-input" rows={5} value={String(f[k])} onChange={set(k)} placeholder={opts.placeholder} />
      ) : (
        <input className="admin-input" type={opts.type ?? "text"} value={String(f[k])} onChange={set(k)} placeholder={opts.placeholder} disabled={opts.disabled} inputMode={opts.type === "number" ? "decimal" : undefined} />
      )}
    </label>
  );
  const locked = !!s.go;
  return (
    <details className="mda-card" open={!s.entryFeeCents && !s.go}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>Réglages du tournoi</summary>
      <form
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 14 }}
        onSubmit={(e) => {
          e.preventDefault();
          props.run("regler", {
            action: "regler",
            name: f.name,
            teamLabel: f.teamLabel,
            birthYears: f.birthYears.split(/[\s,;]+/).filter(Boolean),
            advancedOnly: f.advancedOnly,
            dates: f.dates.split(/[\s,;]+/).filter(Boolean),
            location: f.location,
            venue: f.venue,
            organizer: f.organizer,
            organizerUrl: f.organizerUrl,
            imageUrl: f.imageUrl,
            info: f.info,
            ...(locked ? {} : { entryFeeCents: cents(f.entryFee), coachFeeCents: cents(f.coachFee), teams: Number(f.teams) || 1, minPlayers: Number(f.min) || 1 }),
            maxPlayers: Number(f.max) || undefined,
            payDays: Number(f.payDays) || 7,
            survey: f.surveyId.trim() && f.surveyOption.trim() ? { id: f.surveyId.trim(), option: f.surveyOption.trim() } : null
          });
        }}
      >
        {field("Nom", "name", { wide: true })}
        {field("Équipe ou génération visée (en mots)", "teamLabel", { placeholder: "Équipe 2015 AV" })}
        {field("Années de naissance visées", "birthYears", { placeholder: "2015" })}
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
          <input type="checkbox" checked={f.advancedOnly} onChange={(e) => setF({ ...f, advancedOnly: e.target.checked })} /> Seulement le groupe avancé (AV)
        </label>
        {field("Dates (AAAA-MM-JJ, séparées par des virgules)", "dates", { placeholder: "2027-02-14, 2027-02-15" })}
        {field("Ville", "location", { placeholder: "Mississauga (Ontario)" })}
        {field("Lieu", "venue", { placeholder: "Nom du complexe" })}
        {field("Organisateur", "organizer", { placeholder: "Game Awareness" })}
        {field("Site de l'organisateur", "organizerUrl", { placeholder: "https://…" })}
        {field("Image (adresse d'une photo)", "imageUrl", { placeholder: "https://…", wide: true })}
        {field("Informations pour les familles", "info", { area: true, wide: true, placeholder: "Format, nombre de matchs garantis, hébergement, transport…" })}
        {field("Inscription d'une équipe ($, taxes incluses)", "entryFee", { type: "number", disabled: locked })}
        {field("Salaire du coach par équipe ($)", "coachFee", { type: "number", disabled: locked })}
        {field("Nombre d'équipes", "teams", { type: "number", disabled: locked })}
        {field("Minimum de joueuses", "min", { type: "number", disabled: locked })}
        {field("Maximum (équipe complète)", "max", { type: "number" })}
        {field("Jours pour payer après le go", "payDays", { type: "number" })}
        {field("Sondage d'intérêt (identifiant)", "surveyId", { placeholder: "facultatif" })}
        {field("Choix du sondage qui correspond à ce tournoi", "surveyOption", { placeholder: "Family Day Cup" })}
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" className="admin-btn-primary" disabled={!!props.busy}>{props.busy === "regler" ? "Enregistrement…" : "Enregistrer"}</button>
          {locked ? <span className="mda-sub" style={{ margin: 0 }}>Prix, minimum et frais sont figés depuis le go.</span> : null}
        </div>
      </form>
    </details>
  );
}

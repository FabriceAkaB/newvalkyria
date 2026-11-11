"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Bar, shortDay } from "@/components/mandalart/ui";
import {
  FORMATS,
  NETWORKS,
  THEMES,
  WEEKLY_IDEAL,
  WEEKLY_TARGET,
  engagementRate,
  fmt1,
  fmtInt,
  fmtMoney,
  fmtPct,
  fmtSigned,
  formatLabel,
  networkLabel,
  needsStatsUpdate,
  plural,
  postLabel,
  safeHref,
  themeKey,
  themeLabel,
  type Agg,
  type FollowerNetwork,
  type FollowerPoint,
  type MarketingPost,
  type Network,
  type PostFormat,
  type WeekBar
} from "@/lib/marketing-posts-core";

/** Écran Réseaux sociaux (/admin/reseaux) : saisie rapide au téléphone (publication, abonnés),
 *  graphiques (rythme de la semaine, abonnés par réseau), comparaison des contenus et liste des publications. */

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/reseaux", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Erreur, réessayez.");
  return json;
}

const errText = (e: unknown) => (e instanceof Error ? e.message : "Erreur, réessayez.");

/** « 1 234 », « 1,2 k », « 3 M » → nombre entier ; vide → null ; illisible → NaN. */
function parseCount(raw: string): number | null {
  const t = raw
    .trim()
    .toLowerCase()
    .replace(/[\s  ]/g, "");
  if (!t) return null;
  if (/^-?\d{1,3}([.,]\d{3})+$/.test(t)) return Number(t.replace(/[.,]/g, ""));
  const m = t.replace(",", ".").match(/^(-?\d+(?:\.\d+)?)(k|m)?$/);
  if (!m) return Number.NaN;
  return Math.round(Number(m[1]) * (m[2] === "k" ? 1_000 : m[2] === "m" ? 1_000_000 : 1));
}

/** « 40 », « 40,50 $ » → cents ; vide → null ; illisible → NaN. */
function parseMoney(raw: string): number | null {
  const t = raw
    .trim()
    .replace(/[\s  $]/g, "")
    .replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : Number.NaN;
}

function normalizeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

type Msg = { ok: boolean; text: string } | null;

function Message({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p className="rsx-msg" data-ok={msg.ok} role="status">
      {msg.text}
    </p>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="rsx-chip" aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="rsx-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="rsx-field">
      <span className="rsx-field-label">{label}</span>
      {children}
      {hint ? <span className="rsx-hint">{hint}</span> : null}
    </label>
  );
}

// ── Chiffres d'une publication (formulaire d'ajout et de mise à jour) ──

const STAT_FIELDS = [
  { key: "views", label: "Vues" },
  { key: "likes", label: "J'aime" },
  { key: "comments", label: "Commentaires" },
  { key: "shares", label: "Partages" },
  { key: "saves", label: "Enregistrements" },
  { key: "followersGained", label: "Abonnés gagnés" },
  { key: "leads", label: "Essais / contacts" },
  { key: "registrations", label: "Inscriptions" }
] as const;
type StatKey = (typeof STAT_FIELDS)[number]["key"];
type StatInputs = Record<StatKey, string>;
const EMPTY_STATS: StatInputs = { views: "", likes: "", comments: "", shares: "", saves: "", followersGained: "", leads: "", registrations: "" };

function parseStats(s: StatInputs): { values: Record<StatKey, number | null>; bad: string | null } {
  const values = {} as Record<StatKey, number | null>;
  let bad: string | null = null;
  for (const f of STAT_FIELDS) {
    const v = parseCount(s[f.key]);
    if (v !== null && (Number.isNaN(v) || (v < 0 && f.key !== "followersGained"))) bad ??= f.label;
    values[f.key] = v === null || Number.isNaN(v) ? null : v;
  }
  return { values, bad };
}

function StatsGrid({ value, onChange }: { value: StatInputs; onChange: (v: StatInputs) => void }) {
  return (
    <div className="rsx-grid">
      {STAT_FIELDS.map((f) => (
        <Field key={f.key} label={f.label}>
          <input
            className="admin-input"
            inputMode={f.key === "followersGained" ? "text" : "numeric"}
            placeholder="—"
            value={value[f.key]}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
          />
        </Field>
      ))}
    </div>
  );
}

function ThemePicker({ value, onChange, extra }: { value: string; onChange: (v: string) => void; extra: string[] }) {
  const options = [...THEMES, ...extra.filter((t) => !THEMES.some((k) => themeKey(k) === themeKey(t)))];
  const known = options.some((t) => themeKey(t) === themeKey(value));
  const [custom, setCustom] = useState(Boolean(value) && !known);
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="rsx-chips">
        {options.map((t) => (
          <Chip
            key={t}
            on={!custom && themeKey(t) === themeKey(value)}
            onClick={() => {
              setCustom(false);
              onChange(themeKey(t) === themeKey(value) ? "" : t);
            }}
          >
            {t}
          </Chip>
        ))}
        <Chip
          on={custom}
          onClick={() => {
            setCustom(!custom);
            onChange("");
          }}
        >
          Autre…
        </Chip>
      </div>
      {custom ? <input className="admin-input" autoFocus placeholder="Thème (ex. Journée Valkyria)" maxLength={60} value={value} onChange={(e) => onChange(e.target.value)} /> : null}
    </div>
  );
}

// ── Saisie rapide : publication et abonnés ──

const LAST_KEY = "nv-reseaux-dernier-choix";

export interface FollowerInput {
  network: FollowerNetwork;
  label: string;
  current: number | null;
  at: string | null;
}

export function QuickEntry({ today, followers, extraThemes, startWith }: { today: string; followers: FollowerInput[]; extraThemes: string[]; startWith: "post" | "followers" | null }) {
  const [open, setOpen] = useState<"post" | "followers" | null>(startWith);
  return (
    <section style={{ display: "grid", gap: 16 }}>
      <div className="rsx-actions">
        <button type="button" className="admin-btn-primary" aria-expanded={open === "post"} onClick={() => setOpen(open === "post" ? null : "post")}>
          {open === "post" ? "Fermer" : "Ajouter une publication"}
        </button>
        <button type="button" className="admin-btn-ghost" aria-expanded={open === "followers"} onClick={() => setOpen(open === "followers" ? null : "followers")}>
          {open === "followers" ? "Fermer" : "Entrer les abonnés"}
        </button>
      </div>
      {open === "post" ? <AddPostForm today={today} extraThemes={extraThemes} /> : null}
      {open === "followers" ? <FollowersForm today={today} followers={followers} /> : null}
    </section>
  );
}

function AddPostForm({ today, extraThemes }: { today: string; extraThemes: string[] }) {
  const router = useRouter();
  const [networks, setNetworks] = useState<Network[]>(["instagram", "facebook"]);
  const [format, setFormat] = useState<PostFormat>("reel");
  const [theme, setTheme] = useState("");
  const [paid, setPaid] = useState(false);
  const [spend, setSpend] = useState("");
  const [postedOn, setPostedOn] = useState(today);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [stats, setStats] = useState<StatInputs>(EMPTY_STATS);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [themeReset, setThemeReset] = useState(0);
  const single = networks.length === 1;

  // Dernier choix de réseaux et de type, mémorisé sur cet appareil.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LAST_KEY) ?? "null");
      const ids = NETWORKS.map((n) => n.id) as string[];
      if (Array.isArray(saved?.networks) && saved.networks.length && saved.networks.every((n: string) => ids.includes(n))) setNetworks(saved.networks);
      if (FORMATS.some((f) => f.id === saved?.format)) setFormat(saved.format);
    } catch {
      /* stockage indisponible : on garde les choix par défaut */
    }
  }, []);

  const toggleNetwork = (n: Network) => setNetworks((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]));

  return (
    <form
      className="mda-card rsx-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setMsg(null);
        if (!networks.length) return setMsg({ ok: false, text: "Choisissez au moins un réseau." });
        const { values, bad } = parseStats(stats);
        if (single && bad) return setMsg({ ok: false, text: `« ${bad} » : entrez un nombre (ex. 1 234 ou 1,2 k).` });
        const spendCents = paid && single ? parseMoney(spend) : null;
        if (spendCents !== null && Number.isNaN(spendCents)) return setMsg({ ok: false, text: "Montant dépensé : entrez un montant (ex. 40 ou 40,50)." });
        setBusy(true);
        try {
          await post({
            action: "add-post",
            networks,
            format,
            paid,
            postedOn,
            url: normalizeUrl(url),
            title: title.trim() || null,
            theme: theme.trim() || null,
            note: note.trim() || null,
            ...(single ? { ...values, spendCents } : {})
          });
          try {
            localStorage.setItem(LAST_KEY, JSON.stringify({ networks, format }));
          } catch {
            /* stockage indisponible */
          }
          setMsg({ ok: true, text: `Publication enregistrée (${networks.map(networkLabel).join(" + ")}). Dans 7 jours, relevez ses vues et les essais qu'elle a amenés.` });
          setTitle("");
          setUrl("");
          setNote("");
          setTheme("");
          setThemeReset((n) => n + 1);
          setSpend("");
          setStats(EMPTY_STATS);
          router.refresh();
        } catch (err) {
          setMsg({ ok: false, text: errText(err) });
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <h2 className="mda-h2">Nouvelle publication</h2>
        <p className="mda-sub" style={{ margin: 0 }}>
          Publiée sur plusieurs réseaux ? Cochez-les tous : elle compte pour une publication, et chaque réseau garde ses chiffres.
        </p>
      </div>

      <div className="rsx-field">
        <span className="rsx-field-label">Publiée sur</span>
        <div className="rsx-chips">
          {NETWORKS.map((n) => (
            <Chip key={n.id} on={networks.includes(n.id)} onClick={() => toggleNetwork(n.id)}>
              {n.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="rsx-field">
        <span className="rsx-field-label">Type</span>
        <div className="rsx-chips">
          {FORMATS.map((f) => (
            <Chip key={f.id} on={format === f.id} onClick={() => setFormat(f.id)}>
              {f.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="rsx-field">
        <span className="rsx-field-label">Thème</span>
        <ThemePicker key={themeReset} value={theme} onChange={setTheme} extra={extraThemes} />
      </div>

      <div className="rsx-field">
        <span className="rsx-field-label">Organique ou payant</span>
        <Segmented
          label="Organique ou payant"
          value={paid ? "payant" : "organique"}
          options={[
            { id: "organique", label: "Organique" },
            { id: "payant", label: "Payant (boostée)" }
          ]}
          onChange={(v) => setPaid(v === "payant")}
        />
      </div>

      <div className="rsx-grid">
        <Field label="Date de publication">
          <input className="admin-input" type="date" value={postedOn} onChange={(e) => setPostedOn(e.target.value)} required />
        </Field>
        {paid && single ? (
          <Field label="Montant dépensé ($)">
            <input className="admin-input" inputMode="decimal" placeholder="Ex. 40" value={spend} onChange={(e) => setSpend(e.target.value)} />
          </Field>
        ) : null}
      </div>

      <Field label="Sujet" hint="Ce qu'on voit, sans nom de joueuse (Loi 25).">
        <input className="admin-input" maxLength={160} placeholder="Ex. Ball mastery U10 : 3 touches de balle" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>

      <Field label="Lien de la publication (facultatif)">
        <input className="admin-input" inputMode="url" placeholder="https://www.instagram.com/reel/…" value={url} onChange={(e) => setUrl(e.target.value)} />
      </Field>

      {single ? (
        <details className="rsx-details">
          <summary>Ajouter les chiffres maintenant (sinon dans 7 jours)</summary>
          <div style={{ marginTop: 12 }}>
            <StatsGrid value={stats} onChange={setStats} />
          </div>
        </details>
      ) : (
        <p className="rsx-hint">
          Publiée sur {networks.length} réseaux : chaque réseau aura sa ligne dans la liste. Entrez-y ses vues, ses essais{paid ? " et le montant de la pub" : ""} 7 jours après.
        </p>
      )}

      <Field label="Note (facultatif)">
        <input className="admin-input" maxLength={500} placeholder="Ex. musique tendance, publiée à 18 h" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      <div className="rsx-submit">
        <button className="admin-btn-primary" disabled={busy}>
          {busy ? "Enregistrement…" : "Enregistrer la publication"}
        </button>
        <Message msg={msg} />
      </div>
    </form>
  );
}

function FollowersForm({ today, followers }: { today: string; followers: FollowerInput[] }) {
  const router = useRouter();
  const [day, setDay] = useState(today);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  return (
    <form
      className="mda-card rsx-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setMsg(null);
        const entries: { network: FollowerNetwork; followers: number }[] = [];
        for (const f of followers) {
          const v = parseCount(values[f.network] ?? "");
          if (v === null) continue;
          if (Number.isNaN(v) || v < 0) return setMsg({ ok: false, text: `${f.label} : entrez un nombre d'abonnés (ex. 1 234 ou 1,2 k).` });
          entries.push({ network: f.network, followers: v });
        }
        if (!entries.length) return setMsg({ ok: false, text: "Entrez les abonnés d'au moins un réseau." });
        setBusy(true);
        try {
          await post({ action: "followers", measuredAt: day, entries });
          setMsg({ ok: true, text: `Abonnés enregistrés : ${entries.map((x) => networkLabel(x.network)).join(", ")}.` });
          setValues({});
          router.refresh();
        } catch (err) {
          setMsg({ ok: false, text: errText(err) });
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <h2 className="mda-h2">Abonnés aujourd’hui</h2>
        <p className="mda-sub" style={{ margin: 0 }}>
          Le nombre affiché sur chaque profil. Aux 2 semaines, c’est assez pour voir la croissance. Laissez vide un réseau qu’on n’utilise pas.
        </p>
      </div>
      <div className="rsx-grid">
        {followers.map((f) => (
          <Field key={f.network} label={f.label} hint={f.current !== null ? `Dernier : ${fmtInt(f.current)} le ${shortDay(f.at)}` : "Aucun relevé"}>
            <input className="admin-input" inputMode="numeric" placeholder="Abonnés" value={values[f.network] ?? ""} onChange={(e) => setValues({ ...values, [f.network]: e.target.value })} />
          </Field>
        ))}
      </div>
      <div className="rsx-grid">
        <Field label="Date du relevé">
          <input className="admin-input" type="date" max={today} value={day} onChange={(e) => setDay(e.target.value)} required />
        </Field>
      </div>
      <div className="rsx-submit">
        <button className="admin-btn-primary" disabled={busy}>
          {busy ? "Enregistrement…" : "Enregistrer les abonnés"}
        </button>
        <Message msg={msg} />
      </div>
    </form>
  );
}

/** Campagne de pub qui n'est pas une publication boostée (Meta, Google) : montant et contacts obtenus. */
export function AdSpendEntry({ today }: { today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<"pub_meta" | "pub_google">("pub_meta");
  const [day, setDay] = useState(today);
  const [spend, setSpend] = useState("");
  const [leads, setLeads] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  if (!open)
    return (
      <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
        <button type="button" className="admin-btn-ghost rsx-btn44" onClick={() => setOpen(true)}>
          Entrer une campagne
        </button>
        <Message msg={msg} />
      </div>
    );
  return (
    <form
      className="rsx-form rsx-inline-form"
      style={{ flexBasis: "100%" }}
      onSubmit={async (e) => {
        e.preventDefault();
        setMsg(null);
        const spendCents = parseMoney(spend);
        if (spendCents === null || Number.isNaN(spendCents) || spendCents <= 0) return setMsg({ ok: false, text: "Montant dépensé : entrez un montant (ex. 150 ou 149,50)." });
        const n = parseCount(leads);
        if (n !== null && (Number.isNaN(n) || n < 0)) return setMsg({ ok: false, text: "Contacts : entrez un nombre (ex. 4)." });
        setBusy(true);
        try {
          await post({ action: "ad-spend", channel, measuredAt: day, spendCents, leads: n, note: note.trim() || null });
          setSpend("");
          setLeads("");
          setNote("");
          setOpen(false);
          setMsg({ ok: true, text: "Campagne enregistrée." });
          router.refresh();
        } catch (err) {
          setMsg({ ok: false, text: errText(err) });
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="rsx-field">
        <span className="rsx-field-label">Où</span>
        <Segmented
          label="Plateforme de pub"
          value={channel}
          options={[
            { id: "pub_meta", label: "Facebook / Instagram" },
            { id: "pub_google", label: "Google" }
          ]}
          onChange={setChannel}
        />
      </div>
      <div className="rsx-grid">
        <Field label="Montant dépensé ($)">
          <input className="admin-input" inputMode="decimal" placeholder="Ex. 150" value={spend} onChange={(e) => setSpend(e.target.value)} required />
        </Field>
        <Field label="Contacts obtenus" hint="Formulaires, messages, essais réservés">
          <input className="admin-input" inputMode="numeric" placeholder="—" value={leads} onChange={(e) => setLeads(e.target.value)} />
        </Field>
        <Field label="Fin de la campagne">
          <input className="admin-input" type="date" max={today} value={day} onChange={(e) => setDay(e.target.value)} required />
        </Field>
      </div>
      <Field label="Note (facultatif)">
        <input className="admin-input" maxLength={200} placeholder="Ex. Essai gratuit, rayon de 25 km" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="rsx-submit">
        <button className="admin-btn-primary" disabled={busy}>
          {busy ? "Enregistrement…" : "Enregistrer la campagne"}
        </button>
        <button type="button" className="admin-btn-ghost rsx-btn44" onClick={() => setOpen(false)} disabled={busy}>
          Annuler
        </button>
        <Message msg={msg} />
      </div>
    </form>
  );
}

// ── Graphiques ──

/** Contenus publiés par semaine : vidéos (mauve) et autres publications (gris), lignes de la cible et de l'idéal. */
export function WeeklyChart({ bars }: { bars: WeekBar[] }) {
  const max = Math.max(WEEKLY_IDEAL + 1, ...bars.map((b) => b.videos + b.others));
  const h = (n: number) => `${(n / max) * 100}%`;
  return (
    <div>
      <div className="rsx-legend" aria-hidden>
        <span>
          <i className="rsx-sw rsx-v" />
          Vidéos (reel, vidéo)
        </span>
        <span>
          <i className="rsx-sw rsx-o" />
          Autres publications
        </span>
      </div>
      <div className="rsx-plot" style={{ ["--n" as string]: bars.length }}>
        {[
          { v: WEEKLY_TARGET, label: `cible ${WEEKLY_TARGET}` },
          { v: WEEKLY_IDEAL, label: `idéal ${WEEKLY_IDEAL}` }
        ].map((r) => (
          <div key={r.v} className="rsx-ref" style={{ bottom: h(r.v) }}>
            <span>{r.label}</span>
          </div>
        ))}
        <div className="rsx-cols">
          {bars.map((b) => {
            const tip = `${b.current ? "Cette semaine" : `Semaine du ${shortDay(b.week)}`} : ${b.videos} ${plural(b.videos, "vidéo")}${b.others ? `, ${b.others} ${plural(b.others, "autre publication", "autres publications")}` : ""}`;
            return (
              <div key={b.week} className="rsx-col" tabIndex={0} aria-label={tip} data-current={b.current}>
                <span className="rsx-tip">{tip}</span>
                {b.current || b.videos + b.others > 0 ? <span className="rsx-val">{b.videos}</span> : null}
                {b.others > 0 ? <i className="rsx-o" style={{ height: h(b.others) }} /> : null}
                {b.videos > 0 ? <i className="rsx-v" style={{ height: h(b.videos) }} /> : null}
              </div>
            );
          })}
        </div>
      </div>
      <div className="rsx-x" style={{ ["--n" as string]: bars.length }} aria-hidden>
        {bars.map((b, i) => (
          <span key={b.week} data-current={b.current} data-major={(bars.length - 1 - i) % 3 === 0}>
            {b.current ? "cette sem." : shortDay(b.week)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Abonnés d'un réseau dans le temps (ligne fine, point au dernier relevé, survol ou toucher pour lire une date). */
export function FollowerSpark({ points, label }: { points: FollowerPoint[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  if (!points.length) return <div className="rsx-spark rsx-spark-empty" aria-hidden />;
  const t0 = Date.parse(points[0].date);
  const span = Math.max(1, Date.parse(points[points.length - 1].date) - t0);
  const vals = points.map((p) => p.followers);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi === lo) {
    lo -= 1;
    hi += 1;
  }
  const xy = points.map((p) => ({
    x: points.length === 1 ? 100 : ((Date.parse(p.date) - t0) / span) * 100,
    y: 8 + (1 - (p.followers - lo) / (hi - lo)) * 84
  }));
  const active = hover ?? points.length - 1;
  const pick = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const x = ((clientX - box.left) / box.width) * 100;
    let best = 0;
    for (let i = 1; i < xy.length; i++) if (Math.abs(xy[i].x - x) < Math.abs(xy[best].x - x)) best = i;
    setHover(best);
  };
  return (
    <div
      ref={ref}
      className="rsx-spark"
      role="img"
      aria-label={`${label}, abonnés : ${points.map((p) => `${fmtInt(p.followers)} le ${shortDay(p.date)}`).join(", ")}`}
      onPointerMove={(e) => pick(e.clientX)}
      onPointerDown={(e) => pick(e.clientX)}
      onPointerLeave={() => setHover(null)}
    >
      {points.length > 1 ? (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <polyline
            points={xy.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="var(--adm-accent)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      ) : null}
      {hover !== null ? <span className="rsx-cross" style={{ left: `${xy[hover].x}%` }} /> : null}
      <span className="rsx-dot" style={{ left: `${xy[active].x}%`, top: `${xy[active].y}%` }} />
      {hover !== null ? (
        <span className="rsx-spark-tip" style={{ left: `${Math.min(80, Math.max(20, xy[hover].x))}%` }}>
          {fmtInt(points[hover].followers)} · {shortDay(points[hover].date)}
        </span>
      ) : null}
    </div>
  );
}

// ── Comparaison des contenus ──

type CompareKey = "theme" | "format" | "network";

export function CompareTabs({ byTheme, byFormat, byNetwork }: { byTheme: Agg[]; byFormat: Agg[]; byNetwork: Agg[] }) {
  const [tab, setTab] = useState<CompareKey>("theme");
  const rows = tab === "theme" ? byTheme : tab === "format" ? byFormat : byNetwork;
  const maxRate = Math.max(0, ...rows.map((r) => r.leadsPer1000 ?? 0));
  const maxViews = Math.max(0, ...rows.map((r) => r.avgViews ?? 0));
  const best = rows.find((r) => (r.leadsPer1000 ?? 0) > 0 && r.leadsPer1000 === maxRate);
  return (
    <>
      <div style={{ padding: "16px 20px 4px" }}>
        <Segmented
          label="Comparer par"
          value={tab}
          options={[
            { id: "theme", label: "Par thème" },
            { id: "format", label: "Par type" },
            { id: "network", label: "Par réseau" }
          ]}
          onChange={setTab}
        />
      </div>
      {rows.length === 0 ? (
        <p className="rsx-empty">Rien à comparer pour l’instant : ajoutez des publications, puis leurs vues et leurs essais 7 jours après.</p>
      ) : (
        <ul className="rsx-compare">
          {rows.map((r) => {
            // Le classement se fait aux essais ; sans essai attribué, la barre montre les vues moyennes.
            const byLeads = maxRate > 0;
            const share = byLeads ? (r.leadsPer1000 ?? 0) / maxRate : maxViews > 0 ? (r.avgViews ?? 0) / maxViews : 0;
            return (
              <li key={r.key}>
                <div className="rsx-compare-head">
                  <div style={{ minWidth: 0, display: "grid", gap: 6, justifyItems: "start" }}>
                    <p className="mda-task-title" style={{ fontWeight: 600 }}>
                      {r.label}
                    </p>
                    {best && r.key === best.key ? (
                      <span className="mda-pill" data-tone="good">
                        Amène le plus de familles
                      </span>
                    ) : null}
                  </div>
                  <span className="rsx-top-num">
                    {byLeads ? fmt1(r.leadsPer1000) : fmtInt(r.avgViews)}
                    <small>{byLeads ? "essais / 1 000 vues" : "vues en moyenne"}</small>
                  </span>
                </div>
                <Bar thin value={share} color={best && r.key === best.key ? "var(--adm-good)" : undefined} />
                <div className="mda-task-meta">
                  <span>
                    {r.posts} {plural(r.posts, "publication")}
                  </span>
                  {byLeads && r.avgViews !== null ? <span>{fmtInt(r.avgViews)} vues en moyenne</span> : null}
                  {r.avgViews === null ? <span>vues pas encore entrées</span> : null}
                  {r.engagementRate !== null ? <span>{fmtPct(r.engagementRate)} d’engagement</span> : null}
                  <span>
                    {r.leads} {plural(r.leads, "essai")}
                  </span>
                  <span>
                    {r.registrations} {plural(r.registrations, "inscription")}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="rsx-foot">
        Essais pour 1 000 vues = essais attribués ÷ vues × 1 000, sur les publications dont les vues sont entrées. Engagement = (j’aime + commentaires + partages + enregistrements) ÷ vues. Une
        publication sur 2 réseaux compte une fois par réseau.
      </p>
    </>
  );
}

// ── Liste des publications ──

const PAGE = 15;

export function PostList({ posts, today, extraThemes }: { posts: MarketingPost[]; today: string; extraThemes: string[] }) {
  const [filter, setFilterRaw] = useState<"toutes" | "a-relever" | "payantes">("toutes");
  const [shown, setShown] = useState(PAGE);
  const setFilter = (f: "toutes" | "a-relever" | "payantes") => {
    setFilterRaw(f);
    setShown(PAGE);
  };
  const [openId, setOpenId] = useState<number | null>(null);
  const stale = posts.filter((p) => needsStatsUpdate(p, today));
  const paidCount = posts.filter((p) => p.paid).length;
  const list = filter === "a-relever" ? stale : filter === "payantes" ? posts.filter((p) => p.paid) : posts;
  if (!posts.length) return <p className="rsx-empty">Aucune publication pour l’instant. Touchez « Ajouter une publication » en haut de la page après chaque publication.</p>;
  return (
    <>
      <div className="rsx-chips" style={{ padding: "12px 20px" }}>
        <Chip on={filter === "toutes"} onClick={() => setFilter("toutes")}>
          Toutes · {posts.length}
        </Chip>
        <Chip on={filter === "a-relever"} onClick={() => setFilter("a-relever")}>
          Chiffres à relever · {stale.length}
        </Chip>
        {paidCount ? (
          <Chip on={filter === "payantes"} onClick={() => setFilter("payantes")}>
            Payantes · {paidCount}
          </Chip>
        ) : null}
      </div>
      {list.length === 0 ? (
        <p className="rsx-empty">{filter === "a-relever" ? "Tous les chiffres sont à jour." : "Aucune publication dans ce filtre."}</p>
      ) : (
        <ul className="mda-tasks" style={{ borderTop: "1px solid var(--adm-line)" }}>
          {list.slice(0, shown).map((p) => (
            <PostRow key={p.id} p={p} today={today} open={openId === p.id} onToggle={() => setOpenId(openId === p.id ? null : p.id)} extraThemes={extraThemes} />
          ))}
        </ul>
      )}
      {list.length > shown ? (
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--adm-line)" }}>
          <button type="button" className="admin-btn-ghost rsx-btn44" onClick={() => setShown(shown + PAGE)}>
            Afficher {Math.min(PAGE, list.length - shown)} de plus
          </button>
        </div>
      ) : null}
    </>
  );
}

function statLine(p: MarketingPost): string {
  if (p.views === null && p.leads === null && p.registrations === null && p.likes === null) return "Pas encore de chiffres";
  const parts = [`${fmtInt(p.views)} vues`];
  const er = engagementRate(p);
  if (er !== null) parts.push(`${fmtPct(er)} d'engagement`);
  if (p.followers_gained) parts.push(`${fmtSigned(p.followers_gained)} ${plural(p.followers_gained, "abonné")}`);
  parts.push(`${p.leads ?? 0} ${plural(p.leads ?? 0, "essai")}`);
  if (p.registrations) parts.push(`${p.registrations} ${plural(p.registrations, "inscription")}`);
  return parts.join(" · ");
}

function PostRow({ p, today, open, onToggle, extraThemes }: { p: MarketingPost; today: string; open: boolean; onToggle: () => void; extraThemes: string[] }) {
  const stale = needsStatsUpdate(p, today);
  return (
    <li className="mda-task" style={{ display: "block" }}>
      <div className="rsx-row">
        <div style={{ minWidth: 0 }}>
          <p className="mda-task-title" style={{ fontWeight: 600 }}>
            {safeHref(p.url) ? (
              <a href={safeHref(p.url)!} target="_blank" rel="noopener noreferrer" className="rsx-link">
                {postLabel(p)} <span aria-hidden>↗</span>
              </a>
            ) : (
              postLabel(p)
            )}
          </p>
          <div className="mda-task-meta">
            <span>{networkLabel(p.network)}</span>
            <span>{formatLabel(p.format)}</span>
            <span>{shortDay(p.posted_on)}</span>
            {p.theme && p.title ? <span>{themeLabel(p.theme)}</span> : null}
            {p.paid ? (
              <span className="mda-pill" data-tone="accent">
                Payant{p.spend_cents ? ` · ${fmtMoney(p.spend_cents)}` : ""}
              </span>
            ) : null}
            {stale ? (
              <span className="mda-pill" data-tone="warn">
                Chiffres à relever
              </span>
            ) : null}
          </div>
          <p className="rsx-statline">{statLine(p)}</p>
        </div>
        <button type="button" className="admin-btn-ghost rsx-btn44" aria-expanded={open} onClick={onToggle}>
          {open ? "Fermer" : stale || p.views === null ? "Entrer les chiffres" : "Modifier"}
        </button>
      </div>
      {open ? <PostEditor p={p} onDone={onToggle} extraThemes={extraThemes} /> : null}
    </li>
  );
}

const str = (n: number | null) => (n === null || n === undefined ? "" : String(n));

function PostEditor({ p, onDone, extraThemes }: { p: MarketingPost; onDone: () => void; extraThemes: string[] }) {
  const router = useRouter();
  const [stats, setStats] = useState<StatInputs>({
    views: str(p.views),
    likes: str(p.likes),
    comments: str(p.comments),
    shares: str(p.shares),
    saves: str(p.saves),
    followersGained: str(p.followers_gained),
    leads: str(p.leads),
    registrations: str(p.registrations)
  });
  const [format, setFormat] = useState<PostFormat>(p.format);
  const [paid, setPaid] = useState(p.paid);
  const [spend, setSpend] = useState(p.spend_cents !== null ? String(p.spend_cents / 100).replace(".", ",") : "");
  const [postedOn, setPostedOn] = useState(p.posted_on);
  const [theme, setTheme] = useState(p.theme ?? "");
  const [title, setTitle] = useState(p.title ?? "");
  const [url, setUrl] = useState(p.url ?? "");
  const [note, setNote] = useState(p.note ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  return (
    <form
      className="rsx-form rsx-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        setMsg(null);
        const { values, bad } = parseStats(stats);
        if (bad) return setMsg({ ok: false, text: `« ${bad} » : entrez un nombre (ex. 1 234 ou 1,2 k).` });
        const spendCents = paid ? parseMoney(spend) : null;
        if (spendCents !== null && Number.isNaN(spendCents)) return setMsg({ ok: false, text: "Montant dépensé : entrez un montant (ex. 40 ou 40,50)." });
        setBusy(true);
        try {
          await post({
            action: "update-post",
            id: p.id,
            format,
            paid,
            postedOn,
            url: normalizeUrl(url),
            title: title.trim() || null,
            theme: theme.trim() || null,
            note: note.trim() || null,
            ...values,
            spendCents
          });
          router.refresh();
          onDone();
        } catch (err) {
          setMsg({ ok: false, text: errText(err) });
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="rsx-hint">Chiffres de {networkLabel(p.network)} seulement. Essais et inscriptions : les familles qui disent venir de cette publication.</p>
      <StatsGrid value={stats} onChange={setStats} />
      <div className="rsx-field">
        <span className="rsx-field-label">Organique ou payant</span>
        <Segmented
          label="Organique ou payant"
          value={paid ? "payant" : "organique"}
          options={[
            { id: "organique", label: "Organique" },
            { id: "payant", label: "Payant" }
          ]}
          onChange={(v) => setPaid(v === "payant")}
        />
      </div>
      <div className="rsx-grid">
        {paid ? (
          <Field label="Montant dépensé ($)">
            <input className="admin-input" inputMode="decimal" placeholder="Ex. 40" value={spend} onChange={(e) => setSpend(e.target.value)} />
          </Field>
        ) : null}
        <Field label="Type">
          <select className="admin-input" value={format} onChange={(e) => setFormat(e.target.value as PostFormat)}>
            {FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date de publication">
          <input className="admin-input" type="date" value={postedOn} onChange={(e) => setPostedOn(e.target.value)} required />
        </Field>
      </div>
      <div className="rsx-field">
        <span className="rsx-field-label">Thème</span>
        <ThemePicker value={theme} onChange={setTheme} extra={extraThemes} />
      </div>
      <Field label="Sujet" hint="Sans nom de joueuse (Loi 25).">
        <input className="admin-input" maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Lien">
        <input className="admin-input" inputMode="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
      </Field>
      <Field label="Note">
        <input className="admin-input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="rsx-submit">
        <button className="admin-btn-primary" disabled={busy}>
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button type="button" className="admin-btn-ghost rsx-btn44" onClick={onDone} disabled={busy}>
          Annuler
        </button>
        <button
          type="button"
          className="rsx-danger"
          disabled={busy}
          onClick={async () => {
            if (!confirm(`Supprimer « ${postLabel(p)} » (${networkLabel(p.network)}) ? Ses chiffres seront perdus.`)) return;
            setBusy(true);
            try {
              await post({ action: "delete-post", id: p.id });
              router.refresh();
              onDone();
            } catch (err) {
              setMsg({ ok: false, text: errText(err) });
              setBusy(false);
            }
          }}
        >
          Supprimer
        </button>
        <Message msg={msg} />
      </div>
    </form>
  );
}

// ── Styles de l'écran (jetons --adm-* du thème admin) ──

const CSS = `
.rsx-actions { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
.rsx-actions > button, .rsx-submit > .admin-btn-primary { min-height: 44px; padding: 0 20px; }
.rsx-btn44 { min-height: 44px; padding: 0 16px !important; display: inline-flex; align-items: center; justify-content: center; white-space: nowrap; }
.rsx-form { display: grid; gap: 20px; }
.rsx-field { display: grid; gap: 8px; min-width: 0; align-content: start; }
.rsx-field-label { font-size: 0.82rem; font-weight: 600; color: var(--adm-text-2); }
.rsx-hint { font-size: 0.78rem; color: var(--adm-text-3); margin: 0; line-height: 1.45; }
.rsx-form .admin-input { width: 100%; min-height: 44px; box-sizing: border-box; padding: 0 12px; }
.rsx-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(124px, 1fr)); gap: 12px; }
.rsx-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.rsx-chip { min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid var(--adm-border); background: var(--adm-surface-2); color: var(--adm-text-2); font-size: 0.88rem; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; transition: background 0.15s, border-color 0.15s, color 0.15s; }
.rsx-chip:hover { background: var(--adm-surface-3); color: var(--adm-text); }
.rsx-chip[aria-pressed="true"] { background: var(--adm-accent-soft); border-color: var(--adm-accent); color: var(--adm-text); }
.rsx-chip:focus-visible, .rsx-seg button:focus-visible, .rsx-col:focus-visible { outline: 2px solid var(--adm-accent); outline-offset: 2px; }
.rsx-seg { display: inline-flex; flex-wrap: wrap; padding: 3px; gap: 2px; border-radius: 10px; background: var(--adm-surface-2); border: 1px solid var(--adm-border); max-width: 100%; }
.rsx-seg button { min-height: 38px; padding: 0 14px; border-radius: 8px; border: 0; background: transparent; color: var(--adm-text-2); font-size: 0.86rem; font-weight: 500; cursor: pointer; }
.rsx-seg button[aria-pressed="true"] { background: var(--adm-surface-3); color: var(--adm-text); }
.rsx-details > summary { cursor: pointer; font-size: 0.86rem; color: var(--adm-text-2); min-height: 44px; display: flex; align-items: center; }
.rsx-submit { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.rsx-msg { font-size: 0.85rem; margin: 0; line-height: 1.4; }
.rsx-msg[data-ok="true"] { color: var(--adm-good); }
.rsx-msg[data-ok="false"] { color: var(--adm-bad); }
.rsx-danger { background: none; border: none; color: var(--adm-bad); font-size: 0.85rem; cursor: pointer; min-height: 44px; padding: 0 8px; margin-left: auto; }
.rsx-danger:disabled { opacity: 0.5; }
.rsx-empty { padding: 16px 20px; margin: 0; color: var(--adm-text-3); font-size: 0.88rem; line-height: 1.45; }
.rsx-foot { padding: 12px 20px 16px; margin: 0; font-size: 0.75rem; color: var(--adm-text-3); line-height: 1.45; border-top: 1px solid var(--adm-line); }
.rsx-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.rsx-statline { margin: 6px 0 0; font-size: 0.82rem; color: var(--adm-text-2); font-variant-numeric: tabular-nums; }
.rsx-link { color: var(--adm-text); text-decoration: none; }
.rsx-link:hover { text-decoration: underline; text-underline-offset: 2px; }
.rsx-link > span { color: var(--adm-text-3); font-weight: 400; }
.rsx-editor { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--adm-line); }
.rsx-top { list-style: none; margin: 0; padding: 0; }
.rsx-top > li { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 20px; border-top: 1px solid var(--adm-line); min-height: 44px; }
.rsx-top > li:first-child { border-top: none; }
.rsx-top-num { font-size: 1.05rem; font-weight: 600; color: var(--adm-text); font-variant-numeric: tabular-nums; white-space: nowrap; text-align: right; }
.rsx-top-num small { display: block; font-size: 0.72rem; font-weight: 400; color: var(--adm-text-3); }
.rsx-campaigns { padding: 16px 20px; border-top: 1px solid var(--adm-line); display: grid; gap: 4px; }
.rsx-campaigns .rsx-top > li { padding-left: 0; padding-right: 0; }
.rsx-campaigns > .rsx-row { flex-wrap: wrap; }
.rsx-compare { list-style: none; margin: 8px 0 0; padding: 0; }
.rsx-compare > li { display: grid; gap: 8px; padding: 14px 20px; border-top: 1px solid var(--adm-line); }
.rsx-compare-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.rsx-compare-head .mda-task-title { margin: 0; min-width: 0; }
.rsx-h3 { margin: 0 0 4px; font-size: 0.95rem; font-weight: 600; color: var(--adm-text); }
.rsx-inline-form { margin-top: 12px; padding: 16px; border-radius: var(--adm-radius); background: var(--adm-surface-2); }

.rsx-legend { display: flex; gap: 16px; flex-wrap: wrap; font-size: 0.78rem; color: var(--adm-text-2); }
.rsx-sw { width: 10px; height: 10px; border-radius: 3px; display: inline-block; margin-right: 6px; vertical-align: -1px; }
.rsx-v { background: var(--adm-accent); }
.rsx-o { background: var(--adm-text-3); opacity: 0.55; }
.rsx-plot { position: relative; height: 180px; margin-top: 40px; border-bottom: 1px solid var(--adm-border); }
.rsx-ref { position: absolute; left: 0; right: 0; border-top: 1px dashed var(--adm-border); pointer-events: none; }
.rsx-ref > span { position: absolute; right: 0; top: 0; transform: translateY(-50%); width: 48px; font-size: 0.72rem; color: var(--adm-text-3); background: var(--adm-surface); padding-left: 6px; }
.rsx-cols { position: absolute; left: 0; right: 56px; top: 0; bottom: 0; display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 6px; }
.rsx-col { position: relative; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 2px; border-radius: 6px 6px 0 0; outline: none; }
.rsx-col:hover { background: var(--adm-line); }
.rsx-col > i { display: block; width: 100%; max-width: 40px; flex: none; }
.rsx-col > i:first-of-type { border-radius: 4px 4px 0 0; }
.rsx-val { font-size: 0.72rem; color: var(--adm-text-2); font-variant-numeric: tabular-nums; margin-bottom: 2px; }
.rsx-col[data-current="true"] .rsx-val { color: var(--adm-text); font-weight: 600; }
.rsx-tip { position: absolute; bottom: 100%; left: 50%; transform: translate(-50%, -8px); background: var(--adm-surface-3); border: 1px solid var(--adm-border); border-radius: 8px; padding: 6px 10px; font-size: 0.75rem; color: var(--adm-text); white-space: nowrap; pointer-events: none; opacity: 0; transition: opacity 0.12s; z-index: 3; }
.rsx-col:hover .rsx-tip, .rsx-col:focus .rsx-tip { opacity: 1; }
.rsx-col:nth-child(-n+3) .rsx-tip { left: 0; transform: translate(0, -8px); }
.rsx-col:nth-last-child(-n+3) .rsx-tip { left: auto; right: 0; transform: translate(0, -8px); }
.rsx-x { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 6px; margin: 8px 56px 0 0; font-size: 0.72rem; color: var(--adm-text-3); text-align: center; white-space: nowrap; }
.rsx-x > span[data-current="true"] { color: var(--adm-text); font-weight: 600; }

.rsx-spark { position: relative; height: 52px; margin: 16px 4px 4px; touch-action: pan-y; cursor: crosshair; }
.rsx-spark-empty { border-bottom: 1px dashed var(--adm-line); cursor: default; }
.rsx-spark > svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.rsx-dot { position: absolute; width: 8px; height: 8px; border-radius: 999px; background: var(--adm-accent); box-shadow: 0 0 0 2px var(--adm-surface); transform: translate(-50%, -50%); pointer-events: none; }
.rsx-cross { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--adm-border); pointer-events: none; }
.rsx-spark-tip { position: absolute; top: -6px; transform: translate(-50%, -100%); background: var(--adm-surface-3); border: 1px solid var(--adm-border); border-radius: 6px; padding: 3px 8px; font-size: 0.72rem; color: var(--adm-text); white-space: nowrap; pointer-events: none; font-variant-numeric: tabular-nums; z-index: 2; }

@media (max-width: 640px) {
  .rsx-seg { display: flex; width: 100%; box-sizing: border-box; flex-wrap: nowrap; }
  .rsx-seg button { flex: 1 1 0; padding: 0 8px; min-width: 0; }
  .rsx-cols, .rsx-x { gap: 3px; }
  .rsx-x > span:not([data-major="true"]) { visibility: hidden; }
  .rsx-row { flex-direction: column; }
  .rsx-row > .admin-btn-ghost { width: 100%; }
  .rsx-submit > .admin-btn-primary { width: 100%; }
  .rsx-danger { margin-left: 0; }
  .rsx-top > li { padding: 12px 16px; }
}
`;

export function ReseauxStyles() {
  return <style>{CSS}</style>;
}

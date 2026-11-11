"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { DelegateForm } from "@/components/delegate-form";

/** Les écrans interactifs de l'espace JP : ma journée (tâches), habitudes, nutrition, connaissances, calendrier. */

async function post(body: Record<string, unknown>, url = "/api/admin/moi") {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Erreur d'enregistrement");
  return json;
}

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

const Err = ({ error }: { error: string | null }) => (error ? <p style={{ fontSize: "0.8rem", color: "var(--adm-bad)", margin: "6px 0 0" }}>{error}</p> : null);

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const DOW = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
export const shortDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

// ───────────────────────── Ma journée ─────────────────────────

export interface DayEntryItem {
  key: string;
  title: string;
  due: string | null;
  source: "mandalart" | "perso";
  code: string | null;
  star: boolean;
  status: string;
  taskId: string | null;
  objectiveName: string | null;
  late: boolean;
}

function DayRow({ e }: { e: DayEntryItem }) {
  const { busy, error, run } = useAction();
  const [done, setDone] = useState(false);
  const [delegating, setDelegating] = useState(false);
  const check = () =>
    run(async () => {
      setDone(true);
      if (e.source === "mandalart") await post({ action: "status", code: e.code, status: "fait" }, "/api/admin/mandalart");
      else await post({ action: "status", id: e.taskId, status: "fait" });
    }).then((ok) => !ok && setDone(false));
  return (
    <li className="mda-task" data-s={done ? "fait" : e.status}>
      <button type="button" className="mda-check" data-s={done ? "fait" : e.status} disabled={busy || done} onClick={check} aria-label="Marquer comme fait">
        <span>{done ? "✓" : ""}</span>
      </button>
      <div className="mda-task-body">
        <p className="mda-task-title">
          {e.star ? <span title="Priorité absolue">⭐ </span> : null}
          {e.title}
        </p>
        <div className="mda-task-meta">
          {e.due ? <span className={e.late ? "mda-late" : undefined}>{e.late ? `En retard · ${shortDate(e.due)}` : shortDate(e.due)}</span> : <span>Sans date</span>}
          {e.source === "mandalart" ? <span className="mda-pill" title={e.objectiveName ?? undefined}>Mandalart {e.code}</span> : <span>Ma liste</span>}
          <button type="button" className="mda-task-more" onClick={() => setDelegating((d) => !d)}>
            {delegating ? "Fermer" : "Confier"}
          </button>
        </div>
        {delegating ? (
          <DelegateForm
            mandalartCode={e.source === "mandalart" ? e.code : null}
            defaultTitle={e.title}
            defaultDue={e.due}
            onCancel={() => setDelegating(false)}
            onDone={() => {
              setDelegating(false);
              if (e.taskId) void post({ action: "status", id: e.taskId, status: "abandonne" });
              setDone(true);
            }}
          />
        ) : null}
        <Err error={error} />
      </div>
    </li>
  );
}

export function DayList({ entries, empty }: { entries: DayEntryItem[]; empty: string }) {
  if (!entries.length) return <p style={{ padding: "14px 20px", margin: 0, fontSize: "0.88rem", color: "var(--adm-text-3)" }}>{empty}</p>;
  return (
    <ul className="mda-tasks">
      {entries.map((e) => (
        <DayRow key={e.key} e={e} />
      ))}
    </ul>
  );
}

export function AddTask({ today }: { today: string }) {
  const { busy, error, run } = useAction();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(today);
  const [delegate, setDelegate] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  if (delegate) {
    return (
      <div style={{ padding: "0 20px 16px" }}>
        <DelegateForm
          withTitle
          defaultTitle={title}
          defaultDue={due}
          onCancel={() => setDelegate(false)}
          onDone={(who) => {
            setDelegate(false);
            setTitle("");
            setSent(`Envoyée à ${who}.`);
          }}
        />
      </div>
    );
  }
  return (
    <div style={{ padding: "0 20px 16px", display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(0, 1fr) auto" }}>
        <input className="admin-input" placeholder="Nouvelle tâche (ex. rappeler le gymnase Saint-Gabriel)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="admin-input" type="date" value={due} onChange={(e) => setDue(e.target.value)} style={{ maxWidth: 160 }} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="admin-btn-primary"
          disabled={busy || title.trim().length < 3}
          onClick={() => run(() => post({ action: "add", title, due: due || null, assignee: "JP" })).then((ok) => ok && (setTitle(""), setSent("Ajoutée à ta journée.")))}
        >
          Pour moi
        </button>
        <button type="button" className="admin-btn-ghost" disabled={busy || title.trim().length < 3} onClick={() => setDelegate(true)}>
          Confier à quelqu&apos;un…
        </button>
      </div>
      {sent ? <p style={{ fontSize: "0.8rem", color: "var(--adm-good)", margin: 0 }}>{sent}</p> : null}
      <Err error={error} />
    </div>
  );
}

export interface DelegatedItem {
  id: string;
  title: string;
  assignee: string;
  due: string | null;
  status: string;
  late: boolean;
  seen: boolean;
  doneNote: string | null;
  evidenceUrl: string | null;
  code: string | null;
  doneAt: string | null;
}

export function DelegatedRow({ t }: { t: DelegatedItem }) {
  const { busy, error, run } = useAction();
  const open = t.status === "a_faire" || t.status === "en_cours";
  return (
    <li className="mda-task" data-s={t.status}>
      <span className="mda-check" data-s={t.status} aria-hidden>
        <span>{t.status === "fait" ? "✓" : ""}</span>
      </span>
      <div className="mda-task-body">
        <p className="mda-task-title">{t.title}</p>
        <div className="mda-task-meta">
          <span style={{ fontWeight: 600 }}>{t.assignee}</span>
          {t.due ? <span className={t.late && open ? "mda-late" : undefined}>{t.late && open ? `En retard · ${shortDate(t.due)}` : shortDate(t.due)}</span> : null}
          <span>{t.status === "fait" ? "Faite" : t.status === "en_cours" ? "S'en occupe" : t.status === "abandonne" ? "Reprise" : t.seen ? "Vue, pas commencée" : "Pas encore ouverte"}</span>
          {t.code ? <span className="mda-pill">Mandalart {t.code}</span> : null}
          {open ? (
            <>
              <button type="button" className="mda-task-more" disabled={busy} onClick={() => run(() => post({ action: "status", id: t.id, status: "fait" }))}>
                Marquer faite
              </button>
              <button type="button" className="mda-task-more" disabled={busy} onClick={() => confirm(`Reprendre cette tâche ? ${t.assignee} n'aura plus rien à faire.`) && run(() => post({ action: "take-back", id: t.id }))}>
                Reprendre
              </button>
            </>
          ) : null}
        </div>
        {t.doneNote ? <p style={{ fontSize: "0.82rem", color: "var(--adm-text-2)", margin: "6px 0 0", whiteSpace: "pre-wrap" }}>« {t.doneNote} »</p> : null}
        {t.evidenceUrl ? (
          <a href={t.evidenceUrl} target="_blank" rel="noreferrer" style={{ fontSize: "0.82rem" }}>
            Voir le lien
          </a>
        ) : null}
        <Err error={error} />
      </div>
    </li>
  );
}

// ───────────────────────── Habitudes ─────────────────────────

export interface HabitWeekItem {
  id: string;
  name: string;
  kind: "check" | "nombre";
  unit: string | null;
  target: number;
  days: { day: string; value: number | null; met: boolean }[];
  met: number;
  goal: number;
  streak: number;
  average: number | null;
}

function HabitCell({ h, d, today }: { h: HabitWeekItem; d: HabitWeekItem["days"][number]; today: string }) {
  const { busy, run } = useAction();
  const [value, setValue] = useState<number | null>(d.value);
  const future = d.day > today;
  const met = h.kind === "check" ? (value ?? 0) >= 1 : value !== null && value >= h.target;
  if (h.kind === "check") {
    return (
      <button
        type="button"
        className="jp-cell"
        data-met={String(met)}
        data-today={String(d.day === today)}
        disabled={busy || future}
        onClick={() => {
          const next = met ? null : 1;
          setValue(next);
          void run(() => post({ action: "habit-log", habitId: h.id, day: d.day, value: next }));
        }}
        aria-label={`${h.name}, ${shortDate(d.day)} : ${met ? "fait" : "pas fait"}`}
      >
        {met ? "✓" : ""}
      </button>
    );
  }
  return (
    <input
      className="jp-cell jp-cell-num"
      data-met={String(met)}
      data-today={String(d.day === today)}
      disabled={future}
      inputMode="decimal"
      defaultValue={d.value ?? ""}
      aria-label={`${h.name}, ${shortDate(d.day)}`}
      onBlur={(e) => {
        const raw = e.target.value.replace(",", ".").trim();
        const next = raw === "" ? null : Number(raw);
        if (next !== null && !Number.isFinite(next)) return;
        if (next === value) return;
        setValue(next);
        void run(() => post({ action: "habit-log", habitId: h.id, day: d.day, value: next }));
      }}
    />
  );
}

export function HabitsBoard({ weeks, today }: { weeks: HabitWeekItem[]; today: string }) {
  const days = weeks[0]?.days.map((d) => d.day) ?? [];
  return (
    <div className="jp-habits" role="table" aria-label="Habitudes de la semaine">
      <div className="jp-habits-row jp-habits-head" role="row">
        <span role="columnheader">Habitude</span>
        {days.map((d) => (
          <span key={d} role="columnheader" data-today={String(d === today)}>
            {shortDate(d).split(" ")[0]}
            <br />
            {shortDate(d).split(" ")[1]}
          </span>
        ))}
        <span role="columnheader">Semaine</span>
      </div>
      {weeks.map((h) => (
        <div key={h.id} className="jp-habits-row" role="row">
          <span role="cell" className="jp-habit-name">
            {h.name}
            <small>
              {h.kind === "check" ? `${h.target} jours / semaine` : `${h.target} ${h.unit ?? ""} par jour`}
              {h.streak >= 2 ? ` · série de ${h.streak} jours 🔥` : ""}
            </small>
          </span>
          {h.days.map((d) => (
            <span key={d.day} role="cell">
              <HabitCell h={h} d={d} today={today} />
            </span>
          ))}
          <span role="cell" className="jp-habit-score" data-ok={String(h.met >= h.goal)}>
            {h.met}/{h.goal}
            {h.average !== null ? <small>moy. {h.average}</small> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

export function HabitEditor({ habits }: { habits: { id: string; name: string; kind: "check" | "nombre"; unit: string | null; target: number; active: boolean }[] }) {
  const { busy, error, run } = useAction();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"check" | "nombre">("check");
  const [target, setTarget] = useState("5");
  const [unit, setUnit] = useState("");
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
        {habits.map((h) => (
          <li key={h.id} style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", opacity: h.active ? 1 : 0.5 }}>
            <span style={{ fontSize: "0.88rem" }}>
              {h.name} <span style={{ color: "var(--adm-text-3)" }}>· {h.kind === "check" ? `${h.target} j / sem.` : `${h.target} ${h.unit ?? ""} / jour`}</span>
            </span>
            <button type="button" className="admin-btn-ghost" disabled={busy} onClick={() => run(() => post({ action: "habit-save", id: h.id, name: h.name, kind: h.kind, unit: h.unit, target: h.target, active: !h.active }))}>
              {h.active ? "Retirer" : "Remettre"}
            </button>
          </li>
        ))}
      </ul>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        <input className="admin-input" placeholder="Nouvelle habitude (ex. méditation)" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="admin-input" value={kind} onChange={(e) => setKind(e.target.value as "check" | "nombre")}>
          <option value="check">À cocher (jours / semaine)</option>
          <option value="nombre">Un nombre chaque jour</option>
        </select>
        <input className="admin-input" inputMode="decimal" placeholder={kind === "check" ? "Jours visés / semaine" : "Valeur visée / jour"} value={target} onChange={(e) => setTarget(e.target.value)} />
        {kind === "nombre" ? <input className="admin-input" placeholder="Unité (heures, verres…)" value={unit} onChange={(e) => setUnit(e.target.value)} /> : null}
      </div>
      <div>
        <button
          type="button"
          className="admin-btn-primary"
          disabled={busy || name.trim().length < 2 || !Number(target.replace(",", "."))}
          onClick={() => run(() => post({ action: "habit-save", name, kind, unit: kind === "nombre" ? unit : null, target: Number(target.replace(",", ".")) })).then((ok) => ok && setName(""))}
        >
          Ajouter l&apos;habitude
        </button>
      </div>
      <Err error={error} />
    </div>
  );
}

// ───────────────────────── Nutrition ─────────────────────────

const MOMENTS = [
  ["dejeuner", "Déjeuner"],
  ["diner", "Dîner"],
  ["souper", "Souper"],
  ["collation", "Collation"],
  ["avant-match", "Avant pratique / match"]
] as const;

export function MealForm({ today }: { today: string }) {
  const { busy, error, run } = useAction();
  const [day, setDay] = useState(today);
  const [moment, setMoment] = useState<string>("dejeuner");
  const [description, setDescription] = useState("");
  const [protein, setProtein] = useState("");
  const [quality, setQuality] = useState<string>("bien");
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <input className="admin-input" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        <select className="admin-input" value={moment} onChange={(e) => setMoment(e.target.value)}>
          {MOMENTS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select className="admin-input" value={quality} onChange={(e) => setQuality(e.target.value)} aria-label="Qualité">
          <option value="bien">Bien mangé</option>
          <option value="moyen">Moyen</option>
          <option value="a-ameliorer">À améliorer</option>
        </select>
      </div>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(0, 1fr) 130px" }}>
        <input className="admin-input" placeholder="Ce que j'ai mangé (ex. 3 œufs, toasts, banane)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <input className="admin-input" inputMode="numeric" placeholder="Protéines (g)" value={protein} onChange={(e) => setProtein(e.target.value)} />
      </div>
      <div>
        <button
          type="button"
          className="admin-btn-primary"
          disabled={busy || description.trim().length < 2}
          onClick={() =>
            run(() => post({ action: "meal-add", day, moment, description, proteinG: protein ? Math.round(Number(protein)) || null : null, quality })).then((ok) => ok && (setDescription(""), setProtein("")))
          }
        >
          Noter le repas
        </button>
      </div>
      <Err error={error} />
    </div>
  );
}

export function MealDelete({ id }: { id: string }) {
  const { busy, run } = useAction();
  return (
    <button type="button" className="mda-task-more" disabled={busy} onClick={() => run(() => post({ action: "meal-delete", id }))} aria-label="Effacer ce repas">
      Effacer
    </button>
  );
}

// ───────────────────────── Connaissances ─────────────────────────

export interface KnowledgeItem {
  id: string;
  title: string;
  source_type: string;
  author: string | null;
  url: string | null;
  status: "a-lire" | "en-cours" | "fini";
  lessons: string | null;
  apply_to: string | null;
  tags: string[];
  applied: boolean;
}

const SOURCES = [
  ["livre", "Livre"],
  ["video", "Vidéo"],
  ["cours", "Cours"],
  ["balado", "Balado"],
  ["mentor", "Mentor"],
  ["article", "Article"],
  ["experience", "Expérience vécue"]
] as const;

export function KnowledgeForm({ item, onClose }: { item?: KnowledgeItem; onClose?: () => void }) {
  const { busy, error, run } = useAction();
  const [f, setF] = useState({
    title: item?.title ?? "",
    sourceType: item?.source_type ?? "livre",
    author: item?.author ?? "",
    url: item?.url ?? "",
    status: item?.status ?? "en-cours",
    lessons: item?.lessons ?? "",
    applyTo: item?.apply_to ?? "",
    tags: item?.tags.join(", ") ?? "",
    applied: item?.applied ?? false
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <input className="admin-input" placeholder="Titre (ex. $100M Offers)" value={f.title} onChange={set("title")} />
        <input className="admin-input" placeholder="Auteur ou source" value={f.author} onChange={set("author")} />
        <select className="admin-input" value={f.sourceType} onChange={set("sourceType")}>
          {SOURCES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select className="admin-input" value={f.status} onChange={set("status")}>
          <option value="a-lire">À lire / écouter</option>
          <option value="en-cours">En cours</option>
          <option value="fini">Fini</option>
        </select>
      </div>
      <textarea className="admin-input" rows={4} placeholder="Ce que j'en retiens (les idées clés, une par ligne)" value={f.lessons} onChange={set("lessons")} />
      <textarea className="admin-input" rows={2} placeholder="Comment je l'applique à l'académie ou à mon image" value={f.applyTo} onChange={set("applyTo")} />
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <input className="admin-input" placeholder="Lien (facultatif)" value={f.url} onChange={set("url")} />
        <input className="admin-input" placeholder="Étiquettes : marketing, coaching, finances" value={f.tags} onChange={set("tags")} />
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.85rem" }}>
        <input type="checkbox" checked={f.applied} onChange={(e) => setF({ ...f, applied: e.target.checked })} /> Déjà appliqué
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="admin-btn-primary"
          disabled={busy || f.title.trim().length < 2}
          onClick={() =>
            run(() => post({ action: "knowledge-save", id: item?.id, ...f, author: f.author || null, url: f.url || null, lessons: f.lessons || null, applyTo: f.applyTo || null })).then((ok) => {
              if (!ok) return;
              if (onClose) onClose();
              else setF({ ...f, title: "", author: "", url: "", lessons: "", applyTo: "", tags: "", applied: false });
            })
          }
        >
          {item ? "Enregistrer" : "Ajouter à mes connaissances"}
        </button>
        {item ? (
          <button type="button" className="admin-btn-ghost" disabled={busy} onClick={() => confirm("Effacer cette fiche ?") && run(() => post({ action: "knowledge-delete", id: item.id })).then((ok) => ok && onClose?.())}>
            Effacer
          </button>
        ) : null}
        {onClose ? (
          <button type="button" className="admin-btn-ghost" onClick={onClose}>
            Fermer
          </button>
        ) : null}
      </div>
      <Err error={error} />
    </div>
  );
}

export function KnowledgeCard({ k, sourceLabel, statusLabel }: { k: KnowledgeItem; sourceLabel: string; statusLabel: string }) {
  const [edit, setEdit] = useState(false);
  if (edit) {
    return (
      <li className="mda-task" style={{ display: "block" }}>
        <KnowledgeForm item={k} onClose={() => setEdit(false)} />
      </li>
    );
  }
  return (
    <li className="mda-task" style={{ display: "block" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <p className="mda-task-title" style={{ fontWeight: 600 }}>
          {k.url ? (
            <a href={k.url} target="_blank" rel="noreferrer">
              {k.title}
            </a>
          ) : (
            k.title
          )}
          {k.author ? <span style={{ fontWeight: 400, color: "var(--adm-text-3)" }}> · {k.author}</span> : null}
        </p>
        <button type="button" className="mda-task-more" onClick={() => setEdit(true)}>
          Modifier
        </button>
      </div>
      <div className="mda-task-meta">
        <span>{sourceLabel}</span>
        <span>{statusLabel}</span>
        {k.applied ? <span style={{ color: "var(--adm-good)" }}>Appliqué</span> : null}
        {k.tags.map((t) => (
          <span key={t} className="mda-pill">
            {t}
          </span>
        ))}
      </div>
      {k.lessons ? <p style={{ fontSize: "0.86rem", color: "var(--adm-text-2)", margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{k.lessons}</p> : null}
      {k.apply_to ? (
        <p style={{ fontSize: "0.86rem", margin: "6px 0 0", whiteSpace: "pre-wrap" }}>
          <strong>À appliquer :</strong> {k.apply_to}
        </p>
      ) : null}
    </li>
  );
}

// ───────────────────────── Calendrier ─────────────────────────

export function CalendarConnect({ connected }: { connected: boolean }) {
  const { busy, error, run } = useAction();
  const [url, setUrl] = useState("");
  const [open, setOpen] = useState(!connected);
  if (!open) {
    return (
      <button type="button" className="admin-btn-ghost" onClick={() => setOpen(true)}>
        Changer le lien Google Agenda
      </button>
    );
  }
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <ol style={{ margin: 0, paddingLeft: 18, fontSize: "0.86rem", color: "var(--adm-text-2)", lineHeight: 1.6 }}>
        <li>Ouvre Google Agenda sur l&apos;ordinateur, roue dentée → Paramètres.</li>
        <li>À gauche, sous « Paramètres de mes agendas », clique ton agenda (jpaka06@gmail.com).</li>
        <li>Descends à « Intégrer l&apos;agenda » et copie l&apos;« Adresse secrète au format iCal ».</li>
        <li>Colle-la ici. Elle reste privée : seule ton admin la lit.</li>
      </ol>
      <input className="admin-input" placeholder="https://calendar.google.com/calendar/ical/…/private-…/basic.ics" value={url} onChange={(e) => setUrl(e.target.value)} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="admin-btn-primary" disabled={busy || !url.trim()} onClick={() => run(() => post({ action: "calendar-url", url })).then((ok) => ok && setOpen(false))}>
          {busy ? "Vérification…" : "Brancher mon agenda"}
        </button>
        {connected ? (
          <>
            <button type="button" className="admin-btn-ghost" onClick={() => setOpen(false)}>
              Annuler
            </button>
            <button type="button" className="admin-btn-ghost" disabled={busy} onClick={() => run(() => post({ action: "calendar-url", url: null }))}>
              Débrancher
            </button>
          </>
        ) : null}
      </div>
      <Err error={error} />
    </div>
  );
}

// ───────────────────────── Mon plan ─────────────────────────

export interface PlanStepItem {
  id: string;
  text: string;
  link?: { label: string; href: string };
  done: boolean;
}

/** Une étape de « Mon plan » : un toucher la coche (ou la décoche). */
export function PlanStepRow({ s, next }: { s: PlanStepItem; next?: boolean }) {
  const { busy, error, run } = useAction();
  const [done, setDone] = useState(s.done);
  const toggle = () => {
    const to = !done;
    setDone(to);
    void run(() => post({ action: "plan-step", stepId: s.id, done: to })).then((ok) => !ok && setDone(!to));
  };
  return (
    <li className="mda-task" data-s={done ? "fait" : "a_faire"} style={next && !done ? { background: "var(--adm-accent-soft)" } : undefined}>
      <button type="button" className="mda-check" data-s={done ? "fait" : "a_faire"} disabled={busy} onClick={toggle} aria-label={done ? "Décocher" : "Marquer comme fait"}>
        <span>{done ? "✓" : ""}</span>
      </button>
      <div className="mda-task-body">
        <p className="mda-task-title" style={done ? { textDecoration: "line-through", color: "var(--adm-text-3)" } : undefined}>
          {next && !done ? <strong>👉 </strong> : null}
          {s.text}
        </p>
        {s.link && !done ? (
          <div className="mda-task-meta">
            <a href={s.link.href}>Ouvrir {s.link.label} →</a>
          </div>
        ) : null}
        <Err error={error} />
      </div>
    </li>
  );
}

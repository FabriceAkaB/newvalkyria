"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import { ExerciseDiagramEditor, ExerciseDiagramView } from "@/components/exercise-diagram";
import { Pill, dayLabel, shortDay } from "@/components/mandalart/ui";
import {
  AGE_GROUPS,
  APPROVAL_SCORE,
  DEFAULT_PLACE,
  EXERCISE_CATEGORIES,
  EXERCISE_LEVELS,
  EXERCISE_TYPES,
  MATERIAL_SUGGESTIONS,
  RATING_CRITERIA,
  SESSION_PLACES,
  SIZE_BANDS,
  STATUS_LABEL,
  STATUS_TONE,
  VENUES,
  applicableBands,
  checklistSummary,
  fmtScore,
  placeLabel,
  recommendedVenue,
  typeLabel,
  venueLabel,
  type ExerciseSheetFields,
  type ExerciseType
} from "@/lib/exercise-bank";
import type { BankEntry, ExerciseDiagram, ExerciseRating } from "@/lib/exercises-repo";

interface FormState {
  title: string;
  exerciseType: string;
  sessionPlace: string;
  category: string;
  objective: string;
  ageGroups: string[];
  level: string;
  minPlayers: string;
  maxPlayers: string;
  venue: string;
  dimensions: string;
  durationMinutes: string;
  material: string;
  instructions: string;
  coachingPoints: string;
  commonMistakes: string;
  setup57: string;
  setup810: string;
  setup1116: string;
  variantEasier: string;
  variantHarder: string;
  variantCognitive: string;
  variants: string;
  progression: string;
  physicalMetrics: string;
  videoUrl: string;
  author: string;
}

const SETUP_FIELD: Record<(typeof SIZE_BANDS)[number]["key"], "setup57" | "setup810" | "setup1116"> = { setup_5_7: "setup57", setup_8_10: "setup810", setup_11_16: "setup1116" };

function fromEntry(e: BankEntry | null): FormState {
  return {
    title: e?.title ?? "",
    exerciseType: e?.exercise_type ?? "",
    sessionPlace: e?.session_place ?? "",
    category: e?.category ?? "",
    objective: e?.objective ?? "",
    ageGroups: e?.age_groups ?? [],
    level: e?.level ?? "",
    minPlayers: e?.min_players?.toString() ?? "",
    maxPlayers: e?.max_players?.toString() ?? "",
    venue: e?.venue ?? "",
    dimensions: e?.dimensions ?? "",
    durationMinutes: e?.duration_minutes?.toString() ?? "",
    material: e?.material ?? "",
    instructions: e?.instructions ?? "",
    coachingPoints: e?.coaching_points ?? "",
    commonMistakes: e?.common_mistakes ?? "",
    setup57: e?.setup_5_7 ?? "",
    setup810: e?.setup_8_10 ?? "",
    setup1116: e?.setup_11_16 ?? "",
    variantEasier: e?.variant_easier ?? "",
    variantHarder: e?.variant_harder ?? "",
    variantCognitive: e?.variant_cognitive ?? "",
    variants: e?.variants ?? "",
    progression: e?.progression ?? "",
    physicalMetrics: e?.physical_metrics ?? "",
    videoUrl: e?.video_url ?? "",
    author: e?.author ?? (e ? "" : "JP")
  };
}

const num = (s: string) => (s.trim() ? parseInt(s, 10) : null);

function toBody(f: FormState) {
  return { ...f, minPlayers: num(f.minPlayers), maxPlayers: num(f.maxPlayers), durationMinutes: num(f.durationMinutes) };
}

/** Les champs de la fiche tels que la liste de vérification les lit, pendant la saisie. */
function asSheet(f: FormState, e: BankEntry | null): ExerciseSheetFields {
  const t = (s: string) => (s.trim() ? s : null);
  return {
    title: f.title, objective: t(f.objective), category: t(f.category), exercise_type: t(f.exerciseType), session_place: t(f.sessionPlace), age_groups: f.ageGroups,
    level: t(f.level), min_players: num(f.minPlayers), max_players: num(f.maxPlayers), venue: t(f.venue), duration_minutes: num(f.durationMinutes), material: t(f.material),
    instructions: t(f.instructions), coaching_points: t(f.coachingPoints), setup_5_7: t(f.setup57), setup_8_10: t(f.setup810), setup_11_16: t(f.setup1116),
    variant_easier: t(f.variantEasier), variant_harder: t(f.variantHarder), variant_cognitive: t(f.variantCognitive), progression: t(f.progression),
    physical_metrics: t(f.physicalMetrics), image_url: e?.image_url ?? null, video_url: t(f.videoUrl), diagram_data: e?.diagram_data ?? null, author: t(f.author)
  };
}

/** `group` : champ fait de pastilles (pas un <label>, qui activerait la première pastille au clic). */
function Field({ label, hint, wide, group, children }: { label: string; hint?: React.ReactNode; wide?: boolean; group?: boolean; children: React.ReactNode }) {
  const className = `xb-field${wide ? " xb-field-wide" : ""}`;
  const content = (
    <>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </>
  );
  return group ? (
    <div className={className} role="group" aria-label={label}>
      {content}
    </div>
  ) : (
    <label className={className}>{content}</label>
  );
}

function ExerciseForm({ entry, onDone, startAsNewVersion }: { entry: BankEntry | null; onDone: () => void; startAsNewVersion: boolean }) {
  const router = useRouter();
  const [f, setF] = useState<FormState>(() => fromEntry(entry));
  const [newVersion, setNewVersion] = useState(startAsNewVersion);
  const [versionNote, setVersionNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof FormState) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: ev.target.value }));

  const sheet = checklistSummary(asSheet(f, entry));
  const bands = applicableBands(num(f.minPlayers), num(f.maxPlayers));
  const advice = recommendedVenue(f.exerciseType, f.category);
  const hasRatings = (entry?.bank.count ?? 0) > 0;

  const setType = (type: string) =>
    setF((p) => ({ ...p, exerciseType: type, sessionPlace: p.sessionPlace || DEFAULT_PLACE[type as ExerciseType] || "", venue: p.venue || recommendedVenue(type, p.category)?.venue || "" }));
  const toggleAge = (a: string) => setF((p) => ({ ...p, ageGroups: p.ageGroups.includes(a) ? p.ageGroups.filter((x) => x !== a) : [...p.ageGroups, a].sort((x, y) => AGE_GROUPS.indexOf(x as never) - AGE_GROUPS.indexOf(y as never)) }));
  const hasMaterial = (m: string) => f.material.toLowerCase().includes(m.toLowerCase());
  const toggleMaterial = (m: string) =>
    setF((p) => {
      if (hasMaterial(m)) return { ...p, material: p.material.split(/,\s*/).filter((x) => !x.toLowerCase().includes(m.toLowerCase())).join(", ") };
      return { ...p, material: p.material.trim() ? `${p.material.trim()}, ${m}` : m };
    });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(entry ? `/api/admin/exercises/${entry.id}` : "/api/admin/exercises", {
        method: entry ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...toBody(f), ...(entry ? { newVersion, versionNote } : {}) })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "La fiche n'a pas été enregistrée.");
        return;
      }
      if (!entry) {
        router.push(`/admin/exercices/${data.id}`);
        return;
      }
      // Le formulaire reste affiché jusqu'à ce que la fiche à jour arrive.
      startTransition(() => {
        router.refresh();
        onDone();
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="xb-form">
      {entry ? (
        <section className="mda-card">
          <label className="xb-toggle">
            <input type="checkbox" checked={newVersion} onChange={(e) => setNewVersion(e.target.checked)} />
            <span>
              <strong>C’est une nouvelle version de l’exercice (version {entry.version + 1})</strong>
              <br />
              <span className="mda-muted">
                {hasRatings ? `Les ${entry.bank.count} note(s) de la version ${entry.version} restent dans l'historique ; le compteur repart à zéro.` : "Le compteur de notes repart à zéro."} Décocher pour une petite correction.
              </span>
            </span>
          </label>
          {newVersion ? (
            <div className="xb-field" style={{ marginTop: 12 }}>
              <span>Ce qui change</span>
              <input className="admin-input" value={versionNote} onChange={(e) => setVersionNote(e.target.value)} placeholder="Ex. : 2 ballons de plus, plus de file d'attente" />
            </div>
          ) : null}
      <section className="mda-card">
        <h2 className="mda-h2">L’essentiel</h2>
        <div className="xb-grid" style={{ marginTop: 12 }}>
          <Field label="Titre" wide>
            <input className="admin-input" value={f.title} onChange={set("title")} placeholder="Ex. : Rondo 4 contre 2 avec changement de zone" autoFocus={!entry} />
          </Field>
          <Field label="Type d'exercice" wide group>
            <div className="xb-chips" role="radiogroup" aria-label="Type d'exercice">
              {EXERCISE_TYPES.map((t) => (
                <button key={t.key} type="button" role="radio" aria-checked={f.exerciseType === t.key} className="xb-chip" data-on={f.exerciseType === t.key || undefined} onClick={() => setType(f.exerciseType === t.key ? "" : t.key)}>
                  {t.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Place dans la séance">
            <select className="admin-input" value={f.sessionPlace} onChange={set("sessionPlace")}>
              <option value="">À choisir</option>
              {SESSION_PLACES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Geste ou thème">
            <select className="admin-input" value={f.category} onChange={set("category")}>
              <option value="">À choisir</option>
              {EXERCISE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              {f.category && !(EXERCISE_CATEGORIES as readonly string[]).includes(f.category) ? <option value={f.category}>{f.category}</option> : null}
            </select>
          </Field>
          <Field label="Auteur">
            <input className="admin-input" value={f.author} onChange={set("author")} placeholder="Qui a créé l'exercice" />
          </Field>
          <Field label="Objectif" wide>
            <textarea className="admin-input" rows={2} value={f.objective} onChange={set("objective")} placeholder="Ce que la joueuse apprend ou améliore" />
          </Field>
        </div>
      </section>

      <section className="mda-card">
        <h2 className="mda-h2">Pour qui, où, avec quoi</h2>
        <div className="xb-grid" style={{ marginTop: 12 }}>
          <Field label="Âge ou génération" wide group>
            <div className="xb-chips">
              {AGE_GROUPS.map((a) => (
                <button key={a} type="button" className="xb-chip" data-on={f.ageGroups.includes(a) || undefined} aria-pressed={f.ageGroups.includes(a)} onClick={() => toggleAge(a)}>
                  {a}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Niveau">
            <select className="admin-input" value={f.level} onChange={set("level")}>
              <option value="">À choisir</option>
              {EXERCISE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              {f.level && !(EXERCISE_LEVELS as readonly string[]).includes(f.level) ? <option value={f.level}>{f.level}</option> : null}
            </select>
          </Field>
          <Field label="Joueuses minimum">
            <input className="admin-input" type="number" inputMode="numeric" min={1} value={f.minPlayers} onChange={set("minPlayers")} />
          </Field>
          <Field label="Joueuses maximum">
            <input className="admin-input" type="number" inputMode="numeric" min={1} value={f.maxPlayers} onChange={set("maxPlayers")} />
          </Field>
          <Field label="Durée (minutes)">
            <input className="admin-input" type="number" inputMode="numeric" min={1} value={f.durationMinutes} onChange={set("durationMinutes")} />
          </Field>
          <Field label="Lieu" hint={advice ? `Conseil : ${advice.why}${f.venue && f.venue !== advice.venue && f.venue !== "les-deux" ? " (choix différent)" : ""}.` : "Gymnase : technique et ball mastery. Synthétique : tactique, grand espace, prise de décision."}>
            <select className="admin-input" value={f.venue} onChange={set("venue")}>
              <option value="">À choisir</option>
              {VENUES.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Dimensions de l'espace">
            <input className="admin-input" value={f.dimensions} onChange={set("dimensions")} placeholder="Ex. : 20 m × 15 m" />
          </Field>
          <Field label="Matériel" wide group>
            <input className="admin-input" aria-label="Matériel" value={f.material} onChange={set("material")} placeholder="Ballons, cônes, dossards bicolores…" />
            <div className="xb-chips" style={{ marginTop: 4 }}>
              {MATERIAL_SUGGESTIONS.map((m) => (
                <button key={m} type="button" className="xb-chip" data-on={hasMaterial(m) || undefined} onClick={() => toggleMaterial(m)}>
                  {m}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </section>

      <section className="mda-card">
        <h2 className="mda-h2">Déroulement</h2>
        <div className="xb-grid" style={{ marginTop: 12 }}>
          <Field label="Déroulement" wide>
            <textarea className="admin-input" rows={4} value={f.instructions} onChange={set("instructions")} placeholder="Comment l'exercice se joue, étape par étape" />
          </Field>
          <Field label="Consignes clés" wide hint="Ce que l'éducateur dit et corrige ; explicable en moins de 2 minutes.">
            <textarea className="admin-input" rows={3} value={f.coachingPoints} onChange={set("coachingPoints")} />
          </Field>
          <Field label="Erreurs fréquentes" wide>
            <textarea className="admin-input" rows={2} value={f.commonMistakes} onChange={set("commonMistakes")} />
          </Field>
        </div>
      </section>

      <section className="mda-card">
        <h2 className="mda-h2">Organisation selon le nombre de joueuses</h2>
        <p className="mda-sub">Un ballon par fille, aucune file d’attente : comment on monte l’exercice avec 5 à 7, 8 à 10 ou 11 à 16 joueuses.</p>
        <div className="xb-grid">
          {SIZE_BANDS.map((b) => {
            const needed = bands.some((x) => x.key === b.key);
            return (
              <Field key={b.key} label={b.label} hint={needed ? undefined : "Pas nécessaire avec ce nombre de joueuses."}>
                <textarea className="admin-input" rows={4} value={f[SETUP_FIELD[b.key]]} onChange={set(SETUP_FIELD[b.key])} placeholder={needed ? "Groupes, espaces, rotations" : ""} />
              </Field>
            );
          })}
        </div>
      </section>

      <section className="mda-card">
        <h2 className="mda-h2">Variantes et progression</h2>
        <div className="xb-grid" style={{ marginTop: 12 }}>
          <Field label="Variante plus facile">
            <textarea className="admin-input" rows={3} value={f.variantEasier} onChange={set("variantEasier")} />
          </Field>
          <Field label="Variante plus difficile">
            <textarea className="admin-input" rows={3} value={f.variantHarder} onChange={set("variantHarder")} />
          </Field>
          <Field label="Variante cognitive" hint="Prise d'information, couleurs, chiffres, consigne à décoder.">
            <textarea className="admin-input" rows={3} value={f.variantCognitive} onChange={set("variantCognitive")} />
          </Field>
          <Field label="Progression" wide hint="Sur place, en mouvement, à vitesse, sous pression ou en jeu.">
            <textarea className="admin-input" rows={3} value={f.progression} onChange={set("progression")} />
          </Field>
          {f.exerciseType === "physique" || f.physicalMetrics ? (
            <Field label="Métriques (exercice physique)" wide hint="Séries, durée d'effort, récupération, distance, intensité.">
              <textarea className="admin-input" rows={2} value={f.physicalMetrics} onChange={set("physicalMetrics")} />
            </Field>
          ) : null}
          {f.variants ? (
            <Field label="Autres variantes" wide>
              <textarea className="admin-input" rows={2} value={f.variants} onChange={set("variants")} />
            </Field>
          ) : null}
          <Field label="Lien vidéo" wide hint={entry ? "Le schéma et la photo s'ajoutent depuis la fiche." : "Le schéma et la photo s'ajoutent après l'enregistrement."}>
            <input className="admin-input" value={f.videoUrl} onChange={set("videoUrl")} placeholder="https://…" inputMode="url" />
          </Field>
        </div>
      </section>

        </section>
      ) : null}

      <div className="xb-savebar">
        <span className="xb-savebar-info">
          {sheet.complete ? "Fiche complète ✓" : `Fiche ${sheet.done}/${sheet.total} · il manque : ${sheet.missing.map((m) => m.label.toLowerCase()).slice(0, 3).join(", ")}${sheet.missing.length > 3 ? "…" : ""}`}
          {error ? <span className="xb-error" style={{ display: "block" }}>{error}</span> : null}
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          {entry ? (
            <button type="button" className="admin-btn-ghost" onClick={onDone}>
              Annuler
            </button>
          ) : (
            <Link href="/admin/exercices" className="admin-btn-ghost" style={{ textDecoration: "none" }}>
              Annuler
            </Link>
          )}
          <button type="button" className="admin-btn-primary" onClick={save} disabled={saving || refreshing || !f.title.trim()}>
            {saving || refreshing ? "Enregistrement…" : entry ? "Enregistrer" : "Créer l'exercice"}
          </button>
        </span>
      </div>
    </div>
  );
}

function Block({ title, text, missing }: { title: string; text: string | null | undefined; missing?: boolean }) {
  return (
    <div className="xb-block">
      <h3>{title}</h3>
      {text ? <p>{text}</p> : <p className={missing === false ? "xb-na" : "xb-missing"}>{missing === false ? "Pas nécessaire" : "À écrire"}</p>}
    </div>
  );
}

export function AdminExerciceFiche({ entry, ratings }: { entry: BankEntry | null; ratings: ExerciseRating[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(entry === null);
  const [asNewVersion, setAsNewVersion] = useState(false);
  const [editingDiagram, setEditingDiagram] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  if (!entry || editing) {
    return (
      <>
        <AdminTopbar />
        <div className="admin-content">
          <div className="admin-section mda">
            <header>
              <p className="mda-eyebrow">{entry ? `Fiche Valkyria · version ${entry.version}` : "Banque d'exercices Valkyria"}</p>
              <h1 className="mda-h1">{entry ? (asNewVersion ? `Nouvelle version : ${entry.title}` : `Modifier : ${entry.title}`) : "Nouvel exercice"}</h1>
              <p className="mda-lead">La fiche suit la liste de vérification Valkyria ; ce qui manque est indiqué en bas. Un nouvel exercice part « à tester ».</p>
            </header>
            <ExerciseForm
              entry={entry}
              startAsNewVersion={asNewVersion}
              onDone={() => {
                setEditing(false);
                setAsNewVersion(false);
              }}
            />
          </div>
        </div>
      </>
    );
  }

  const e = entry;
  const b = e.bank;
  const sheet = checklistSummary(e);
  const bands = applicableBands(e.min_players, e.max_players);
  const advice = recommendedVenue(e.exercise_type, e.category);
  const sortedRatings = [...ratings].sort((x, y) => (y.activity_date ?? y.created_at).localeCompare(x.activity_date ?? x.created_at));

  const decide = async (action: "valider" | "annuler-validation" | "retirer" | "remettre", reason?: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/exercises/${e.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) setError(data?.error ?? "L'action n'a pas fonctionné.");
      else startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  };

  const approve = () => {
    if (!sheet.complete && !confirm(`La fiche n'est pas complète (il manque : ${sheet.missing.map((m) => m.label.toLowerCase()).join(", ")}). L'approuver quand même ?`)) return;
    decide("valider");
  };
  const retire = () => {
    const reason = prompt("Pourquoi retirer cet exercice de la banque ? (facultatif)");
    if (reason === null) return;
    decide("retirer", reason);
  };
  const restore = () => {
    const reason = prompt("Qu'est-ce qui change pour le remettre à l'essai ? (nouvelle version)");
    if (reason === null) return;
    decide("remettre", reason || "Remis à l'essai par JP");
  };
  const remove = async () => {
    if (!confirm(`Supprimer définitivement « ${e.title} » et ses ${b.countAll} note(s) ? Pour le sortir de la banque sans perdre l'historique, utiliser « Retirer ».`)) return;
    const res = await fetch(`/api/admin/exercises/${e.id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/exercices");
  };
  const saveDiagram = async (diagram: ExerciseDiagram) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/exercises/${e.id}/diagram`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(diagram) });
      if (res.ok) {
        setEditingDiagram(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };
  const uploadImage = async (file: File | undefined) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch(`/api/admin/exercises/${e.id}/image`, { method: "POST", body: formData });
    if (res.ok) router.refresh();
  };
  const edit = (newVersion: boolean) => {
    setAsNewVersion(newVersion);
    setEditing(true);
  };

  const primary =
    b.status === "a-valider" ? { label: "Approuver cet exercice", run: approve }
    : b.status === "a-changer" ? { label: "Faire la nouvelle version", run: () => edit(true) }
    : b.status === "retire" ? { label: "Remettre à l'essai", run: restore }
    : !sheet.complete ? { label: "Compléter la fiche", run: () => edit(false) }
    : null;

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">
              {[typeLabel(e.exercise_type) ?? "Type à choisir", placeLabel(e.session_place), `version ${e.version}`, e.author ? `par ${e.author}` : null].filter(Boolean).join(" · ")}
            </p>
            <h1 className="mda-h1">
              {b.top ? "★ " : ""}
              {e.title}
            </h1>
            <div className="xb-status-line">
              <Pill tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Pill>
              <span>{b.reason}</span>
            </div>
            {e.retired_reason && b.status === "retire" ? <p className="mda-sub" style={{ margin: "6px 0 0" }}>Raison : {e.retired_reason}</p> : null}
            <div className="xb-actions">
              {primary ? (
                <button type="button" className="admin-btn-primary" onClick={primary.run} disabled={busy || refreshing}>
                  {busy || refreshing ? "Un instant…" : primary.label}
                </button>
              ) : null}
              <button type="button" className="admin-btn-ghost" onClick={() => edit(false)}>
                Modifier la fiche
              </button>
              {b.status !== "a-changer" && b.status !== "retire" && b.count > 0 ? (
                <button type="button" className="admin-btn-ghost" onClick={() => edit(true)}>
                  Nouvelle version
                </button>
              ) : null}
              <button type="button" className="admin-btn-ghost" onClick={() => setEditingDiagram((v) => !v)}>
                {editingDiagram ? "Fermer le schéma" : e.diagram_data ? "Modifier le schéma" : "Ajouter un schéma"}
              </button>
              <button type="button" className="admin-btn-ghost" onClick={() => fileInput.current?.click()}>
                {e.image_url ? "Changer la photo" : "Ajouter une photo"}
              </button>
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={(ev) => uploadImage(ev.target.files?.[0])} />
            </div>
            {error ? <p className="xb-error" style={{ marginTop: 8 }}>{error}</p> : null}
          </header>

          <section className="mda-cols-3">
            <div className="mda-card">
              <p className="mda-num">
                {fmtScore(b.average)}
                {b.average !== null ? <span className="mda-muted" style={{ fontSize: "0.9rem", fontWeight: 500 }}> /10</span> : null}
              </p>
              <p className="mda-label">
                Note moyenne de la version {e.version} · {b.count ? `${b.count} note${b.count > 1 ? "s" : ""}` : "aucune note"}
                {b.countAll > b.count ? ` (${b.countAll} en tout)` : ""}
              </p>
            </div>
            <div className="mda-card">
              <p className="mda-num" style={{ color: b.coachesAtApproval >= 2 ? "var(--adm-good)" : undefined }}>{Math.min(b.coachesAtApproval, 2)}/2</p>
              <p className="mda-label">Éducateurs différents à {APPROVAL_SCORE} ou plus{b.status === "approuve" && e.validated_at ? ` · validé par JP le ${dayLabel(e.validated_at)}` : ""}</p>
            </div>
            <div className="mda-card">
              <p className="mda-num" style={{ color: sheet.complete ? "var(--adm-good)" : "var(--adm-warn)" }}>
                {sheet.done}/{sheet.total}
              </p>
              <p className="mda-label">{sheet.complete ? "Fiche Valkyria complète" : `Fiche Valkyria : ${sheet.missing.length} élément${sheet.missing.length > 1 ? "s" : ""} à compléter`}</p>
            </div>
          </section>

          {editingDiagram ? (
            <section className="mda-card">
              <h2 className="mda-h2">Schéma</h2>
              <ExerciseDiagramEditor initial={e.diagram_data} onSave={saveDiagram} saving={busy} />
            </section>
          ) : null}

          <section className="mda-card">
            <h2 className="mda-h2">La fiche</h2>
            <div className="xb-blocks" style={{ marginTop: 16 }}>
              <dl className="xb-facts">
                <div><dt>Geste ou thème</dt><dd>{e.category ?? "—"}</dd></div>
                <div><dt>Âge</dt><dd>{e.age_groups?.length ? e.age_groups.join(", ") : "—"}</dd></div>
                <div><dt>Niveau</dt><dd>{e.level ?? "—"}</dd></div>
                <div><dt>Joueuses</dt><dd>{e.min_players && e.min_players === e.max_players ? e.min_players : e.min_players || e.max_players ? `${e.min_players ?? "?"} à ${e.max_players ?? "?"}` : "—"}</dd></div>
                <div>
                  <dt>Lieu</dt>
                  <dd>
                    {venueLabel(e.venue) ?? "—"}
                    {advice && e.venue && e.venue !== advice.venue && e.venue !== "les-deux" ? <span className="mda-muted"> (conseil : {venueLabel(advice.venue)?.toLowerCase()})</span> : null}
                  </dd>
                </div>
                <div><dt>Espace</dt><dd>{e.dimensions ?? "—"}</dd></div>
                <div><dt>Durée</dt><dd>{e.duration_minutes ? `${e.duration_minutes} min` : "—"}</dd></div>
                <div><dt>Matériel</dt><dd>{e.material ?? "—"}</dd></div>
              </dl>
              <Block title="Objectif" text={e.objective} />
              <Block title="Déroulement" text={e.instructions} />
              <Block title="Consignes clés" text={e.coaching_points} />
              {e.common_mistakes ? <Block title="Erreurs fréquentes" text={e.common_mistakes} /> : null}
              <div className="xb-block">
                <h3>Organisation selon le nombre de joueuses</h3>
                <div className="xb-trio">
                  {SIZE_BANDS.map((band) => (
                    <Block key={band.key} title={band.label} text={e[band.key]} missing={bands.some((x) => x.key === band.key) ? undefined : false} />
                  ))}
                </div>
              </div>
              <div className="xb-block">
                <h3>Variantes</h3>
                <div className="xb-trio">
                  <Block title="Plus facile" text={e.variant_easier} />
                  <Block title="Plus difficile" text={e.variant_harder} />
                  <Block title="Cognitive" text={e.variant_cognitive} />
                </div>
              </div>
              {e.variants ? <Block title="Autres variantes" text={e.variants} /> : null}
              <Block title="Progression" text={e.progression} />
              {e.exercise_type === "physique" || e.physical_metrics ? <Block title="Métriques" text={e.physical_metrics} /> : null}
              {e.diagram_data && !editingDiagram ? (
                <div className="xb-block">
                  <h3>Schéma</h3>
                  <ExerciseDiagramView diagram={e.diagram_data} />
                </div>
              ) : null}
              {e.image_url ? (
                <div className="xb-block">
                  <h3>Photo</h3>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={e.image_url} alt={e.title} style={{ maxWidth: "min(100%, 420px)", borderRadius: 8 }} />
                </div>
              ) : null}
              {e.video_url ? (
                <div className="xb-block">
                  <h3>Vidéo</h3>
                  <p>
                    <a href={e.video_url} target="_blank" rel="noreferrer" style={{ color: "var(--adm-accent)" }}>
                      Voir la vidéo ↗
                    </a>
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <div className="mda-cols-2" style={{ alignItems: "start" }}>
            <section className="mda-card">
              <h2 className="mda-h2">Liste de vérification Valkyria</h2>
              <p className="mda-sub">{sheet.complete ? "Tout y est." : `Il manque ${sheet.missing.length} élément${sheet.missing.length > 1 ? "s" : ""}.`}</p>
              <ul className="xb-check">
                {sheet.items.map((i) => (
                  <li key={i.key} data-ok={i.ok}>
                    <span className="xb-check-mark" aria-hidden>{i.ok ? "✓" : ""}</span>
                    <span>
                      {i.label}
                      <span className="sr-only">{i.ok ? " : fait" : " : manquant"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mda-card-flush">
              <div className="mda-card-head">
                <div>
                  <h2 className="mda-h2" style={{ margin: 0 }}>Notes des éducateurs</h2>
                  <p className="mda-sub" style={{ margin: 0 }}>Données dans le portail entraîneur après la séance (5 critères à 0, 1 ou 2).</p>
                </div>
              </div>
              {sortedRatings.length ? (
                <ul className="xb-ratings">
                  {sortedRatings.map((r) => (
                    <li key={r.id} className="xb-rating" data-old={r.exercise_version !== e.version || undefined}>
                      <div>
                        <p className="xb-rating-who" style={{ margin: 0 }}>{r.rater_name ?? "Éducateur"}</p>
                        <p className="mda-muted" style={{ margin: 0, fontSize: "0.8rem" }}>
                          {r.activity_id ? (
                            <Link href={`/admin/entraineurs/activites/${r.activity_id}`} style={{ color: "inherit" }}>
                              Séance du {shortDay(r.activity_date ?? r.created_at)}
                            </Link>
                          ) : (
                            `Le ${shortDay(r.activity_date ?? r.created_at)}`
                          )}
                          {` · version ${r.exercise_version}`}
                        </p>
                      </div>
                      <div className="xb-rating-total" data-low={r.total < APPROVAL_SCORE || undefined}>
                        {r.total}
                        <small>/10</small>
                      </div>
                      <div className="xb-rating-crit">
                        {RATING_CRITERIA.map((c) => (
                          <span key={c.key} style={r.scores?.[c.key] === 0 ? { color: "var(--adm-bad)" } : undefined}>
                            {c.short} {r.scores?.[c.key] ?? "—"}
                          </span>
                        ))}
                      </div>
                      {r.comment ? <p className="xb-rating-comment">« {r.comment} »</p> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mda-sub" style={{ padding: 20, margin: 0 }}>
                  Pas encore de note. Mets l’exercice dans le plan d’une séance ; les éducateurs le noteront après la pratique.
                </p>
              )}
            </section>
          </div>

          {e.version_history?.length ? (
            <section className="mda-card">
              <h2 className="mda-h2">Versions</h2>
              <ul className="xb-check" style={{ marginTop: 8 }}>
                <li data-ok="true">
                  <span className="xb-check-mark" aria-hidden>1</span>
                  <span>Version 1 · créée le {dayLabel(e.created_at)}</span>
                </li>
                {e.version_history.map((h) => (
                  <li key={h.version} data-ok="true">
                    <span className="xb-check-mark" aria-hidden>{h.version}</span>
                    <span>
                      Version {h.version} · {dayLabel(h.at)}
                      {h.note ? ` · ${h.note}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mda-card xb-danger">
            <span className="mda-sub" style={{ margin: 0 }}>
              {b.status === "retire" ? "Retiré : il n'est plus proposé dans les plans de séance." : "Retirer garde la fiche et ses notes, mais l'exercice n'est plus proposé dans les plans de séance."}
            </span>
            <span style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {b.status === "approuve" ? (
                <button type="button" className="admin-btn-ghost" onClick={() => decide("annuler-validation")} disabled={busy}>
                  Annuler ma validation
                </button>
              ) : null}
              {b.status !== "retire" ? (
                <button type="button" className="admin-btn-ghost" onClick={retire} disabled={busy}>
                  Retirer de la banque
                </button>
              ) : null}
              <button type="button" className="xb-link-danger" onClick={remove}>
                Supprimer définitivement
              </button>
            </span>
          </section>
        </div>
      </div>
    </>
  );
}

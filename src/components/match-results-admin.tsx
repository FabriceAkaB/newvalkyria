"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  OUR_NAME,
  clubInitials,
  crestColors,
  lessonNotesFrom,
  matchDayLabel,
  normalizeAnalysis,
  parseLogo,
  parseVideoLink,
  summarizeLessons,
  type MatchAnalysis,
  type MatchLessons
} from "@/lib/match-results-core";

/* ══ Pastille d'équipe : logo, emoji ou initiales sur une couleur tirée du nom ══ */

export function Crest({ name, logo, size = 40, ours = false }: { name: string; logo?: string | null; size?: number; ours?: boolean }) {
  const parsed = parseLogo(logo);
  const box = { width: size, height: size, borderRadius: "50%", flexShrink: 0 } as const;
  if (ours && name === OUR_NAME) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/logo.png" alt="" width={size} height={size} style={{ ...box, objectFit: "contain", borderRadius: 0 }} />;
  }
  if (parsed?.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={parsed.url} alt="" width={size} height={size} style={{ ...box, objectFit: "cover", background: "var(--adm-surface-3)" }} />;
  }
  const { bg, fg } = crestColors(name);
  return (
    <span
      aria-hidden
      style={{ ...box, display: "inline-flex", alignItems: "center", justifyContent: "center", background: bg, color: fg, fontWeight: 700, fontSize: Math.round(size * (parsed?.kind === "emoji" ? 0.5 : 0.36)), letterSpacing: "0.02em" }}
    >
      {parsed?.kind === "emoji" ? parsed.text : clubInitials(name)}
    </span>
  );
}

/* ══ Résumé du match → à travailler en pratique ══ */

const toneColor = { good: "var(--adm-good)", bad: "var(--adm-bad)", warn: "var(--adm-warn)" };
const box: React.CSSProperties = { background: "var(--adm-surface-2)", borderRadius: "var(--adm-radius-sm)", padding: "12px 14px" };
const label: React.CSSProperties = { fontSize: "0.78rem", fontWeight: 600, color: "var(--adm-text-3)", margin: "0 0 8px" };
const small: React.CSSProperties = { fontSize: "0.8rem", color: "var(--adm-text-3)", margin: 0, lineHeight: 1.45 };

function ThemeList({ items, tone }: { items: MatchLessons["toFix"]; tone: "good" | "bad" }) {
  if (!items.length) return <p style={small}>{tone === "good" ? "Aucune force nommée pour l'instant." : "Rien à corriger dans les notes."}</p>;
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      {items.slice(0, 6).map((t) => {
        const n = tone === "good" ? t.positive : t.negative;
        const who = tone === "good" ? t.playersStrong : t.playersToFix;
        return (
          <li key={t.key} style={{ fontSize: "0.88rem", color: "var(--adm-text)", lineHeight: 1.4 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: toneColor[tone], flexShrink: 0 }} aria-hidden />
              <strong style={{ fontWeight: 600 }}>{t.label}</strong>
              <span style={{ color: "var(--adm-text-3)", fontVariantNumeric: "tabular-nums" }}>
                {n} mention{n > 1 ? "s" : ""}
                {t.matches > 1 ? ` · ${t.matches} matchs` : ""}
              </span>
            </span>
            {who.length ? <span style={{ display: "block", ...small, paddingLeft: 16 }}>{who.map((w) => w.split(" ")[0]).join(", ")}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Le bloc « Résumé du match → à travailler en pratique » (fiche du match, panneau d'après-match, Nos matchs). */
export function LessonsView({ lessons, title = "Résumé du match → à travailler en pratique", action, footnote }: { lessons: MatchLessons; title?: string; action?: React.ReactNode; footnote?: React.ReactNode }) {
  if (lessons.empty) {
    return (
      <div>
        <p style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 4px" }}>{title}</p>
        <p style={small}>
          Rien à résumer encore. Les commentaires écrits pour chaque joueuse après le match (et l&apos;analyse : points forts, à corriger, actions) sont regroupés ici par thème : passes, contrôle, 1 contre 1, placement, transition…
        </p>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <p style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 4px" }}>{title}</p>
        <p style={small}>
          {lessons.matches > 1 ? `${lessons.matches} matchs · ` : ""}
          {lessons.notesRead} note{lessons.notesRead > 1 ? "s" : ""} lue{lessons.notesRead > 1 ? "s" : ""}
          {lessons.evaluated ? ` · ${lessons.evaluated} joueuse${lessons.evaluated > 1 ? "s" : ""} évaluée${lessons.evaluated > 1 ? "s" : ""}` : ""}
          {lessons.avgNote !== null ? ` · moyenne ${lessons.avgNote.toLocaleString("fr-CA")}/10` : ""}
        </p>
      </div>

      {lessons.priorities.length ? (
        <div style={{ ...box, background: "var(--adm-accent-soft)" }}>
          <p style={{ ...label, color: "var(--adm-accent)" }}>Priorités pour les prochaines pratiques</p>
          <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            {lessons.priorities.map((p, i) => (
              <li key={p.key} style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--adm-accent)", fontVariantNumeric: "tabular-nums", minWidth: 18 }}>{i + 1}</span>
                <span>
                  <strong style={{ fontSize: "0.98rem", color: "var(--adm-text)" }}>{p.label}</strong>
                  <span style={{ display: "block", ...small }}>{p.why}</span>
                </span>
              </li>
            ))}
          </ol>
          {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <div style={box}>
          <p style={label}>À corriger</p>
          <ThemeList items={lessons.toFix} tone="bad" />
        </div>
        <div style={box}>
          <p style={label}>Forces</p>
          <ThemeList items={lessons.strengths} tone="good" />
        </div>
      </div>

      {lessons.watch.length ? (
        <div style={box}>
          <p style={label}>Joueuses à surveiller</p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {lessons.watch.slice(0, 8).map((w) => (
              <li key={w.name} style={{ fontSize: "0.88rem", color: "var(--adm-text)" }}>
                <strong style={{ fontWeight: 600 }}>{w.name}</strong>
                <span style={{ color: "var(--adm-text-3)" }}>
                  {w.note !== null ? ` · ${w.note.toLocaleString("fr-CA")}/10` : ""}
                  {w.themes.length ? ` · ${w.themes.join(", ")}` : w.negatives ? ` · ${w.negatives} point${w.negatives > 1 ? "s" : ""} à corriger` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {lessons.otherFixes.length ? (
        <details style={box}>
          <summary style={{ ...label, margin: 0, cursor: "pointer" }}>Autres points notés ({lessons.otherFixes.length})</summary>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            {lessons.otherFixes.map((t) => (
              <li key={t} style={{ fontSize: "0.85rem", color: "var(--adm-text-2)" }}>{t}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {lessons.toFix.some((t) => t.examples.length) ? (
        <details style={box}>
          <summary style={{ ...label, margin: 0, cursor: "pointer" }}>Ce qui a été écrit, par thème</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {lessons.themes.slice(0, 8).map((t) => (
              <div key={t.key}>
                <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--adm-text)", margin: "0 0 2px" }}>{t.label}</p>
                {t.examples.map((e) => (
                  <p key={e} style={{ ...small, color: "var(--adm-text-2)" }}>« {e} »</p>
                ))}
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {footnote ? <p style={small}>{footnote}</p> : null}
    </div>
  );
}

/* ══ « Ajouter au thème de la semaine prochaine » ══ */

export function ApplyLessonsButton({ matchId, weekStart, theme, added, disabled }: { matchId: string; weekStart: string; theme: string | null; added: boolean; disabled?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<{ busy: boolean; done: boolean; error: string | null; theme: string | null }>({ busy: false, done: added, error: null, theme });
  const week = `semaine du ${matchDayLabel(weekStart)}`;
  const apply = async () => {
    setState((s) => ({ ...s, busy: true, error: null }));
    const res = await fetch(`/api/admin/matchs/resultats/${matchId}/lecons`, { method: "POST" });
    const json = await res.json().catch(() => null);
    if (!res.ok) return setState((s) => ({ ...s, busy: false, error: json?.error ?? "Erreur, réessaie." }));
    setState({ busy: false, done: true, error: null, theme: json?.theme ?? theme });
    router.refresh();
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
      <button type="button" className={state.done ? "admin-btn-ghost" : "admin-btn-primary"} onClick={apply} disabled={state.busy || disabled} style={{ minHeight: 44 }}>
        {state.busy ? "Ajout…" : state.done ? "Mettre à jour dans le thème" : "Ajouter au thème de la semaine prochaine"}
      </button>
      <span style={{ ...small, color: state.error ? "var(--adm-bad)" : state.done ? "var(--adm-good)" : "var(--adm-text-3)" }}>
        {state.error ??
          (state.done
            ? `Dans les notes du thème, ${week}${state.theme ? ` (« ${state.theme} »)` : ""} : les éducateurs le voient dans la pratique du jour.`
            : `${week}${state.theme ? ` · thème prévu : « ${state.theme} » (il reste, les priorités s'ajoutent à ses notes)` : " · aucun thème prévu : la 1re priorité deviendra le thème"}`)}
      </span>
    </div>
  );
}

/** Panneau d'après-match (Entraînements et portail) : le résumé se recalcule à chaque évaluation enregistrée. */
export function MatchLessonsLive({
  activityId,
  role,
  evaluations,
  names,
  analysis,
  summary
}: {
  activityId: string;
  role: "admin" | "coach";
  evaluations: { registration_id: string; scale: number; score: number | null; comment: string | null }[];
  names: Record<string, string>;
  analysis: unknown;
  summary: string | null;
}) {
  const lessons = useMemo(
    () =>
      summarizeLessons([
        {
          matchId: activityId,
          notes: lessonNotesFrom(
            evaluations.map((e) => ({ player: names[e.registration_id] ?? "Joueuse", scale: e.scale, score: e.score, comment: e.comment })),
            normalizeAnalysis(analysis) as MatchAnalysis,
            summary
          )
        }
      ]),
    [activityId, evaluations, names, analysis, summary]
  );
  // Le bouton n'apparaît que pour JP connecté à l'admin (aussi depuis le portail des éducateurs).
  const [target, setTarget] = useState<{ weekStart: string; theme: string | null; added: boolean } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/matchs/resultats/${activityId}/lecons`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j?.target) setTarget(j.target);
      })
      .catch(() => null);
    return () => {
      alive = false;
    };
  }, [activityId, lessons.priorities.length]);

  return (
    <div style={{ marginBottom: "1.5rem", background: "var(--adm-surface)", borderRadius: "var(--adm-radius)", padding: 16 }}>
      <LessonsView
        lessons={lessons}
        action={target ? <ApplyLessonsButton key={`${target.weekStart}-${target.added}`} matchId={activityId} weekStart={target.weekStart} theme={target.theme} added={target.added} /> : null}
        footnote={
          role === "admin" ? (
            <>
              Score, résumé écrit, vidéo et analyse :{" "}
              <a href={`/admin/matchs/resultats/${activityId}`} style={{ color: "var(--adm-accent)" }}>
                fiche du match
              </a>
              .
            </>
          ) : (
            "Regroupé automatiquement à partir de tes commentaires : sois précis (ex. « doit lever la tête avant de recevoir »)."
          )
        }
      />
    </div>
  );
}

/* ══ Fiche du match : score, résumé, analyse, lien vidéo, adversaire ══ */

export interface SheetFormInitial {
  scoreUs: number | null;
  scoreThem: number | null;
  cancelled: boolean;
  opponentName: string;
  homeAway: "home" | "away";
  opponentLogo: string;
  summary: string;
  analysis: MatchAnalysis;
  videoUrl: string;
}

const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
const fieldLabel: React.CSSProperties = { fontSize: "0.8rem", fontWeight: 600, color: "var(--adm-text-2)" };

export function MatchSheetForm({ id, ourName, initial, canEditHome }: { id: string; ourName: string; initial: SheetFormInitial; canEditHome: boolean }) {
  const router = useRouter();
  const [v, setV] = useState({
    ...initial,
    scoreUs: initial.scoreUs === null ? "" : String(initial.scoreUs),
    scoreThem: initial.scoreThem === null ? "" : String(initial.scoreThem)
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => {
    setV((s) => ({ ...s, [k]: value }));
    setMsg(null);
  };
  const video = parseVideoLink(v.videoUrl);
  const logo = parseLogo(v.opponentLogo);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = (s: string) => (s.trim() === "" ? null : Math.max(0, Math.round(Number(s))));
    const scoreUs = num(v.scoreUs);
    const scoreThem = num(v.scoreThem);
    if ((scoreUs === null) !== (scoreThem === null)) return setMsg({ ok: false, text: "Entre les deux scores, ou aucun." });
    setBusy(true);
    const res = await fetch(`/api/admin/matchs/resultats/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scoreUs, scoreThem, cancelled: v.cancelled, opponentName: v.opponentName, homeAway: v.homeAway, opponentLogo: v.opponentLogo, summary: v.summary, analysis: v.analysis, videoUrl: v.videoUrl })
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: json?.error ?? "Erreur, réessaie." });
    setMsg({ ok: true, text: "Enregistré." });
    router.refresh();
  };

  return (
    <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
        <label style={field}>
          <span style={fieldLabel}>{ourName}</span>
          <input className="admin-input" inputMode="numeric" type="number" min={0} max={99} value={v.scoreUs} onChange={(e) => set("scoreUs", e.target.value)} style={{ width: 88, fontSize: "1.4rem", textAlign: "center", fontVariantNumeric: "tabular-nums" }} aria-label={`Buts ${ourName}`} />
        </label>
        <span style={{ fontSize: "1.4rem", color: "var(--adm-text-3)", paddingBottom: 10 }}>–</span>
        <label style={field}>
          <span style={fieldLabel}>Adversaire</span>
          <input className="admin-input" inputMode="numeric" type="number" min={0} max={99} value={v.scoreThem} onChange={(e) => set("scoreThem", e.target.value)} style={{ width: 88, fontSize: "1.4rem", textAlign: "center", fontVariantNumeric: "tabular-nums" }} aria-label="Buts de l'adversaire" />
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "0.88rem", color: "var(--adm-text-2)", minHeight: 44 }}>
          <input type="checkbox" checked={v.cancelled} onChange={(e) => set("cancelled", e.target.checked)} /> Match annulé
        </label>
      </div>

      <label style={field}>
        <span style={fieldLabel}>Résumé de ce qui s&apos;est passé</span>
        <textarea className="admin-input" rows={4} maxLength={5000} value={v.summary} onChange={(e) => set("summary", e.target.value)} placeholder="Ex. On a dominé la 1re demie, deux buts sur transition ; on a reculé en 2e demie après l'égalisation." />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <label style={field}>
          <span style={fieldLabel}>Points forts</span>
          <textarea className="admin-input" rows={4} maxLength={4000} value={v.analysis.strengths} onChange={(e) => set("analysis", { ...v.analysis, strengths: e.target.value })} placeholder="Ce qui a marché" />
        </label>
        <label style={field}>
          <span style={fieldLabel}>À corriger</span>
          <textarea className="admin-input" rows={4} maxLength={4000} value={v.analysis.fixes} onChange={(e) => set("analysis", { ...v.analysis, fixes: e.target.value })} placeholder="Ce qui n'a pas marché" />
        </label>
        <label style={field}>
          <span style={fieldLabel}>Actions pour les pratiques</span>
          <textarea className="admin-input" rows={4} maxLength={4000} value={v.analysis.actions} onChange={(e) => set("analysis", { ...v.analysis, actions: e.target.value })} placeholder="Ex. travailler la communication et les passes courtes" />
        </label>
      </div>

      <label style={field}>
        <span style={fieldLabel}>Lien de la vidéo (YouTube non répertorié, Veo, Google Drive)</span>
        <input className="admin-input" type="url" inputMode="url" value={v.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} placeholder="https://youtu.be/…" />
        {v.videoUrl.trim() ? <span style={{ ...small, color: video ? "var(--adm-text-3)" : "var(--adm-bad)" }}>{video ? `${video.label}${video.embed ? " · lecteur affiché sur la fiche" : " · ouvert dans un nouvel onglet"}` : "Lien invalide (adresse https://…)."}</span> : null}
      </label>

      <details>
        <summary style={{ ...fieldLabel, cursor: "pointer", minHeight: 32 }}>Adversaire, logo, domicile</summary>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12, alignItems: "flex-end" }}>
          <label style={{ ...field, flex: "1 1 220px" }}>
            <span style={fieldLabel}>Nom de l&apos;adversaire</span>
            <input className="admin-input" maxLength={120} value={v.opponentName} onChange={(e) => set("opponentName", e.target.value)} placeholder="Ex. FC Laval · U12 D1" />
          </label>
          <label style={{ ...field, flex: "1 1 220px" }}>
            <span style={fieldLabel}>Logo (adresse https d&apos;une image ou un emoji)</span>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Crest name={v.opponentName || "?"} logo={logo ? v.opponentLogo : null} size={36} />
              <input className="admin-input" maxLength={500} value={v.opponentLogo} onChange={(e) => set("opponentLogo", e.target.value)} placeholder="🦁 ou https://…" style={{ flex: 1 }} />
            </span>
          </label>
          {canEditHome ? (
            <label style={field}>
              <span style={fieldLabel}>On joue</span>
              <select className="admin-input" value={v.homeAway} onChange={(e) => set("homeAway", e.target.value as "home" | "away")}>
                <option value="home">À domicile</option>
                <option value="away">À l&apos;extérieur</option>
              </select>
            </label>
          ) : null}
        </div>
      </details>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button type="submit" className="admin-btn-primary" disabled={busy} style={{ minHeight: 44 }}>
          {busy ? "Enregistrement…" : "Enregistrer la fiche"}
        </button>
        {msg ? <span style={{ fontSize: "0.85rem", color: msg.ok ? "var(--adm-good)" : "var(--adm-bad)" }}>{msg.text}</span> : null}
      </div>
    </form>
  );
}

/* ══ Plage vendue sans activité : créer l'activité du match pour noter les joueuses ══ */

export function CreateMatchActivity({ id, categories, suggested }: { id: string; categories: { id: string; label: string }[]; suggested: string | null }) {
  const router = useRouter();
  const [category, setCategory] = useState(suggested ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/matchs/resultats/${id}/activite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categoryId: category || null }) });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.activityId) {
      setBusy(false);
      return setError(json?.error ?? "L'activité n'a pas pu être créée. Réessaie.");
    }
    router.push(`/admin/entraineurs/activites/${json.activityId}`);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
        <label style={{ ...field, flex: "1 1 200px" }}>
          <span style={fieldLabel}>Joueuses de la catégorie</span>
          <select className="admin-input" value={category} onChange={(e) => setCategory(e.target.value)} style={{ minHeight: 44 }}>
            <option value="">Aucune (j&apos;ajouterai l&apos;effectif plus tard)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="admin-btn-primary" onClick={create} disabled={busy} style={{ minHeight: 44 }}>
          {busy ? "Création…" : "Créer l'activité du match"}
        </button>
      </div>
      <p style={small}>
        {error ? <span style={{ color: "var(--adm-bad)" }}>{error} </span> : null}
        Même date, heure et lieu que la plage vendue ; le score, le résumé et la vidéo restent sur cette fiche. Ensuite : assigne les éducateurs, convoque les joueuses, puis le chronomètre et les évaluations d&apos;après-match se font dans le portail.
      </p>
    </div>
  );
}

/* ══ Vidéo déposée dans le stockage privé (téléversement direct, lien signé) ══ */

function putFile(url: string, file: File, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type || "video/mp4");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      if (xhr.status === 413 || /too large|EntityTooLarge|maximum allowed size/i.test(xhr.responseText)) return reject(new Error("Vidéo trop lourde pour le dépôt direct. Mets-la sur YouTube (non répertoriée) et colle le lien."));
      if (/mime/i.test(xhr.responseText)) return reject(new Error("Ce fichier n'est pas une vidéo acceptée (MP4 ou MOV)."));
      reject(new Error("L'envoi n'a pas fonctionné. Réessaie."));
    };
    xhr.onerror = () => reject(new Error("La connexion a coupé pendant l'envoi. Réessaie sur le Wi-Fi."));
    xhr.send(file);
  });
}

export function VideoUpload({ id, hasFile }: { id: string; hasFile: boolean }) {
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setError(null);
    if (!/^video\//i.test(file.type || "")) return setError("Choisis un fichier vidéo (MP4, MOV).");
    setProgress(0);
    try {
      const res = await fetch(`/api/admin/matchs/resultats/${id}/video`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, contentType: file.type }) });
      const start = await res.json().catch(() => null);
      if (!res.ok) throw new Error(start?.error ?? "Dépôt impossible.");
      await putFile(start.signedUrl, file, setProgress);
      const done = await fetch(`/api/admin/matchs/resultats/${id}/video`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: start.path }) });
      const json = await done.json().catch(() => null);
      if (!done.ok) throw new Error(json?.error ?? "La vidéo n'a pas pu être reliée au match.");
      setProgress(null);
      router.refresh();
    } catch (err) {
      setProgress(null);
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  const remove = async () => {
    if (!window.confirm("Retirer la vidéo déposée ? Le fichier sera effacé du stockage.")) return;
    const res = await fetch(`/api/admin/matchs/resultats/${id}/video`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else setError("La vidéo n'a pas pu être retirée.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <label className="admin-btn-ghost" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", cursor: progress === null ? "pointer" : "default" }}>
          {progress !== null ? `Envoi… ${Math.round(progress * 100)} %` : hasFile ? "Remplacer la vidéo" : "Déposer une vidéo"}
          <input
            type="file"
            accept="video/*"
            hidden
            disabled={progress !== null}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void upload(f);
            }}
          />
        </label>
        {hasFile && progress === null ? (
          <button type="button" className="admin-btn-ghost" onClick={remove} style={{ minHeight: 44 }}>
            Retirer
          </button>
        ) : null}
      </div>
      {progress !== null ? (
        <div style={{ height: 6, borderRadius: 999, background: "var(--adm-surface-3)", overflow: "hidden" }}>
          <div style={{ width: `${Math.round(progress * 100)}%`, height: "100%", background: "var(--adm-accent)" }} />
        </div>
      ) : null}
      <p style={small}>
        {error ? <span style={{ color: "var(--adm-bad)" }}>{error} </span> : null}
        Stockage privé (Loi 25) : la vidéo n&apos;est jamais publique, elle se lit ici par un lien qui expire après 2 heures. Pour un match complet (gros fichier), un lien YouTube non répertorié est plus simple.
      </p>
    </div>
  );
}

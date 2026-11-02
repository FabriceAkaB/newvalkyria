"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { familyLabel, GESTURE_FAMILIES, gestureChecklist, placeLabelOf, PROGRESSION_STEPS, structureTotal, type Gesture, type Principle, type StructureBlock } from "@/lib/coaching-method";
import { LEVEL_LABEL, PASSPORT_LEVELS } from "@/lib/skill-tests";

type SaveState = { kind: "idle" | "saving" | "saved" | "error"; message?: string };

async function send(url: string, method: string, body: unknown): Promise<SaveState> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  if (res?.ok) return { kind: "saved", message: "Enregistré" };
  const data = await res?.json().catch(() => ({}));
  return { kind: "error", message: data?.error ?? "Pas enregistré : réessaie." };
}

function Status({ state }: { state: SaveState }) {
  if (state.kind === "saved") return <span style={{ color: "var(--adm-good)", fontSize: "0.82rem" }}>{state.message}</span>;
  if (state.kind === "error") return <span style={{ color: "var(--adm-bad)", fontSize: "0.82rem" }} role="alert">{state.message}</span>;
  return null;
}

/** Structure de séance (P1.1.01) : les blocs, leur durée, leur objectif et leurs règles ; total comparé à la pratique. */
export function StructureEditor({ initial, validated, practiceMinutes }: { initial: StructureBlock[]; validated: boolean; practiceMinutes: number }) {
  const router = useRouter();
  const [blocks, setBlocks] = useState(initial);
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const total = structureTotal(blocks);
  const upd = (i: number, patch: Partial<StructureBlock>) => {
    setBlocks((prev) => prev.map((b, j) => (j === i ? { ...b, ...patch } : b)));
    setState({ kind: "idle" });
  };
  const save = async (validate?: boolean) => {
    setState({ kind: "saving" });
    const s = await send("/api/admin/coaching/methode", "PUT", { slug: "structure", blocks, validated: validate });
    setState(s);
    if (s.kind === "saved") router.refresh();
  };

  return (
    <div>
      <p className="mda-lead" style={{ marginTop: 0 }}>
        Total : <strong style={{ color: total === practiceMinutes ? "var(--adm-good)" : "var(--adm-warn)" }}>{total} min</strong> pour une pratique de {practiceMinutes} min
        {total !== practiceMinutes ? ` (${total > practiceMinutes ? "+" : "−"}${Math.abs(total - practiceMinutes)} min)` : ""}.
      </p>
      <ol className="cm-blocks">
        {blocks.map((b, i) => (
          <li key={i} className="cm-block">
            <div className="cm-block-head">
              <span className="cm-place">{placeLabelOf(b.place)}</span>
              <input className="admin-input" value={b.label} onChange={(e) => upd(i, { label: e.target.value })} aria-label="Nom du bloc" />
              <label className="cm-minutes">
                <input className="admin-input" inputMode="numeric" value={String(b.minutes)} onChange={(e) => upd(i, { minutes: Number(e.target.value.replace(/\D/g, "")) || 0 })} aria-label="Minutes" />
                <span>min</span>
              </label>
            </div>
            <label className="ct-field"><span>Objectif</span><textarea className="admin-input" rows={2} value={b.objective} onChange={(e) => upd(i, { objective: e.target.value })} /></label>
            <label className="ct-field"><span>Règles</span><textarea className="admin-input" rows={2} value={b.rules} onChange={(e) => upd(i, { rules: e.target.value })} /></label>
          </li>
        ))}
      </ol>
      <div className="cm-actions">
        <button type="button" className="admin-btn-ghost" onClick={() => save()} disabled={state.kind === "saving"}>Enregistrer</button>
        {!validated ? (
          <button type="button" className="admin-btn-primary" onClick={() => save(true)} disabled={state.kind === "saving"}>Valider la structure</button>
        ) : (
          <button type="button" className="admin-btn-ghost" onClick={() => save(false)} disabled={state.kind === "saving"}>Remettre en proposition</button>
        )}
        <Status state={state} />
      </div>
    </div>
  );
}

/** Principes de la pédagogie Valkyria (P1.5.01, P1.4.05). */
export function PrinciplesEditor({ initial, validated }: { initial: Principle[]; validated: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const upd = (i: number, patch: Partial<Principle>) => {
    setItems((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));
    setState({ kind: "idle" });
  };
  const save = async (validate?: boolean) => {
    setState({ kind: "saving" });
    const s = await send("/api/admin/coaching/methode", "PUT", { slug: "principes", items, validated: validate });
    setState(s);
    if (s.kind === "saved") router.refresh();
  };
  return (
    <div>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((p, i) => (
          <div key={i} className="cm-block">
            <div style={{ display: "flex", gap: 8 }}>
              <input className="admin-input" value={p.title} onChange={(e) => upd(i, { title: e.target.value })} style={{ fontWeight: 600, flex: 1, minWidth: 0 }} aria-label="Titre du principe" />
              <button type="button" className="admin-btn-ghost" onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))} aria-label="Retirer ce principe">×</button>
            </div>
            <textarea className="admin-input" rows={2} value={p.text} onChange={(e) => upd(i, { text: e.target.value })} style={{ width: "100%", boxSizing: "border-box" }} aria-label="Texte du principe" />
          </div>
        ))}
      </div>
      <div className="cm-actions">
        <button type="button" className="admin-btn-ghost" onClick={() => setItems((prev) => [...prev, { title: "", text: "" }])}>+ Ajouter un principe</button>
        <button type="button" className="admin-btn-ghost" onClick={() => save()} disabled={state.kind === "saving"}>Enregistrer</button>
        {!validated && <button type="button" className="admin-btn-primary" onClick={() => save(true)} disabled={state.kind === "saving"}>Valider les principes</button>}
        <Status state={state} />
      </div>
    </div>
  );
}

/** Bibliothèque des gestes (P1.1.02 à P1.1.05) : un geste par carte, sa fiche et ce qui lui manque. */
export function GestureLibrary({ gestures }: { gestures: Gesture[] }) {
  const router = useRouter();
  const [family, setFamily] = useState<string>("toutes");
  const [openId, setOpenId] = useState<string | null>(null);
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const list = gestures.filter((g) => family === "toutes" || g.family === family);

  const add = async () => {
    setState({ kind: "saving" });
    const res = await fetch("/api/admin/coaching/gestes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Nouveau geste", family: family === "toutes" ? "semelle" : family })
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setState(res?.ok ? { kind: "idle" } : { kind: "error", message: data?.error ?? "Pas créé" });
    if (res?.ok) {
      setOpenId(data.id);
      router.refresh();
    }
  };

  return (
    <div>
      <div className="cm-actions" style={{ marginTop: 0 }}>
        <select className="admin-input" value={family} onChange={(e) => setFamily(e.target.value)} aria-label="Famille">
          <option value="toutes">Toutes les familles ({gestures.length})</option>
          {GESTURE_FAMILIES.map((f) => (
            <option key={f.key} value={f.key}>{f.label} ({gestures.filter((g) => g.family === f.key).length})</option>
          ))}
        </select>
        <button type="button" className="admin-btn-primary" onClick={add} disabled={state.kind === "saving"}>+ Ajouter un geste</button>
        <Status state={state} />
      </div>
      {list.length === 0 ? (
        <p className="admin-empty-text">Aucun geste dans cette famille. Commence par les 5 gestes de base du niveau bronze.</p>
      ) : (
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {list.map((g) => (
            <GestureCard key={g.id} gesture={g} open={openId === g.id} onToggle={() => setOpenId(openId === g.id ? null : g.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function GestureCard({ gesture, open, onToggle }: { gesture: Gesture; open: boolean; onToggle: () => void }) {
  const router = useRouter();
  const [g, setG] = useState({
    name: gesture.name,
    family: gesture.family,
    passportLevel: gesture.passport_level ?? "",
    execution: gesture.execution ?? "",
    keyPoints: [0, 1, 2].map((i) => gesture.key_points?.[i] ?? ""),
    commonMistakes: gesture.common_mistakes ?? "",
    videoUrl: gesture.video_url ?? "",
    progression: Object.fromEntries(PROGRESSION_STEPS.map((s) => [s.key, gesture.progression?.[s.key] ?? ""])) as Record<string, string>
  });
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const check = gestureChecklist({ ...gesture, passport_level: (g.passportLevel || null) as Gesture["passport_level"], execution: g.execution, key_points: g.keyPoints, common_mistakes: g.commonMistakes, video_url: g.videoUrl, progression: g.progression });
  const upd = (patch: Partial<typeof g>) => {
    setG((prev) => ({ ...prev, ...patch }));
    setState({ kind: "idle" });
  };
  const save = async (extra: Record<string, unknown> = {}) => {
    setState({ kind: "saving" });
    const s = await send("/api/admin/coaching/gestes", "PATCH", { id: gesture.id, ...g, passportLevel: g.passportLevel || null, ...extra });
    setState(s);
    if (s.kind === "saved") router.refresh();
  };

  return (
    <div className="cm-block" style={{ opacity: gesture.active ? 1 : 0.6 }}>
      <button type="button" onClick={onToggle} className="cm-gesture-head">
        <span style={{ minWidth: 0 }}>
          <strong>{gesture.name}</strong>
          <span className="cm-meta">
            {familyLabel(gesture.family)}
            {gesture.passport_level ? ` · ${LEVEL_LABEL[gesture.passport_level]}` : ""}
            {!gesture.active ? " · retiré" : ""}
          </span>
        </span>
        <span className="mda-pill" data-tone={check.done === check.total ? (gesture.validated_at ? "good" : "accent") : "warn"}>
          {check.done === check.total ? (gesture.validated_at ? "Validé" : "Fiche complète") : `Fiche ${check.done}/${check.total}`}
        </span>
      </button>
      {open && (
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
            <label className="ct-field"><span>Nom</span><input className="admin-input" value={g.name} onChange={(e) => upd({ name: e.target.value })} /></label>
            <label className="ct-field">
              <span>Famille</span>
              <select className="admin-input" value={g.family} onChange={(e) => upd({ family: e.target.value })}>
                {GESTURE_FAMILIES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </label>
            <label className="ct-field">
              <span>Niveau du passeport</span>
              <select className="admin-input" value={g.passportLevel} onChange={(e) => upd({ passportLevel: e.target.value })}>
                <option value="">—</option>
                {PASSPORT_LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
              </select>
            </label>
          </div>
          <label className="ct-field"><span>Exécution</span><textarea className="admin-input" rows={2} value={g.execution} onChange={(e) => upd({ execution: e.target.value })} /></label>
          <div className="ct-field">
            <span>3 points clés</span>
            {g.keyPoints.map((k, i) => (
              <input key={i} className="admin-input" value={k} placeholder={`Point clé ${i + 1}`} onChange={(e) => upd({ keyPoints: g.keyPoints.map((x, j) => (j === i ? e.target.value : x)) })} />
            ))}
          </div>
          <label className="ct-field"><span>Erreurs fréquentes</span><textarea className="admin-input" rows={2} value={g.commonMistakes} onChange={(e) => upd({ commonMistakes: e.target.value })} /></label>
          <label className="ct-field"><span>Vidéo de démonstration (moins d&apos;une minute, YouTube non répertorié)</span><input className="admin-input" type="url" value={g.videoUrl} onChange={(e) => upd({ videoUrl: e.target.value })} /></label>
          <div className="ct-field">
            <span>Progression en 4 étapes</span>
            {PROGRESSION_STEPS.map((s) => (
              <input key={s.key} className="admin-input" value={g.progression[s.key]} placeholder={s.label} aria-label={s.label} onChange={(e) => upd({ progression: { ...g.progression, [s.key]: e.target.value } })} />
            ))}
          </div>
          {check.missing.length > 0 && <p className="cm-meta" style={{ color: "var(--adm-warn)" }}>Manque : {check.missing.join(", ")}</p>}
          <div className="cm-actions">
            <button type="button" className="admin-btn-ghost" onClick={() => save()} disabled={state.kind === "saving"}>Enregistrer</button>
            {!gesture.validated_at && check.done === check.total && <button type="button" className="admin-btn-primary" onClick={() => save({ validated: true })} disabled={state.kind === "saving"}>Valider le geste</button>}
            <button type="button" className="admin-btn-ghost" onClick={() => save({ active: !gesture.active })} disabled={state.kind === "saving"}>{gesture.active ? "Retirer" : "Remettre"}</button>
            <Status state={state} />
          </div>
        </div>
      )}
    </div>
  );
}

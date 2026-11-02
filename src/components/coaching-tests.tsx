"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { CONTEXT_LABEL, LEVEL_LABEL, PASSPORT_LEVELS, TEST_CONTEXTS, videoFileName, type SkillTest, type TestContext, type TestResult } from "@/lib/skill-tests";
import type { TestPlayer } from "@/lib/skill-tests-repo";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
const fr = (n: number) => n.toLocaleString("fr-CA", { maximumFractionDigits: 1 });

/** Saisie des tests au bord du terrain : un groupe, un test, une date ; un score (et le lien de la vidéo) par fille. */
export function TestEntry({ players, tests, results }: { players: TestPlayer[]; tests: SkillTest[]; results: TestResult[] }) {
  const router = useRouter();
  const groups = useMemo(() => [...new Map(players.map((p) => [p.groupKey, p.group])).entries()], [players]);
  const [groupKey, setGroupKey] = useState(groups[0]?.[0] ?? "");
  const [testId, setTestId] = useState(tests[0]?.id ?? "");
  const [date, setDate] = useState(today());
  const [context, setContext] = useState<TestContext>("jour-1");
  const [values, setValues] = useState<Record<string, { score: string; video: string; note: string }>>({});
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" | "error"; message?: string }>({ kind: "idle" });

  const test = tests.find((t) => t.id === testId);
  const list = players.filter((p) => p.groupKey === groupKey);
  const filled = list.filter((p) => values[p.registrationId]?.score?.trim()).length;
  const last = (registrationId: string) =>
    results.filter((r) => r.registration_id === registrationId && r.test_id === testId && r.tested_on < date).sort((a, b) => b.tested_on.localeCompare(a.tested_on))[0];
  const set = (id: string, field: "score" | "video" | "note", v: string) => {
    setValues((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { score: "", video: "", note: "" }), [field]: v } }));
    setState({ kind: "idle" });
  };

  const save = async () => {
    setState({ kind: "saving" });
    const res = await fetch("/api/admin/coaching/tests/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        testId,
        testedOn: date,
        context,
        entries: list.map((p) => ({ registrationId: p.registrationId, score: values[p.registrationId]?.score ?? "", videoUrl: values[p.registrationId]?.video || null, note: values[p.registrationId]?.note || null }))
      })
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) return setState({ kind: "error", message: data?.error ?? "Pas enregistré : vérifie la connexion et réessaie." });
    setState({ kind: "saved", message: `${data.saved} résultat${data.saved > 1 ? "s" : ""} enregistré${data.saved > 1 ? "s" : ""}.` });
    setValues({});
    router.refresh();
  };

  if (!tests.length) return <p className="admin-empty-text">Ajoute d&apos;abord un test dans « Les tests du passeport » plus bas.</p>;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
        <label className="ct-field">
          <span>Groupe</span>
          <select className="admin-input" value={groupKey} onChange={(e) => setGroupKey(e.target.value)}>
            {groups.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </label>
        <label className="ct-field">
          <span>Test</span>
          <select className="admin-input" value={testId} onChange={(e) => setTestId(e.target.value)}>
            {tests.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="ct-field">
          <span>Date</span>
          <input className="admin-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="ct-field">
          <span>Type de test</span>
          <select className="admin-input" value={context} onChange={(e) => setContext(e.target.value as TestContext)}>
            {TEST_CONTEXTS.map((c) => <option key={c} value={c}>{CONTEXT_LABEL[c]}</option>)}
          </select>
        </label>
      </div>
      {test?.protocol && <p className="ct-protocol">{test.protocol}</p>}

      <ul className="ct-list">
        {list.map((p) => {
          const prev = last(p.registrationId);
          const v = values[p.registrationId] ?? { score: "", video: "", note: "" };
          return (
            <li key={p.registrationId} className="ct-row">
              <div className="ct-who">
                <strong>{p.firstName} {p.lastName}</strong>
                <span>{prev ? `Dernier : ${fr(prev.score)} ${test?.unit ?? ""} (${prev.tested_on})` : "Premier test"}</span>
              </div>
              <input className="admin-input ct-score" inputMode="decimal" placeholder={test?.unit ?? "score"} aria-label={`Score de ${p.firstName}`} value={v.score} onChange={(e) => set(p.registrationId, "score", e.target.value)} />
              <input
                className="admin-input ct-video"
                type="url"
                placeholder="Lien de la vidéo (YouTube non répertorié)"
                aria-label={`Vidéo de ${p.firstName}`}
                value={v.video}
                onChange={(e) => set(p.registrationId, "video", e.target.value)}
              />
              {v.score && test && <span className="ct-filename">Nom du fichier : {videoFileName(p.firstName, p.lastName, test.gesture ?? test.name, date, "test")}</span>}
            </li>
          );
        })}
      </ul>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
        <button type="button" className="admin-btn-primary" disabled={!filled || state.kind === "saving"} onClick={save} style={{ minHeight: 44 }}>
          {state.kind === "saving" ? "Enregistrement…" : `Enregistrer ${filled || ""} résultat${filled > 1 ? "s" : ""}`}
        </button>
        {state.kind === "saved" && <span style={{ color: "var(--adm-good)", fontSize: "0.85rem" }}>{state.message}</span>}
        {state.kind === "error" && <span style={{ color: "var(--adm-bad)", fontSize: "0.85rem" }} role="alert">{state.message}</span>}
      </div>
    </div>
  );
}

/** Catalogue des tests : JP ajuste le protocole et les seuils de chaque niveau du passeport, puis valide. */
export function TestCatalog({ tests }: { tests: SkillTest[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const add = async () => {
    setAdding(true);
    await fetch("/api/admin/coaching/tests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Nouveau test" }) });
    setAdding(false);
    router.refresh();
  };
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {tests.map((t) => <TestCard key={t.id} test={t} />)}
      <button type="button" className="admin-btn-ghost" onClick={add} disabled={adding} style={{ justifySelf: "start" }}>+ Ajouter un test</button>
    </div>
  );
}

function TestCard({ test }: { test: SkillTest }) {
  const router = useRouter();
  const [t, setT] = useState({
    name: test.name,
    gesture: test.gesture ?? "",
    unit: test.unit,
    higherIsBetter: test.higher_is_better,
    protocol: test.protocol ?? "",
    thresholds: Object.fromEntries(PASSPORT_LEVELS.map((l) => [l, test.thresholds?.[l] !== undefined ? String(test.thresholds[l]) : ""])) as Record<string, string>
  });
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const send = async (extra: Record<string, unknown> = {}) => {
    setState("saving");
    const res = await fetch("/api/admin/coaching/tests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: test.id,
        name: t.name,
        gesture: t.gesture || null,
        unit: t.unit,
        higherIsBetter: t.higherIsBetter,
        protocol: t.protocol || null,
        thresholds: Object.fromEntries(Object.entries(t.thresholds).map(([k, v]) => [k, v.trim() === "" ? null : Number(v.replace(",", "."))])),
        ...extra
      })
    }).catch(() => null);
    setState(res?.ok ? "saved" : "error");
    if (res?.ok) router.refresh();
  };
  const upd = (patch: Partial<typeof t>) => {
    setT((prev) => ({ ...prev, ...patch }));
    setState("idle");
  };

  return (
    <div className="mda-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <input className="admin-input" value={t.name} onChange={(e) => upd({ name: e.target.value })} style={{ fontWeight: 600, flex: "1 1 220px" }} aria-label="Nom du test" />
        <span className="mda-pill" data-tone={test.validated_at ? "good" : "warn"}>{test.validated_at ? "Validé par JP" : "Proposition à valider"}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginTop: 8 }}>
        <label className="ct-field"><span>Geste (nom des vidéos)</span><input className="admin-input" value={t.gesture} onChange={(e) => upd({ gesture: e.target.value })} /></label>
        <label className="ct-field"><span>Unité</span><input className="admin-input" value={t.unit} onChange={(e) => upd({ unit: e.target.value })} /></label>
        <label className="ct-field">
          <span>Meilleur score</span>
          <select className="admin-input" value={t.higherIsBetter ? "haut" : "bas"} onChange={(e) => upd({ higherIsBetter: e.target.value === "haut" })}>
            <option value="haut">Le plus haut</option>
            <option value="bas">Le plus bas (chrono)</option>
          </select>
        </label>
      </div>
      <label className="ct-field" style={{ marginTop: 8 }}>
        <span>Protocole (même exercice, même angle, même durée à chaque fois)</span>
        <textarea className="admin-input" rows={2} value={t.protocol} onChange={(e) => upd({ protocol: e.target.value })} />
      </label>
      <p className="ct-field" style={{ margin: "10px 0 4px" }}><span>Score à atteindre pour chaque niveau du passeport</span></p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
        {PASSPORT_LEVELS.map((l) => (
          <label key={l} className="ct-field">
            <span>{LEVEL_LABEL[l]}</span>
            <input className="admin-input" inputMode="decimal" value={t.thresholds[l]} placeholder="—" onChange={(e) => upd({ thresholds: { ...t.thresholds, [l]: e.target.value } })} />
          </label>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
        <button type="button" className="admin-btn-ghost" onClick={() => send()} disabled={state === "saving"}>Enregistrer</button>
        {!test.validated_at ? (
          <button type="button" className="admin-btn-primary" onClick={() => send({ validated: true })} disabled={state === "saving"}>Valider ce test</button>
        ) : (
          <button type="button" className="admin-btn-ghost" onClick={() => send({ validated: false })} disabled={state === "saving"}>Remettre en proposition</button>
        )}
        <button type="button" className="admin-btn-ghost" onClick={() => send({ active: !test.active })} disabled={state === "saving"}>{test.active ? "Retirer" : "Remettre"}</button>
        {state === "saved" && <span style={{ color: "var(--adm-good)", fontSize: "0.82rem" }}>Enregistré</span>}
        {state === "error" && <span style={{ color: "var(--adm-bad)", fontSize: "0.82rem" }}>Pas enregistré</span>}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DelegateForm } from "@/components/delegate-form";
import { shortDate } from "@/components/jp-space";
import type { TaskGuide } from "@/lib/mandalart-steps";

/** Une tâche de « Mon plan » : la case à cocher, et le « comment faire » toujours lisible (ouvert pour l'étape 👉). */

export interface PlanTaskItem {
  code: string;
  title: string;
  owner: string | null;
  due: string | null;
  star: boolean;
  status: string;
  late: boolean;
  objectiveName: string;
  guide: TaskGuide | null;
}

async function setStatus(code: string, status: string) {
  const res = await fetch("/api/admin/mandalart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", code, status }) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Erreur d'enregistrement");
}

export function PlanTask({ t, open = false }: { t: PlanTaskItem; open?: boolean }) {
  const router = useRouter();
  const [status, setLocal] = useState(t.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(open);
  const [delegating, setDelegating] = useState(false);

  const change = async (next: string) => {
    const before = status;
    setLocal(next);
    setBusy(true);
    setError(null);
    try {
      await setStatus(t.code, next);
      router.refresh();
    } catch (err) {
      setLocal(before);
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const g = t.guide;
  return (
    <li className="mda-task" data-s={status}>
      <button type="button" className="mda-check" data-s={status} disabled={busy} onClick={() => change(status === "fait" ? "a_faire" : "fait")} aria-label={status === "fait" ? "Remettre à faire" : "Marquer comme fait"}>
        <span>{status === "fait" ? "✓" : ""}</span>
      </button>
      <div className="mda-task-body">
        <p className="mda-task-title">
          {t.star ? <span title="Priorité absolue">⭐ </span> : null}
          {t.title}
        </p>
        <div className="mda-task-meta">
          {t.due ? <span className={t.late ? "mda-late" : undefined}>{t.late ? `En retard · ${shortDate(t.due)}` : `D'ici ${shortDate(t.due)}`}</span> : null}
          {t.owner ? <span>{t.owner}</span> : null}
          {status === "en_cours" ? <span className="mda-pill" data-tone="warn">Commencée</span> : null}
          {g?.already ? <span className="mda-pill" data-tone="good">Déjà réglé par le site</span> : null}
          <button type="button" className="mda-task-more" onClick={() => setShowGuide((s) => !s)}>
            {showGuide ? "Cacher le détail" : "Comment faire"}
          </button>
          {status === "a_faire" ? (
            <button type="button" className="mda-task-more" disabled={busy} onClick={() => change("en_cours")}>
              Je commence
            </button>
          ) : null}
          <button type="button" className="mda-task-more" onClick={() => setDelegating((d) => !d)}>
            {delegating ? "Fermer" : "Confier"}
          </button>
        </div>

        {showGuide ? (
          <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 10, background: "var(--adm-surface-2)", fontSize: "0.86rem", lineHeight: 1.5 }}>
            {g?.already ? <p style={{ margin: "0 0 8px", color: "var(--adm-good)" }}>✓ {g.already}</p> : null}
            {g ? (
              <>
                <p style={{ margin: "0 0 4px", fontWeight: 600 }}>Comment faire</p>
                <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 3 }}>
                  {g.how.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                <p style={{ margin: "8px 0 0" }}>
                  <strong>✅ Fini quand :</strong> {g.done}
                </p>
              </>
            ) : (
              <p style={{ margin: 0 }}>
                <strong>✅ Fini quand :</strong> ce qui est écrit dans le titre est fait. Mets la preuve (lien, photo, document) dans le Mandalart si tu en as une.
              </p>
            )}
            <p style={{ margin: "8px 0 0", color: "var(--adm-text-3)", fontSize: "0.8rem" }}>
              Pourquoi : {t.objectiveName} · Mandalart {t.code}
              {g?.link ? (
                <>
                  {" · "}
                  <Link href={g.link.href}>Ouvrir {g.link.label}</Link>
                </>
              ) : null}
            </p>
          </div>
        ) : null}

        {delegating ? (
          <DelegateForm
            mandalartCode={t.code}
            defaultTitle={t.title}
            defaultDue={t.due}
            onCancel={() => setDelegating(false)}
            onDone={() => {
              setDelegating(false);
              router.refresh();
            }}
          />
        ) : null}
        {error ? <p style={{ fontSize: "0.8rem", color: "var(--adm-bad)", margin: "6px 0 0" }}>{error}</p> : null}
      </div>
    </li>
  );
}

export function PlanTaskList({ items, empty }: { items: PlanTaskItem[]; empty: string }) {
  if (!items.length) return <p style={{ padding: "14px 20px", margin: 0, fontSize: "0.88rem", color: "var(--adm-text-3)" }}>{empty}</p>;
  return (
    <ul className="mda-tasks">
      {items.map((t) => (
        <PlanTask key={t.code} t={t} />
      ))}
    </ul>
  );
}

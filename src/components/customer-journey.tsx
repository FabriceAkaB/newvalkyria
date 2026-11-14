"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { kindOf, NODE_KINDS, STATUSES, type JourneyTree, type NodeKind } from "@/lib/customer-journey-core";

/** Le parcours client en arbre : chaque étape se déplie ; chaque élément se modifie, se déplace, s'ajoute. */

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/parcours", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Erreur");
}

const TONE: Record<string, string> = { "en-place": "var(--adm-good)", "en-cours": "var(--adm-warn)", prevu: "var(--adm-text-3)" };

function NodeForm({ initial, onSave, onCancel }: { initial?: Partial<JourneyTree>; onSave: (n: Record<string, unknown>) => Promise<void>; onCancel: () => void }) {
  const [f, setF] = useState({ kind: (initial?.kind ?? "famille") as NodeKind, title: initial?.title ?? "", detail: initial?.detail ?? "", status: initial?.status ?? "en-place", whereRef: initial?.where_ref ?? "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div style={{ display: "grid", gap: 6, padding: 10, border: "1px dashed var(--adm-line)", borderRadius: 10, margin: "6px 0" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <select className="admin-input" style={{ width: "auto" }} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as NodeKind })}>
          {NODE_KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.icon} {k.label}
            </option>
          ))}
        </select>
        <select className="admin-input" style={{ width: "auto" }} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as typeof f.status })}>
          {STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <input className="admin-input" placeholder="Ce qui se passe (ex. reçoit son chandail à la 1re pratique)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <input className="admin-input" placeholder="Détail (facultatif)" value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} />
      <input className="admin-input" placeholder="Où le voir / tâche du Mandalart (facultatif)" value={f.whereRef} onChange={(e) => setF({ ...f, whereRef: e.target.value })} />
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          className="admin-btn-primary"
          disabled={busy || f.title.trim().length < 2}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              await onSave({ kind: f.kind, title: f.title, detail: f.detail || null, status: f.status, whereRef: f.whereRef || null });
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Erreur");
            } finally {
              setBusy(false);
            }
          }}
        >
          Enregistrer
        </button>
        <button type="button" className="admin-btn-ghost" onClick={onCancel}>
          Annuler
        </button>
      </div>
      {err ? <p style={{ margin: 0, color: "var(--adm-bad)", fontSize: "0.8rem" }}>{err}</p> : null}
    </div>
  );
}

function Node({ n, depth, editable }: { n: JourneyTree; depth: number; editable: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit" | "add">("view");
  const k = kindOf(n.kind);
  const run = async (body: Record<string, unknown>) => {
    await post(body);
    setMode("view");
    router.refresh();
  };
  const header = (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
      <span aria-hidden>{k.icon}</span>
      <span style={{ fontWeight: n.kind === "etape" ? 700 : n.kind === "choix" ? 600 : 400, fontSize: n.kind === "etape" ? "1.02rem" : "0.9rem", color: "var(--adm-text)" }}>{n.title}</span>
      {n.kind !== "etape" && n.kind !== "choix" ? <span style={{ fontSize: "0.72rem", color: TONE[n.status] }}>● {STATUSES.find((s) => s.id === n.status)?.label}</span> : null}
      {n.where_ref ? <span style={{ fontSize: "0.72rem", color: "var(--adm-text-3)" }}>· {n.where_ref}</span> : null}
    </span>
  );
  const tools = editable ? (
    <span style={{ display: "inline-flex", gap: 2, marginLeft: 6 }}>
      <button type="button" className="admin-btn-ghost" style={{ padding: "0 6px", fontSize: "0.75rem" }} title="Monter" onClick={() => run({ action: "move", id: n.id, dir: -1 })}>
        ↑
      </button>
      <button type="button" className="admin-btn-ghost" style={{ padding: "0 6px", fontSize: "0.75rem" }} title="Descendre" onClick={() => run({ action: "move", id: n.id, dir: 1 })}>
        ↓
      </button>
      <button type="button" className="admin-btn-ghost" style={{ padding: "0 6px", fontSize: "0.75rem" }} title="Modifier" onClick={() => setMode("edit")}>
        ✏️
      </button>
      <button type="button" className="admin-btn-ghost" style={{ padding: "0 6px", fontSize: "0.75rem" }} title="Ajouter dessous" onClick={() => setMode("add")}>
        ＋
      </button>
      <button
        type="button"
        className="admin-btn-ghost"
        style={{ padding: "0 6px", fontSize: "0.75rem" }}
        title="Retirer"
        onClick={() => confirm(n.children.length ? `Retirer « ${n.title} » et ses ${n.children.length} élément(s) ?` : `Retirer « ${n.title} » ?`) && run({ action: "delete", id: n.id })}
      >
        ×
      </button>
    </span>
  ) : null;
  const body = (
    <>
      {n.detail ? <p style={{ margin: "2px 0 4px 26px", fontSize: "0.82rem", color: "var(--adm-text-2)" }}>{n.detail}</p> : null}
      {mode === "edit" ? <NodeForm initial={n} onSave={(node) => run({ action: "update", id: n.id, node })} onCancel={() => setMode("view")} /> : null}
      {mode === "add" ? <NodeForm onSave={(node) => run({ action: "add", parentId: n.id, node })} onCancel={() => setMode("view")} /> : null}
      {n.children.length ? (
        <div style={{ marginLeft: 12, paddingLeft: 14, borderLeft: `2px solid ${n.kind === "choix" ? "rgba(240,200,120,0.5)" : "var(--adm-line)"}`, display: "grid", gap: 4 }}>
          {n.children.map((c) => (
            <Node key={c.id} n={c} depth={depth + 1} editable={editable} />
          ))}
        </div>
      ) : null}
    </>
  );
  if (n.kind === "etape" || (n.kind === "choix" && n.children.length)) {
    return (
      <details open className={depth === 0 ? "mda-card" : undefined} style={depth === 0 ? { margin: 0 } : undefined}>
        <summary style={{ cursor: "pointer", listStyle: depth === 0 ? undefined : "none" }}>
          {header}
          {tools}
        </summary>
        <div style={{ marginTop: 6 }}>{body}</div>
      </details>
    );
  }
  return (
    <div>
      <div>
        {header}
        {tools}
      </div>
      {body}
    </div>
  );
}

export function CustomerJourney({ tree, editable }: { tree: JourneyTree[]; editable: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {tree.map((n) => (
        <Node key={n.id} n={n} depth={0} editable={editable} />
      ))}
      {editable ? (
        adding ? (
          <NodeForm
            initial={{ kind: "etape" }}
            onSave={async (node) => {
              await post({ action: "add", parentId: null, node });
              setAdding(false);
              router.refresh();
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button type="button" className="admin-btn-ghost" style={{ justifySelf: "start" }} onClick={() => setAdding(true)}>
            + Ajouter une étape
          </button>
        )
      ) : null}
    </div>
  );
}

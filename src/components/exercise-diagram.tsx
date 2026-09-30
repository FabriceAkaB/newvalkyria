"use client";

import { useRef, useState } from "react";

import type { DiagramArrow, DiagramArrowType, DiagramElement, DiagramElementType, ExerciseDiagram } from "@/lib/exercises-repo";

const VIEWBOX = 100;

const ELEMENT_STYLES: Record<DiagramElementType, { fill: string; stroke: string; radius: number; shape: "circle" | "triangle" }> = {
  player: { fill: "#4a7fd6", stroke: "#1f3a66", radius: 2.6, shape: "circle" },
  "player-alt": { fill: "#d64a4a", stroke: "#661f1f", radius: 2.6, shape: "circle" },
  cone: { fill: "#ff9f43", stroke: "#8a4d0f", radius: 1.8, shape: "triangle" },
  ball: { fill: "#f6f3f9", stroke: "#100e17", radius: 1.4, shape: "circle" }
};

const ELEMENT_LABELS: Record<DiagramElementType, string> = {
  player: "Joueuse (bleu)",
  "player-alt": "Joueuse (rouge)",
  cone: "Cône",
  ball: "Ballon"
};

const ARROW_LABELS: Record<DiagramArrowType, string> = {
  movement: "Déplacement",
  pass: "Passe",
  dribble: "Conduite (balle au pied)"
};

const ARROW_STYLES: Record<DiagramArrowType, { stroke: string; dash?: string }> = {
  movement: { stroke: "#e6ddef" },
  pass: { stroke: "#c4a6dc", dash: "3 2" },
  dribble: { stroke: "#ff9f43", dash: "0.5 2" }
};

function Pitch() {
  return (
    <g>
      <rect x={2} y={2} width={96} height={96} fill="#1f5c3a" stroke="#e6ddef" strokeWidth={0.4} />
      <line x1={2} y1={50} x2={98} y2={50} stroke="#e6ddef" strokeWidth={0.3} />
      <circle cx={50} cy={50} r={10} fill="none" stroke="#e6ddef" strokeWidth={0.3} />
      <rect x={30} y={2} width={40} height={12} fill="none" stroke="#e6ddef" strokeWidth={0.3} />
      <rect x={30} y={86} width={40} height={12} fill="none" stroke="#e6ddef" strokeWidth={0.3} />
    </g>
  );
}

function ElementShape({ el, selected }: { el: DiagramElement; selected?: boolean }) {
  const style = ELEMENT_STYLES[el.type];
  return (
    <g>
      {style.shape === "circle" ? (
        <circle cx={el.x} cy={el.y} r={style.radius} fill={style.fill} stroke={selected ? "#f6f3f9" : style.stroke} strokeWidth={selected ? 0.6 : 0.3} />
      ) : (
        <polygon
          points={`${el.x},${el.y - style.radius} ${el.x - style.radius},${el.y + style.radius} ${el.x + style.radius},${el.y + style.radius}`}
          fill={style.fill}
          stroke={selected ? "#f6f3f9" : style.stroke}
          strokeWidth={selected ? 0.6 : 0.3}
        />
      )}
      {el.label && (
        <text x={el.x} y={el.y + 0.9} fontSize={2.4} textAnchor="middle" fill="#100e17" fontWeight={700}>
          {el.label}
        </text>
      )}
    </g>
  );
}

function ArrowShape({ arrow, selected }: { arrow: DiagramArrow; selected?: boolean }) {
  const style = ARROW_STYLES[arrow.type];
  const markerId = `arrowhead-${arrow.type}`;
  return (
    <line
      x1={arrow.x1} y1={arrow.y1} x2={arrow.x2} y2={arrow.y2}
      stroke={selected ? "#f6f3f9" : style.stroke}
      strokeWidth={selected ? 1 : 0.6}
      strokeDasharray={style.dash}
      markerEnd={`url(#${markerId})`}
    />
  );
}

function ArrowMarkers() {
  return (
    <defs>
      {(Object.keys(ARROW_STYLES) as DiagramArrowType[]).map((type) => (
        <marker key={type} id={`arrowhead-${type}`} markerWidth={4} markerHeight={4} refX={3} refY={2} orient="auto">
          <path d="M0,0 L4,2 L0,4 Z" fill={ARROW_STYLES[type].stroke} />
        </marker>
      ))}
    </defs>
  );
}

/** Rendu lecture seule d'un schéma — utilisé partout où un exercice avec
 *  diagramme est affiché (fiches admin, plan de séance côté entraîneur). */
export function ExerciseDiagramView({ diagram }: { diagram: ExerciseDiagram }) {
  return (
    <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} style={{ width: "100%", maxWidth: "360px", borderRadius: "8px" }}>
      <ArrowMarkers />
      <Pitch />
      {diagram.arrows.map((a) => <ArrowShape key={a.id} arrow={a} />)}
      {diagram.elements.map((el) => <ElementShape key={el.id} el={el} />)}
    </svg>
  );
}

type Tool = "select" | DiagramElementType | `arrow-${DiagramArrowType}`;

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

/** Constructeur visuel glisser-déposer — place des éléments (joueuses,
 *  cônes, ballon) et des flèches (déplacement/passe/conduite) sur un
 *  terrain schématique, puis enregistre via `onSave`. */
export function ExerciseDiagramEditor({ initial, onSave, saving }: { initial: ExerciseDiagram | null; onSave: (diagram: ExerciseDiagram) => void; saving?: boolean }) {
  const [elements, setElements] = useState<DiagramElement[]>(initial?.elements ?? []);
  const [arrows, setArrows] = useState<DiagramArrow[]>(initial?.arrows ?? []);
  const [tool, setTool] = useState<Tool>("select");
  const [selected, setSelected] = useState<{ kind: "element" | "arrow"; id: string } | null>(null);
  const [arrowStart, setArrowStart] = useState<{ x: number; y: number } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const toPoint = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return { x: 50, y: 50 };
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VIEWBOX;
    const y = ((e.clientY - rect.top) / rect.height) * VIEWBOX;
    return { x: Math.max(0, Math.min(VIEWBOX, x)), y: Math.max(0, Math.min(VIEWBOX, y)) };
  };

  const handleCanvasClick = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragId) return; // le clic qui suit un drag ne doit pas placer un nouvel élément
    const point = toPoint(e);

    if (tool === "select") {
      setSelected(null);
      return;
    }
    if (tool.startsWith("arrow-")) {
      const arrowType = tool.slice(6) as DiagramArrowType;
      if (!arrowStart) {
        setArrowStart(point);
      } else {
        setArrows((prev) => [...prev, { id: newId(), type: arrowType, x1: arrowStart.x, y1: arrowStart.y, x2: point.x, y2: point.y }]);
        setArrowStart(null);
        setTool("select");
      }
      return;
    }
    setElements((prev) => [...prev, { id: newId(), type: tool as DiagramElementType, x: point.x, y: point.y }]);
    setTool("select");
  };

  const startDrag = (e: React.PointerEvent, id: string) => {
    if (tool !== "select") return;
    e.stopPropagation();
    setSelected({ kind: "element", id });
    setDragId(id);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragId) return;
    const point = toPoint(e);
    setElements((prev) => prev.map((el) => (el.id === dragId ? { ...el, x: point.x, y: point.y } : el)));
  };

  const endDrag = () => {
    if (dragId) setTimeout(() => setDragId(null), 0);
  };

  const deleteSelected = () => {
    if (!selected) return;
    if (selected.kind === "element") setElements((prev) => prev.filter((el) => el.id !== selected.id));
    else setArrows((prev) => prev.filter((a) => a.id !== selected.id));
    setSelected(null);
  };

  const clearAll = () => {
    if (!confirm("Effacer tout le schéma ?")) return;
    setElements([]);
    setArrows([]);
    setSelected(null);
  };

  return (
    <div className={`exercise-create-panel`} style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <p className="exercise-create-panel__title">Schéma visuel</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
        {(Object.keys(ELEMENT_LABELS) as DiagramElementType[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTool(t); setArrowStart(null); }}
            className={tool === t ? "admin-btn-primary" : "admin-btn-ghost"}
            style={{ fontSize: "0.68rem", padding: "0.35rem 0.6rem" }}
          >
            + {ELEMENT_LABELS[t]}
          </button>
        ))}
        {(Object.keys(ARROW_LABELS) as DiagramArrowType[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTool(`arrow-${t}`); setArrowStart(null); }}
            className={tool === `arrow-${t}` ? "admin-btn-primary" : "admin-btn-ghost"}
            style={{ fontSize: "0.68rem", padding: "0.35rem 0.6rem" }}
          >
            ↗ {ARROW_LABELS[t]}
          </button>
        ))}
      </div>

      {tool.startsWith("arrow-") && (
        <p style={{ fontSize: "0.68rem", color: "#c9a8e3", margin: 0 }}>
          {arrowStart ? "Cliquez le point d'arrivée de la flèche." : "Cliquez le point de départ de la flèche."}
        </p>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        style={{ width: "100%", maxWidth: "420px", borderRadius: "8px", cursor: tool === "select" ? "default" : "crosshair", touchAction: "none" }}
        onPointerDown={handleCanvasClick}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <ArrowMarkers />
        <Pitch />
        {arrows.map((a) => (
          <g key={a.id} onPointerDown={(e) => { if (tool === "select") { e.stopPropagation(); setSelected({ kind: "arrow", id: a.id }); } }}>
            <ArrowShape arrow={a} selected={selected?.kind === "arrow" && selected.id === a.id} />
          </g>
        ))}
        {elements.map((el) => (
          <g key={el.id} onPointerDown={(e) => startDrag(e, el.id)} style={{ cursor: tool === "select" ? "grab" : undefined }}>
            <ElementShape el={el} selected={selected?.kind === "element" && selected.id === el.id} />
          </g>
        ))}
      </svg>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button className="admin-btn-primary" onClick={() => onSave({ elements, arrows })} disabled={saving} style={{ fontSize: "0.75rem" }}>
          {saving ? "..." : "Enregistrer le schéma"}
        </button>
        <button className="admin-btn-ghost" onClick={deleteSelected} disabled={!selected} style={{ fontSize: "0.75rem" }}>Supprimer la sélection</button>
        <button className="admin-btn-ghost" onClick={clearAll} style={{ fontSize: "0.75rem" }}>Tout effacer</button>
      </div>
    </div>
  );
}

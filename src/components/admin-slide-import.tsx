"use client";

import { CheckCircle2, FileUp, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import "./exercise-bible.css";

import { bibleInfo, categoriesForBible, EXERCISE_TYPES, type BibleKey } from "@/lib/exercise-bank";

/** pdf.js chargé à la demande (seulement quand JP dépose un PDF), pour transformer chaque page en image et lire son texte. */
const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
const PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
const MAX_WIDTH = 1600;
const MAX_PAGES = 40;

interface Item {
  key: string;
  fileName: string;
  preview: string;
  state: "lecture" | "cree" | "erreur";
  error?: string;
  id?: string;
  by?: "claude" | "texte";
  title: string;
  category: string;
  exerciseType: string;
  saved?: boolean;
}

interface Prepared {
  blob: Blob;
  name: string;
  text: string;
}

 
type PdfLib = any;
let pdfLib: Promise<PdfLib> | null = null;
function loadPdfLib(): Promise<PdfLib> {
  pdfLib ??= (new Function("u", "return import(u)") as (u: string) => Promise<PdfLib>)(PDFJS).then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    return lib;
  });
  return pdfLib;
}

const canvasBlob = (c: HTMLCanvasElement, type: string) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Image illisible"))), type, 0.9));

async function fromImage(file: File): Promise<Prepared> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WIDTH / bmp.width);
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  let blob = await canvasBlob(c, type);
  if (blob.size > 3_800_000) blob = await canvasBlob(c, "image/jpeg");
  const ext = blob.type === "image/png" ? "png" : "jpg";
  return { blob, name: file.name.replace(/\.[a-z0-9]+$/i, "") + `.${ext}`, text: "" };
}

async function fromPdf(file: File): Promise<Prepared[]> {
  const lib = await loadPdfLib();
  const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const out: Prepared[] = [];
  const base = file.name.replace(/\.pdf$/i, "");
  for (let n = 1; n <= Math.min(pdf.numPages, MAX_PAGES); n++) {
    const page = await pdf.getPage(n);
    const v1 = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(3, MAX_WIDTH / v1.width) });
    const c = document.createElement("canvas");
    c.width = Math.round(viewport.width);
    c.height = Math.round(viewport.height);
    await page.render({ canvasContext: c.getContext("2d")!, viewport }).promise;
    const content = await page.getTextContent();
     
    const text = (content.items as any[]).map((it) => `${it.str ?? ""}${it.hasEOL ? "\n" : " "}`).join("");
    let blob = await canvasBlob(c, "image/png");
    if (blob.size > 3_800_000) blob = await canvasBlob(c, "image/jpeg");
    const name = pdf.numPages > 1 ? `${base} - page ${n}` : base;
    out.push({ blob, name: `${name}.${blob.type === "image/png" ? "png" : "jpg"}`, text });
  }
  return out;
}

/** Ajouter des exercices par leurs diapos : déposer, c'est créé, lu et rangé ; JP corrige le chapitre au besoin. */
export function AdminSlideImport({ ai, bible = "valkyria" }: { ai: boolean; bible?: BibleKey }) {
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const patch = (key: string, p: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i)));

  async function send(key: string, prep: Prepared) {
    const form = new FormData();
    form.append("image", new File([prep.blob], prep.name, { type: prep.blob.type }));
    form.append("text", prep.text);
    form.append("fileName", prep.name);
    form.append("bible", bible);
    try {
      const res = await fetch("/api/admin/exercises/diapo", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Ajout impossible");
      patch(key, { state: "cree", id: data.id, by: data.by, title: data.draft.title, category: data.draft.category, exerciseType: data.draft.exerciseType ?? "" });
    } catch (e) {
      patch(key, { state: "erreur", error: e instanceof Error ? e.message : "Ajout impossible" });
    }
  }

  async function handle(files: FileList | File[]) {
    setBusy(true);
    for (const file of Array.from(files)) {
      try {
        const preps = file.type === "application/pdf" || /\.pdf$/i.test(file.name) ? await fromPdf(file) : file.type.startsWith("image/") ? [await fromImage(file)] : [];
        if (!preps.length) {
          setItems((l) => [{ key: `${file.name}-${Date.now()}`, fileName: file.name, preview: "", state: "erreur", error: "Format non supporté : image (PNG, JPG) ou PDF.", title: file.name, category: "", exerciseType: "" }, ...l]);
          continue;
        }
        const queued = preps.map((p, i) => ({ p, item: { key: `${p.name}-${Date.now()}-${i}`, fileName: p.name, preview: URL.createObjectURL(p.blob), state: "lecture" as const, title: p.name.replace(/\.[a-z0-9]+$/i, ""), category: "", exerciseType: "" } }));
        setItems((l) => [...queued.map((q) => q.item), ...l]);
        for (const q of queued) await send(q.item.key, q.p);
      } catch (e) {
        setItems((l) => [{ key: `${file.name}-${Date.now()}`, fileName: file.name, preview: "", state: "erreur", error: e instanceof Error ? e.message : "Lecture impossible", title: file.name, category: "", exerciseType: "" }, ...l]);
      }
    }
    setBusy(false);
  }

  async function save(item: Item, p: Partial<Pick<Item, "title" | "category" | "exerciseType">>) {
    patch(item.key, { ...p, saved: false });
    const res = await fetch("/api/admin/exercises/diapo", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: item.id, ...p }) });
    patch(item.key, { saved: res.ok, ...(res.ok ? {} : { error: "Correction non enregistrée" }) });
  }

  async function remove(item: Item) {
    if (!item.id || !window.confirm(`Retirer « ${item.title} » de la banque ?`)) return;
    const res = await fetch(`/api/admin/exercises/${item.id}`, { method: "DELETE" });
    if (res.ok) setItems((l) => l.filter((i) => i.key !== item.key));
  }

  const created = items.filter((i) => i.state === "cree").length;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <header>
        <p className="mda-eyebrow">{bibleInfo(bible).title} · ajout par diapo</p>
        <h1 className="mda-h1">Ajoute un exercice en déposant sa diapo</h1>
        <p className="mda-lead">
          Une image (PNG, JPG) ou un PDF : chaque page devient un exercice, avec la diapo comme schéma. {ai ? "Claude lit la diapo et remplit la fiche (titre, thème, organisation, consignes, variantes)." : "Le site lit le texte du PDF et le nom du fichier pour le titre, le thème et le type."} L&apos;exercice est rangé dans son chapitre de {bibleInfo(bible).title} ; corrige-le ici au besoin, puis complète la fiche. Tu peux en déposer plusieurs d&apos;un coup.
        </p>
      </header>

      <div
        className="xsl-drop"
        data-over={String(over)}
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files.length) void handle(e.dataTransfer.files);
        }}
      >
        {busy ? <Loader2 size={28} strokeWidth={1.75} className="xsl-spin" aria-hidden /> : <FileUp size={28} strokeWidth={1.75} aria-hidden />}
        <strong>{busy ? "Lecture des diapos…" : "Dépose tes diapos ici"}</strong>
        <span>ou clique pour choisir des fichiers · images ou PDF, plusieurs à la fois</span>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void handle(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {!ai ? (
        <p className="mda-sub" style={{ margin: 0 }}>
          Lecture complète des images par l&apos;IA : ajouter la clé ANTHROPIC_API_KEY dans Vercel. En attendant, une diapo en image prend le nom du fichier comme titre et le thème qui s&apos;en dégage.
        </p>
      ) : null}

      {items.length ? (
        <section style={{ display: "grid", gap: 10 }}>
          <div className="mda-card-head" style={{ padding: 0 }}>
            <h2 className="mda-h2" style={{ margin: 0 }}>
              {created} exercice{created > 1 ? "s" : ""} ajouté{created > 1 ? "s" : ""}
            </h2>
            <Link href="/admin/exercices/bible" className="admin-btn-ghost" style={{ textDecoration: "none" }}>
              Voir la Bible
            </Link>
          </div>
          <ul className="xsl-list">
            {items.map((item) => (
              <li key={item.key} className="xsl-item">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {item.preview ? <img src={item.preview} alt={`Diapo : ${item.title}`} /> : <div />}
                <div className="xsl-fields">
                  {item.state === "lecture" ? (
                    <p className="xsl-state">
                      <Loader2 size={14} strokeWidth={1.75} aria-hidden /> Lecture de {item.fileName}…
                    </p>
                  ) : item.state === "erreur" ? (
                    <p className="xsl-state" data-tone="bad">
                      <TriangleAlert size={14} strokeWidth={1.75} aria-hidden /> {item.fileName} : {item.error}
                    </p>
                  ) : (
                    <>
                      <p className="xsl-state" data-tone="good">
                        {item.by === "claude" ? <Sparkles size={14} strokeWidth={1.75} aria-hidden /> : <CheckCircle2 size={14} strokeWidth={1.75} aria-hidden />}
                        {item.by === "claude" ? "Lu par Claude et rangé" : "Rangé d'après le texte et le nom du fichier"}
                        {item.saved ? " · correction enregistrée" : ""}
                      </p>
                      <input className="admin-input" defaultValue={item.title} aria-label="Titre" onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== item.title && void save(item, { title: e.target.value.trim() })} />
                      <div className="xsl-row">
                        <label className="xbk-muted" style={{ display: "grid", gap: 4 }}>
                          Chapitre (thème)
                          <select className="admin-input" value={item.category} onChange={(e) => void save(item, { category: e.target.value })}>
                            {categoriesForBible(bible).map((c) => <option key={c} value={c}>{c}</option>)}
                            {!categoriesForBible(bible).includes(item.category) ? <option value={item.category}>{item.category}</option> : null}
                          </select>
                        </label>
                        <label className="xbk-muted" style={{ display: "grid", gap: 4 }}>
                          Catégorie (type)
                          <select className="admin-input" value={item.exerciseType} onChange={(e) => void save(item, { exerciseType: e.target.value })}>
                            <option value="">À choisir</option>
                            {EXERCISE_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                          </select>
                        </label>
                      </div>
                      <div className="xsl-actions">
                        <Link href={`/admin/exercices/${item.id}`}>Compléter la fiche</Link>
                        <button type="button" className="admin-btn-ghost" style={{ padding: "4px 10px" }} onClick={() => void remove(item)}>
                          Retirer
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

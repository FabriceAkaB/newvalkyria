"use client";

import { useEffect, useMemo, useState } from "react";

import { CHAMPION_KINDS, championPoints, photoAllowed, type ChampionKind, type PointsRules } from "@/lib/player-points";
import type { ChampionPost } from "@/lib/player-points-repo";

/** Championnes du jour (portail des éducateurs, étape « Après ») : l'éducateur choisit le type (gagnante, groupe,
 *  attitude, partie spéciale), touche les noms, ajoute une photo si chaque fille a l'autorisation photo, et publie.
 *  Les points se donnent tout seuls selon le barème et la publication apparaît dans l'espace des familles. */

export interface ChampionPlayer {
  registrationId: string;
  firstName: string;
  lastName: string;
  imageConsent?: boolean | null;
}

/** Réduit la photo du téléphone (max 1600 px, JPEG) avant l'envoi : rapide sur le réseau du terrain. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

export function CoachChampionsCard({ activityId, players, initial, rules }: { activityId: string; players: ChampionPlayer[]; initial: ChampionPost[]; rules: PointsRules }) {
  const [posts, setPosts] = useState(initial);
  const [open, setOpen] = useState(initial.length === 0);
  const [kind, setKind] = useState<ChampionKind>("individuel");
  const [title, setTitle] = useState("");
  const [special, setSpecial] = useState(Math.min(rules.specialMax, 15));
  const [picked, setPicked] = useState<string[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const points = championPoints(kind, rules, special);
  const byId = new Map(players.map((p) => [p.registrationId, p]));
  const pickedPlayers = picked.map((id) => byId.get(id)).filter((p): p is ChampionPlayer => Boolean(p));
  const noConsent = pickedPlayers.filter((p) => !photoAllowed([p.imageConsent]));
  const canPhoto = pickedPlayers.length > 0 && noConsent.length === 0;
  const todayOf = (id: string) => posts.filter((p) => p.girls.some((g) => g.registrationId === id)).reduce((s, p) => s + p.points, 0);

  const toggle = (id: string) => {
    setError(null);
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : kind === "individuel" ? [id] : [...prev, id]));
  };
  const pickKind = (k: ChampionKind) => {
    setKind(k);
    setError(null);
    if (k === "individuel" && picked.length > 1) setPicked(picked.slice(0, 1));
  };

  const publish = async () => {
    setSaving(true);
    setError(null);
    const form = new FormData();
    form.set("kind", kind);
    form.set("title", title);
    form.set("points", String(special));
    form.set("registrationIds", JSON.stringify(picked));
    if (photo && canPhoto) form.set("photo", await shrink(photo), "championnes.jpg");
    const res = await fetch(`/api/coach/activities/${activityId}/champions`, { method: "POST", body: form }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setSaving(false);
    if (!res) return setError("Pas de connexion : réessaie dans un instant.");
    if (data?.posts) setPosts(data.posts);
    if (!res.ok || data?.error) return setError(data?.error ?? "Pas publié : réessaie.");
    setPicked([]);
    setTitle("");
    setPhoto(null);
    setOpen(false);
  };

  const remove = async (post: ChampionPost) => {
    if (!confirm(`Retirer cette publication ? Les ${post.points} points de ${post.girls.map((g) => g.name.split(" ")[0]).join(", ")} seront enlevés.`)) return;
    const res = await fetch(`/api/coach/activities/${activityId}/champions`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: post.id }) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) return setError(data?.error ?? "Pas retiré : réessaie.");
    setPosts(data.posts ?? posts.filter((p) => p.id !== post.id));
  };

  const label = CHAMPION_KINDS.find((k) => k.kind === kind)!;

  return (
    <div className="coach-card chp">
      <div className="chp-head">
        <div>
          <p className="coach-card__label" style={{ margin: 0 }}>Championnes du jour</p>
          <p className="coach-sub">Elles apparaissent dans l&apos;espace des familles et les points se donnent tout seuls.</p>
        </div>
        {!open && players.length > 0 ? (
          <button type="button" className="chp-add" onClick={() => setOpen(true)}>+ Publier</button>
        ) : null}
      </div>

      {posts.length > 0 && (
        <ul className="chp-posts">
          {posts.map((p) => {
            const k = CHAMPION_KINDS.find((x) => x.kind === p.kind)!;
            return (
              <li key={p.id} className="chp-post">
                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photoUrl} alt="" className="chp-thumb" />
                ) : (
                  <span className="chp-thumb chp-thumb--emoji" aria-hidden>{k.emoji}</span>
                )}
                <div className="chp-post__body">
                  <p className="chp-post__title">{p.title || k.label}</p>
                  <p className="chp-post__names">{p.girls.map((g) => g.name).join(", ")}</p>
                  <p className="coach-muted" style={{ margin: 0 }}>+{p.points} point{p.points > 1 ? "s" : ""}{p.girls.length > 1 ? " chacune" : ""}{p.hidden ? " · retirée du fil" : ""}</p>
                </div>
                <button type="button" className="chp-remove" onClick={() => remove(p)} aria-label="Retirer cette publication">Retirer</button>
              </li>
            );
          })}
        </ul>
      )}

      {players.length === 0 ? (
        <p className="coach-muted" style={{ margin: "8px 0 0" }}>Marque d&apos;abord les présences : seules les filles présentes peuvent être championnes.</p>
      ) : open ? (
        <div className="chp-form">
          <div className="chp-kinds" role="radiogroup" aria-label="Type de championne">
            {CHAMPION_KINDS.map((k) => (
              <button key={k.kind} type="button" role="radio" aria-checked={kind === k.kind} data-on={kind === k.kind || undefined} onClick={() => pickKind(k.kind)}>
                <span aria-hidden>{k.emoji}</span>
                <strong>{k.label}</strong>
                <small>{k.kind === "special" ? `jusqu'à ${rules.specialMax}` : `+${championPoints(k.kind, rules)}${k.kind === "groupe" ? " chacune" : ""}`}</small>
              </button>
            ))}
          </div>
          <p className="coach-muted" style={{ margin: 0 }}>{label.hint}.</p>

          <label className="chp-field">
            <span>Le jeu ou le défi (facultatif)</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Ex. Roi du carré, relais 1 contre 1" />
          </label>

          {kind === "special" && (
            <div className="chp-field">
              <span>Points pour chaque fille</span>
              <div className="chp-stepper">
                <button type="button" onClick={() => setSpecial((v) => Math.max(1, v - 5))} aria-label="Moins 5">−</button>
                <strong>{points}</strong>
                <button type="button" onClick={() => setSpecial((v) => Math.min(rules.specialMax, v + 5))} aria-label="Plus 5">+</button>
              </div>
            </div>
          )}

          <div className="chp-field">
            <span>{kind === "individuel" ? "Touche la gagnante" : "Touche les filles"}{picked.length ? ` · ${picked.length} choisie${picked.length > 1 ? "s" : ""}` : ""}</span>
            <div className="chp-names">
              {players.map((p) => {
                const full = todayOf(p.registrationId) + points > rules.maxParPratique;
                return (
                  <button
                    key={p.registrationId}
                    type="button"
                    aria-pressed={picked.includes(p.registrationId)}
                    data-on={picked.includes(p.registrationId) || undefined}
                    disabled={full && !picked.includes(p.registrationId)}
                    onClick={() => toggle(p.registrationId)}
                    title={full ? `Maximum de ${rules.maxParPratique} points atteint pour cette pratique` : undefined}
                  >
                    {p.firstName} {p.lastName.charAt(0)}.
                  </button>
                );
              })}
            </div>
          </div>

          <div className="chp-field">
            <span>Photo (facultatif)</span>
            {pickedPlayers.length > 0 && !canPhoto ? (
              <p className="chp-noconsent">Pas de photo : {noConsent.map((p) => p.firstName).join(", ")} n&apos;a pas l&apos;autorisation photo de sa famille.</p>
            ) : (
              <label className="chp-photo" data-disabled={!canPhoto || undefined}>
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="Aperçu de la photo" />
                ) : (
                  <span>{canPhoto ? "📷 Prendre ou choisir une photo" : "Choisis d'abord les filles"}</span>
                )}
                <input type="file" accept="image/*" capture="environment" disabled={!canPhoto} onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
              </label>
            )}
            {preview && canPhoto ? <button type="button" className="chp-link" onClick={() => setPhoto(null)}>Enlever la photo</button> : null}
          </div>

          {error && <p className="coach-error" role="alert">{error}</p>}
          <div className="chp-actions">
            <button type="button" className="coach-primary" disabled={!picked.length || saving} onClick={publish}>
              {saving ? "Publication…" : picked.length ? `Publier · +${points} à ${pickedPlayers.map((p) => p.firstName).join(", ")}` : "Publier"}
            </button>
            {posts.length > 0 && (
              <button type="button" className="chp-link" onClick={() => setOpen(false)}>Fermer</button>
            )}
          </div>
        </div>
      ) : error ? (
        <p className="coach-error" role="alert">{error}</p>
      ) : null}
    </div>
  );
}

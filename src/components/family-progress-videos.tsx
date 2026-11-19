import { beforeAfter, checkpointLabel, type Checkpoint } from "@/lib/progress-videos";
import type { ProgressVideo } from "@/lib/progress-videos-repo";

/** Espace famille : la progression de sa fille en vidéo (début, mi-saison, fin) et, dès deux moments, l'avant / après.
 *  Liens signés de 2 heures : les vidéos restent privées (Loi 25). */
export function FamilyProgressVideos({ firstName, checkpoints, videos }: { firstName: string; checkpoints: Checkpoint[]; videos: ProgressVideo[] }) {
  const pair = beforeAfter(videos.filter((v) => v.url));
  const player = (v: ProgressVideo) => (
    <video src={v.url ?? undefined} controls playsInline preload="metadata" style={{ width: "100%", borderRadius: 10, background: "#000", aspectRatio: "16 / 9" }} />
  );
  return (
    <div className="parent-card" style={{ display: "grid", gap: 14 }}>
      <h2 style={{ margin: 0 }}>La progression de {firstName} en vidéo</h2>
      {pair && (
        <div style={{ display: "grid", gap: 8 }}>
          <p className="parent-muted" style={{ margin: 0 }}>Avant / après</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            {[pair.before, pair.after].map((v) => (
              <figure key={v.id} style={{ margin: 0, display: "grid", gap: 4 }}>
                {player(v)}
                <figcaption className="parent-muted" style={{ fontSize: "0.85rem" }}>{checkpointLabel(v.checkpoint)} · {v.title}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
      {checkpoints.map((cp) => {
        const list = videos.filter((v) => v.checkpoint === cp && v.url);
        return (
          <div key={cp} style={{ display: "grid", gap: 6 }}>
            <p style={{ margin: 0, fontWeight: 700 }}>{checkpointLabel(cp)}</p>
            {list.length ? (
              list.map((v) => (
                <figure key={v.id} style={{ margin: 0, display: "grid", gap: 4 }}>
                  {player(v)}
                  <figcaption className="parent-muted" style={{ fontSize: "0.85rem" }}>{v.title}{v.note ? ` · ${v.note}` : ""}</figcaption>
                </figure>
              ))
            ) : (
              <p className="parent-muted" style={{ margin: 0, fontSize: "0.9rem" }}>À venir : les éducatrices la filmeront à ce moment de la saison.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

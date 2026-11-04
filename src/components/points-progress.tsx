import { type Progress } from "@/lib/player-points";

/** Barre de progression des points d'une joueuse, comme dans un jeu : niveau, points, prochain niveau, récompenses.
 *  Sans état : utilisée dans Coaching, sur la fiche de la joueuse et dans l'espace des familles. */
export function PointsProgress({ p, compact = false }: { p: Progress; compact?: boolean }) {
  return (
    <div className="pp" data-compact={compact || undefined}>
      <div className="pp-head">
        <span className="pp-level" aria-label={`Niveau ${p.level.n}`}>{p.level.n}</span>
        <span className="pp-name">
          <strong>{p.level.name}</strong>
          <small>{p.xp} point{p.xp > 1 ? "s" : ""}</small>
        </span>
        {p.next ? <span className="pp-goal">{p.next.name} à {p.next.min}</span> : <span className="pp-goal">Niveau maximum 🏆</span>}
      </div>
      <div className="pp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p.pct * 100)} aria-label={p.next ? `Vers le niveau ${p.next.name}` : "Niveau maximum"}>
        <div style={{ width: `${Math.max(4, p.pct * 100)}%` }} />
      </div>
      {!compact && (
        <p className="pp-sub">
          {p.next ? `Encore ${p.toNext} point${p.toNext > 1 ? "s" : ""} pour devenir ${p.next.name}.` : "Elle a atteint le plus haut niveau."}
          {p.nextReward ? ` Prochaine récompense : ${p.nextReward.name} à ${p.nextReward.cost} points (encore ${p.nextReward.toGo}).` : ""}
        </p>
      )}
      {p.unlocked.length > 0 && (
        <p className="pp-rewards">
          {p.unlocked.map((r) => (
            <span key={r.id} data-given={r.given || undefined}>
              {r.given ? "✓" : "🎁"} {r.name}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

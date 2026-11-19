import { CoachTopbar } from "@/components/coach-topbar";
import { MatchPlayer } from "@/components/match-player";
import { requireCoach } from "@/lib/coach-auth";
import { getCoach } from "@/lib/coaches-repo";
import { PRACTICE_VIDEO_DAYS, videosForCoach } from "@/lib/match-videos";

export const metadata = { title: "Vidéos — Espace Technique" };
export const dynamic = "force-dynamic";

const day = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" }) : "");
const mins = (s: number | null) => (s ? `${Math.round(s / 60)} min` : "");

/** Vidéothèque des éducateurs (JP, 18 nov. 2026) : tous nos matchs en tout temps, et les pratiques filmées pendant
 *  14 jours (le temps d'écrire ses notes sur les joueuses), puis elles se ferment. */
export default async function CoachVideosPage() {
  const coachId = await requireCoach();
  const [coach, videos] = await Promise.all([getCoach(coachId), videosForCoach().catch(() => [])]);
  const matches = videos.filter((v) => v.kind === "match");
  const practices = videos.filter((v) => v.kind === "pratique");
  // Un aperçu par vidéo (image, titre, date, durée) ; un clic ouvre le lecteur, ses périodes et ses temps forts.
  const Row = ({ v }: { v: (typeof videos)[number] }) => (
    <div className="coach-card" style={{ padding: 12, display: "grid", gap: 10, alignContent: "start" }}>
      <MatchPlayer id={v.id} endpoint={`/api/coach/videos/${v.id}`} label={`Regarder ${v.teamName ?? v.title}`} poster={v.poster} />
      <div>
        <p style={{ margin: 0, fontWeight: 600 }}>{v.teamName ?? v.title}</p>
        <p className="coach-muted" style={{ margin: 0, fontSize: "0.8rem" }}>
          {day(v.date)} {mins(v.duration_s) ? `· ${mins(v.duration_s)}` : ""} {v.goals ? `· ${v.goals} but${v.goals > 1 ? "s" : ""}` : ""}
          {v.closesOn ? ` · ouverte jusqu'au ${day(v.closesOn)}` : ""}
        </p>
      </div>
    </div>
  );
  const grid = { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))" } as const;
  return (
    <>
      <CoachTopbar coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"} />
      <div className="admin-content">
        <div className="admin-section coach-page">
          <p className="coach-eyebrow">Vidéos</p>
          <h1 className="coach-title coach-title--xl">Nos matchs et les pratiques filmées</h1>
          <p className="coach-sub">Les matchs restent ici en tout temps. Une pratique filmée est ouverte {PRACTICE_VIDEO_DAYS} jours : regarde-la pour écrire tes notes sur tes joueuses, puis elle se ferme.</p>
          <h2 className="coach-h2" style={{ marginTop: 20 }}>Pratiques filmées ({practices.length})</h2>
          <div style={grid}>{practices.length ? practices.map((v) => <Row key={v.id} v={v} />) : <p className="coach-muted">Aucune pratique filmée ces {PRACTICE_VIDEO_DAYS} derniers jours.</p>}</div>
          <h2 className="coach-h2" style={{ marginTop: 24 }}>Matchs ({matches.length})</h2>
          <div style={grid}>{matches.length ? matches.map((v) => <Row key={v.id} v={v} />) : <p className="coach-muted">Aucun match filmé pour l&apos;instant.</p>}</div>
        </div>
      </div>
    </>
  );
}

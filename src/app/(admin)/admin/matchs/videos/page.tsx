import { MatchVideosAdmin, type AdminVideoRow, type PlaceOption } from "@/components/match-videos-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { candidatesOn, listMatchVideos, type MatchVideo } from "@/lib/match-videos";
import { durationLabel } from "@/lib/match-videos-core";
import { loadTeamTargets } from "@/lib/mcs-robot-runner";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getVeoStatus } from "@/lib/veo-config";

export const metadata = { title: "Matchs et pratiques filmés — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const hhmm = (m: number | null) => (m === null ? "" : ` ${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`);

/** Les enregistrements Veo « Newval » rangés par le robot : matchs (familles de l'équipe) et pratiques (éducateurs). */
export default async function MatchVideosPage() {
  await requireAdmin({ roles: ["admin"] });
  const [list, veo, teams, { data: views }] = await Promise.all([listMatchVideos(), getVeoStatus(), loadTeamTargets(), (getSupabaseAdminClient() as any).from("match_video_views").select("video_id")]);
  const viewCount = new Map<string, number>();
  for (const v of (views ?? []) as any[]) viewCount.set(v.video_id, (viewCount.get(v.video_id) ?? 0) + 1);
  const row = (v: MatchVideo & { teamName: string | null }): AdminVideoRow => ({
    id: v.id,
    kind: v.kind,
    status: v.status,
    date: v.match_date,
    title: v.title,
    veoTitle: v.veo_title,
    teamName: v.teamName,
    duration: durationLabel(v.duration_s),
    poster: v.thumbnail_url,
    goals: v.highlights.filter((h) => h.type === "goal").length,
    moments: v.highlights.length,
    published: v.published,
    views: viewCount.get(v.id) ?? 0,
    reason: v.error,
    veoUrl: v.veo_slug ? `https://app.veo.co/matches/${v.veo_slug}/` : null
  });
  // Ranger à la main : les activités du même jour d'abord, puis n'importe quelle équipe (match ou pratique).
  const teamOptions: PlaceOption[] = teams
    .filter((t) => t.kind === "match" || t.kind === "pratique")
    .flatMap((t) => (["match", "pratique"] as const).map((kind) => ({ kind, teamId: t.id, mcsEventId: null, activityId: null, teamName: t.name, label: `${t.name} · ${kind === "match" ? "match (familles)" : "pratique (éducateurs)"}` })));
  const toClassify = await Promise.all(
    list
      .filter((v) => v.status === "a-classer")
      .map(async (v) => ({
        v: row(v),
        options: v.match_date
          ? (await candidatesOn(v.match_date).catch(() => [])).map((c) => ({ kind: c.kind, teamId: c.teamId, mcsEventId: c.mcsEventId, activityId: c.activityId, teamName: c.teamName, label: `Ce jour-là : ${c.teamName} · ${c.kind}${hhmm(c.startMin)}` }))
          : []
      }))
  );
  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1000 }}>
        <header>
          <p className="mda-eyebrow">Caméra Veo, rangé au bon endroit</p>
          <h1 className="mda-h1">Matchs et pratiques filmés</h1>
          <p className="mda-lead">Un match est dans l&apos;espace client des familles de l&apos;équipe (et des joueuses présentes) ; une pratique est dans le portail des éducateurs, sur la page de l&apos;activité. Lecture en 1080p, avec les périodes et les temps forts de Veo.</p>
        </header>
        <MatchVideosAdmin videos={list.filter((v) => v.status === "pret").map(row)} toClassify={toClassify} teams={teamOptions} veo={veo ? { email: veo.email, updatedAt: veo.updatedAt } : null} />
      </div>
    </div>
  );
}

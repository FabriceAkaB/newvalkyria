import { MatchVideosAdmin, type AdminVideoRow } from "@/components/match-videos-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { consentForVideo, getFilmableMatches, getFilmablePractices, getStreamConfig, listMatchVideos, refreshVideoStatuses } from "@/lib/match-videos";
import { durationLabel } from "@/lib/match-videos-core";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getVeoStatus } from "@/lib/veo-config";

export const metadata = { title: "Matchs filmés — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Matchs filmés (familles de l'équipe, dans leur espace client) et pratiques filmées (éducateurs seulement). */
export default async function MatchVideosPage() {
  await requireAdmin({ roles: ["admin"] });
  await refreshVideoStatuses().catch(() => null);
  const [config, list, matches, practices, veo, { data: views }] = await Promise.all([
    getStreamConfig(),
    listMatchVideos(),
    getFilmableMatches().catch(() => []),
    getFilmablePractices().catch(() => []),
    getVeoStatus(),
    (getSupabaseAdminClient() as any).from("match_video_views").select("video_id")
  ]);
  const viewCount = new Map<string, number>();
  for (const v of (views ?? []) as any[]) viewCount.set(v.video_id, (viewCount.get(v.video_id) ?? 0) + 1);
  const videos: AdminVideoRow[] = await Promise.all(
    list.map(async (v) => ({
      id: v.id,
      kind: v.kind,
      date: v.match_date,
      title: v.title,
      teamName: v.teamName,
      status: v.status,
      duration: durationLabel(v.duration_s),
      error: v.error,
      published: v.published,
      source: v.source,
      consent: v.kind === "match" ? await consentForVideo(v) : { oui: [], non: [], sansReponse: [], total: 0 },
      views: viewCount.get(v.id) ?? 0
    }))
  );
  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1000 }}>
        <header>
          <p className="mda-eyebrow">Veo ou fichier, rangé au bon endroit</p>
          <h1 className="mda-h1">Matchs et pratiques filmés</h1>
          <p className="mda-lead">
            Un match va dans l&apos;espace client des familles de l&apos;équipe (et des joueuses présentes), après le contrôle de l&apos;accord photo et vidéo. Une pratique reste pour les éducateurs : ils la retrouvent sur la page de l&apos;activité, le jour où ils évaluent. Qualité gardée (1080p), lecture fluide sur téléphone, liens privés qui expirent.
          </p>
        </header>
        <MatchVideosAdmin configured={Boolean(config)} videos={videos} matches={matches} practices={practices} veo={veo} />
      </div>
    </div>
  );
}

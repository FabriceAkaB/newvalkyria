import { notFound } from "next/navigation";

import { PlayerPhotoUpload } from "@/components/player-photo-upload";
import { getPlayerByPhotoToken } from "@/lib/players-repo";

export const metadata = { title: "Photo de votre joueuse — New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Lien personnel envoyé aux familles : la photo de leur fille pour que les éducateurs la reconnaissent. */
export default async function PlayerPhotoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const player = await getPlayerByPhotoToken(token);
  if (!player) notFound();
  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <h1 style={{ fontSize: "1.6rem", margin: 0, lineHeight: 1.2 }}>La photo de {player.firstName}</h1>
      <p style={{ margin: 0, lineHeight: 1.55, color: "#4a4358" }}>
        Une photo du visage, bien éclairée, suffit (un selfie de {player.firstName} fait très bien l&apos;affaire). Elle sert seulement à ses éducateurs pour la reconnaître : présences, évaluations et bulletin. Elle n&apos;est jamais publiée sans votre accord.
      </p>
      <PlayerPhotoUpload token={token} firstName={player.firstName} hasPhoto={player.hasPhoto} initialConsent={player.imageConsent} />
    </div>
  );
}

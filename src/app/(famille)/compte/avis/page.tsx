import type { Metadata } from "next";

import { Container } from "@/components/container";
import { FamilyReview } from "@/components/family-review";
import { getMyReview, getReviewSettings } from "@/lib/family-reviews-repo";
import { requireParentUserId } from "@/lib/parent-auth";

export const metadata: Metadata = { title: "Votre avis | Espace famille", robots: "noindex" };
export const dynamic = "force-dynamic";

const money = (c: number) => (c / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

/** « Votre avis compte » : écrit une fois, publié sur Google et Facebook en deux clics ; témoignage vidéo récompensé. */
export default async function AvisPage() {
  const userId = await requireParentUserId();
  const [review, settings] = await Promise.all([getMyReview(userId), getReviewSettings()]);
  return (
    <section className="insc-hero">
      <Container className="max-w-2xl">
        <div className="fam-hello">
          <p>Votre avis compte</p>
          <h1>Partagez votre expérience</h1>
        </div>
        <FamilyReview
          googleUrl={settings.googleUrl}
          facebookUrl={settings.facebookUrl}
          creditLabel={settings.videoCreditCents > 0 ? `${money(settings.videoCreditCents)} sur la prochaine saison` : "merci !"}
          initial={review ? { stars: review.stars, body: review.body, videoStatus: review.videoStatus, googleClicked: !!review.googleClickedAt, facebookClicked: !!review.facebookClickedAt } : null}
        />
      </Container>
    </section>
  );
}

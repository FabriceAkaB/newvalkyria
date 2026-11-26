import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/container";
import { ChampionTitles } from "@/components/family-champion-titles";
import { getGirlPhotos } from "@/lib/family-photos";
import { requireParentUserId } from "@/lib/parent-auth";
import { getFamilyRegistrations } from "@/lib/parent-repo";
import { getChampionTitles } from "@/lib/player-points-repo";

export const metadata: Metadata = { title: "Titres de championne | Espace famille", robots: "noindex" };
export const dynamic = "force-dynamic";

/** « Toutes les fois où ma fille a été championne » (JP, 25 nov. 2026) : le palmarès de chaque fille de la famille
 *  connectée, le plus récent en haut. Ouvert depuis l'Accueil ; seulement les inscriptions de cette famille. */
export default async function ChampionnePage() {
  const userId = await requireParentUserId();
  const family = await getFamilyRegistrations(userId);
  const ids = family.map((f) => f.registrationId);
  const [titles, photos] = await Promise.all([getChampionTitles(ids), getGirlPhotos(ids).catch(() => new Map<string, string>())]);

  return (
    <section className="insc-hero">
      <Container className="max-w-2xl">
        <div className="fam-hello">
          <p>Championnes du jour</p>
          <h1>{family.length === 1 ? `Les titres de ${family[0].firstName}` : "Leurs titres de championne"}</h1>
        </div>

        {!family.length ? (
          <div className="parent-card">
            <p className="parent-muted" style={{ margin: 0 }}>
              Ses titres apparaissent dès que votre fille est inscrite à la saison et reliée à votre compte. <Link href="/compte/enfants" className="parent-link">Mes enfants →</Link>
            </p>
          </div>
        ) : (
          family.map((f) => <ChampionTitles key={f.registrationId} firstName={f.firstName} titles={titles.get(f.registrationId) ?? []} photoUrl={photos.get(f.registrationId) ?? null} />)
        )}

        <p className="parent-muted" style={{ margin: "1.5rem 0 0", fontSize: "0.85rem" }}>
          Les photos ne paraissent que si chaque famille de la photo l&apos;a autorisé. Les autres filles sont nommées par leur prénom et leur initiale. Il n&apos;y a pas de classement entre les filles. <Link href="/compte/points" className="parent-link">Ses points et ses récompenses →</Link>
        </p>
      </Container>
    </section>
  );
}

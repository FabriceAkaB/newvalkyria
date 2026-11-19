import type { Metadata } from "next";
import Link from "next/link";

import { BulletinReport } from "@/components/bulletin-report";
import { FamilyProgressVideos } from "@/components/family-progress-videos";
import { Container } from "@/components/container";
import { getBulletinReport } from "@/lib/bulletin-repo";
import { requireParentUserId } from "@/lib/parent-auth";
import { getFamilyRegistrations, getVerifiedParentEmail } from "@/lib/parent-repo";
import { getFamilyProgressVideos } from "@/lib/progress-videos-repo";
import { getGirlPhotos } from "@/lib/family-photos";

export const metadata: Metadata = { title: "Progression | New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Espace parent : où en est ma fille ? Le bulletin de sa saison en cours (présences, évaluations des éducateurs,
 *  évolution, objectifs), sans les notes internes des éducateurs. */
export default async function ProgressionPage({ searchParams }: { searchParams: Promise<{ bulletin?: string }> }) {
  const sp = await searchParams;
  const period = sp.bulletin === "mi-saison" || sp.bulletin === "fin-saison" ? sp.bulletin : null;
  const userId = await requireParentUserId();
  const [family, email] = await Promise.all([getFamilyRegistrations(userId), getVerifiedParentEmail(userId)]);
  const regIds = new Map(family.map((f) => [`${f.firstName} ${f.lastName}`.toLowerCase(), f.registrationId]));
  const [bulletins, progress, photos] = await Promise.all([
    Promise.all([...regIds.entries()].map(async ([k, id]) => ({ key: k, data: await getBulletinReport(id, { period, audience: "parent" }).catch(() => null) }))),
    // Seulement les inscriptions de cette famille : les vidéos des autres filles ne sont jamais lues ici (Loi 25).
    getFamilyProgressVideos(family.map((f) => f.registrationId)).catch(() => new Map()),
    getGirlPhotos(family.map((f) => f.registrationId)).catch(() => new Map<string, string>())
  ]);
  return (
    <section className="insc-hero">
      <Container className="max-w-2xl">
        <div className="insc-hero-inner">
          <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Espace parent</p>
          <h1 className="insc-hero-title">Progression</h1>
          <p className="insc-hero-sub">Sa progression en vidéo (filmée au fil de la saison, avec un avant / après), puis son bulletin deux fois par saison : ses présences, ce que les éducatrices observent après chaque pratique, son bien-être, son leadership et ses objectifs.</p>
        </div>
      </Container>
      <Container className="max-w-2xl">
        <div style={{ display: "grid", gap: "1.5rem" }}>
          {family.map((f) => {
            const p = progress.get(f.registrationId);
            return p ? <FamilyProgressVideos key={`v-${f.registrationId}`} firstName={f.firstName} checkpoints={p.checkpoints} videos={p.videos} photoUrl={photos.get(f.registrationId) ?? null} /> : null;
          })}
          {bulletins.filter((b) => b.data).map((b) => (
            <BulletinReport key={b.key} data={b.data!} periodHref={(p) => `/compte/progression?bulletin=${p}`} />
          ))}
          {!bulletins.some((b) => b.data) ? (
            <div className="parent-card">
              <h2>Pas encore de bulletin</h2>
              <p className="parent-muted" style={{ margin: 0 }}>
                {regIds.size
                  ? "Le bulletin apparaît dès les premières évaluations de la saison."
                  : email
                    ? "Nous ne trouvons pas d'inscription à votre courriel : si l'autre parent a inscrit votre fille, reliez son profil dans l'onglet Accueil."
                    : "Confirmez d'abord votre courriel (onglet Accueil) : le bulletin de votre fille apparaîtra ici."}{" "}
                {!regIds.size ? <Link href="/compte/espace" className="parent-link">Aller à l&apos;accueil →</Link> : null}
              </p>
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  );
}

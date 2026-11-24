import type { Metadata } from "next";
import Link from "next/link";

import { BulletinGateSurvey, BulletinGoogleReview } from "@/components/bulletin-gate";
import { BulletinReport } from "@/components/bulletin-report";
import { FamilyPassport } from "@/components/family-passport";
import { FamilyProgressVideos } from "@/components/family-progress-videos";
import { Container } from "@/components/container";
import { needsGate, reviewDraft, showGoogleButton } from "@/lib/bulletin-gate";
import { getEarlyAccess, getGoogleReviewUrl, getParentGate } from "@/lib/bulletin-gate-repo";
import { getBulletinReport } from "@/lib/bulletin-repo";
import { getFamilyParcours, type FamilyParcours } from "@/lib/family-passport-repo";
import { requireParentUserId } from "@/lib/parent-auth";
import { getFamilyRegistrations, getParentAccount, getVerifiedParentEmail } from "@/lib/parent-repo";
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
  const [family, email, account] = await Promise.all([getFamilyRegistrations(userId), getVerifiedParentEmail(userId), getParentAccount(userId)]);
  const earlyAccess = await getEarlyAccess(account?.email).catch(() => false);
  const regIds = new Map(family.map((f) => [`${f.firstName} ${f.lastName}`.toLowerCase(), f.registrationId]));
  const [bulletins, progress, photos, parcours] = await Promise.all([
    Promise.all([...regIds.entries()].map(async ([k, id]) => ({ key: k, data: await getBulletinReport(id, { period, audience: "parent", earlyAccess }).catch(() => null) }))),
    // Seulement les inscriptions de cette famille : les vidéos des autres filles ne sont jamais lues ici (Loi 25).
    getFamilyProgressVideos(family.map((f) => f.registrationId)).catch(() => new Map()),
    getGirlPhotos(family.map((f) => f.registrationId)).catch(() => new Map<string, string>()),
    // Passeport et parcours : seulement les filles de cette famille, chacune comparée à elle-même (P1.5.03).
    getFamilyParcours(family.map((f) => f.registrationId)).catch(() => new Map<string, FamilyParcours>())
  ]);
  // Bulletin remis : d'abord le sondage de 2 minutes (P4.8.18), une fois par parent ; à 9 ou 10, le bouton d'avis Google (P3.8.19).
  const shown = bulletins.filter((b) => b.data);
  const released = shown.find((b) => b.data!.released)?.data ?? null;
  const gate = released ? await getParentGate(userId, released.range.period).catch(() => null) : null;
  const locked = !!gate && needsGate({ released: true, surveyStatus: gate.survey.status, respondedAt: gate.invite.responded_at });
  const googleUrl = gate?.response && !locked ? await getGoogleReviewUrl().catch(() => null) : null;
  const askGoogle = !!gate?.response && !gate.response.google_clicked_at && showGoogleButton(gate.response.recommend_score, googleUrl);
  const names = shown.filter((b) => b.data!.released).map((b) => b.data!.player.firstName).filter(Boolean);
  return (
    <section className="insc-hero">
      <Container className="max-w-2xl">
        <div className="insc-hero-inner">
          <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Espace parent</p>
          <h1 className="insc-hero-title">Progression</h1>
          <p className="insc-hero-sub">Sa progression en vidéo (filmée au fil de la saison, avec un avant / après), son passeport et son parcours, puis son bulletin deux fois par saison : ses présences, ce que les éducatrices observent après chaque pratique, son bien-être, son leadership et ses objectifs.</p>
        </div>
      </Container>
      <Container className="max-w-2xl">
        <div style={{ display: "grid", gap: "1.5rem" }}>
          {family.map((f) => {
            const p = progress.get(f.registrationId);
            const pc = parcours.get(f.registrationId);
            return (
              <div key={`g-${f.registrationId}`} style={{ display: "grid", gap: "1.5rem" }}>
                {p ? <FamilyProgressVideos firstName={f.firstName} checkpoints={p.checkpoints} videos={p.videos} photoUrl={photos.get(f.registrationId) ?? null} /> : null}
                {pc ? <FamilyPassport registrationId={f.registrationId} firstName={f.firstName} photoUrl={photos.get(f.registrationId) ?? null} data={pc} /> : null}
              </div>
            );
          })}
          {locked && gate && released ? (
            <BulletinGateSurvey
              period={released.range.period}
              names={names.length > 1 ? `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}` : names[0] || "votre fille"}
              label={released.range.label}
              intro={gate.survey.intro}
              questions={gate.survey.questions}
            />
          ) : (
            <>
              {askGoogle && gate?.response && googleUrl ? (
                <BulletinGoogleReview period={released!.range.period} url={googleUrl} draft={reviewDraft(gate.response.answers)} clicked={false} />
              ) : null}
              {shown.map((b) => (
                <BulletinReport key={b.key} data={b.data!} periodHref={(p) => `/compte/progression?bulletin=${p}`} />
              ))}
            </>
          )}
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

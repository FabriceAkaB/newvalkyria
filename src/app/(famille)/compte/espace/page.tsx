import type { Metadata } from "next";
import { CalendarClock, ChevronRight, ClipboardList, MessageSquareHeart, MessageSquareQuote } from "lucide-react";
import Link from "next/link";

import { Container } from "@/components/container";
import { EmailCheckBanner } from "@/components/email-check-banner";
import { FamilyInviteCard } from "@/components/family-invite-card";
import { ChampionFeed, GirlPointsCard } from "@/components/family-champions";
import { ChampionTitlesLink } from "@/components/family-champion-titles";
import type { ChampionTitle } from "@/lib/champion-titles";
import { getGirlPhotos } from "@/lib/family-photos";
import { getSheetsForRegistrations } from "@/lib/player-sheet-repo";
import { requireParentUserId } from "@/lib/parent-auth";
import { progressOf } from "@/lib/player-points";
import { CLUB } from "@/lib/club";
import { getFamilySchedule } from "@/lib/family-schedule";
import { fmtDay, fmtHours } from "@/lib/family-schedule-core";
import { getChampionTitles, getFamilyFeed, getPointsHistory, getPointsSummaries, getRewards } from "@/lib/player-points-repo";
import { getFamilyRegistrations, getParentAccount, isParentEmailVerified } from "@/lib/parent-repo";
import { getTrialInviteUrl } from "@/lib/referrals-repo";
import { isFreshWin } from "@/lib/trial-invite";

export const metadata: Metadata = { title: "Accueil | Espace famille", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Accueil de l'app famille : les points de chaque fille, puis le fil des championnes du jour (les pratiques de
 *  son groupe) et l'accès à ses titres de championne (/compte/championne). */
export default async function EspaceParentPage({ searchParams }: { searchParams: Promise<{ courriel?: string }> }) {
  const userId = await requireParentUserId();
  const [account, family, sp] = await Promise.all([getParentAccount(userId), getFamilyRegistrations(userId), searchParams]);
  const verified = account?.email ? await isParentEmailVerified(userId, account.email) : false;
  const ids = family.map((f) => f.registrationId);
  const [summaries, rewards, feed, histories, photos, schedules, sheets, titles] = await Promise.all([
    getPointsSummaries(ids),
    getRewards(),
    getFamilyFeed(ids),
    Promise.all(ids.map((id) => getPointsHistory(id).catch(() => []))),
    getGirlPhotos(ids).catch(() => new Map<string, string>()),
    getFamilySchedule(ids).catch(() => []),
    getSheetsForRegistrations(ids).catch(() => new Map()),
    getChampionTitles(ids).catch(() => new Map<string, ChampionTitle[]>())
  ]);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: CLUB.timezone });
  const active = rewards.filter((r) => r.active);
  const firstName = (account?.fullName ?? "").split(" ")[0];
  // « Invite une amie à l'essai » (P3.1.08) : juste après une victoire de sa fille (championne du jour, 14 jours).
  const champion = family.find((f, i) => histories[i].some((h) => (h.kind === "victoire" || h.kind === "attitude") && isFreshWin(h.date, today)));
  const inviteUrl = champion && verified ? await getTrialInviteUrl(account?.email, account?.fullName) : null;

  return (
    <section className="insc-hero">
      <Container className="max-w-2xl">
        <div className="fam-hello">
          <p>Bonjour{firstName ? ` ${firstName}` : ""}</p>
          <h1>{family.length ? (family.length === 1 ? `La saison de ${family[0].firstName}` : `La saison de ${family.map((f) => f.firstName).join(" et ")}`) : "Votre espace famille"}</h1>
        </div>
        <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1.25rem" }}>
          {sp.courriel === "confirme" ? <p style={{ margin: 0, color: "var(--adm-good)", fontWeight: 600 }}>Merci, votre courriel est confirmé.</p> : null}
          {sp.courriel === "invalide" ? <p style={{ margin: 0, color: "var(--adm-bad)" }}>Ce lien de confirmation n&apos;est plus valide : demandez-en un nouveau ci-dessous.</p> : null}
          {!verified ? <EmailCheckBanner /> : null}
        </div>

        {family.length ? (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {family.map((f, i) => {
              const s = summaries.get(f.registrationId);
              if (!s) return null;
              return (
                <GirlPointsCard
                  key={f.registrationId}
                  firstName={f.firstName}
                  progress={progressOf(s.earned, active, s.balance)}
                  summary={s}
                  titles={histories[i].filter((h) => h.kind === "victoire" || h.kind === "attitude").length}
                  photoUrl={photos.get(f.registrationId) ?? null}
                />
              );
            })}
          </div>
        ) : (
          <div className="parent-card">
            <h2 style={{ marginTop: 0 }}>Bienvenue</h2>
            <p className="parent-muted" style={{ margin: 0 }}>
              {verified
                ? "Nous ne trouvons pas encore d'inscription à la saison pour votre famille. Si l'autre parent a inscrit votre fille, reliez son profil dans « Mes enfants »."
                : "Confirmez votre courriel ci-dessus : la saison de votre fille (points, championnes, bulletin) apparaîtra ici."}{" "}
              <Link href="/compte/enfants" className="parent-link">Mes enfants →</Link>
            </p>
          </div>
        )}

        {schedules.length ? (
          <>
            <h2 className="fam-h2">Prochaine pratique</h2>
            <ul className="fam-list">
              {schedules.map((s) => {
                const n = s.next;
                const hours = n ? fmtHours(n.start, n.end) : null;
                return (
                  <li key={s.registrationId}>
                    <CalendarClock aria-hidden strokeWidth={1.75} />
                    <span>
                      <Link href="/compte/horaire" className="parent-link">
                        {schedules.length > 1 ? `${s.firstName} : ` : ""}
                        {n ? `${fmtDay(n.date, today)}${hours ? ` · ${hours}` : ""}` : "Aucune pratique dans les 14 prochains jours"}
                      </Link>
                      {n ? <small>{[n.group, n.place ?? n.address].filter(Boolean).join(" · ")}</small> : <small>Voir son horaire et ses matchs</small>}
                    </span>
                    <ChevronRight aria-hidden strokeWidth={1.75} />
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}

        <h2 className="fam-h2">Championnes du jour</h2>
        <ChampionFeed posts={feed} empty={family.length ? "Les championnes de ses pratiques apparaîtront ici dès que les éducatrices les publieront, après chaque pratique." : "Le fil des championnes s'ouvre dès l'inscription de votre fille."} />
        {champion && inviteUrl ? (
          <div style={{ marginTop: "1rem" }}>
            <FamilyInviteCard moment="championne" firstName={champion.firstName} url={inviteUrl} />
          </div>
        ) : null}

        {family.length ? (
          <>
            <h2 className="fam-h2">{family.length === 1 ? "Ses titres de championne" : "Leurs titres de championne"}</h2>
            <ul className="fam-list">
              {family.map((f) => (
                <ChampionTitlesLink key={f.registrationId} firstName={f.firstName} titles={titles.get(f.registrationId) ?? []} many={family.length > 1} />
              ))}
            </ul>
          </>
        ) : null}
        {family.some((f) => !sheets.has(f.registrationId)) ? (
          <div className="parent-card" style={{ marginTop: "1.5rem", display: "flex", gap: 12, alignItems: "center", boxShadow: "inset 3px 0 0 var(--adm-accent-strong)" }}>
            <ClipboardList aria-hidden strokeWidth={1.75} style={{ color: "var(--adm-accent)", flex: "0 0 auto" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 600 }}>Aidez les éducatrices à connaître votre fille</p>
              <p className="parent-muted" style={{ margin: "2px 0 0", fontSize: "0.9rem" }}>Deux minutes : ce qu&apos;elle aime, ce qui la stresse, comment l&apos;encourager. Elles la lisent avant la pratique.</p>
            </div>
            <Link href="/compte/fiche" className="parent-link">Remplir la fiche →</Link>
          </div>
        ) : null}

        <h2 className="fam-h2">Votre voix compte</h2>
        <ul className="fam-list">
          <li>
            <MessageSquareQuote aria-hidden strokeWidth={1.75} />
            <span>
              <Link href="/compte/avis" className="parent-link">Donner votre avis</Link>
              <small>Sur Google et Facebook en deux clics, et un témoignage vidéo récompensé</small>
            </span>
            <ChevronRight aria-hidden strokeWidth={1.75} />
          </li>
          <li>
            <MessageSquareHeart aria-hidden strokeWidth={1.75} />
            <span>
              <Link href="/compte/idees" className="parent-link">Boîte à suggestions</Link>
              <small>Une idée, ce que vous aimez, ce qui vous dérange : l&apos;équipe lit tout et vous répond</small>
            </span>
            <ChevronRight aria-hidden strokeWidth={1.75} />
          </li>
        </ul>
      </Container>
    </section>
  );
}

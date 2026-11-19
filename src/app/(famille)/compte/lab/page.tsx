import { Flame, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/container";
import { EmailCheckBanner } from "@/components/email-check-banner";
import { LabDayToggle } from "@/components/family-lab-day";
import { dailyChallenge, monthRate, monthTrack, streakOf } from "@/lib/lab-progress-core";
import { requireParentUserId } from "@/lib/parent-auth";
import { getVerifiedParentEmail } from "@/lib/parent-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { gameOfWeek, getAccessByEmail, getPracticeDays, listRoutines, monthOf, monthTitle, pickRoutine, playerFullName, syncFamilies, todayIso, videoEmbed } from "@/lib/valkyria-lab";

export const metadata: Metadata = { title: "Valkyria Lab | Espace famille", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Valkyria Lab, la formation à la maison (JP, 17 nov. 2026) : le défi du jour (un geste de la routine du mois, écrit
 *  et en vidéo), la progression de chaque fille (jours faits, série), le jeu de la semaine et les retours de son
 *  éducatrice. L'envoi des vidéos reste sur le lien personnel de la famille (/lab/[jeton]). */
export default async function ParentLabPage() {
  const userId = await requireParentUserId();
  const email = await getVerifiedParentEmail(userId);
  let access = email ? await getAccessByEmail(email) : null;
  if (email && !access) {
    await syncFamilies().catch(() => null);
    access = await getAccessByEmail(email);
  }
  const today = todayIso();
  const routines = await listRoutines().catch(() => []);
  const picked = pickRoutine(routines, monthOf(today));
  const routine = picked?.routine ?? null;
  const challenge = routine ? dailyChallenge(routine.exercises, today) : null;
  const embed = challenge ? videoEmbed(challenge.item.videoUrl) : null;
  const game = routine ? gameOfWeek(routine.weekly_games, today) : null;
  type Feedback = { player_name: string; gesture: string; coach_comment: string; seen_at: string | null };
  const [days, feedback]: [Map<string, string[]>, Feedback[]] = access?.active
    ? await Promise.all([
        getPracticeDays(access.id, `${today.slice(0, 7)}-01`).catch(() => new Map<string, string[]>()),
        (getSupabaseAdminClient() as any)
          .from("lab_submissions")
          .select("player_name, gesture, coach_comment, seen_at")
          .eq("access_id", access.id)
          .not("coach_comment", "is", null)
          .order("seen_at", { ascending: false })
          .limit(4)
          .then((r: any) => (r.data ?? []) as Feedback[])
      ])
    : [new Map<string, string[]>(), []];

  return (
    <section className="insc-hero">
      <Container className="max-w-2xl">
        <div className="fam-hello">
          <p>Valkyria Lab</p>
          <h1>{routine ? `${monthTitle(routine.month)} : ${routine.title}` : "La formation à la maison"}</h1>
        </div>

        {!email ? (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p className="parent-muted" style={{ margin: 0 }}>Confirmez d&apos;abord votre courriel pour ouvrir le Lab de votre famille.</p>
            <EmailCheckBanner />
          </div>
        ) : !access?.active ? (
          <div className="parent-card">
            <h2>Le Lab est réservé aux familles inscrites à la saison</h2>
            <p className="parent-muted" style={{ margin: 0 }}>Nous n&apos;avons pas d&apos;inscription à la saison en cours avec le courriel {email}. Si votre fille est inscrite avec l&apos;autre parent, écrivez-nous : nous relierons votre compte.</p>
          </div>
        ) : !routine ? (
          <div className="parent-card">
            <h2>La première routine arrive bientôt</h2>
            <p className="parent-muted" style={{ margin: 0 }}>Chaque mois, l&apos;académie publie ici une routine de ball mastery en capsules vidéo, un geste par jour et un jeu par semaine. Vous serez avisés par courriel dès qu&apos;elle est en ligne.</p>
          </div>
        ) : (
          <>
            {challenge ? (
              <article className="fam-lab-day">
                <p className="fam-post__kind"><Target size={14} strokeWidth={1.75} aria-hidden /> Le défi du jour</p>
                <h2 className="fam-lab-day__title">{challenge.item.name}</h2>
                {embed ? (
                  <div className="fam-lab-video" data-vertical={embed.vertical || undefined}>
                    <iframe src={embed.embedUrl} title={challenge.item.name} allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />
                  </div>
                ) : null}
                {challenge.item.how ? <p className="fam-lab-day__how">{challenge.item.how}</p> : null}
                <p className="parent-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                  Geste {challenge.index + 1} sur {routine.exercises.length} de la routine du mois. Demain, le suivant.
                </p>
              </article>
            ) : null}

            <h2 className="fam-h2">Sa progression</h2>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {access.players.map((p) => {
                const name = playerFullName(p);
                const mine = days.get(name) ?? [];
                const rate = monthRate(mine, today);
                const streak = streakOf(mine, today);
                return (
                  <article key={name} className="fam-girl">
                    <div className="fam-girl__top">
                      <span className="fam-girl__avatar" aria-hidden>{p.firstName.charAt(0)}</span>
                      <div className="fam-girl__id">
                        <p className="fam-girl__name">{p.firstName}</p>
                        <p className="fam-girl__level">{streak ? <><Flame size={14} strokeWidth={1.75} aria-hidden /> {streak} jour{streak > 1 ? "s" : ""} d&apos;affilée</> : "Commence sa série aujourd'hui"}</p>
                      </div>
                      <div className="fam-girl__wallet">
                        <strong>{rate.done}</strong>
                        <small>jours ce mois-ci</small>
                      </div>
                    </div>
                    <div className="fam-lab-track" aria-label={`${rate.done} jours de routine sur ${rate.elapsed}`}>
                      {monthTrack(mine, today).map((d) => (
                        <span key={d.day} data-state={d.state} title={d.day} />
                      ))}
                    </div>
                    <LabDayToggle player={name} firstName={p.firstName} done={mine.includes(today)} />
                  </article>
                );
              })}
            </div>

            {game ? (
              <>
                <h2 className="fam-h2">Le jeu de la semaine</h2>
                <div className="parent-card">
                  <h3 style={{ margin: 0 }}>{game.game.title}</h3>
                  {game.game.how ? <p className="parent-muted" style={{ margin: "0.4rem 0 0", whiteSpace: "pre-line" }}>{game.game.how}</p> : null}
                </div>
              </>
            ) : null}

            {feedback.length ? (
              <>
                <h2 className="fam-h2">Les retours de l&apos;éducatrice</h2>
                <ul className="fam-list">
                  {feedback.map((f, i) => (
                    <li key={i}>
                      <span>
                        « {f.coach_comment} »
                        <small>{f.player_name.split(" ")[0]} · {f.gesture}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <Link href={`/lab/${access.token}`} className="fam-girl__cta" style={{ marginTop: "1.25rem" }}>
              Toute la routine, envoyer une vidéo et voir nos vidéos →
            </Link>
          </>
        )}
      </Container>
    </section>
  );
}

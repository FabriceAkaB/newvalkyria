import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/container";
import { EmailCheckBanner } from "@/components/email-check-banner";
import { ParentTabs } from "@/components/parent-tabs";
import { requireParentUserId } from "@/lib/parent-auth";
import { getVerifiedParentEmail } from "@/lib/parent-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { listRoutines, monthOf, monthTitle, pickRoutine, syncFamilies, todayIso } from "@/lib/valkyria-lab";

export const metadata: Metadata = { title: "Valkyria Lab | New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Espace parent : le Valkyria Lab, la plateforme de la maison. Chaque mois une routine en capsules vidéo, à faire à la
 *  maison pendant la semaine ; la joueuse envoie ses vidéos et l'éducatrice les regarde. Le lien personnel de la
 *  famille (/lab/[jeton]) est créé à sa première visite si elle est inscrite à la saison. */
export default async function ParentLabPage() {
  const userId = await requireParentUserId();
  const email = await getVerifiedParentEmail(userId);
  const db = getSupabaseAdminClient() as any;
  let access: { token: string; active: boolean } | null = null;
  if (email) {
    const find = async () => (await db.from("lab_access").select("token, active").ilike("parent_email", email).maybeSingle()).data as { token: string; active: boolean } | null;
    access = await find();
    if (!access) {
      await syncFamilies().catch(() => null);
      access = await find();
    }
  }
  const today = todayIso();
  const routines = await listRoutines().catch(() => []);
  const picked = pickRoutine(routines, monthOf(today));
  return (
    <section className="insc-hero">
      <Container className="max-w-2xl">
        <ParentTabs />
      </Container>
      <Container className="max-w-2xl">
        <div className="insc-hero-inner">
          <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Espace parent</p>
          <h1 className="insc-hero-title">Valkyria Lab</h1>
          <p className="insc-hero-sub">La formation à la maison : chaque mois, une routine en capsules vidéo, des jeux pour chaque semaine, et votre fille envoie ses vidéos à son éducatrice.</p>
        </div>
      </Container>
      <Container className="max-w-2xl">
        <div style={{ display: "grid", gap: "1rem" }}>
          {!email ? (
            <>
              <p className="parent-muted" style={{ margin: 0 }}>Confirmez d&apos;abord votre courriel pour ouvrir le Lab de votre famille.</p>
              <EmailCheckBanner />
            </>
          ) : !access?.active ? (
            <div className="parent-card">
              <h2>Le Lab est réservé aux familles inscrites à la saison</h2>
              <p className="parent-muted" style={{ margin: 0 }}>Nous n&apos;avons pas d&apos;inscription à la saison en cours avec le courriel {email}. Si votre fille est inscrite avec l&apos;autre parent, écrivez-nous : nous relierons votre compte.</p>
            </div>
          ) : (
            <div className="parent-card">
              <h2>{picked ? `${monthTitle(picked.routine.month)} : ${picked.routine.title}` : "La première routine arrive bientôt"}</h2>
              <p className="parent-muted" style={{ margin: "0 0 0.9rem" }}>
                {picked
                  ? `${picked.routine.exercises.length} exercice${picked.routine.exercises.length > 1 ? "s" : ""} en vidéo${picked.routine.challenge ? `, et le défi du mois : ${picked.routine.challenge}` : ""}.`
                  : "Chaque mois, l'académie publie ici une routine de ball mastery en capsules vidéo et un jeu par semaine. Vous serez avisés par courriel dès qu'elle est en ligne."}
              </p>
              <Link href={`/lab/${access.token}`} style={{ display: "inline-block", background: "#fff", color: "#1d1730", fontWeight: 700, padding: "0.75rem 1.2rem", borderRadius: 10, textDecoration: "none" }}>
                Ouvrir le Lab de ma fille →
              </Link>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}

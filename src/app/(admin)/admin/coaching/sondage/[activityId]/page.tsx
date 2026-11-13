import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminTopbar } from "@/components/admin-topbar";
import { PracticeSurvey, type SurveyPresence } from "@/components/practice-survey";
import { requireAdmin } from "@/lib/admin-auth";
import { answerOf, getSurveyData } from "@/lib/practice-survey-repo";
import { kioskPath } from "@/lib/survey-kiosk";

export const metadata = { title: "Sondage de fin — Coaching", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Sondage de fin d'une pratique, au bord du terrain sur le téléphone. */
export default async function SurveyPage({ params }: { params: Promise<{ activityId: string }> }) {
  await requireAdmin();
  const { activityId } = await params;
  const data = await getSurveyData(activityId);
  if (!data) notFound();
  const { activity, roster, attendance, label } = data;
  const date = new Date(`${String(activity.activity_date).slice(0, 10)}T12:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda" style={{ maxWidth: 720 }}>
          <Link href="/admin/coaching/sondage" className="mda-sub" style={{ textDecoration: "none" }}>← Toutes les pratiques</Link>
          <header>
            <p className="mda-eyebrow" style={{ textTransform: "none" }}>
              <span style={{ textTransform: "capitalize" }}>{date}</span> · {String(activity.start_time).slice(0, 5)}
              {activity.location ? ` · ${activity.location}` : ""}
            </p>
            <h1 className="mda-h1">{label} · {roster.length} joueuse{roster.length > 1 ? "s" : ""}</h1>
            <p className="mda-lead">Touche « Présente » ou « Absente », puis pour chaque fille : son plaisir et sa fatigue sur 10 et, si elle veut, ce qu&apos;elle aimerait avoir plus. Tout s&apos;enregistre à chaque touche.</p>
          </header>
          <a href={kioskPath(activity.id)} target="_blank" rel="noreferrer" className="admin-btn-primary" style={{ textDecoration: "none", justifySelf: "start" }}>
            📱 Ouvrir la borne sur l&apos;iPad
          </a>
          <PracticeSurvey
            activityId={activity.id}
            players={roster}
            initialPresence={Object.fromEntries(attendance.map((a) => [a.registration_id, a.status as SurveyPresence]))}
            initialAnswers={Object.fromEntries(attendance.map((a) => [a.registration_id, answerOf(a)]))}
            feedbackUrl="/api/admin/coaching/sondage/reponse"
            attendanceUrl="/api/admin/coaching/sondage/presence"
          />
        </div>
      </div>
    </>
  );
}

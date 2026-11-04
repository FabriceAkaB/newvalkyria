import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/admin-auth";
import { getRecentPracticesForSurvey, openSurveyActivity } from "@/lib/practice-survey-repo";

export const dynamic = "force-dynamic";

const nowMinutes = () => {
  const [h, m] = new Date().toLocaleTimeString("en-GB", { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit" }).split(":").map(Number);
  return h * 60 + m;
};

/** Raccourci à garder sur l'écran d'accueil du téléphone : newvalkyria.com/admin/sondage ouvre tout de suite le
 *  sondage de fin de la pratique qui vient de commencer ou de finir (sinon la dernière pratique passée). */
export default async function SurveyShortcut() {
  await requireAdmin();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const practices = await getRecentPracticesForSurvey();
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const now = nowMinutes();
  // La plus récente qui a déjà commencé (aujourd'hui) ou qui est passée.
  const target = practices.find((p) => p.date < today || (p.date === today && toMin(p.start) <= now + 15));
  if (!target) redirect("/admin/coaching/sondage");
  const id = target.activityId ?? (await openSurveyActivity(target.key));
  redirect(id ? `/admin/coaching/sondage/${id}` : "/admin/coaching/sondage");
}

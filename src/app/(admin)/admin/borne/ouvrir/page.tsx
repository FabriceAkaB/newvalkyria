import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/admin-auth";
import { openSurveyActivity } from "@/lib/practice-survey-repo";
import { kioskPath } from "@/lib/survey-kiosk";

export const dynamic = "force-dynamic";

/** Une pratique de l'horaire sans activité encore : la crée, puis ouvre la borne (pratique ou sondage). */
export default async function OpenKiosk({ searchParams }: { searchParams: Promise<{ pratique?: string; vue?: string }> }) {
  await requireAdmin({ roles: ["admin", "gerante", "borne"] });
  const { pratique, vue } = await searchParams;
  const id = pratique ? await openSurveyActivity(pratique) : null;
  redirect(id ? `${kioskPath(id)}&vue=${vue === "sondage" || vue === "tournoi" ? vue : "pratique"}` : "/admin/borne");
}

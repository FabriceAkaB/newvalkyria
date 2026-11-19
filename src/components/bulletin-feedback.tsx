import { BulletinFeedbackCard } from "@/components/bulletin-feedback-card";
import { getMyFeedback } from "@/lib/bulletin-feedback-repo";
import { getParentUserId } from "@/lib/parent-auth";

/** Le sondage court sous le bulletin (P4.8.11), côté parent seulement : retrouve la réponse déjà donnée par ce parent. */
export async function BulletinFeedback({ registrationId, period, firstName }: { registrationId: string; period: "mi-saison" | "fin-saison"; firstName: string }) {
  const userId = await getParentUserId().catch(() => null);
  if (!userId) return null;
  const mine = await getMyFeedback(userId, registrationId, period).catch(() => null);
  return <BulletinFeedbackCard registrationId={registrationId} period={period} firstName={firstName} initial={mine ? { useful: mine.useful, missing: mine.missing } : null} />;
}

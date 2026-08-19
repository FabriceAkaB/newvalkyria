import type { Metadata } from "next";

import { SportEtudesContent } from "@/components/sport-etudes-content";
import { countFullProgramRegistrations, getActiveSessions, getSettings } from "@/lib/sport-etudes-repo";

export const metadata: Metadata = {
  title: "Programme technique de préparation aux évaluations du Sport-Études | New Valkyria",
  description:
    "Encadrement technique intensif pour préparer un jeune joueur à son entrée dans un programme Sport-Études — 6 séances et une séance diagnostique gratuite.",
  alternates: { canonical: "/sport-etudes" }
};

export const dynamic = "force-dynamic";

export default async function SportEtudesPage() {
  const [sessions, settings, takenCount] = await Promise.all([getActiveSessions(), getSettings(), countFullProgramRegistrations()]);
  const remaining = Math.max(0, settings.max_capacity - takenCount);

  return <SportEtudesContent sessions={sessions} remaining={remaining} isFull={remaining <= 0} />;
}

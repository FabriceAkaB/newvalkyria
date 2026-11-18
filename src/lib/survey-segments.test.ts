import { describe, expect, it } from "vitest";
import { PROJECTS_2027, SEGMENT_6E_2027, projectOption } from "@/lib/project-pipeline";
import { SURVEY_TEMPLATES, questionsForInvite } from "@/lib/surveys-repo";

describe("un seul formulaire, adapté à chaque famille", () => {
  const tpl = SURVEY_TEMPLATES.find((t) => t.kind === "interet")!;
  const prep = projectOption(PROJECTS_2027.find((p) => p.key === "prep-sport-etudes")!);
  it("une seule liste à cocher pour tous les projets", () => {
    expect(tpl.questions.filter((q) => q.type === "choix_multiple" && q.role === "interet")).toHaveLength(1);
  });
  it("le préparatoire Sport-Études seulement pour l'entrée en 6e en 2027", () => {
    const opts = (seg: string | null) => questionsForInvite(tpl.questions, seg)[0].options ?? [];
    expect(opts(`Saison filles · ${SEGMENT_6E_2027}`)).toContain(prep);
    expect(opts("Saison filles")).not.toContain(prep);
    expect(opts(null)).toHaveLength(PROJECTS_2027.length - 2);
  });
});

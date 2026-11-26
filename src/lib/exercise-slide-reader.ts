import Anthropic from "@anthropic-ai/sdk";

import { EXERCISE_TYPES } from "@/lib/exercise-bank";
import { draftFromSlideText, sanitizeDraft, SLIDE_DRAFT_SCHEMA, type SlideDraft } from "@/lib/exercise-slide-core";

/** Lit la diapo d'un exercice déposée par JP. Avec la clé ANTHROPIC_API_KEY (Vercel), Claude regarde l'image et le
 *  texte de la diapo et remplit la fiche ; sans clé (ou si l'appel échoue), le texte du PDF et le nom du fichier
 *  suffisent pour un titre, un thème et un type que JP corrige au besoin. */

const MODEL = "claude-sonnet-5-5";

const SYSTEM = `Tu lis la diapositive d'un exercice de soccer (football) pour filles de 7 à 14 ans de l'académie New Valkyria, au Québec.
Remplis la fiche en français québécois simple, sans inventer : un champ absent de la diapo reste null.
- title : le titre de l'exercice tel qu'écrit (court).
- category : le thème ou geste principal, dans la liste.
- exerciseType : ${EXERCISE_TYPES.map((t) => `${t.key} (${t.label})`).join(", ")}.
- dimensions : l'organisation du terrain (taille, zones, portes, buts).
- instructions : le déroulement et les règles, une règle par ligne.
- coachingPoints : les consignes clés et comportements attendus, un par ligne.
- variantEasier, variantHarder : les variantes pour simplifier ou complexifier ; variants : les autres variantes.
- material : le matériel. durationMinutes, minPlayers, maxPlayers : seulement s'ils sont écrits ou évidents (ex. 3c2 = 5 joueuses).`;

export function canReadWithClaude(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export async function readSlide(input: { image: { data: string; mediaType: "image/png" | "image/jpeg" | "image/webp" } | null; text: string; fileName: string }): Promise<{ draft: SlideDraft; by: "claude" | "texte" }> {
  const fallback = draftFromSlideText(input.text, input.fileName);
  if (!canReadWithClaude() || !input.image) return { draft: fallback, by: "texte" };
  try {
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SLIDE_DRAFT_SCHEMA as unknown as Record<string, unknown> } },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: input.image.mediaType, data: input.image.data } },
            { type: "text", text: `Nom du fichier : ${input.fileName}\n${input.text.trim() ? `Texte extrait de la diapo :\n${input.text.slice(0, 6000)}` : "Aucun texte extrait : lis l'image."}` }
          ]
        }
      ]
    });
    if (response.stop_reason === "refusal") return { draft: fallback, by: "texte" };
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return { draft: sanitizeDraft(JSON.parse(text), fallback), by: "claude" };
  } catch (error) {
    console.error("[exercise-slide-reader]", error instanceof Error ? error.message : error);
    return { draft: fallback, by: "texte" };
  }
}

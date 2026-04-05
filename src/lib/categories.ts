export type AgeCategory = "2016" | "2015" | "2014-2013";

export const AGE_CATEGORIES: AgeCategory[] = ["2016", "2015", "2014-2013"];

export const CATEGORY_LABELS: Record<AgeCategory, string> = {
  "2016":     "Nées 2016",
  "2015":     "Nées 2015",
  "2014-2013": "Nées 2014–2013"
};

export const CATEGORY_SUBLABELS: Record<AgeCategory, string> = {
  "2016":     "Féminin U10",
  "2015":     "Féminin U11",
  "2014-2013": "Féminin U12–U13"
};

/** Convertit une année de naissance en catégorie. Retourne null si hors plage. */
export function getCategoryFromYear(year: number | string): AgeCategory | null {
  const y = parseInt(String(year), 10);
  if (y === 2016) return "2016";
  if (y === 2015) return "2015";
  if (y === 2013 || y === 2014) return "2014-2013";
  return null;
}

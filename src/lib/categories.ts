export type AgeCategory = "2016-2017" | "2014-2015" | "2012-2013";

export const AGE_CATEGORIES: AgeCategory[] = ["2016-2017", "2014-2015", "2012-2013"];

export const CATEGORY_LABELS: Record<AgeCategory, string> = {
  "2016-2017": "Nées 2016–2017",
  "2014-2015": "Nées 2014–2015",
  "2012-2013": "Nées 2012–2013"
};

export const CATEGORY_SUBLABELS: Record<AgeCategory, string> = {
  "2016-2017": "U8–U9",
  "2014-2015": "U10–U11",
  "2012-2013": "U12–U13"
};

/** Convertit une année de naissance en catégorie. Retourne null si hors plage. */
export function getCategoryFromYear(year: number | string): AgeCategory | null {
  const y = parseInt(String(year), 10);
  if (y === 2016 || y === 2017) return "2016-2017";
  if (y === 2014 || y === 2015) return "2014-2015";
  if (y === 2012 || y === 2013) return "2012-2013";
  return null;
}

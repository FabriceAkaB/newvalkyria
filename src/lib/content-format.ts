/** Dates et heures à la française pour l'espace Contenu (pur, client et serveur). */
const SHORT_M = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const DOW = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const LONG_DOW = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

export const shortDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate() === 1 ? "1er" : d.getUTCDate()} ${SHORT_M[d.getUTCMonth()]}`;
};
export const longDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${LONG_DOW[d.getUTCDay()]} ${d.getUTCDate() === 1 ? "1er" : d.getUTCDate()} ${["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"][d.getUTCMonth()]}`;
};
export const hm = (t: string) => {
  const [h, m] = t.split(":");
  return `${Number(h)} h ${m}`;
};
export const slotLabel = (s: { day: string; start_time: string; end_time: string; place: string }) => `${longDate(s.day)}, ${hm(s.start_time)} à ${hm(s.end_time)} · ${s.place}`;

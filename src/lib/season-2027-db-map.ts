/** Correspondance entre les identifiants statiques du tunnel public
 *  (`season-2027.ts`) et les lignes réelles en base de données, créées
 *  par la migration `20260730_season_foundation.sql`. Les programmes
 *  (TV/SV/NV/TVA/SVA) et catégories (2017/2016/2015/2014-2013) partagent
 *  déjà le même identifiant des deux côtés — seules les plages horaires
 *  ont un UUID généré, d'où cette table de correspondance figée. */

export const SEASON_DB_ID = "automne-hiver-2026";

export const SLOT_DB_ID: Record<string, string> = {
  "lun-1": "17dd6100-b6b3-4e3c-98f6-19e7fccc2ce8",
  "lun-2": "0e605ac4-f930-4a4f-9ad8-b02b7c332ee8",
  "lun-3": "349df15b-e6e2-4894-815e-80220e895528",
  "lun-4": "cea5d167-9c91-4e8f-a436-3562a6cd1072",
  "mer-1": "628700ca-4a1f-42d8-b7b4-690070297598",
  "mer-2": "f03f681e-8506-4b41-8d7e-4cf6ec7e1795",
  "mer-3": "627283a4-88f2-416d-b283-792ec8387fee",
  "mer-4": "850cfb61-64ac-4730-b858-6cb1d3b82ad6",
  "jeu-1": "c7164547-cce9-4529-8769-b6fda020efc7",
  "jeu-2": "8d50566d-b500-4557-93c0-e1dc064c864e",
  "jeu-3": "432b0084-3ccd-419a-adf1-1c1b74c34a15",
  "jeu-4": "95a8da3e-fcd9-4575-a7e2-1100de54b3aa"
  // Plus de plages "ven-*" — le vendredi est réservé aux séances solo (solo_groups).
};

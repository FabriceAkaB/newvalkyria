/** Club qui utilise ce système. Tout ce qui est propre au club (plan Mandalart, état des tâches,
 *  sondages) est rangé sous cet identifiant, pour pouvoir dupliquer le système chez un autre club
 *  (Valkyria Club System, pilier 5.8) en changeant seulement `CLUB_ID` et son plan
 *  (`data/mandalart.json`, généré par `scripts/mandalart-build.mjs`). */
export const CLUB_ID = process.env.CLUB_ID ?? "new-valkyria";

export const CLUB = {
  id: CLUB_ID,
  name: "Académie New Valkyria",
  shortName: "Valkyria",
  ownerName: "JP",
  timezone: "America/Toronto"
};

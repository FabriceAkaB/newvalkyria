/** Carte « Invite une amie à l'essai » de l'espace famille (Mandalart P3.1.08) : les parents sont notre plus gros canal.
 *  Le lien porte le code de parrainage de la famille (referral_codes) : le formulaire d'essai coche « Parrainage » avec
 *  ce code, et la demande est comptée au parrain dans « D'où viennent nos familles ». Fichier PUR (testé). */

export type InviteMoment = "bulletin" | "championne" | "video";

/** Une victoire (championne du jour, attitude) compte comme « moment » pendant 14 jours. */
export const CHAMPION_WINDOW_DAYS = 14;

/** Code de parrainage lu dans l'adresse (?ref=) : lettres et chiffres seulement, en majuscules ; sinon null. */
export function parseRefCode(raw: unknown): string | null {
  const code = String(raw ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{4,12}$/.test(code) ? code : null;
}

export function inviteUrl(siteUrl: string, code: string): string {
  return `${siteUrl.replace(/\/$/, "")}/inscription/essai?ref=${encodeURIComponent(code)}`;
}

/** La victoire la plus récente est-elle assez fraîche pour montrer la carte sur l'accueil ? */
export function isFreshWin(winDay: string | null | undefined, today: string): boolean {
  if (!winDay) return false;
  const days = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${winDay.slice(0, 10)}T12:00:00Z`)) / 86_400_000);
  return days >= 0 && days <= CHAMPION_WINDOW_DAYS;
}

export interface InviteCopy {
  title: string;
  body: string;
  /** Texte partagé (texto, courriel, réseaux), suivi du lien. */
  share: string;
}

/** Les mots de la carte, selon le moment où elle apparaît. */
export function inviteCopy(moment: InviteMoment, firstName: string): InviteCopy {
  const name = firstName.trim() || "votre fille";
  const share = `On adore New Valkyria, l'académie de soccer 100 % filles de ${name === "votre fille" ? "ma fille" : name}. Ta fille aimerait essayer ? L'essai est gratuit :`;
  if (moment === "championne") {
    return {
      title: `${name} a été championne du jour : une amie aimerait vivre ça ?`,
      body: "Invitez une amie à un essai gratuit avec elle. Vous partagez votre lien, la famille réserve en 2 minutes.",
      share
    };
  }
  if (moment === "video") {
    return {
      title: `Vous voyez les progrès de ${name} ? Une amie pourrait les faire avec elle`,
      body: "Invitez une amie à un essai gratuit : elle sera accueillie par son prénom et filmée sur ses premiers gestes.",
      share
    };
  }
  return {
    title: `Le bulletin de ${name} vous plaît ? Invitez une amie à l'essai`,
    body: "Une amie de son équipe d'école ou du quartier ? L'essai est gratuit et votre lien nous dit que c'est grâce à vous.",
    share
  };
}

/** Lien de texto prérempli (téléphone) : le texte puis le lien. */
export function smsHref(copy: InviteCopy, url: string): string {
  return `sms:?&body=${encodeURIComponent(`${copy.share} ${url}`)}`;
}

export function mailHref(copy: InviteCopy, url: string): string {
  return `mailto:?subject=${encodeURIComponent("Un essai gratuit chez New Valkyria")}&body=${encodeURIComponent(`${copy.share}\n${url}`)}`;
}

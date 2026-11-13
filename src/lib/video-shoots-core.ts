/** Tournages de JP (règles pures, testées) : planifier la vidéo du lendemain en 15 minutes, la tourner,
 *  la monter, la publier. Table jp_video_shoots ; la publication et ses chiffres vont ensuite dans
 *  marketing_posts (Réseaux sociaux). */

export type ShootStatus = "idee" | "planifie" | "tourne" | "monte" | "publie";

export const SHOOT_STATUS: { id: ShootStatus; label: string; next: string | null }[] = [
  { id: "idee", label: "Idée", next: "Planifier" },
  { id: "planifie", label: "Planifié", next: "Tourné ✓" },
  { id: "tourne", label: "Tourné", next: "Monté ✓" },
  { id: "monte", label: "Monté", next: "Publié ✓" },
  { id: "publie", label: "Publié", next: null }
];

export const statusLabel = (s: ShootStatus) => SHOOT_STATUS.find((x) => x.id === s)?.label ?? s;
export const nextStatus = (s: ShootStatus): ShootStatus | null => {
  const i = SHOOT_STATUS.findIndex((x) => x.id === s);
  return i >= 0 && i < SHOOT_STATUS.length - 1 ? SHOOT_STATUS[i + 1].id : null;
};

/** Les séries : les 5 séries de vidéos explicatives (Mandalart P3.2.12) + les vidéos des réseaux. */
export const SERIES: { id: string; label: string; emoji: string }[] = [
  { id: "academie", label: "Qui est New Valkyria", emoji: "💜" },
  { id: "programmes", label: "Nos programmes", emoji: "🗺️" },
  { id: "projets", label: "Nos projets", emoji: "🧪" },
  { id: "preuves", label: "Preuves et témoignages", emoji: "📈" },
  { id: "nouveaux-parents", label: "Nouveaux parents", emoji: "🤝" },
  { id: "reseaux", label: "Réseaux sociaux (3 par semaine)", emoji: "📱" }
];
export const seriesOf = (id: string) => SERIES.find((s) => s.id === id) ?? SERIES[SERIES.length - 1];

export interface Shoot {
  id: string;
  title: string;
  series: string;
  status: ShootStatus;
  shoot_on: string | null;
  shoot_time: string | null;
  place: string | null;
  message: string | null;
  hook: string | null;
  shots: string | null;
  people: string | null;
  gear: string | null;
  format: string | null;
  mandalart_code: string | null;
  note: string | null;
  sort_order: number;
  /** Calendrier de publication (espace Contenu) : jour prévu, organique / essai / pub, angle, réseaux, qui filme. */
  publish_on?: string | null;
  post_kind?: string | null;
  angle?: string | null;
  networks?: string[] | null;
  filmed_by?: string | null;
}

/** Ce qu'il faut avoir écrit la veille pour tourner sans réfléchir. */
export const PLAN_CHECKS: { key: keyof Shoot; label: string }[] = [
  { key: "shoot_on", label: "Le jour" },
  { key: "shoot_time", label: "L'heure" },
  { key: "place", label: "Le lieu" },
  { key: "message", label: "Le message en une phrase" },
  { key: "hook", label: "L'accroche des 3 premières secondes" },
  { key: "shots", label: "Les plans à filmer" }
];

export function missingForShoot(s: Shoot): string[] {
  return PLAN_CHECKS.filter((c) => !String(s[c.key] ?? "").trim()).map((c) => c.label);
}

/** Les 15 minutes de la veille, dans l'ordre. */
export const PLAN_STEPS = [
  "Choisis UNE idée (la plus utile pour vendre ce mois-ci).",
  "Écris le message en une phrase : ce qu'un parent doit retenir.",
  "Écris l'accroche des 3 premières secondes (une question ou un résultat).",
  "Liste 4 à 6 plans : un large, un serré sur le ballon, un visage, toi face caméra, la fin avec l'appel à l'action.",
  "Note le lieu, l'heure, qui est dans la vidéo et le matériel (trépied, micro, batterie chargée).",
  "Mets ton téléphone à charger. Demain, tu tournes sans réfléchir."
];

export interface ShootIdea {
  title: string;
  series: string;
  message: string;
  code: string;
}

/** Idées préremplies : le plan de vidéos explicatives discuté avec la gérante (11 nov. 2026). */
export const SHOOT_IDEAS: ShootIdea[] = [
  { series: "academie", code: "P3.2.13", title: "Qu'est-ce que New Valkyria Academy ?", message: "Une académie pour filles où chaque joueuse maîtrise le ballon et gagne en confiance." },
  { series: "academie", code: "P3.2.13", title: "Notre mission", message: "Pourquoi l'académie existe et ce qu'elle veut changer pour les filles." },
  { series: "academie", code: "P3.2.13", title: "Notre philosophie de développement", message: "Ball mastery, prise de décision, plaisir : comment on fait progresser une fille." },
  { series: "academie", code: "P3.2.13", title: "Ce qui nous distingue d'un club traditionnel", message: "Plus de touches de ballon, un suivi individuel, une méthode écrite." },
  { series: "programmes", code: "P3.2.14", title: "Comment fonctionnent nos programmes", message: "Saison, demi-saison, Sport-Études, été : qui va où." },
  { series: "programmes", code: "P3.2.14", title: "Ce que les joueuses vont apprendre", message: "Les gestes, la confiance, la lecture du jeu, saison après saison." },
  { series: "programmes", code: "P3.2.14", title: "Objectifs à court, moyen et long terme", message: "Ce qu'une fille sait faire après 3 mois, 1 an, 3 ans." },
  { series: "programmes", code: "P3.2.14", title: "Le parcours de la joueuse", message: "De la première séance jusqu'au sport-études et au-delà." },
  { series: "projets", code: "P3.2.16", title: "Valkyria Lab", message: "La routine du mois à la maison et la vidéo envoyée à l'académie." },
  { series: "projets", code: "P3.2.16", title: "Ball mastery et le tapis d'entraînement", message: "Pourquoi 500 touches par séance changent tout." },
  { series: "projets", code: "P3.2.16", title: "Développement individuel et collectif", message: "Chaque fille suivie, et une équipe qui joue ensemble." },
  { series: "projets", code: "P3.2.16", title: "Activités, matchs, tournois et Olympiades", message: "La vie de l'académie en dehors des pratiques." },
  { series: "projets", code: "P3.2.16", title: "Les projets futurs de l'académie", message: "Où on s'en va : ce qui arrive cette année et la prochaine." },
  { series: "preuves", code: "P3.2.17", title: "Une joueuse avant/après", message: "Son évolution, filmée, en 45 secondes." },
  { series: "preuves", code: "P3.2.17", title: "Témoignage d'un parent", message: "Ce qui a changé chez sa fille, dans ses mots." },
  { series: "preuves", code: "P3.2.17", title: "Nos joueuses en sport-études", message: "Celles qui y sont entrées et comment l'académie les a aidées." },
  { series: "nouveaux-parents", code: "P4.1.06", title: "Que se passe-t-il après l'inscription ?", message: "Courriel, MonClubSportif, chandail, première pratique : étape par étape." },
  { series: "nouveaux-parents", code: "P4.1.06", title: "Comment fonctionne l'encadrement", message: "Qui s'occupe de votre fille, combien de filles par éducateur." },
  { series: "nouveaux-parents", code: "P4.1.06", title: "Comment communiquer avec l'équipe", message: "Où écrire, en combien de temps on répond." },
  { series: "nouveaux-parents", code: "P4.1.06", title: "Suivre la progression de son enfant", message: "Bulletins, vidéos, espace famille." },
  { series: "nouveaux-parents", code: "P4.1.06", title: "À quoi s'attendre pendant une saison", message: "De septembre à avril : les grands moments." }
];

const STATUS_ORDER: Record<ShootStatus, number> = { planifie: 0, tourne: 1, monte: 2, idee: 3, publie: 4 };

/** Rangement de la page : demain d'abord, puis à venir par date, à monter/publier, idées, publiés. */
export function groupShoots(shoots: Shoot[], today: string, tomorrow: string) {
  const byDate = (a: Shoot, b: Shoot) => (a.shoot_on ?? "9999").localeCompare(b.shoot_on ?? "9999") || (a.shoot_time ?? "").localeCompare(b.shoot_time ?? "") || a.sort_order - b.sort_order;
  const planned = shoots.filter((s) => s.status === "planifie").sort(byDate);
  return {
    tomorrow: planned.filter((s) => s.shoot_on === tomorrow),
    today: planned.filter((s) => s.shoot_on === today),
    late: planned.filter((s) => !!s.shoot_on && s.shoot_on < today),
    upcoming: planned.filter((s) => !s.shoot_on || s.shoot_on > tomorrow),
    toFinish: shoots.filter((s) => s.status === "tourne" || s.status === "monte").sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || byDate(a, b)),
    ideas: shoots.filter((s) => s.status === "idee").sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title, "fr")),
    published: shoots.filter((s) => s.status === "publie").sort((a, b) => byDate(b, a))
  };
}

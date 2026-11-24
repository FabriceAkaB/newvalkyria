/** Calendrier de contenu de l'académie sur 90 jours, du 1er déc. 2026 au 28 févr. 2027 (Mandalart P3.2.25,
 *  plan « machine d'acquisition 90 jours », section 6). Règles pures, testées.
 *  - 7 publications par semaine, une par jour : 3 du haut, 3 du milieu, 1 du bas de l'entonnoir ;
 *  - 3 à 5 reels d'essai par semaine pour tester les crochets de la banque (50 crochets, chacun testé une fois) ;
 *  - 5 familles de contenu ; chaque publication a son crochet et l'appel à l'action « Réserve l'essai gratuit ».
 *  Seulement le compte New Valkyria : les vidéos JP Coach (marque personnelle de JP) restent à part.
 *  Les publications vont dans jp_video_shoots (série « plan-90 », seedPlan90 dans content-repo.ts). */

import { CTA, formatOf, type FormatId } from "@/lib/shooting-guide-core";

export const PLAN90_START = "2026-12-01";
export const PLAN90_END = "2027-02-28";
export const PLAN90_SERIES = "plan-90";
export const PLAN90_CODE = "P3.2.25";

export type Funnel = "haut" | "milieu" | "bas";
export const FUNNELS: { id: Funnel; label: string; goal: string; perWeek: number }[] = [
  { id: "haut", label: "Haut", goal: "Attirer des familles qui ne nous connaissent pas", perWeek: 3 },
  { id: "milieu", label: "Milieu", goal: "Convaincre celles qui nous suivent", perWeek: 3 },
  { id: "bas", label: "Bas", goal: "Faire réserver l'essai", perWeek: 1 }
];
export const funnelLabel = (f: string | null | undefined) => FUNNELS.find((x) => x.id === f)?.label ?? "";

export type Family = "educatif" | "demonstratif" | "coulisses" | "histoires" | "preuve";
export const FAMILIES: { id: Family; label: string; funnels: Funnel[]; angle: string; examples: string }[] = [
  { id: "educatif", label: "Éducatif", funnels: ["haut", "milieu"], angle: "Éducatif (un geste expliqué)", examples: "Un geste expliqué en 30 s, l'erreur que font 90 % des filles, un exercice à la maison (Valkyria Lab)" },
  { id: "demonstratif", label: "Démonstratif", funnels: ["haut", "milieu"], angle: "Preuve (avant/après, résultat)", examples: "Ball mastery en musique, défis, avant/après d'une fille" },
  { id: "coulisses", label: "Coulisses et éducateurs", funnels: ["milieu"], angle: "Coulisses d'une pratique", examples: "Une coach qui explique son exercice, la préparation d'une pratique" },
  { id: "histoires", label: "Histoires de joueuses", funnels: ["milieu", "bas"], angle: "Appartenance (Valkyria Family)", examples: "L'entrevue de la semaine, la championne du jour" },
  { id: "preuve", label: "Preuve et offre", funnels: ["bas"], angle: "Offre (évaluation gratuite, essai)", examples: "Témoignages de parents, progrès filmés, « Réserve l'essai », camps d'été" }
];
export const familyOf = (f: string | null | undefined) => FAMILIES.find((x) => x.id === f);

/* ── La banque de 50 crochets (les 3 premières secondes) ──────────────── */

export interface Hook {
  id: string;
  family: Family;
  text: string;
}

const HOOKS_BY_FAMILY: Record<Family, string[]> = {
  educatif: [
    "90 % des filles font cette erreur avec le ballon.",
    "Arrête de dire à ta fille de « frapper plus fort ».",
    "Le geste que les coachs regardent en premier chez une joueuse.",
    "Si ta fille fait ça, elle va perdre le ballon.",
    "3 touches par jour qui changent tout.",
    "Personne n'enseigne ça aux filles de 8 ans. Nous, oui.",
    "Ce que les meilleures font avant de recevoir le ballon.",
    "Pied faible ? Voici le truc.",
    "5 minutes dans le salon, pas besoin de terrain.",
    "Le geste le plus sous-estimé du soccer féminin."
  ],
  demonstratif: [
    "Elle a 9 ans. Regarde ses pieds.",
    "50 touches en 30 secondes. Ta fille peut-elle battre ça ?",
    "Même fille, même geste, 3 mois plus tard.",
    "On a filmé tout le groupe en même temps.",
    "Attends la fin.",
    "Ce n'est pas du talent. C'est de la répétition.",
    "La coach contre les filles : qui gagne ?",
    "Regarde ce ballon : il ne quitte jamais son pied.",
    "Au ralenti, on voit tout.",
    "Le défi que nos filles réussissent, et les parents non."
  ],
  coulisses: [
    "Il est 17 h 30, le gymnase est vide.",
    "Ce que tu ne vois pas avant une pratique.",
    "Pourquoi nos coachs prennent des notes sur chaque fille.",
    "Voici ce qu'une coach dit après une erreur.",
    "On évalue chaque fille, chaque semaine. Voici pourquoi.",
    "La dernière minute de chaque pratique.",
    "Le moment préféré de nos coachs.",
    "Des équipes où personne n'est choisie en dernier.",
    "Ce qu'on teste cette semaine.",
    "Une pratique Valkyria en 30 secondes."
  ],
  histoires: [
    "Il y a 3 mois, elle n'avait jamais touché un ballon.",
    "Elle était gênée au début. Écoute-la maintenant.",
    "Pourquoi elle voulait une équipe juste de filles.",
    "Sa réponse nous a donné des frissons.",
    "Elle a un message pour les filles qui hésitent.",
    "Son geste préféré, en 10 secondes.",
    "Ce qu'elle dirait à la fille qu'elle était en septembre.",
    "Sa maman ne s'attendait pas à ça.",
    "La championne de la semaine, et pourquoi.",
    "Elle a 7 ans et elle a déjà un objectif."
  ],
  preuve: [
    "8,8 sur 10 de plaisir : ce sont nos familles qui le disent.",
    "Ta fille hésite ? La première pratique est gratuite.",
    "Voici exactement ce qui se passe à un essai.",
    "Ce que les parents nous disent après un mois.",
    "On garde quelques places d'essai chaque semaine.",
    "Pas besoin d'avoir déjà joué.",
    "Le cadeau qui bouge : un essai gratuit.",
    "Ce que ta fille reçoit à New Valkyria, en 20 secondes.",
    "Une académie 100 % filles, près de chez toi.",
    "Les camps d'été 2027 s'en viennent."
  ]
};

const FAMILY_ORDER: Family[] = ["educatif", "demonstratif", "coulisses", "histoires", "preuve"];

/** La banque, dans l'ordre où on les teste : une famille après l'autre, pour varier chaque semaine. */
export const HOOK_BANK: Hook[] = Array.from({ length: 10 }, (_, round) =>
  FAMILY_ORDER.map((family) => ({ id: `C${String(round * 5 + FAMILY_ORDER.indexOf(family) + 1).padStart(2, "0")}`, family, text: HOOKS_BY_FAMILY[family][round] }))
).flat();

/** Les crochets d'une famille, pour la page (banque groupée). */
export const hooksOf = (family: Family) => HOOK_BANK.filter((h) => h.family === family);

/* ── Les sujets de chaque jour de la semaine ──────────────────────────── */

interface Topic {
  title: string;
  hook: string;
  message: string;
  format?: FormatId;
  family?: Family;
  angle?: string;
}

/** Un jour de la semaine = une place fixe dans l'entonnoir (0 = dimanche). Le samedi alterne démonstratif
 *  (avant/après) et histoires de joueuses. */
const DAY_SLOT: Record<number, { funnel: Funnel; family: Family; format: FormatId }> = {
  0: { funnel: "bas", family: "preuve", format: "carrousel" },
  1: { funnel: "haut", family: "educatif", format: "reel30" },
  2: { funnel: "milieu", family: "coulisses", format: "reel30" },
  3: { funnel: "haut", family: "demonstratif", format: "reel30" },
  4: { funnel: "milieu", family: "histoires", format: "entrevue" },
  5: { funnel: "haut", family: "educatif", format: "lab" },
  6: { funnel: "milieu", family: "demonstratif", format: "avant_apres" }
};

const TOPICS: Record<number, Topic[]> = {
  // Lundi : un geste expliqué en 30 secondes.
  1: [
    { title: "Le contrôle orienté en 30 secondes", hook: "Ta fille arrête le ballon, puis elle le perd ? Regarde ça.", message: "Un bon premier contact envoie le ballon là où on veut aller." },
    { title: "L'erreur que font 90 % des filles au premier contact", hook: "90 % des filles font cette erreur au premier contact.", message: "On reçoit le ballon avec un pied souple, pas un pied raide." },
    { title: "Frapper avec le coup de pied : 3 repères", hook: "Elle frappe de la pointe ? Voici 3 repères simples.", message: "Pied d'appui à côté du ballon, cheville bloquée, on frappe au centre." },
    { title: "Le crochet intérieur pour se retourner", hook: "Un seul geste pour sortir de la pression.", message: "Le crochet intérieur permet de changer de direction sans perdre le ballon." },
    { title: "Regarder avant de recevoir", hook: "Les meilleures font ceci AVANT de toucher le ballon.", message: "Un coup d'œil avant la passe, et on sait déjà quoi faire." },
    { title: "La semelle : garder le ballon collé", hook: "Pourquoi le ballon s'éloigne toujours de son pied ?", message: "La semelle garde le ballon près du corps dans les petits espaces." },
    { title: "Le premier pas explosif", hook: "La vitesse, ce n'est pas juste les jambes.", message: "Un premier pas court et rapide fait gagner le duel." },
    { title: "Protéger le ballon avec son corps", hook: "Petite, mais impossible à déposséder.", message: "Le corps entre l'adversaire et le ballon, les bras pour sentir." },
    { title: "La passe à une touche en mouvement", hook: "Elle passe bien à l'arrêt. Et en courant ?", message: "Orienter les hanches vers la cible avant que le ballon arrive." },
    { title: "La feinte de frappe", hook: "La feinte la plus simple, et la plus efficace.", message: "On arme la frappe, on passe le pied au-dessus, on repart de l'autre côté." },
    { title: "La conduite en petits touchers", hook: "Grands touchers, ballon perdu. Regarde la différence.", message: "Un toucher à chaque pas : le ballon reste à soi." },
    { title: "Ouvrir le corps pour recevoir", hook: "Elle reçoit dos au jeu ? Un pas change tout.", message: "De côté, on voit le terrain et on reçoit vers l'avant." }
  ],
  // Mardi : coulisses et éducateurs.
  2: [
    { title: "Avant que les filles arrivent", hook: "Il est 17 h 30, le gymnase est vide. Voici ce qu'on fait.", message: "Chaque pratique est préparée d'avance, exercice par exercice." },
    { title: "Une coach explique son exercice en 20 secondes", hook: "Voici pourquoi on fait cet exercice.", message: "Chaque exercice a un but précis, choisi pour le thème de la semaine." },
    { title: "Pourquoi on évalue chaque fille après chaque pratique", hook: "Pourquoi nos coachs prennent des notes sur chaque fille.", message: "Chaque fille est suivie : c'est ce qui donne le bulletin du 15 décembre." },
    { title: "La causerie de fin de pratique", hook: "La dernière minute de chaque pratique.", message: "On finit toujours ensemble : ce qu'on a appris et ce qu'on travaille à la maison." },
    { title: "Ce que nos coachs se disent après une pratique", hook: "Ce que tu ne vois pas après une pratique.", message: "Après chaque pratique, les coachs notent ce qui a marché et ce qu'on change." },
    { title: "Nouvelle année : les objectifs de nos coachs", hook: "2027 : ce que nos coachs veulent voir chez vos filles.", message: "Chaque coach a des objectifs pour son groupe, partagés avec les familles." },
    { title: "Le matériel d'une pratique Valkyria", hook: "Un ballon par fille. Toujours.", message: "Un ballon par joueuse, dès la première minute : c'est notre façon de faire." },
    { title: "Des équipes où personne n'est choisie en dernier", hook: "Des équipes où personne n'est choisie en dernier.", message: "Le site prépare des équipes nouvelles à chaque pratique, pour que toutes jouent avec toutes." },
    { title: "La capitaine du jour", hook: "Chaque fille sera capitaine. Voici sa mission.", message: "La capitaine change à chaque pratique : chaque fille apprend à mener." },
    { title: "Une journée avec nos éducateurs", hook: "Une pratique Valkyria en 30 secondes.", message: "Des éducateurs formés, une méthode commune, des filles au centre." },
    { title: "Le laboratoire des coachs", hook: "Ce qu'on teste cette semaine.", message: "Nos coachs testent de nouveaux exercices et gardent seulement ceux qui marchent." },
    { title: "Pourquoi le ballon au pied dès la 1re minute", hook: "Pas de tours de terrain chez nous. Voici pourquoi.", message: "Plus de touches de ballon, plus de progrès, plus de plaisir." },
    { title: "Rencontre une éducatrice", hook: "Pourquoi elle a choisi de coacher des filles.", message: "Nos éducatrices sont des modèles pour nos joueuses." }
  ],
  // Mercredi : démonstratif, ball mastery et défis.
  3: [
    { title: "Ball mastery en musique", hook: "Regarde ce ballon : il ne quitte jamais son pied.", message: "Le ball mastery, chaque semaine, c'est ce qui rend nos filles à l'aise avec le ballon." },
    { title: "Défi : 50 touches de semelle en 30 secondes", hook: "50 touches en 30 secondes. Ta fille peut-elle battre ça ?", message: "Un défi simple à refaire à la maison." },
    { title: "Le geste de la semaine au ralenti", hook: "Au ralenti, on voit tout.", message: "Le geste de la semaine, décortiqué." },
    { title: "Défi des Fêtes : combien de jongles ?", hook: "Défi des Fêtes : combien de jongles pour ta fille ?", message: "Un défi pour bouger pendant le congé, filmé avec les filles avant Noël." },
    { title: "Les plus beaux moments de décembre", hook: "Attends la fin.", message: "Un mois de pratiques en 30 secondes." },
    { title: "Défi : le slalom chronométré", hook: "Le slalom en moins de 10 secondes ?", message: "Conduite de balle et vitesse, chronométrées." },
    { title: "Tout le groupe en même temps", hook: "On a filmé tout le groupe en même temps.", message: "Le ball mastery filmé à 360° : chaque fille, chaque touche." },
    { title: "1 contre 1 : qui garde le ballon ?", hook: "Elle a 9 ans. Regarde ses pieds.", message: "Le duel, c'est là que la confiance se voit." },
    { title: "La coach contre les filles", hook: "La coach contre les filles : qui gagne ?", message: "Un défi entre les filles et leur coach, pour le plaisir." },
    { title: "Le geste le plus difficile de la saison", hook: "Ce n'est pas du talent. C'est de la répétition.", message: "Un geste raté en septembre, réussi en février." },
    { title: "Défi de la Saint-Valentin : la passe parfaite", hook: "La passe parfaite à ta partenaire, du premier coup ?", message: "Une passe précise, un défi en duo." },
    { title: "Les petites au ballon", hook: "Elles ont 6 ans. Elles ont déjà le ballon collé au pied.", message: "On commence le ballon au pied dès les plus petites." },
    { title: "3 mois de ball mastery en 30 secondes", hook: "3 mois de touches en 30 secondes.", message: "Ce que la répétition fait en un trimestre." }
  ],
  // Jeudi : histoires de joueuses (l'entrevue de la semaine dès la mi-décembre).
  4: [
    { title: "La championne de la semaine", hook: "La championne de la semaine, et pourquoi.", message: "Chaque semaine, une fille est mise de l'avant pour son effort.", format: "reel30" },
    { title: "La championne de la semaine", hook: "Elle n'a rien lâché cette semaine.", message: "Ce qu'on récompense : l'effort, l'attitude, l'aide aux autres.", format: "reel30" },
    { title: "Entrevue de la semaine n°1 (une débutante)", hook: "Il y a 3 mois, elle n'avait jamais touché un ballon.", message: "On peut commencer à tout âge : elle le prouve." },
    { title: "Entrevue de la semaine n°2 (une avancée)", hook: "Son geste préféré, en 10 secondes.", message: "Ce qu'elle aime à l'académie, et ce qu'elle vise." },
    { title: "Entrevue de la semaine n°3 (une petite)", hook: "Elle a 7 ans et elle a déjà un objectif.", message: "Les petites aussi ont leurs rêves de soccer." },
    { title: "Entrevue de la semaine n°4 (une grande)", hook: "Ce qu'elle dirait à la fille qu'elle était en septembre.", message: "Le chemin parcouru depuis le début de la saison." },
    { title: "Entrevue de la semaine n°5 (une débutante)", hook: "Elle était gênée au début. Écoute-la maintenant.", message: "La confiance, ça se construit, pratique après pratique." },
    { title: "Entrevue de la semaine n°6 (une avancée)", hook: "Pourquoi elle voulait une équipe juste de filles.", message: "Entre filles, on ose plus." },
    { title: "Entrevue de la semaine n°7 (une petite)", hook: "Sa réponse nous a donné des frissons.", message: "Les mots d'une joueuse sur ce qu'elle vit à l'académie." },
    { title: "Entrevue de la semaine n°8 (une grande)", hook: "Elle a un message pour les filles qui hésitent.", message: "Une joueuse parle directement aux filles qui n'osent pas encore." },
    { title: "Entrevue de la semaine n°9 (une débutante)", hook: "Sa maman ne s'attendait pas à ça.", message: "Une joueuse et son parent racontent le changement." },
    { title: "Entrevue de la semaine n°10 (une avancée)", hook: "Son meilleur moment de la saison.", message: "Le moment qu'elle n'oubliera pas." },
    { title: "Entrevue de la semaine n°11 (une petite)", hook: "Pourquoi elle a hâte au lundi.", message: "Le plaisir d'abord : c'est ce qui la fait revenir." }
  ],
  // Vendredi : un exercice à faire à la maison (Valkyria Lab).
  5: [
    { title: "À la maison : la semelle dans le salon", hook: "5 minutes dans le salon, pas besoin de terrain.", message: "Un exercice du Valkyria Lab à faire chaque jour." },
    { title: "À la maison : le mur, ton meilleur partenaire", hook: "Un mur, un ballon, 10 minutes.", message: "Passes et contrôles contre un mur, comme à la pratique." },
    { title: "À la maison : jongler avec un ballon mou", hook: "Pas de ballon de soccer à la maison ? Pas grave.", message: "Les jongles s'apprennent avec n'importe quel ballon." },
    { title: "Pendant les Fêtes : 10 minutes par jour", hook: "Le congé, sans perdre ses touches.", message: "Une petite routine pour garder le ballon au pied pendant les Fêtes." },
    { title: "Le défi de janvier : 31 jours de touches", hook: "31 jours, 100 touches par jour. Tu embarques ?", message: "Un défi d'un mois, à cocher chaque jour." },
    { title: "À la maison : la conduite en 8 autour de 2 chaises", hook: "Deux chaises, un ballon : l'exercice parfait.", message: "La conduite en 8 travaille les deux pieds." },
    { title: "À la maison : contrôle et passe contre le mur", hook: "Contrôle, passe, recommence. 3 minutes.", message: "Le premier contact s'améliore à la maison aussi." },
    { title: "À la maison : petits espaces, ballon collé", hook: "Dans un corridor ? Encore mieux.", message: "Les petits espaces obligent les petits touchers." },
    { title: "À la maison : l'échelle en ruban adhésif", hook: "Du ruban adhésif au sol, et c'est parti.", message: "Coordination et vitesse des pieds, sans matériel." },
    { title: "À la maison : le pied faible", hook: "Pied faible ? Voici le truc.", message: "5 minutes par jour sur le pied faible changent tout en un mois." },
    { title: "À la maison : la routine avant l'école", hook: "5 minutes avant l'autobus.", message: "Une routine courte, tous les matins." },
    { title: "À la maison : jouer avec maman ou papa", hook: "Le défi que nos filles réussissent, et les parents non.", message: "Un exercice à faire en famille." },
    { title: "À la maison : le test de fin de mois", hook: "Combien de touches en 30 secondes ce mois-ci ?", message: "On se mesure chaque mois pour voir le progrès." }
  ],
  // Samedi : démonstratif avant/après (semaines paires) ou histoires (semaines impaires).
  6: [
    { title: "Avant / après : le même geste, septembre et décembre", hook: "Même fille, même geste, 3 mois plus tard.", message: "La preuve en images de ce que la répétition donne." },
    { title: "Une maman raconte la première pratique de sa fille", hook: "Sa première pratique, racontée par sa maman.", message: "La peur du premier jour, puis le sourire.", family: "histoires", format: "entrevue" },
    { title: "Avant / après : le contrôle de balle", hook: "Le ballon rebondissait partout. Plus maintenant.", message: "Le premier contact, avant et après 3 mois." },
    { title: "Le plus beau moment de 2026 de nos joueuses", hook: "On leur a demandé leur plus beau moment de 2026.", message: "Les souvenirs de l'année, dits par nos filles.", family: "histoires", format: "reel30" },
    { title: "Avant / après : la conduite de balle", hook: "Regarde ses pieds en septembre. Puis aujourd'hui.", message: "La conduite de balle, avant et après." },
    { title: "Sœurs à l'académie", hook: "Deux sœurs, deux groupes, une même passion.", message: "À New Valkyria, c'est souvent une histoire de famille.", family: "histoires", format: "reel30" },
    { title: "Avant / après : la jongle", hook: "3 jongles en septembre. Combien maintenant ?", message: "La jongle, le progrès le plus facile à voir." },
    { title: "Pourquoi une équipe 100 % filles", hook: "Une équipe juste de filles : les parents nous disent pourquoi.", message: "Ce que les filles et leurs parents disent de l'académie 100 % filles.", family: "histoires", format: "entrevue" },
    { title: "Avant / après : le pied faible", hook: "Son pied gauche en septembre. Et maintenant ?", message: "Le pied faible, avant et après." },
    { title: "Une débutante de 11 ans raconte", hook: "Commencer à 11 ans ? Elle l'a fait.", message: "Il n'est jamais trop tard pour commencer.", family: "histoires", format: "entrevue" },
    { title: "Avant / après : le contrôle orienté", hook: "Même fille, même exercice, 5 mois d'écart.", message: "Le contrôle orienté, avant et après." },
    { title: "Ce que le soccer lui a donné", hook: "Ce n'est pas juste du soccer. C'est de la confiance.", message: "La confiance gagnée sur le terrain se voit ailleurs aussi.", family: "histoires", format: "reel30" },
    { title: "Avant / après : la saison en 30 secondes", hook: "Une saison en 30 secondes.", message: "Le progrès de nos filles, de septembre à février." }
  ],
  // Dimanche : preuve et offre, le bas de l'entonnoir.
  0: [
    { title: "Comment se passe un essai gratuit", hook: "Voici exactement ce qui se passe à un essai.", message: "L'arrivée, la pratique, le mot de la coach : rien à prévoir sauf des espadrilles." },
    { title: "8,8 sur 10 de plaisir selon nos familles", hook: "8,8 sur 10 de plaisir : ce sont nos familles qui le disent.", message: "Les résultats de nos sondages aux familles." },
    { title: "Le cadeau de Noël qui bouge", hook: "Le cadeau qui bouge : un essai gratuit.", message: "Offrir une première pratique pour commencer l'année." },
    { title: "2026 à l'académie en chiffres", hook: "Une année à New Valkyria en 6 chiffres.", message: "Ce que nos filles ont vécu cette année." },
    { title: "Janvier : se joindre en cours de saison", hook: "Nouvelle année, nouveau sport ?", message: "On peut se joindre en cours de saison : la première pratique est gratuite." },
    { title: "Un parent raconte ce qui a changé", hook: "Ce que les parents nous disent après un mois.", message: "Le témoignage d'un parent, en ses mots.", format: "reel30", angle: "Témoignage d'un parent" },
    { title: "Les questions des parents avant l'essai", hook: "Pas besoin d'avoir déjà joué.", message: "Les 6 questions qu'on nous pose le plus, avec nos réponses." },
    { title: "Camps de jour de l'été 2027", hook: "Les camps d'été 2027 s'en viennent.", message: "Les camps d'été de New Valkyria : les dates et comment être avertie en premier." },
    { title: "Sa progression en 4 mois", hook: "4 mois à l'académie, en images.", message: "Une fille, son bulletin et ses vidéos de progrès.", format: "avant_apres", angle: "Preuve (avant/après, résultat)" },
    { title: "Valkyria Été 2027", hook: "L'été 2027 se prépare maintenant.", message: "Ce qui s'en vient pour l'été, et l'essai pour commencer dès maintenant." },
    { title: "Ce que ta fille reçoit à New Valkyria", hook: "Ce que ta fille reçoit à New Valkyria, en 20 secondes.", message: "Un ballon par fille, des coachs formées, un bulletin, des vidéos de progrès." },
    { title: "Une famille raconte en vidéo", hook: "On a laissé la parole à une famille.", message: "Un témoignage vidéo d'une famille de l'académie.", format: "reel30", angle: "Témoignage d'un parent" },
    { title: "Merci pour ces 90 jours", hook: "90 jours, 90 publications. Merci.", message: "Le bilan de l'hiver et la place pour essayer en mars." }
  ]
};

/** Reels d'essai par semaine (3 à 5) : on monte à mesure que le montage devient rapide ; la dernière semaine
 *  redescend à 4 pour faire le bilan. Total = 50, la banque au complet. */
export const TESTS_PER_WEEK = [3, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 4, 0];
/** Jours des reels d'essai dans la semaine (mardi, jeudi, samedi, puis lundi et mercredi). */
const TEST_DAYS = [2, 4, 6, 1, 3];

export const NETWORKS_DEFAULT = ["instagram", "facebook"];

export interface PlanPost {
  date: string;
  week: number;
  funnel: Funnel;
  family: Family;
  format: FormatId;
  postKind: "organique" | "essai";
  title: string;
  hook: string;
  hookId?: string;
  message: string;
  cta: string;
  angle: string;
  networks: string[];
  shots: string;
}

const DAY = 86_400_000;
const parse = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
const addDays = (iso: string, n: number) => new Date(parse(iso) + n * DAY).toISOString().slice(0, 10);
const dow = (iso: string) => new Date(parse(iso)).getUTCDay();
const sundayOf = (iso: string) => addDays(iso, -dow(iso));

/** Semaine du plan (0 = la semaine du 29 nov. 2026, les semaines vont du dimanche au samedi). */
export const planWeek = (iso: string) => Math.round((parse(sundayOf(iso)) - parse(sundayOf(PLAN90_START))) / (7 * DAY));

const shotsText = (format: FormatId) => {
  const f = formatOf(format);
  return `${f.label} (${f.length}) :\n${f.steps.map((s) => `${s.at} : ${s.what}`).join("\n")}`;
};

/** Le plan complet : une publication par jour (90) + les reels d'essai (50). */
export function buildPlan90(): PlanPost[] {
  const out: PlanPost[] = [];
  const seen: Record<number, number> = {};
  for (let d = PLAN90_START; d <= PLAN90_END; d = addDays(d, 1)) {
    const day = dow(d);
    const week = planWeek(d);
    const i = seen[day] ?? 0;
    seen[day] = i + 1;
    const slot = DAY_SLOT[day];
    const t = TOPICS[day][i % TOPICS[day].length];
    const family = t.family ?? slot.family;
    const format = t.format ?? slot.format;
    out.push({
      date: d,
      week,
      funnel: slot.funnel,
      family,
      format,
      postKind: "organique",
      title: t.title,
      hook: t.hook,
      message: t.message,
      cta: CTA,
      angle: t.angle ?? familyOf(family)!.angle,
      networks: NETWORKS_DEFAULT,
      shots: shotsText(format)
    });
  }
  let h = 0;
  for (let w = 0; w < TESTS_PER_WEEK.length; w++) {
    const start = addDays(sundayOf(PLAN90_START), w * 7);
    for (const day of TEST_DAYS.slice(0, TESTS_PER_WEEK[w])) {
      const date = addDays(start, day);
      if (date < PLAN90_START || date > PLAN90_END || h >= HOOK_BANK.length) continue;
      const hook = HOOK_BANK[h++];
      out.push({
        date,
        week: w,
        funnel: "haut",
        family: hook.family,
        format: "reel30",
        postKind: "essai",
        title: `Reel d'essai ${hook.id} : « ${hook.text} »`,
        hook: hook.text,
        hookId: hook.id,
        message: "Le même extrait que la publication de la semaine ; seul le crochet change. On garde celui qui retient le plus à 3 secondes et qui fait le plus partager.",
        cta: CTA,
        angle: familyOf(hook.family)!.angle,
        networks: ["instagram"],
        shots: shotsText("reel30")
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.postKind === b.postKind ? 0 : a.postKind === "organique" ? -1 : 1));
}

/** L'équilibre d'une semaine : haut, milieu, bas (publications organiques) et reels d'essai. */
export function weekBalance(posts: { funnel?: string | null; postKind: string }[]): { haut: number; milieu: number; bas: number; essais: number } {
  const b = { haut: 0, milieu: 0, bas: 0, essais: 0 };
  for (const p of posts) {
    if (p.postKind === "essai") b.essais++;
    else if (p.funnel === "haut" || p.funnel === "milieu" || p.funnel === "bas") b[p.funnel]++;
  }
  return b;
}

/** Ce qui ne respecte pas la règle dans un plan : semaine complète qui n'a pas 3 / 3 / 1, reels d'essai hors de
 *  3 à 5, publication sans crochet ou sans appel à l'action. Liste vide = plan conforme. */
export function planProblems(posts: PlanPost[]): string[] {
  const problems: string[] = [];
  const weeks = [...new Set(posts.map((p) => p.week))];
  for (const w of weeks) {
    const list = posts.filter((p) => p.week === w);
    const days = new Set(list.filter((p) => p.postKind === "organique").map((p) => p.date)).size;
    const b = weekBalance(list);
    if (days === 7 && (b.haut !== 3 || b.milieu !== 3 || b.bas !== 1)) problems.push(`Semaine ${w} : ${b.haut} haut, ${b.milieu} milieu, ${b.bas} bas.`);
    if (days === 7 && (b.essais < 3 || b.essais > 5)) problems.push(`Semaine ${w} : ${b.essais} reels d'essai.`);
  }
  for (const p of posts) {
    if (!p.hook.trim()) problems.push(`${p.date} ${p.title} : pas de crochet.`);
    if (p.cta !== CTA) problems.push(`${p.date} ${p.title} : pas d'appel à l'action.`);
  }
  return problems;
}

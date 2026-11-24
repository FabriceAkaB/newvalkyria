/** Guide de tournage New Valkyria (Mandalart P3.2.24, plan « machine d'acquisition 90 jours », section 8).
 *  Règles pures, testées : les types de plans (dessinés dans shot-diagrams.tsx), la liste des plans à prendre à
 *  chaque pratique, la recette de chaque format et les règles (jamais les garçons, consentement photo
 *  players.image_consent). Sert à la personne caméra, puis à Will, pour filmer « comme chez nous » sans JP.
 *  Affiché dans l'admin (/admin/contenu/guide) et dans le portail des éducateurs (/entraineur/guide-tournage). */

export type ShotId = "large" | "moyen" | "serre" | "pieds" | "ralenti" | "pov" | "reaction" | "entrevue" | "ambiance";

export interface ShotType {
  id: ShotId;
  label: string;
  /** Ce qu'on voit dans l'image. */
  what: string;
  /** À quoi il sert au montage. */
  use: string;
  /** Comment le prendre : distance, hauteur, durée. */
  how: string;
  /** Durée d'un clip, en secondes. */
  seconds: number;
  /** L'erreur à éviter. */
  avoid: string;
}

export const SHOT_TYPES: ShotType[] = [
  {
    id: "large",
    label: "Plan large",
    what: "Tout le groupe ou toute la zone : les filles, les cônes, le terrain ou le gymnase.",
    use: "Montrer l'exercice et l'ambiance. C'est le premier plan d'un reel après le crochet.",
    how: "Recule jusqu'à voir toute la zone, téléphone à hauteur de poitrine ou un peu plus haut. Ne bouge pas.",
    seconds: 8,
    avoid: "Zoomer avec les doigts : tu perds la qualité. Avance ou recule plutôt."
  },
  {
    id: "moyen",
    label: "Plan moyen",
    what: "Une ou deux filles, des genoux à la tête, avec le ballon.",
    use: "Le plan principal : on voit le geste et la personne.",
    how: "À 2 ou 3 mètres, à hauteur de la taille de la fille (penche-toi pour les petites). Suis-la doucement.",
    seconds: 6,
    avoid: "Filmer de haut vers le bas : la fille paraît petite. Mets-toi à sa hauteur."
  },
  {
    id: "serre",
    label: "Plan serré",
    what: "Le visage ou les épaules : concentration, effort, sourire.",
    use: "Créer l'émotion. Un plan serré fait que le parent s'attache.",
    how: "À 1 ou 2 mètres, téléphone à hauteur des yeux de la fille. Seulement une fille qui a le consentement photo.",
    seconds: 4,
    avoid: "Un visage sans consentement photo. En cas de doute, de dos ou les pieds."
  },
  {
    id: "pieds",
    label: "Détail des pieds",
    what: "Les pieds et le ballon, rien d'autre.",
    use: "La signature de New Valkyria : le ballon au pied. Parfait pour le ball mastery et quand une fille n'a pas le consentement photo.",
    how: "Accroupi, téléphone à 30 cm du sol, à 1 mètre des pieds. Tiens-le à deux mains, coudes collés.",
    seconds: 5,
    avoid: "Couper le ballon : il doit rester dans l'image du début à la fin."
  },
  {
    id: "ralenti",
    label: "Ralenti",
    what: "Un geste technique au ralenti : la semelle, le crochet, la frappe.",
    use: "Le geste de la semaine expliqué, ou la fin spectaculaire d'un reel.",
    how: "Mode ralenti du téléphone (120 images par seconde), plan moyen ou pieds, beaucoup de lumière. 3 essais du même geste.",
    seconds: 3,
    avoid: "Le ralenti dans un coin sombre : l'image scintille. Mets-toi face à la lumière."
  },
  {
    id: "pov",
    label: "Point de vue",
    what: "Ce que voit la joueuse ou la coach : le ballon, les pieds, les cônes devant.",
    use: "Mettre la fille qui regarde dans la peau d'une joueuse Valkyria.",
    how: "Téléphone tenu contre la poitrine (ou une caméra sur harnais), lentille vers le bas et l'avant. Seulement avec un ballon et une zone libre.",
    seconds: 6,
    avoid: "Courir avec le téléphone dans la main : l'image tremble trop. Marche."
  },
  {
    id: "reaction",
    label: "Réaction",
    what: "Une célébration, un câlin, une coach qui applaudit, deux filles qui se tapent dans la main.",
    use: "La preuve du plaisir. À mettre juste après un geste réussi.",
    how: "Garde l'enregistrement ouvert pendant les formes jouées : les réactions arrivent après un but ou une victoire.",
    seconds: 3,
    avoid: "Demander de « refaire » une réaction : ça se voit. On la prend quand elle arrive."
  },
  {
    id: "entrevue",
    label: "Entrevue",
    what: "Une joueuse, un parent ou une coach qui parle, assis ou debout, fond New Valkyria.",
    use: "L'entrevue de la semaine, les témoignages, une coach qui explique son exercice.",
    how: "Trépied à hauteur des yeux, personne au tiers de l'image, micro-cravate, la lumière devant elle. Elle regarde la personne qui pose les questions, pas la caméra.",
    seconds: 30,
    avoid: "Un fond en désordre ou une fenêtre derrière la personne : son visage devient noir."
  },
  {
    id: "ambiance",
    label: "Ambiance",
    what: "Le gymnase, les ballons alignés, les sacs, les chandails, l'arrivée des filles de dos.",
    use: "Les transitions et le début des coulisses. Aucun visage nécessaire.",
    how: "Plans fixes de 3 secondes, avant et pendant l'arrivée. Un lent mouvement de côté si tu veux, jamais de zoom.",
    seconds: 3,
    avoid: "Oublier de les prendre : sans ambiance, le montage est sec."
  }
];

export const shotLabel = (id: ShotId) => SHOT_TYPES.find((s) => s.id === id)?.label ?? id;

/* ── La liste des plans à prendre à chaque pratique ───────────────────── */

export type PracticeMoment = "avant" | "ball_mastery" | "technique" | "forme_jouee" | "fin" | "lab" | "entrevue";

export const PRACTICE_MOMENTS: { id: PracticeMoment; label: string }[] = [
  { id: "avant", label: "Avant la pratique" },
  { id: "ball_mastery", label: "Ball mastery" },
  { id: "technique", label: "Exercices techniques" },
  { id: "forme_jouee", label: "Forme jouée" },
  { id: "fin", label: "Fin de pratique" },
  { id: "lab", label: "Blocs Valkyria Lab (à la maison)" },
  { id: "entrevue", label: "Entrevue de la semaine" }
];

export interface ShotItem {
  key: string;
  moment: PracticeMoment;
  shot: ShotId;
  what: string;
  /** Combien de clips. */
  count: number;
  /** Seulement en gymnase (ball mastery à 360°). */
  gymOnly?: boolean;
  /** Pour quels formats ce plan sert. */
  formats: FormatId[];
}

export const PRACTICE_SHOTS: ShotItem[] = [
  { key: "avant-gym", moment: "avant", shot: "ambiance", what: "Le gymnase ou le terrain vide, les ballons et les cônes installés.", count: 3, formats: ["reel30", "carrousel"] },
  { key: "avant-coach", moment: "avant", shot: "moyen", what: "La coach qui installe son exercice ou relit son plan (coulisses).", count: 2, formats: ["reel30"] },
  { key: "avant-arrivee", moment: "avant", shot: "ambiance", what: "L'arrivée des filles, de dos, avec leur sac et leur ballon.", count: 2, formats: ["reel30"] },
  { key: "bm-360", moment: "ball_mastery", shot: "large", what: "Le ball mastery à 360° au complet (protocole de la Captation).", count: 1, gymOnly: true, formats: ["avant_apres"] },
  { key: "bm-pieds", moment: "ball_mastery", shot: "pieds", what: "Les pieds de 3 filles différentes sur le geste du jour.", count: 3, formats: ["reel30", "avant_apres"] },
  { key: "bm-ralenti", moment: "ball_mastery", shot: "ralenti", what: "Le geste de la semaine au ralenti, 2 filles.", count: 2, formats: ["reel30", "avant_apres"] },
  { key: "bm-large", moment: "ball_mastery", shot: "large", what: "Tout le groupe en même temps, ballon au pied.", count: 1, formats: ["reel30"] },
  { key: "tech-large", moment: "technique", shot: "large", what: "L'exercice en entier, pour qu'on comprenne comment il marche.", count: 1, formats: ["reel30", "carrousel"] },
  { key: "tech-moyen", moment: "technique", shot: "moyen", what: "Deux filles qui réussissent l'exercice.", count: 3, formats: ["reel30"] },
  { key: "tech-coach", moment: "technique", shot: "moyen", what: "La coach qui montre ou corrige un geste (on l'entend).", count: 2, formats: ["reel30"] },
  { key: "tech-serre", moment: "technique", shot: "serre", what: "La concentration d'une fille avec consentement photo.", count: 2, formats: ["reel30", "carrousel"] },
  { key: "jeu-large", moment: "forme_jouee", shot: "large", what: "Le match à la fin, une action complète.", count: 2, formats: ["reel30"] },
  { key: "jeu-pov", moment: "forme_jouee", shot: "pov", what: "Une conduite de balle vue par la joueuse (zone libre seulement).", count: 1, formats: ["reel30"] },
  { key: "jeu-reaction", moment: "forme_jouee", shot: "reaction", what: "Les célébrations, les encouragements, les tapes dans la main.", count: 3, formats: ["reel30", "carrousel"] },
  { key: "fin-cercle", moment: "fin", shot: "large", what: "Le cercle de fin et le cri d'équipe.", count: 1, formats: ["reel30"] },
  { key: "fin-championne", moment: "fin", shot: "moyen", what: "La championne du jour, si elle a le consentement photo (sinon de dos avec son ballon).", count: 1, formats: ["reel30", "carrousel"] },
  { key: "lab-demo", moment: "lab", shot: "moyen", what: "Bloc 1 et bloc 2 : une fille ou la coach fait l'exercice à la maison, en entier, 3 fois.", count: 2, formats: ["lab"] },
  { key: "lab-pieds", moment: "lab", shot: "pieds", what: "Le détail des pieds de chaque bloc, pour le gros plan du geste.", count: 2, formats: ["lab"] },
  { key: "lab-coach", moment: "lab", shot: "entrevue", what: "La coach face caméra : le nom de l'exercice et le truc en une phrase.", count: 2, formats: ["lab"] },
  { key: "entrevue-reponses", moment: "entrevue", shot: "entrevue", what: "La joueuse de la semaine répond aux questions du guide (5 minutes).", count: 1, formats: ["entrevue"] },
  { key: "entrevue-geste", moment: "entrevue", shot: "moyen", what: "Elle montre son geste préféré avec le ballon (10 secondes).", count: 1, formats: ["entrevue"] },
  { key: "entrevue-jeu", moment: "entrevue", shot: "serre", what: "Des plans d'elle pendant la pratique, pour couvrir sa voix au montage.", count: 3, formats: ["entrevue"] }
];

/** La liste du jour : la pratique en gymnase ajoute le ball mastery à 360° ; les blocs Lab et l'entrevue
 *  s'ajoutent seulement quand ils sont prévus ce jour-là. */
export function shotListFor(input: { gym: boolean; labBlocks?: number; interview?: boolean }): ShotItem[] {
  return PRACTICE_SHOTS.filter((s) => {
    if (s.gymOnly && !input.gym) return false;
    if (s.moment === "lab") return (input.labBlocks ?? 0) > 0;
    if (s.moment === "entrevue") return Boolean(input.interview);
    return true;
  });
}

/** Nombre de clips à rapporter de la pratique. */
export const clipCount = (items: ShotItem[]) => items.reduce((n, s) => n + s.count, 0);

/* ── La recette de chaque format ──────────────────────────────────────── */

export type FormatId = "reel30" | "carrousel" | "entrevue" | "avant_apres" | "lab";

export interface FormatRecipe {
  id: FormatId;
  label: string;
  goal: string;
  length: string;
  /** Le déroulé, dans l'ordre. */
  steps: { at: string; what: string }[];
  /** Les plans qu'il faut avoir avant de monter. */
  shots: ShotId[];
  /** Le texte à l'écran et la légende. */
  text: string;
  tips: string[];
}

export const CTA = "Réserve l'essai gratuit";

export const FORMATS: FormatRecipe[] = [
  {
    id: "reel30",
    label: "Reel de 30 secondes",
    goal: "Attirer une nouvelle famille : un geste, un défi ou une coulisse, assez fort pour qu'on regarde jusqu'au bout.",
    length: "20 à 30 secondes, vertical (9:16)",
    steps: [
      { at: "0 à 3 s", what: "Le crochet : le plan le plus fort (ralenti, réaction ou pieds) avec la phrase du crochet écrite à l'écran." },
      { at: "3 à 20 s", what: "Le corps : 4 à 6 plans courts (large, moyen, pieds), un changement de plan aux 2 ou 3 secondes." },
      { at: "20 à 27 s", what: "La preuve : la réussite, la réaction ou le sourire." },
      { at: "27 à 30 s", what: `L'appel à l'action : « ${CTA} », lien dans la bio.` }
    ],
    shots: ["ralenti", "large", "moyen", "pieds", "reaction"],
    text: "Le crochet en gros caractères les 3 premières secondes, sous-titres sur toute la vidéo (la plupart regardent sans le son), le logo à la fin.",
    tips: ["Monter sur une musique libre de droits de la bibliothèque Instagram.", "Couper chaque plan dès que le geste est fini.", "Toujours la même police et les couleurs de la charte New Valkyria."]
  },
  {
    id: "carrousel",
    label: "Carrousel",
    goal: "Convaincre un parent : une idée expliquée en images qu'il peut garder ou partager.",
    length: "6 à 8 images, format 4:5",
    steps: [
      { at: "Image 1", what: "Le crochet en gros texte sur la meilleure photo." },
      { at: "Images 2 à 6", what: "Une idée par image : une photo et une phrase courte (le geste, le chiffre, la réponse)." },
      { at: "Image 7", what: "La preuve : une citation de parent ou un résultat." },
      { at: "Dernière image", what: `« ${CTA} » et le lien dans la bio.` }
    ],
    shots: ["large", "moyen", "serre", "reaction"],
    text: "Une phrase par image, 12 mots au plus, gros caractères. La légende reprend l'idée en 3 lignes.",
    tips: ["Prendre des photos (pas des captures de vidéo) : plus nettes.", "Même gabarit Canva pour tous les carrousels.", "La première image décide de tout : la tester en reel d'essai si possible."]
  },
  {
    id: "entrevue",
    label: "Entrevue de joueuse",
    goal: "Faire connaître nos filles : l'entrevue de la semaine au Club des Recrues, l'histoire qui fait signer.",
    length: "Reel de 30 s + version longue (2 à 3 min) + une citation en image",
    steps: [
      { at: "Lundi", what: "Choisir la joueuse (alterner les âges, les débutantes et les avancées) et confirmer avec la famille et le consentement photo." },
      { at: "Pendant la pratique", what: "Filmer l'entrevue (questions du guide des Entrevues), son geste préféré et des plans d'elle en action." },
      { at: "Montage du reel", what: "La phrase la plus forte en crochet, puis 2 ou 3 réponses couvertes par des plans d'action, la fin avec son geste." },
      { at: "Montage long et citation", what: "La version longue pour le site et YouTube, une citation en image pour le carrousel." }
    ],
    shots: ["entrevue", "moyen", "serre", "pieds"],
    text: "Son prénom seulement (jamais son nom de famille ni son école), son âge et son groupe à l'écran ; sous-titres complets.",
    tips: ["Lui demander de reprendre la question dans sa réponse.", "Ne jamais lui faire dire un texte appris : on garde ses mots.", "Fichier nommé « AAAA-MM-JJ Prénom entrevue »."]
  },
  {
    id: "avant_apres",
    label: "Avant / après ball mastery",
    goal: "Prouver le progrès : la même fille, le même geste, le même angle, à des mois d'écart.",
    length: "15 à 20 secondes, vertical",
    steps: [
      { at: "0 à 2 s", what: "Le crochet : « Même fille, même geste, 3 mois plus tard »." },
      { at: "2 à 8 s", what: "AVANT : le clip du début (date à l'écran)." },
      { at: "8 à 16 s", what: "APRÈS : le clip d'aujourd'hui, même cadrage, même geste." },
      { at: "16 à 20 s", what: `« ${CTA} » : voici ce que ta fille apprendra.` }
    ],
    shots: ["pieds", "moyen", "ralenti"],
    text: "AVANT et APRÈS en gros, la date de chaque clip, le nom du geste.",
    tips: ["Toujours filmer le même exercice, du même endroit, à la même hauteur : c'est ce qui rend la comparaison possible.", "Les vidéos de progression des familles servent de clip « avant » (avec leur accord).", "Sans consentement photo : seulement les pieds."]
  },
  {
    id: "lab",
    label: "Bloc Valkyria Lab",
    goal: "Donner un exercice à faire à la maison : utile aux familles inscrites, aimant pour les autres.",
    length: "45 à 60 secondes pour le Lab, coupé en 30 s pour les réseaux",
    steps: [
      { at: "Début", what: "La coach face caméra : le nom de l'exercice et à quoi il sert, en une phrase." },
      { at: "Démonstration", what: "L'exercice en entier, 3 fois, en plan moyen, puis le détail des pieds." },
      { at: "Le truc", what: "L'erreur à éviter et le repère à garder, dit par la coach." },
      { at: "Fin", what: "Combien de répétitions faire par jour ; sur les réseaux, « " + CTA + " »." }
    ],
    shots: ["entrevue", "moyen", "pieds"],
    text: "Le nom de l'exercice, le nombre de répétitions et la durée à l'écran.",
    tips: ["2 blocs à chaque sortie de tournage de JP (plan des 90 jours, section 8).", "Un petit espace comme à la maison : un salon, un mur, une chaise.", "Le bloc entier va dans Valkyria Lab, l'extrait de 30 s dans le calendrier."]
  }
];

export const formatOf = (id: FormatId) => FORMATS.find((f) => f.id === id)!;

/** Les plans qui manquent pour monter un format, d'après les types de plans déjà pris. */
export function missingShotsForFormat(id: FormatId, taken: ShotId[]): ShotId[] {
  return formatOf(id).shots.filter((s) => !taken.includes(s));
}

/* ── Les règles ────────────────────────────────────────────────────────── */

export const SHOOT_RULES: { title: string; text: string; strict?: boolean }[] = [
  { title: "Jamais les garçons", text: "On ne filme ni ne photographie les groupes de garçons, même en arrière-plan. Si un garçon entre dans l'image, on coupe ce bout.", strict: true },
  { title: "Consentement photo", text: "Une fille dont on voit le visage n'est publiée que si sa famille a donné le consentement photo. Sans consentement : de dos, les pieds ou hors de l'image.", strict: true },
  { title: "Le prénom seulement", text: "Jamais le nom de famille, l'école, l'adresse ou la ville d'une joueuse à l'écran ou dans la légende.", strict: true },
  { title: "Rien de gênant", text: "Jamais une fille blessée, qui pleure, qui se change ou dans un vestiaire. En cas de doute, on ne publie pas.", strict: true },
  { title: "La coach coache, la caméra filme", text: "La personne caméra ne coache pas, n'arrête pas un exercice et reste hors du chemin des ballons." },
  { title: "Le bon réglage", text: "Vertical (9:16), 4K à 30 images par seconde, 120 pour le ralenti. Lentille essuyée, téléphone en mode Ne pas déranger, batterie pleine et une batterie de secours." },
  { title: "Les fichiers le soir même", text: "Tout dans le dossier partagé, nommé « AAAA-MM-JJ Groupe pratique » ; cocher le ball mastery à 360° dans Captation. Les vidéos d'enfants restent dans nos dossiers privés (Loi 25)." },
  { title: "Deux comptes séparés", text: "New Valkyria publie l'académie et ses joueuses. Les vidéos de JP Coach (marque personnelle de JP) se tournent et se publient à part, jamais sur le compte de l'académie." }
];

/** Peut-on montrer cette joueuse ? Un groupe de garçons : jamais. Une fille reconnaissable : seulement avec le
 *  consentement photo (players.image_consent). Sinon, on propose une façon de la filmer sans la reconnaître. */
export function canFeature(input: { boysGroup: boolean; imageConsent: boolean | null | undefined; recognizable: boolean }): { ok: boolean; how: string } {
  if (input.boysGroup) return { ok: false, how: "Jamais les garçons : on ne filme pas ce groupe." };
  if (!input.recognizable) return { ok: true, how: "Sans visage : de dos, les pieds ou le ballon, ça se publie." };
  if (input.imageConsent === true) return { ok: true, how: "Consentement photo donné : son visage peut être montré." };
  return { ok: false, how: "Pas de consentement photo : la filmer de dos, les pieds seulement, ou la laisser hors de l'image." };
}

/** Un groupe de garçons, d'après le nom de l'activité ou du groupe (même règle que la captation). */
export const isBoysGroup = (title: string | null | undefined) => /gar[cç]on/i.test(String(title ?? ""));

/** Matériel de la personne caméra, à vérifier la veille. */
export const CAMERA_KIT = [
  "Téléphone chargé, 30 Go de libre, lentille propre",
  "Batterie de secours et câble",
  "Petit trépied et support de téléphone",
  "Micro-cravate (entrevues et coach face caméra)",
  "Caméra 360° et son trépied lesté (pratiques en gymnase)",
  "Savoir quelles filles ont le consentement photo (les seules qu'on montre de face)"
];

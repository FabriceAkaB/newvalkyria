/** Les sections (modules) de chaque pilier du Mandalart : ce qui existe déjà dans l'admin,
 *  ce qui est en construction et ce qui reste à bâtir. Chaque nouveau module construit plus tard
 *  se branche ici (changer `status` et `href`), sans changer la structure.
 *  Pour un autre club (Valkyria Club System), la même liste sert de catalogue. */

export type ModuleStatus = "actif" | "partiel" | "a-construire";

export interface PillarModule {
  slug: string;
  pillar: string;
  title: string;
  /** La question à laquelle la section répond, du point de vue de JP. */
  question: string;
  status: ModuleStatus;
  /** Écran existant de l'admin. Sinon, la page de chantier /admin/mandalart/piliers/[pilier]/[slug]. */
  href?: string;
  objectives: string[];
  kpis?: string[];
  links?: string[];
  /** Ce que la section contiendra (pour les sections partielles ou à construire). */
  planned?: string[];
  next?: string;
}

export const MODULE_STATUS_LABEL: Record<ModuleStatus, string> = { actif: "En place", partiel: "En construction", "a-construire": "À construire" };

export const PILLAR_MODULES: PillarModule[] = [
  // ── P1 Excellence pédagogique ──
  {
    slug: "mois-pedagogique",
    pillar: "P1",
    title: "Saison pédagogique",
    question: "Qu'est-ce qui a été fait sur le terrain ce mois-ci : pratiques, matchs, événements, thèmes ?",
    status: "actif",
    objectives: ["P1.3", "P1.8"],
    planned: ["Toutes les pratiques, matchs (adversaire, score), tournois et événements du mois", "Thème de chaque semaine", "Évaluations de joueuses faites pendant les activités"],
    next: "Entrer toutes les pratiques de novembre dans Équipe → Entraînements (type Pratique, Match ou Tournoi)."
  },
  { slug: "entrainements", pillar: "P1", title: "Entrer les pratiques et les matchs", question: "Où j'ajoute une pratique, un match ou un tournoi ?", status: "actif", href: "/admin/entraineurs/activites", objectives: ["P1.3"] },
  {
    slug: "pratiques",
    pillar: "P1",
    title: "Pratiques préparées d'avance",
    question: "Mes prochaines pratiques sont-elles prêtes, deux semaines d'avance ?",
    status: "partiel",
    href: "/admin/pratiques",
    objectives: ["P1.3", "P8.4"],
    links: ["AU21", "A12", "A02"],
    planned: [
      "Chaque pratique à venir : plan prêt (blocs et thème) ou non ; vert 2 semaines d'avance, jaune 1 semaine, rouge 3 jours",
      "Rappel à JP 2 fois par jour tant qu'une pratique est en rouge",
      "Pratiques de JP hors Académie (CF Montréal, St-Gabriel…) dans une section à part",
      "Calendrier identique à MonClubSportif dans les deux sens (agent A12)"
    ],
    next: "P8.4.08 : lire le calendrier MonClubSportif (15 déc.)."
  },
  {
    slug: "methode",
    pillar: "P1",
    title: "Méthode Valkyria et curriculum",
    question: "Comment se déroule une séance Valkyria et qu'est-ce qu'une fille doit maîtriser à chaque âge ?",
    status: "a-construire",
    objectives: ["P1.1", "P1.5"],
    planned: ["Structure de séance en 4 blocs avec leur durée", "Bibliothèque des gestes par famille, avec fiche et vidéo", "Progression en 4 étapes de chaque geste", "Curriculum U8 à U12 par génération et par niveau"],
    next: "P1.1.01 et P1.1.02 : écrire la structure de séance et choisir les 5 gestes par niveau (30 nov.)."
  },
  {
    slug: "periodisation",
    pillar: "P1",
    title: "Planification annuelle (périodisation)",
    question: "Quel thème travaille-t-on chaque semaine, pour chaque catégorie, sur toute l'année ?",
    status: "partiel",
    href: "/admin/themes",
    objectives: ["P1.1", "P1.3"],
    planned: ["Thème de la semaine (existe : Équipe → Thèmes)", "Plan annuel par catégorie : blocs de 4 à 6 semaines, tests, matchs, événements", "Lien avec la banque d'exercices pour bâtir chaque séance"],
    next: "Entrer les thèmes de novembre et décembre dans Thèmes."
  },
  {
    slug: "exercices",
    pillar: "P1",
    title: "Banque d'exercices approuvés",
    question: "Quels exercices marchent vraiment, par âge, thème et espace ?",
    status: "actif",
    href: "/admin/exercices",
    objectives: ["P1.3"],
    kpis: ["exercices_approuves", "seances_approuvees"],
    links: ["AU06", "A02"],
    planned: [
      "Type d'exercice : ball mastery, analytique (technique), jeu réduit à thème, forme jouée, physique (avec métriques), échauffement",
      "Liste de vérification Valkyria : objectif, consignes, variantes facile, difficile et cognitive, progression",
      "Organisation selon le nombre de joueuses : 5 à 7, 8 à 10, 11 à 16",
      "Lieu : gymnase (technique, ball mastery) ou synthétique (tactique, grand espace, prise de décision), relié aux thèmes",
      "Note sur 10 par les éducateurs ; approuvé quand 2 éducateurs donnent 8 ou plus ; sous 8 = nouvelle version, pas la même semaine, réévaluée",
      "Recherche par âge, thème, type, lieu, nombre de joueuses, statut et note",
      "Base : les documents de référence de JP"
    ],
    next: "Remplir les fiches : organisation 5 à 7 / 8 à 10 / 11 à 16 de chaque exercice (P1.3.14), puis importer les documents de référence de JP (P1.3.16, 15 déc.). Les éducateurs notent dans le portail après chaque séance."
  },
  {
    slug: "standards",
    pillar: "P1",
    title: "Passeport et tests de progression",
    question: "Comment je prouve qu'une fille a progressé ?",
    status: "a-construire",
    objectives: ["P1.2"],
    kpis: ["joueuses_filmees_jour1"],
    planned: ["Test de chaque niveau (bronze, argent, or, mauve)", "Feuille de suivi des tests (jour 1, mensuels)", "Vidéos avant-après dans le stockage privé"],
    next: "P1.2.01 et P1.2.02 : fixer les tests et filmer le jour 1 de chaque joueuse (30 nov.)."
  },
  {
    slug: "evaluation-joueuses",
    pillar: "P1",
    title: "Évaluation des joueuses à chaque pratique",
    question: "Comment chaque fille a-t-elle fait aujourd'hui, et qu'est-ce que ça donne sur la saison ?",
    status: "partiel",
    objectives: ["P1.2"],
    links: ["A03"],
    planned: [
      "Dans le portail entraîneur, moins de 2 minutes par fille : photo, ball mastery, prestation, attitude",
      "Une note d'au moins 30 caractères par joueuse (sentiment, comportement)",
      "Résumé de saison par joueuse pour les bulletins (agent suivi des familles A03)"
    ],
    next: "P1.2.08 : évaluation rapide dans le portail entraîneur (30 nov.) ; P1.2.09 : les éducateurs la remplissent après chaque pratique."
  },
  {
    slug: "matchs-joues",
    pillar: "P1",
    title: "Matchs : résultats, vidéos et analyse",
    question: "Contre qui a-t-on joué, qu'est-ce qui s'est passé, qui a joué, et combien ça a coûté ?",
    status: "partiel",
    objectives: ["P1.8", "P7.7"],
    planned: [
      "Chaque match : nous contre l'adversaire (logos), score, résumé ; existe déjà en partie (adversaire, score, alignement et temps de jeu dans Entraînements)",
      "Vidéo du match : lien YouTube non répertorié, ou dépôt direct dans un stockage privé (les fichiers ne passent pas par le site, donc il reste léger)",
      "Analyse du match à partir de la vidéo",
      "Par joueuse : matchs joués, minutes, évaluations (ex. combien de matchs Charlotte a joués)",
      "Bilan financier : coût (terrain, arbitres, éducateurs), part de l'adversaire encaissée ou non, relié aux Revenus"
    ],
    next: "P1.8.05 : section Matchs (31 déc.). En attendant, entrer chaque match dans Entraînements (type Match, adversaire, score)."
  },
  {
    slug: "portail-educateurs",
    pillar: "P1",
    title: "Portail des éducateurs",
    question: "En arrivant, l'éducateur sait-il exactement quoi faire, et ses rapports sont-ils complets ?",
    status: "partiel",
    href: "/entraineur",
    objectives: ["P1.4", "P1.5", "P8.3"],
    kpis: ["appreciation_joueuses"],
    links: ["A02", "AU20"],
    planned: [
      "Pratique du jour : thème, montage du terrain, matériel, qui fait quoi, points clés, variantes et progressions",
      "Évaluation des joueuses et note des exercices, obligatoires avant que les heures comptent",
      "Contrôle de qualité : copier-coller et notes trop répétitives refusés",
      "Routine de fin : chaque joueuse note la pratique sur 10 et sa fatigue sur 10",
      "Accès limités à ce dont l'éducateur a besoin"
    ],
    next: "P1.4.08 : pratique du jour dans le portail (31 déc.) ; P1.5.06 : note des joueuses en fin de pratique (15 déc.)."
  },
  { slug: "evaluations", pillar: "P1", title: "Événements d'évaluation", question: "Où sont les journées d'évaluation (essais, sélections) ?", status: "actif", href: "/admin/evaluations", objectives: ["P1.2"] },
  {
    slug: "valkyria-lab",
    pillar: "P1",
    title: "Valkyria Lab",
    question: "Est-ce que les filles travaillent à la maison, et est-ce que les parents voient les progrès ?",
    status: "a-construire",
    objectives: ["P1.7", "P4.3"],
    kpis: ["familles_video_lab", "familles_profil"],
    links: ["AU08", "AU07", "AU13", "A03"],
    planned: ["Routine maison du mois et jeu de la semaine", "Bouton « Envoyer ma vidéo » (dossier privé de la joueuse)", "Profil de l'enfant dans l'espace parent, publié par JP ou le coach-chef", "Bulletins et défi ball mastery mensuel"],
    next: "P1.7.02 : lancer la routine maison du mois, phase 1 (30 nov.). Commence cette saison et s'améliore chaque mois."
  },
  {
    slug: "innovations",
    pillar: "P1",
    title: "Innovations Valkyria",
    question: "Où en sont les dossards bicolores, les tapis, les repères visuels ?",
    status: "a-construire",
    objectives: ["P1.6"],
    planned: ["Échantillons commandés, testés et notés", "Fournisseurs comparés et commande en volume 2 mois avant le besoin", "Utilisation dans chaque séance (prise d'information)"],
    next: "P1.6.05 : commander les échantillons chez 2 fournisseurs (15 nov.)."
  },
  {
    slug: "formation-coachs",
    pillar: "P1",
    title: "Formation des coachs",
    question: "Est-ce que chaque coach applique la méthode ?",
    status: "a-construire",
    objectives: ["P1.4"],
    planned: ["Parcours d'intégration", "Observations de séance et rétroaction", "Certifications (existe : fiches entraîneurs)"]
  },

  // ── P2 Offres et prix ──
  { slug: "saison", pillar: "P2", title: "Offres et places de la saison", question: "Qu'est-ce qu'on vend, à quel prix, et combien de places restent ?", status: "actif", href: "/admin/saison", objectives: ["P2.1", "P2.4"] },
  { slug: "garcons", pillar: "P2", title: "Programmes garçons et Sport-Études", question: "Où sont les programmes garçons et le Sport-Études ?", status: "actif", href: "/admin/inscriptions-garcons", objectives: ["P2.4"] },
  {
    slug: "calculateur",
    pillar: "P2",
    title: "Calculateur de lancement (GO / NO-GO)",
    question: "Ce nouveau programme est-il rentable avant de le lancer ?",
    status: "a-construire",
    objectives: ["P2.5", "P7.2"],
    links: ["AU11", "A04"],
    planned: ["Coûts fixes, coûts par joueuse, nombre de places", "Prix plancher, seuil de survie, seuil à 50 % de marge", "Verdict GO ou NO-GO et alerte 2 semaines avant le début"],
    next: "P7.2.01 : fournir les vrais coûts (15 nov.), puis P7.2.02."
  },
  { slug: "paiements", pillar: "P2", title: "Paiements et versements", question: "Qui doit encore payer et quand ?", status: "actif", href: "/admin/revenus/paiements", objectives: ["P2.7"], links: ["AU04"] },

  // ── P3 Acquisition et marketing ──
  {
    slug: "reseaux",
    pillar: "P3",
    title: "Réseaux sociaux et publicité",
    question: "Combien d'abonnés, de vidéos et de vues, et combien la pub coûte par inscription ?",
    status: "partiel",
    objectives: ["P3.2", "P3.8"],
    kpis: ["videos_semaine", "cac", "source_connue"],
    links: ["A05", "A06"],
    planned: ["Instagram, Facebook, YouTube, TikTok : abonnés, publications, vues (saisie aux 2 semaines)", "Publicité Meta et Google : dépenses, contacts obtenus, coût par inscription", "Plus tard : l'agent statistiques (A06) remplit ces chiffres seul"],
    next: "Entrer les chiffres d'aujourd'hui de chaque réseau pour avoir un point de départ."
  },
  { slug: "parrainage", pillar: "P3", title: "Parrainage et codes de référence", question: "Qui nous amène des familles ?", status: "actif", href: "/admin/references", objectives: ["P3.1"] },
  { slug: "essais", pillar: "P3", title: "Essais gratuits", question: "Qui vient essayer et quand ?", status: "actif", href: "/admin/essais-dates", objectives: ["P2.2", "P3.3"] },
  {
    slug: "sources",
    pillar: "P3",
    title: "Sources d'acquisition et liste chaude",
    question: "D'où viennent nos familles, et qui attend une place ?",
    status: "a-construire",
    objectives: ["P3.6", "P3.8"],
    kpis: ["source_connue", "nouvelles_joueuses_an"],
    links: ["AU05", "A01"],
    planned: ["Champ obligatoire « Comment nous avez-vous connus ? » à l'inscription et à l'essai", "Liste chaude : familles intéressées, à relancer à l'ouverture des inscriptions", "Tableau par canal : essais, inscriptions, coût"],
    next: "P3.8.01 : rendre le champ source obligatoire (30 nov.)."
  },

  // ── P4 Expérience client et renouvellement ──
  {
    slug: "voix-des-familles",
    pillar: "P4",
    title: "Voix des familles (sondages)",
    question: "Les familles sont-elles contentes, qui a répondu quoi, et qui faut-il rappeler ?",
    status: "actif",
    href: "/admin/sondages",
    objectives: ["P4.8", "P4.5"],
    kpis: ["recommandation", "satisfaction", "taux_reponse_sondages"],
    links: ["AU17"]
  },
  {
    slug: "retention",
    pillar: "P4",
    title: "Rétention et recrutement par génération",
    question: "Combien de familles reviennent, et quelles générations faut-il recruter ?",
    status: "actif",
    objectives: ["P4.7", "P4.8", "P2.4"],
    kpis: ["retour_saison", "cohortes_2017_2019", "membres_actifs", "remplissage"]
  },
  { slug: "relances", pillar: "P4", title: "Relances et suivi", question: "Qui a été relancé, combien de fois, et qui s'est inscrit ?", status: "actif", href: "/admin/relances", objectives: ["P4.8"] },
  { slug: "communication", pillar: "P4", title: "Messages aux familles", question: "Comment j'écris à toutes les familles d'un groupe ?", status: "actif", href: "/admin/communications", objectives: ["P4.5"], links: ["AU13"] },
  {
    slug: "signes-depart",
    pillar: "P4",
    title: "Signes de départ",
    question: "Quelle famille risque de partir, avant qu'elle parte ?",
    status: "a-construire",
    objectives: ["P4.7"],
    links: ["AU03", "AU16"],
    planned: ["Alerte de présence : 2 séances manquées de suite, ou passage de 2 à 1 séance par semaine", "Question de parent sans réponse depuis 20 h", "Note de sondage sous 7 (existe : Voix des familles)"],
    next: "P4.7.01 : alerte de présence (15 déc.)."
  },
  {
    slug: "accueil",
    pillar: "P4",
    title: "Accueil, appartenance et moments marquants",
    question: "Qu'est-ce que vit une nouvelle famille la première semaine ?",
    status: "a-construire",
    objectives: ["P4.1", "P4.2", "P4.4", "P4.6"],
    links: ["AU12", "A01"],
    planned: ["Parcours de bienvenue (courriel, vidéo de JP, kit)", "Anniversaires des joueuses", "Moments vedettes de la saison"]
  },

  // ── P5 Diversification et conseil ──
  {
    slug: "camps",
    pillar: "P5",
    title: "Camps (été, relâche, Fêtes)",
    question: "Combien de semaines de camp sont vendues, par site ?",
    status: "a-construire",
    objectives: ["P5.2", "P5.3"],
    links: ["A09"],
    planned: ["Carte-cadeau « Semaine de camp Valkyria » (Noël)", "Prévente aux familles actuelles, prix hâtifs", "Sites, semaines, places vendues, point de contrôle du 1er avril"],
    next: "P5.2.01 : carte-cadeau de Noël (5 déc.) ; P5.2.10 : préparer la prévente (20 déc.)."
  },
  {
    slug: "parascolaire",
    pillar: "P5",
    title: "Parascolaire",
    question: "Dans quelles écoles est-on, et combien ça rapporte ?",
    status: "a-construire",
    objectives: ["P5.1"],
    links: ["A08"],
    planned: ["Liste des écoles et contacts", "Offres envoyées, groupes ouverts, revenus"]
  },
  {
    slug: "evenements",
    pillar: "P5",
    title: "Événements (tournoi Valkyria, fêtes, ligue des mamans)",
    question: "Quels événements payants s'en viennent ?",
    status: "partiel",
    href: "/admin/calendrier",
    objectives: ["P5.5"],
    planned: ["Tournoi Valkyria : équipes, commanditaires, boutique", "Fêtes d'anniversaire Valkyria", "Ligue des mamans"],
    next: "Ajouter les événements au calendrier (type Tournoi) ; P5.5.04 : réserver le lieu du tournoi (31 janv.)."
  },
  {
    slug: "conseil-clubs",
    pillar: "P5",
    title: "Conseil aux clubs (Valkyria Club System)",
    question: "Quels clubs achètent notre système, et est-il prêt à être dupliqué ?",
    status: "a-construire",
    objectives: ["P5.8"],
    kpis: ["ca_conseil_annee", "clubs_conseil"],
    planned: ["Pipeline des clubs (contact, pilote, signé)", "Le site est déjà bâti pour être dupliqué : chaque donnée du Mandalart et des sondages est rangée par club", "Formation des entraîneurs et version en ligne"]
  },
  { slug: "home-lab", pillar: "P5", title: "Home Lab et analyse vidéo", question: "Qui achète le Home Lab ?", status: "a-construire", objectives: ["P5.4"], planned: ["Kit (tapis, ballon, affiche frigo)", "Analyse vidéo à distance"] },

  // ── P6 Partenariats et commandites ──
  { slug: "commandites", pillar: "P6", title: "Commandites 2027", question: "Quels emplacements sont vendus ?", status: "actif", href: "/admin/sponsors-2027", objectives: ["P6.3", "P6.4"], kpis: ["commandites_annee"] },
  { slug: "suivi-commanditaires", pillar: "P6", title: "Suivi des commanditaires", question: "Avec qui on négocie ?", status: "actif", href: "/admin/commandites", objectives: ["P6.5", "P6.6"], links: ["A08", "AU15"] },
  { slug: "matchs", pillar: "P6", title: "Vente de matchs", question: "Combien de plages de match sont vendues ?", status: "actif", href: "/admin/matchs", objectives: ["P6.7"], kpis: ["plages_matchs"] },
  { slug: "arbitres", pillar: "P6", title: "Arbitres et bilan des matchs", question: "Qui arbitre, qui dois-je payer, et est-ce que mes matchs font leurs frais ?", status: "actif", href: "/admin/arbitres", objectives: ["P7.7", "P7.6"], links: ["AU22", "A04"] },
  {
    slug: "subventions",
    pillar: "P6",
    title: "Subventions et partenaires non financiers",
    question: "Quelles subventions demander et pour quand ?",
    status: "a-construire",
    objectives: ["P6.7", "P6.8"],
    planned: ["Liste des programmes de subvention et échéances", "Demandes envoyées et réponses"]
  },

  // ── P7 Finance et marges ──
  { slug: "revenus", pillar: "P7", title: "Revenus et dépenses", question: "Combien j'ai encaissé et dépensé ?", status: "actif", href: "/admin/revenus", objectives: ["P7.4", "P7.7"], kpis: ["ca_annee", "ca_12m"] },
  { slug: "tresorerie", pillar: "P7", title: "Trésorerie", question: "Combien d'argent j'aurai dans 3 mois ?", status: "actif", href: "/admin/revenus/tresorerie", objectives: ["P7.4"], kpis: ["reserve_tresorerie"] },
  { slug: "marges", pillar: "P7", title: "Marges par programme", question: "Quel programme rapporte vraiment ?", status: "partiel", href: "/admin/historique", objectives: ["P7.3", "P7.7"], kpis: ["marge_valkyria"] },
  {
    slug: "conformite",
    pillar: "P7",
    title: "Conformité et rémunération de JP",
    question: "Est-ce que tout est en règle (CPA, taxes, assurance) et est-ce que JP se paie ?",
    status: "a-construire",
    objectives: ["P7.1", "P7.8"],
    kpis: ["salaire_jp", "remuneration_jp"],
    planned: ["Mandat CPA, TPS/TVQ, assurance 5 M$, entente avec la gérante", "Salaire de JP : 10 000 $ par mois dès février 2027, mois versés cochés", "Compte rémunération : 1 mois d'avance au 1er février, 3 mois de réserve au 1er juillet"],
    next: "P7.1.01 : signer le mandat CPA (15 nov.)."
  },

  {
    slug: "rapprochement",
    pillar: "P7",
    title: "Contrôle comptable (rapprochement)",
    question: "L'argent qui entre et l'argent qui sort concordent-ils ?",
    status: "a-construire",
    objectives: ["P7.7", "P7.6"],
    links: ["AU18", "A04"],
    planned: ["Chaque lundi : Stripe et virements contre inscriptions payées", "Paie, terrains et fournisseurs contre budget", "Tout écart signalé à JP, puis suivi par l'agent financier (A04) avec le CPA"],
    next: "P7.7.04 : rapprochement de la semaine (31 janv.)."
  },

  // ── P8 Organisation, équipe et agents IA ──
  { slug: "agents", pillar: "P8", title: "Agents IA et automatisations", question: "Quels agents existent, lesquels construire, dans quel ordre ?", status: "actif", href: "/admin/mandalart/agents", objectives: ["P8.4", "P8.5", "P8.6", "P8.7"] },
  {
    slug: "monclubsportif",
    pillar: "P8",
    title: "MonClubSportif automatique",
    question: "Qu'est-ce qui reste à faire à la main dans MonClubSportif, et comment s'en débarrasser ?",
    status: "partiel",
    href: "/admin/monclubsportif",
    objectives: ["P8.4"],
    links: ["AU19", "A12"],
    planned: [
      "Liste « à faire dans MonClubSportif » produite par le site : inscrites payées à ajouter (programme, compte, courriel), remboursées à retirer, activités et matchs à créer",
      "Étape 1 : JP liste chaque tâche manuelle et son temps (P8.4.04)",
      "Étape 2 : demander à MonClubSportif une API ou une importation ; sinon un robot (navigateur automatisé) avec un compte dédié dont JP garde le mot de passe",
      "Étape 3 : l'agent A12 fait la synchronisation seul et note chaque action ; vérification de concordance chaque soir",
      "Existe déjà : exports MonClubSportif (Outils → Exports)"
    ],
    next: "P8.4.04 : lister les tâches manuelles (15 nov.) ; P8.4.05 : question à MonClubSportif (30 nov.)."
  },
  {
    slug: "presences-educateurs",
    pillar: "P8",
    title: "Présences et heures des éducateurs",
    question: "Qui a travaillé où, combien d'heures, et combien je dois payer ?",
    status: "partiel",
    href: "/admin/entraineurs/paie",
    objectives: ["P8.3"],
    links: ["AU20", "A10"],
    planned: ["Confirmation de présence de l'éducateur à chaque activité (portail entraîneur)", "Heures × taux de chaque éducateur = paie", "Relance à 24 h si la présence n'est pas confirmée ; liste des manquantes avant chaque paie"],
    next: "P8.3.04 : confirmation de présence et calcul des heures (15 déc.)."
  },
  {
    slug: "structure",
    pillar: "P8",
    title: "Structure et recrutement",
    question: "Qui travaille avec nous, avec quels diplômes, et qui dois-je recruter pour la prochaine saison ?",
    status: "a-construire",
    objectives: ["P8.2", "P8.3"],
    links: ["AU23", "A10"],
    planned: [
      "Organigramme : JP, Annie, Christine, coachs, consultants, caméra, arbitres",
      "Pour chacun : rôle, diplômes et certifications (licences C/B, sport sécuritaire, antécédents), contrat, taux, assignations",
      "Plan de recrutement par saison : coachs certifiés temps plein, temps partiel, moniteurs, selon les groupes prévus (1 coach pour 10 filles) et la marge",
      "Suivi de chaque recrutement : annonce, candidats, entrevue, antécédents, formation, contrat (relié à Contrats)",
      "Existe déjà : fiches entraîneurs, certifications, contrats, paie"
    ],
    next: "P8.2.05 : dossier Structure (15 déc.)."
  },
  { slug: "equipe", pillar: "P8", title: "Équipe et coachs", question: "Qui travaille avec nous ?", status: "actif", href: "/admin/entraineurs", objectives: ["P8.2", "P8.3"] },
  { slug: "contrats", pillar: "P8", title: "Contrats d'embauche", question: "Qui a signé ?", status: "actif", href: "/admin/contrats", objectives: ["P8.3"] },
  {
    slug: "entrevues",
    pillar: "P8",
    title: "Projet entrevues avant/après",
    question: "Combien de filles ont leur entrevue de début et de fin de saison ?",
    status: "a-construire",
    objectives: ["P8.1"],
    kpis: ["entrevues_saison"],
    planned: ["Liste des filles avec consentement à l'image", "Entrevue de début et de fin filmées", "Montage avant/après pour le marketing (P3.2)"],
    next: "P8.2.01 : embaucher la personne caméra ; P8.1.02 : filmer 30 à 40 entrevues (30 nov.)."
  }
];

export const modulesForPillar = (code: string) => PILLAR_MODULES.filter((m) => m.pillar === code);
export const moduleHref = (m: PillarModule) => m.href ?? `/admin/mandalart/piliers/${m.pillar.toLowerCase()}/${m.slug}`;

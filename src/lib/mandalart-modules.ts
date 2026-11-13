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
    status: "partiel",
    href: "/admin/coaching/methode",
    objectives: ["P1.1", "P1.5", "P1.6"],
    planned: [
      "En place : structure de séance en 4 blocs (jeu d'entrée, ball mastery, technique, forme jouée) avec durées et règles, proposition tirée du plan à valider par JP",
      "En place : principes de la pédagogie Valkyria (repris du plan) et page Méthode dans le portail des éducateurs",
      "En place : bibliothèque des gestes par famille et niveau du passeport (fiche, 3 points clés, erreurs, vidéo, progression en 4 étapes), compteur des 5 gestes de base par niveau",
      "À venir : curriculum U8 à U12 par génération et par niveau (P1.1.06)"
    ],
    next: "P1.1.01 et P1.1.02 : JP valide la structure de séance et entre les 5 gestes de base par niveau dans Coaching → Méthode → Gestes (30 nov.)."
  },
  {
    slug: "periodisation",
    pillar: "P1",
    title: "Planification annuelle (périodisation)",
    question: "Quel thème travaille-t-on chaque semaine, pour chaque catégorie, sur toute l'année ?",
    status: "partiel",
    href: "/admin/coaching/plan",
    objectives: ["P1.1", "P1.3"],
    planned: [
      "En place : plan de l'année semaine par semaine (Coaching → Pratiques → Plan de l'année) : thème, thème propre à une catégorie, bloc de 4 à 6 semaines, semaine du test du mois, pratiques prêtes et matchs de la semaine, semaines fermées",
      "En place : alertes « bloc hors de 4 à 6 semaines » et « mois sans semaine de tests » ; le thème de la catégorie arrive dans le briefing et la pratique du jour des éducateurs",
      "À venir : lien lieu et thème (gymnase = technique et ball mastery, synthétique = tactique, P1.3.17) et proposition d'exercices de la banque selon le thème"
    ],
    next: "Écrire les thèmes et les blocs de novembre à avril dans le Plan de l'année, avec une semaine de tests par mois."
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
    status: "partiel",
    href: "/admin/coaching/tests",
    objectives: ["P1.2", "P1.5"],
    kpis: ["joueuses_filmees_jour1"],
    planned: [
      "En place : tests du passeport (touches en 30 s, conduite chronométrée, passes des deux pieds) proposés, protocole et seuils bronze, argent, or, mauve à valider par JP",
      "En place : saisie au bord du terrain par groupe, feuille de suivi (écart avec le test précédent et le jour 1, niveau, lien vidéo, note), chaque fille comparée à elle-même",
      "En place : nom de chaque vidéo selon la convention Prénom-Nom_geste_AAAA-MM-JJ_type ; indicateur « jour 1 filmé »",
      "À venir : test mensuel comparé au mois précédent (P1.2.05), passeport papier et écussons (P1.2.06), vidéo de progression de chaque fille (P1.2.07)"
    ],
    next: "P1.2.01 : valider les tests et leurs seuils ; P1.2.02 : filmer le test du jour 1 de chaque joueuse (30 nov.)."
  },
  {
    slug: "evaluation-joueuses",
    pillar: "P1",
    title: "Évaluation des joueuses à chaque pratique",
    question: "Comment chaque fille a-t-elle fait aujourd'hui, et qu'est-ce que ça donne sur la saison ?",
    status: "actif",
    href: "/entraineur",
    objectives: ["P1.2", "P1.5"],
    kpis: ["appreciation_joueuses"],
    links: ["A03"],
    planned: [
      "En place : dans le portail entraîneur (étape « Après »), moins de 2 minutes par fille : photo, ball mastery, prestation, attitude (1 à 5) et une note d'au moins 30 caractères",
      "En place : note trop courte, répétitive, copiée d'une autre fille ou d'une séance précédente refusée avec un message clair ; copier-coller bloqué",
      "En place : routine de fin, chaque joueuse donne sa note de la pratique et sa fatigue sur 10 ; moyenne par semaine dans l'indicateur « Note des pratiques »",
      "En place : résumé de saison sur la fiche joueuse (moyennes, évolution début → dernières pratiques, sa note des pratiques) et dans le bulletin ; les notes restent internes (pas dans le bulletin des parents)",
      "À venir : résumé de saison rédigé pour les bulletins (agent suivi des familles A03, P1.2.10)"
    ],
    next: "P1.2.09 : les éducateurs remplissent l'évaluation après chaque pratique (31 déc.) ; P1.2.10 : résumé de saison pour les bulletins (31 mars)."
  },
  {
    slug: "matchs-joues",
    pillar: "P1",
    title: "Matchs : résultats, vidéos et analyse",
    question: "Contre qui a-t-on joué, qu'est-ce qui s'est passé, qui a joué, et combien ça a coûté ?",
    status: "actif",
    href: "/admin/matchs/resultats",
    objectives: ["P1.8", "P7.7"],
    planned: [
      "En place : « Nos matchs » (Coaching → Matchs) : chaque match en carte New Valkyria vs adversaire (pastilles ou logo), score, date, lieu ; bilan de saison V-N-D et buts ; matchs hors Académie (Saint-Gabriel…) à part",
      "En place : fiche du match : résumé, score, analyse (points forts, à corriger, actions), joueuses présentes et temps de jeu ; une plage vendue sans activité a le bouton « Créer l'activité du match » (convocations, chronomètre, évaluations) ; fiches à compléter dans Aujourd'hui",
      "En place : vidéo par lien (YouTube non répertorié, Veo, Drive) ou dépôt direct dans le stockage privé « match-videos » (lien signé de 2 h, Loi 25)",
      "En place : résumé d'après-match « à travailler en pratique » (panneau du match et fiche) : commentaires et analyse regroupés par thème, forces, à corriger, joueuses à surveiller, 3 priorités → bouton « Ajouter au thème de la semaine prochaine » ; « Leçons des derniers matchs » sur les 5 derniers",
      "En place : par joueuse : matchs joués, titularisations, minutes, notes, V-N-D (ex. combien de matchs Charlotte a joués), par saison",
      "Bilan financier : dans Équipe & partenaires → Arbitres et bilan (aucun montant dans l'espace Coaching)"
    ],
    next: "Après chaque match : score, résumé et commentaires des joueuses, puis « Ajouter au thème de la semaine prochaine ». P1.8.06 : déposer la vidéo et en faire l'analyse (31 mars)."
  },
  {
    slug: "portail-educateurs",
    pillar: "P1",
    title: "Portail des éducateurs",
    question: "En arrivant, l'éducateur sait-il exactement quoi faire, et ses rapports sont-ils complets ?",
    status: "actif",
    href: "/entraineur",
    objectives: ["P1.4", "P1.5", "P8.3"],
    kpis: ["appreciation_joueuses"],
    links: ["A02", "AU20"],
    planned: [
      "En place : pratique du jour (étape « Avant ») : thème de la semaine, horaire de chaque bloc, montage du terrain (selon le nombre de joueuses attendues), matériel, qui fait quoi, points clés, variantes, progressions, fiche et schéma de l'exercice",
      "En place : JP prépare ces champs bloc par bloc dans Équipe → Entraînements (bouton « Pratique du jour ») ; un champ vide reprend la fiche de l'exercice",
      "En place : présences en un geste (« Toutes présentes »), photos des joueuses, effectif réel de la plage horaire",
      "En place : contrôle de qualité : les heures comptent quand la présence de l'éducateur est confirmée et que présences et évaluations sont complètes",
      "En place : accès limités : seulement ses activités et les joueuses de ses groupes ; aucun prix, paiement, taux ni donnée des parents",
      "En place : gagnantes du jour dans le rapport (victoire, attitude) ; points comptés tout seuls (présence, victoire, attitude) et échangés contre des récompenses (Coaching → Joueuses → Points et récompenses)",
      "Note des exercices sur 10 dans le même rapport (banque d'exercices)"
    ],
    next: "Donner un identifiant à chaque éducateur (Équipe → Entraîneurs) et préparer la pratique du jour de chaque séance dans Pratiques."
  },
  { slug: "evaluations", pillar: "P1", title: "Événements d'évaluation", question: "Où sont les journées d'évaluation (essais, sélections) ?", status: "actif", href: "/admin/evaluations", objectives: ["P1.2"] },
  {
    slug: "valkyria-lab",
    pillar: "P1",
    title: "Valkyria Lab",
    question: "Est-ce que les filles travaillent à la maison, et est-ce que les parents voient les progrès ?",
    status: "partiel",
    href: "/admin/valkyria-lab",
    objectives: ["P1.7", "P4.3"],
    kpis: ["familles_video_lab", "familles_profil"],
    links: ["AU08", "AU07", "AU13", "A03"],
    planned: [
      "En place : routine maison du mois (consignes, gestes avec démonstration YouTube/Vimeo non répertoriée, défi du mois, jeu de la semaine), brouillon ou publiée",
      "En place : lien personnel de chaque famille (/lab/…), créé à partir des inscriptions payées, envoyé par courriel à une famille ou à toutes",
      "En place : « Envoyer ma vidéo » : dossier privé de la joueuse (Prénom-Nom_geste_AAAA-MM-JJ_maison), avis à JP, lecture par lien de 10 minutes, commentaire à la famille",
      "En place : mesure mensuelle familles_video_lab et vidéos à regarder dans Aujourd'hui",
      "Profil de l'enfant dans l'espace parent, publié par JP ou le coach-chef",
      "Bulletins et défi ball mastery mensuel"
    ],
    next: "P1.7.02 : écrire et publier la routine de novembre (démonstrations de P1.7.01), créer les liens puis les envoyer (Coaching → Valkyria Lab). Après un mois : sondage « Le Valkyria Lab, un mois plus tard » (P1.7.12)."
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
    status: "partiel",
    href: "/admin/entraineurs/suivi",
    objectives: ["P1.4"],
    planned: [
      "En place : briefing de 5 minutes en tête de chaque pratique dans le portail (filles à suivre, objectifs, essais, absentes, moment surprise prévu)",
      "En place : méthode et règle du coach dans le portail (page Méthode) ; rapports de chaque pratique dans Suivi des éducateurs",
      "En place : observation filmée de chaque coach chaque mois (Coaching → Éducateurs → Observations du mois) : grille de la règle du coach sur 10, points forts, à améliorer, focus du mois suivant, retour publié dans le portail de l'éducateur",
      "À venir : certification interne Valkyria (P1.4.02, critères à écrire par JP), réunion technique mensuelle (P1.4.04)",
      "Certifications des coachs (existe : fiches entraîneurs)"
    ],
    next: "P1.4.01 : faire le briefing de 5 minutes avant chaque séance (31 déc.) ; P1.4.03 : observer et filmer une séance par coach chaque mois."
  },

  // ── P2 Offres et prix ──
  { slug: "saison", pillar: "P2", title: "Offres et places de la saison", question: "Qu'est-ce qu'on vend, à quel prix, et combien de places restent ?", status: "actif", href: "/admin/saison", objectives: ["P2.1", "P2.4"] },
  { slug: "garcons", pillar: "P2", title: "Programmes garçons et Sport-Études", question: "Où sont les programmes garçons et le Sport-Études ?", status: "actif", href: "/admin/inscriptions-garcons", objectives: ["P2.4"] },
  {
    slug: "calculateur",
    pillar: "P2",
    title: "Calculateur de lancement (GO / NO-GO)",
    question: "Ce nouveau programme est-il rentable avant de le lancer ?",
    status: "actif",
    href: "/admin/revenus/calculateur",
    objectives: ["P2.5", "P7.2"],
    links: ["AU11", "A04"],
    planned: [
      "En place : coûts fixes (terrain à l'heure ou au contrat, éducateurs, matériel, assurance, marketing), coûts par participante (kit, frais Stripe 2,9 % + 0,30 $), places et prix",
      "En place : prix plancher, seuil de survie, seuil de 50 % de marge, marge à 70 % de remplissage et verdict GO, À RISQUE ou NO-GO",
      "En place : préremplissage depuis un programme existant, un contrat de terrain et le taux d'un éducateur ; scénarios enregistrés et comparés",
      "En place : alerte dans Aujourd'hui 2 semaines avant le début si les préventes sont sous le seuil de survie"
    ],
    next: "P7.2.01 : entrer les vrais coûts (gymnase de Prévost, taux et heures de Noura) puis P7.2.03 : passer chaque programme au calculateur avant sa mise en vente. P7.2.04 (15 déc.) : analyse complète de la ligue d'hiver (équipes, vrais coûts, revenus, avis des familles, autres ligues) et go/no-go au calculateur."
  },
  {
    slug: "boutique",
    pillar: "P2",
    title: "Boutique et matériel New Val",
    question: "Qu'est-ce qu'on vend en plus de la saison, avec quelle marge, et qu'est-ce qui fait acheter ?",
    status: "partiel",
    href: "/admin/boutique",
    objectives: ["P2.6", "P1.6"],
    links: ["A04"],
    planned: [
      "En place : boutique et uniformes (/admin/boutique, /admin/uniformes)",
      "Échantillons New Val (P2.6.04, 15 déc. 2026) : ballons, maillots, pastilles, buts rétractables, imperméables, chez 2 fournisseurs chacun",
      "Tester les échantillons, calculer la marge, mettre les modèles choisis en vente (P2.6.05, 31 janv. 2027)",
      "Offre boutique (P2.6.06, 31 janv. 2027) : rabais après un nombre d'achats, ensembles, et le prix de consolation (une fille qui n'a rien gagné reçoit un bon pour la boutique)",
      "Suivi mensuel des ventes par la gérante (P2.6.07)"
    ],
    next: "P2.6.04 : commander les échantillons chez 2 fournisseurs (inscrire chaque échantillon dans /admin/inventaire avec son prix)."
  },
  { slug: "paiements", pillar: "P2", title: "Paiements et versements", question: "Qui doit encore payer et quand ?", status: "actif", href: "/admin/revenus/paiements", objectives: ["P2.7"], links: ["AU04"] },

  // ── P3 Acquisition et marketing ──
  {
    slug: "reseaux",
    pillar: "P3",
    title: "Réseaux sociaux et publicité",
    question: "Est-ce que nos réseaux grandissent, et quel contenu amène des familles ?",
    status: "actif",
    href: "/admin/reseaux",
    objectives: ["P3.2", "P3.8"],
    kpis: ["videos_semaine", "cac", "source_connue"],
    links: ["A05", "A06"],
    planned: [
      "En place : abonnés d'Instagram, Facebook, YouTube et TikTok dans le temps (un relevé aux 2 semaines)",
      "En place : chaque publication suivie (réseau, type, thème, organique ou payant) avec ses vues, essais et inscriptions relevés 7 jours après",
      "En place : vidéos par semaine (cible 3, idéal 5) et indicateur videos_semaine (moyenne des 4 dernières semaines)",
      "En place : meilleurs contenus par vues et par essais, comparaison par thème, par type et par réseau, coût par essai et par inscription de la pub",
      "Plus tard : l'agent statistiques (A06) remplit ces chiffres seul",
      "En place (11 nov. 2026) : Mes tournages (/admin/moi/tournages, Espace JP) : la vidéo du lendemain planifiée la veille, idée → planifiée → tournée → montée → publiée, 21 idées déjà prêtes",
      "Vidéos explicatives pour les parents (P3.2.12 à P3.2.17) : qui est New Valkyria, nos programmes, nos projets, preuves et témoignages, puis la page « Découvrir New Valkyria » pour le 15 janv. 2027",
      "En place (13 nov. 2026) : l'espace Création de contenu (/admin/contenu) : quotas de la personne caméra, calendrier de publication (organique, reel d'essai, pub, angle), tournages, ball mastery filmé à 360° à chaque pratique, photos des joueuses aux matchs",
      "Plus tard (P3.2.21) : Instagram, Facebook et YouTube reliés pour que la portée arrive toute seule"
    ],
    next: "P3.2.12 : écrire avec la gérante la liste des vidéos explicatives (30 nov.), puis tourner les 4 vidéos « Qui est New Valkyria » (P3.2.13, 20 déc.) depuis Mes tournages."
  },
  { slug: "parrainage", pillar: "P3", title: "Parrainage et codes de référence", question: "Qui nous amène des familles ?", status: "actif", href: "/admin/references", objectives: ["P3.1"] },
  { slug: "essais", pillar: "P3", title: "Essais gratuits", question: "Qui vient essayer et quand ?", status: "actif", href: "/admin/essais-dates", objectives: ["P2.2", "P3.3"] },
  {
    slug: "sources",
    pillar: "P3",
    title: "Sources d'acquisition et liste chaude",
    question: "D'où viennent nos familles, et qui attend une place ?",
    status: "actif",
    href: "/admin/acquisition",
    objectives: ["P3.6", "P3.8", "P3.1", "P6.1"],
    kpis: ["source_connue", "nouvelles_joueuses_an"],
    links: ["AU05", "A01"],
    planned: [
      "En place (6 nov. 2026) : « Comment nous avez-vous connus ? » obligatoire et « Avez-vous une entreprise ? » dans tous les formulaires d'inscription et d'essai",
      "En place : tableau par canal (inscriptions, essais, conversion), codes de référence utilisés, familles avec une entreprise, familles sans source",
      "À venir : liste chaude (familles intéressées, à relancer à l'ouverture des inscriptions) et coût par inscription de chaque canal"
    ],
    next: "Compléter la source des familles déjà inscrites (liste « sans source » de /admin/acquisition) et ajouter les entreprises déclarées au suivi des commanditaires."
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
    planned: ["Parcours de bienvenue (courriel, vidéo de JP, kit)", "5 vidéos « nouveaux parents » envoyées automatiquement après le paiement (P4.1.06) : après l'inscription, l'encadrement, communiquer avec l'équipe, suivre la progression, la saison", "Anniversaires des joueuses", "Moments vedettes de la saison"],
    next: "P4.1.06 (31 mars 2027) : tourner les 5 vidéos nouveaux parents (idées prêtes dans Mes tournages), puis les brancher au courriel de confirmation."
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
  { slug: "inventaire", pillar: "P7", title: "Inventaire du matériel", question: "Quel matériel avons-nous, où, et quoi remplacer ?", status: "actif", href: "/admin/inventaire", objectives: ["P7.6"], links: ["A09"] },
  { slug: "registre-contrats", pillar: "P7", title: "Échéances des contrats", question: "Quelles échéances de contrats s'en viennent ?", status: "actif", href: "/admin/registre-contrats", objectives: ["P7.6"], links: ["AU10"] },
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
    status: "actif",
    href: "/admin/entraineurs/paie",
    objectives: ["P8.3"],
    links: ["AU20", "A10"],
    planned: [
      "En place : l'éducateur confirme sa présence et ses heures réelles à la fin de chaque activité (portail entraîneur)",
      "En place : heures × taux = paie ; les heures restent « retenues » tant que la présence ou le rapport manque",
      "En place : relance par courriel 24 h après l'activité (2 vérifications par jour), une seule fois par activité",
      "En place : liste « Avant de payer » dans Paie et section « Présences des éducateurs » dans Aujourd'hui (éducateur sans courriel : à appeler)"
    ],
    next: "Ajouter le courriel de chaque éducateur dans sa fiche pour que la relance parte toute seule."
  },
  {
    slug: "structure",
    pillar: "P8",
    title: "Structure et recrutement",
    question: "Qui travaille avec nous, avec quels diplômes, et qui dois-je recruter pour la prochaine saison ?",
    status: "actif",
    href: "/admin/structure",
    objectives: ["P8.2", "P8.3"],
    links: ["AU23", "A10"],
    planned: [
      "En place : organigramme (JP, Annie, Christine, éducateurs des fiches entraîneurs et des contrats, arbitres actifs, consultants et postes à venir), sans doublon",
      "En place : pour chacun, statut, diplômes, certifications (expirées ou à moins de 60 jours signalées, antécédents et sport sécuritaire exigés sur le terrain), contrat, taux et assignations des 30 prochains jours",
      "En place : plan de recrutement calculé avec les vrais groupes (1 adulte pour 10 joueuses, 2 adultes minimum par séance) contre l'équipe prévue chaque jour, postes à combler éditables et scénario « Et si j'ajoute des groupes ? » avec la marge",
      "En place : suivi des candidats par étape (annonce, candidat, entrevue, antécédents, formation, contrat signé, refusé) ; une certification qui expire dans 30 jours apparaît dans Aujourd'hui"
    ],
    next: "P8.2.06 : JP précise les jours de chacun (Modifier la fiche) et ouvre le poste calculé pour l'hiver 2027 (31 janv.)."
  },
  { slug: "equipe", pillar: "P8", title: "Équipe et coachs", question: "Qui travaille avec nous ?", status: "actif", href: "/admin/entraineurs", objectives: ["P8.2", "P8.3"] },
  { slug: "contrats", pillar: "P8", title: "Contrats d'embauche", question: "Qui a signé ?", status: "actif", href: "/admin/contrats", objectives: ["P8.3"] },
  {
    slug: "entrevues",
    pillar: "P8",
    title: "Projet entrevues avant/après",
    question: "Combien de filles ont leur entrevue de début et de fin de saison ?",
    status: "partiel",
    href: "/admin/contenu/entrevues",
    objectives: ["P8.1"],
    kpis: ["entrevues_saison"],
    planned: [
      "En place (13 nov. 2026) : journées d'entrevues, choix des filles, invitation aux familles avec un lien personnel pour choisir l'heure, suivi invitée → heure choisie → filmée → montée → publiée, guide de questions (joueuse début et fin, parent)",
      "Entrevue de début et de fin filmées",
      "Montage avant/après pour le marketing (P3.2)"
    ],
    next: "P8.1.04 : ouvrir les journées d'entrevues dès la semaine du 21 nov. et envoyer les invitations ; 30 filles d'ici la fin de la saison."
  }
];

export const modulesForPillar = (code: string) => PILLAR_MODULES.filter((m) => m.pillar === code);
export const moduleHref = (m: PillarModule) => m.href ?? `/admin/mandalart/piliers/${m.pillar.toLowerCase()}/${m.slug}`;

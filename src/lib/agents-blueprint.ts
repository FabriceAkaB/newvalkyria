/** Cahier de charges des agents (demande de JP, 4 nov. 2026) : pour automatiser l'académie au maximum, chaque tâche
 *  répétitive est rangée dans la case d'UN agent, avec ce qui la déclenche, qui valide, ce qui existe déjà dans le site
 *  et ce qui reste à construire ; chaque agent reçoit ses accès exacts (tables lues, écrites, interdites), les fonctions
 *  du site qu'il a le droit d'appeler et les clés dont il a besoin (noms seulement, jamais les valeurs).
 *
 *  Le rôle, le niveau et les tâches du plan restent dans `data/mandalart.json` (section 5 du dossier) ; ce fichier les
 *  complète par agent (mêmes identifiants A01 à A12). `agentCan()` servira de garde d'accès quand on construira les agents.
 *  Le test `agents-blueprint.test.ts` vérifie que chaque table et chaque fonction citées existent vraiment. */

export type AgentId = "A01" | "A02" | "A03" | "A04" | "A05" | "A06" | "A07" | "A08" | "A09" | "A10" | "A11" | "A12";

/** Comment la mission tourne une fois mûre : règle fixe du site (sans IA), brouillon de l'IA validé par un humain,
 *  ou IA qui agit seule dans des règles écrites (après 4 semaines sans erreur en brouillon). */
export type MissionMode = "regle" | "brouillon" | "autonome";
/** Où on en est dans le site. */
export type MissionState = "existe" | "partiel" | "a_construire";

export interface Mission {
  title: string;
  /** Quand elle se déclenche. */
  when: string;
  mode: MissionMode;
  state: MissionState;
  /** Qui valide (null = personne, règle fixe ou lecture seule). */
  validation: string | null;
  /** Ce qui existe déjà dans le site (module, page, cron). */
  existing?: string;
  /** Ce qui reste à construire pour qu'elle tourne seule. */
  missing?: string;
  /** Automatisation du plan liée (AU..). */
  automation?: string;
}

export interface AgentTool {
  /** Fichier de `src/lib` (sans .ts). */
  module: string;
  fn: string;
  why: string;
}

export interface AgentBlueprint {
  id: AgentId;
  /** Domaine couvert, en une phrase : ce qui rentre dans sa case. */
  scope: string;
  missions: Mission[];
  reads: string[];
  writes: string[];
  /** Tables qu'il ne doit jamais lire. */
  forbidden: string[];
  tools: AgentTool[];
  /** Canaux par lesquels il agit (courriel info@, robot MonClubSportif, Stripe en lecture…). */
  channels: string[];
  /** Variables d'environnement ou réglages chiffrés nécessaires (noms seulement). */
  secrets: string[];
  /** Documents qu'il doit connaître (sa « nourriture ») : règles, modèles, méthode. */
  knowledge: string[];
}

/** Ce que tous les agents partagent, à construire une seule fois avant le premier agent. */
export const AGENT_FOUNDATION: { title: string; state: MissionState; detail: string }[] = [
  { title: "Clé de l'IA enregistrée dans l'admin", state: "a_construire", detail: "ANTHROPIC_API_KEY saisie par JP dans un formulaire de l'admin et chiffrée dans app_settings (comme le compte robot MonClubSportif), sans ouvrir Vercel. Appels à l'IA côté serveur seulement." },
  { title: "Boîte de brouillons des agents", state: "a_construire", detail: "Table agent_drafts (agent, type, destinataire, sujet, texte, données liées, statut à valider / envoyé / rejeté, validé par) et un écran /admin/agents où JP corrige et envoie en un geste. Mode assistant de tous les agents." },
  { title: "Journal de chaque action", state: "partiel", detail: "audit_log existe (logAudit) : chaque action d'agent y est notée avec l'agent comme auteur, les données touchées et l'humain qui a validé." },
  { title: "Moteur des agents", state: "a_construire", detail: "Un cron /api/cron/agents qui réveille chaque agent selon ses déclencheurs, lui donne seulement ses tables et ses fonctions (agentCan), et dépose ses brouillons. Un agent à la fois, en commençant par A01." },
  { title: "Accès par agent", state: "a_construire", detail: "agentCan(agent, table, lecture/écriture) vérifié avant chaque lecture ou écriture ; une table interdite n'est jamais servie, même si l'IA la demande." }
];

const MAIL: AgentTool = { module: "resend", fn: "getResendClient", why: "Envoyer depuis info@newvalkyria.com (signature d'Annie ajoutée toute seule)." };
const AUDIT: AgentTool = { module: "audit-repo", fn: "logAudit", why: "Noter chaque action dans le journal." };

export const AGENT_BLUEPRINTS: AgentBlueprint[] = [
  {
    id: "A01",
    scope: "Tout l'administratif des familles, tous programmes confondus (saison filles, garçons privés, Sport-Études, essais) : inscriptions, paiements, relances, questions, annonces.",
    missions: [
      { title: "Répondre aux courriels des parents dans le même fil", when: "Courriel reçu sur info@ (vérifié toutes les heures)", mode: "brouillon", state: "partiel", validation: "JP ou Annie (envoi) ; argent, plainte, santé : JP", existing: "Lecture de la boîte en IMAP (skill boite-courriels), réponse dans le fil avec In-Reply-To", missing: "Relève automatique de la boîte et brouillons dans la boîte des agents", automation: "AU16" },
      { title: "Alerte : question d'un parent sans réponse depuis 20 h", when: "Toutes les heures", mode: "regle", state: "a_construire", validation: null, missing: "Lecture de la boîte + tâche dans Aujourd'hui", automation: "AU16" },
      { title: "Bienvenue et confirmation après une inscription payée", when: "Paiement Stripe reçu (webhook)", mode: "regle", state: "existe", validation: null, existing: "sendConfirmationEmail, sendPrivateProgramConfirmationEmail, avis à JP (sendPaidRegistrationNotification)", missing: "Vidéo de bienvenue de JP dans le courriel" },
      { title: "Confirmer un essai, rappel la veille, offre de conversion après l'essai", when: "Essai réservé ; veille de l'essai ; 1 et 3 jours après", mode: "brouillon", state: "partiel", validation: "JP pour le prix ou la bourse", existing: "sendSeasonTrialConfirmationEmail, sendBoysTrialConfirmationEmail, lien trial-conversion (paiement en plusieurs versements)", missing: "Rappel de la veille et suite de relances après l'essai" },
      { title: "Versements échelonnés : prélever, reçu, échec, relances 1-7-14 jours, signalement à 30 jours", when: "Chaque jour à 4 h", mode: "regle", state: "partiel", validation: "JP pour une entente de paiement", existing: "Cron charge-installments, sendInstallmentReceiptEmail, sendPaymentPlanFailedEmail, lien installment-retry", missing: "Relances à 7 et 14 jours et signalement à 30 jours", automation: "AU04" },
      { title: "Inscriptions commencées mais non payées : renvoyer le lien de paiement", when: "48 h après l'inscription, puis 7 jours", mode: "brouillon", state: "a_construire", validation: "JP voit la liste avant l'envoi", missing: "Liste des inscriptions « en attente » sans paiement et relance" },
      { title: "Relances et offres aux familles non inscrites (avec vérification par nom)", when: "Période d'inscription ; place libérée ; demande de JP", mode: "brouillon", state: "partiel", validation: "JP approuve la liste et l'offre", existing: "Offres spéciales /offre/[token], journal outreach_log, skill relance", missing: "Proposition automatique de la liste chaude" },
      { title: "Liste d'attente : offrir la place libérée à la suivante", when: "Annulation ou place ajoutée dans un groupe", mode: "brouillon", state: "a_construire", validation: "JP", existing: "sendWaitlistConfirmationEmail, capacité par groupe (max_places)", missing: "Détection de la place libérée et offre à la première de la liste" },
      { title: "Dossier d'inscription incomplet : demander les infos manquantes", when: "Inscription payée avec champs manquants", mode: "regle", state: "existe", validation: null, existing: "registration_completions, sendRegistrationCompletionRequestEmail" },
      { title: "Annonces et rappels aux familles d'un groupe ou d'un programme", when: "Demande de JP ; changement d'horaire ; matchs ajoutés", mode: "brouillon", state: "partiel", validation: "JP voit le texte et la liste avant un envoi de masse", existing: "resolveAudience, logCommunication, skill courriel-familles" },
      { title: "Parrainage « Amène ton amie » et remerciements", when: "7 jours avant chaque séance amie ; inscription d'une amie référée", mode: "regle", state: "partiel", validation: null, existing: "Codes de parrainage, crédits famille, campagne de parrainage", missing: "Envoi automatique 7 jours avant", automation: "AU09" },
      { title: "Réinscription : ouvrir l'avantage fidèle 4 semaines avant la fin de saison", when: "4 semaines avant la fin de chaque saison", mode: "brouillon", state: "a_construire", validation: "JP approuve l'offre", automation: "AU09" },
      { title: "Remboursement ou annulation demandée", when: "Demande d'un parent", mode: "brouillon", state: "partiel", validation: "JP, toujours (argent réel)", existing: "Skill paiement (Stripe live), annulation dans l'admin", missing: "Dossier prêt à approuver (qui, combien, pourquoi)" }
    ],
    reads: ["registrations", "programs", "birth_categories", "time_slot_templates", "seasons", "registration_payment_plans", "registration_payment_plan_installments", "registration_completions", "session_programs", "session_program_registrations", "session_program_payment_plans", "sport_etudes_registrations", "boys_trials", "trial_slots", "leads", "special_offers", "outreach_log", "communications", "referral_codes", "family_credit_ledger", "shop_orders"],
    writes: ["outreach_log", "communications", "special_offers", "registration_completions", "referral_codes", "audit_log"],
    forbidden: ["lab_submissions", "player_evaluations", "coach_sessions", "employee_contracts", "revenue_expenses", "staff_members"],
    tools: [MAIL, AUDIT, { module: "outreach", fn: "logOutreach", why: "Une ligne par joueuse pour chaque relance, offre, réponse ou excuse." }, { module: "communications-repo", fn: "resolveAudience", why: "Trouver les familles d'un groupe ou d'un programme." }, { module: "communications-repo", fn: "logCommunication", why: "Garder l'historique des annonces." }, { module: "special-offers", fn: "fullGroupsForOffer", why: "Ne jamais offrir une place dans un groupe complet." }, { module: "season-admin-repo", fn: "getDueInstallments", why: "Versements à prélever ou en retard." }, { module: "season-admin-repo", fn: "searchRegistrations", why: "Vérifier par nom qu'une joueuse n'est pas déjà inscrite." }, { module: "referrals-repo", fn: "getOrCreateReferralCode", why: "Lien personnel de parrainage." }, { module: "payment-plan", fn: "parsePlanSchedule", why: "Lire un calendrier de versements." }],
    channels: ["Courriel info@newvalkyria.com (Gmail)", "Liens de paiement Stripe (création par JP ou validation)", "Christine en copie des annonces"],
    secrets: ["Réglage chiffré email_settings (Gmail)", "STRIPE_LIVE_SYNC_KEY (lecture et liens validés)", "ANTHROPIC_API_KEY"],
    knowledge: ["FAQ des familles (à écrire)", "Politique d'annulation et de remboursement (P7.1)", "Prix et programmes de la saison (season-2027.ts)", "Modèles de messages approuvés par JP", "Règles de relance (vérifier la joueuse par nom et courriel)"]
  },
  {
    id: "A02",
    scope: "La préparation et le suivi des pratiques : plan annuel PSG, thème de la semaine, banque d'exercices, diapos, sondage de fin, bilan de la semaine.",
    missions: [
      { title: "Préparer chaque pratique 48 h d'avance selon le plan PSG et le thème de la semaine", when: "48 h avant chaque pratique (cron 2 fois par jour)", mode: "brouillon", state: "partiel", validation: "JP approuve la pratique ; le coach peut l'ajuster", existing: "Cron pratiques (vert, jaune, rouge), thèmes de la saison, skill pratique-diapos", missing: "Composition automatique à partir de la banque d'exercices", automation: "AU21" },
      { title: "Monter les diapos de la pratique et la décomposer en blocs dans le site", when: "Pratique approuvée", mode: "brouillon", state: "partiel", validation: "JP", existing: "Diapos claude.ai (skill pratique-diapos), blocs activity_session_blocks, lien deck_url" },
      { title: "Adapter aux groupes multi-âges, au nombre de joueuses et au terrain", when: "Présences connues le jour même", mode: "brouillon", state: "a_construire", validation: "Coach sur le terrain" },
      { title: "Noter les exercices utilisés et recalculer leur statut dans la banque", when: "Rapport du coach après la séance", mode: "regle", state: "existe", validation: "Approbation : 2 éducateurs ≥ 8 et JP", existing: "exercise_ratings, statut calculé (exercise-bank.ts)", automation: "AU06" },
      { title: "Sondage de fin : présence, plaisir, fatigue, envies ; tendance de la semaine", when: "Après chaque pratique ; résumé le lundi", mode: "regle", state: "partiel", validation: null, existing: "Sondage /admin/sondage, getSurveyTrend", missing: "Résumé hebdomadaire envoyé à JP" },
      { title: "Historique : pratiques non déposées, analyse, note de pertinence du thème (≥ 8 : galerie)", when: "Chaque jour", mode: "regle", state: "existe", validation: "JP note sur 10", existing: "Historique des pratiques, section Aujourd'hui" },
      { title: "Bilan de la semaine (3 questions) prérempli avec les données", when: "Chaque lundi", mode: "brouillon", state: "partiel", validation: "JP répond", existing: "weekly_reviews, rappel du lundi", missing: "Pistes de réponse tirées des sondages et des rapports" }
    ],
    reads: ["season_themes", "exercises", "exercise_ratings", "coach_activities", "activity_session_blocks", "activity_player_attendance", "coach_assignments", "coaching_method_docs", "method_gestures", "weekly_reviews"],
    writes: ["coach_activities", "activity_session_blocks", "exercises", "weekly_reviews", "audit_log"],
    forbidden: ["registrations", "registration_payment_plans", "revenue_income", "revenue_expenses", "coach_sessions", "lab_submissions"],
    tools: [AUDIT, { module: "practices-repo", fn: "listPractices", why: "Pratiques à venir et leur état de préparation." }, { module: "exercises-repo", fn: "getExercisesForPlanning", why: "Exercices approuvés utilisables cette semaine." }, { module: "exercises-repo", fn: "assertExerciseUsable", why: "Refuser un exercice « à changer » ou déjà utilisé la même semaine." }, { module: "season-themes-repo", fn: "getThemeForDate", why: "Thème PSG de la semaine." }, { module: "coaching-method-repo", fn: "getComponents", why: "Composantes obligatoires de chaque pratique." }, { module: "practice-survey-repo", fn: "getSurveyTrend", why: "Plaisir et fatigue des dernières pratiques." }, { module: "practice-history-repo", fn: "depositPractice", why: "Déposer la pratique faite (diapos, analyse)." }],
    channels: ["Diapos claude.ai (type Slides)", "Portail des éducateurs"],
    secrets: ["ANTHROPIC_API_KEY"],
    knowledge: ["Planification annuelle PSG (psg-planification.md)", "Méthode Valkyria : structure, principes, composantes obligatoires", "Règle des groupes multi-âges", "Pratique modèle « Jouer entre les lignes » (2 novembre)"]
  },
  {
    id: "A03",
    scope: "La progression de chaque joueuse et ce que la famille en voit : évaluations, points et niveaux, Valkyria Lab, présence, photos, bulletins, sondages.",
    missions: [
      { title: "Rapport mensuel par joueuse : forces, une correction, prochain défi", when: "Fin de chaque mois", mode: "brouillon", state: "a_construire", validation: "Le coach valide ; JP publie", existing: "Évaluations rapides, objectifs, routines, bulletin (getBulletinData)", automation: "AU07" },
      { title: "Valkyria Lab : vidéo reçue, coach avisé, retour au parent", when: "Le parent envoie la vidéo du défi", mode: "brouillon", state: "partiel", validation: "Le coach commente", existing: "Valkyria Lab (envoi, dossier privé, commentaire)", automation: "AU08" },
      { title: "Alerte de présence : 2 absences de suite ou baisse de séances", when: "Chaque jour", mode: "regle", state: "a_construire", validation: null, missing: "Tâche « appeler la famille sous 48 h » dans Aujourd'hui", automation: "AU03" },
      { title: "Points, niveaux et récompenses de chaque joueuse", when: "Présence ou victoire notée", mode: "regle", state: "existe", validation: null, existing: "player_points, niveaux Recrue à Légende, récompenses au seuil" },
      { title: "Photo de chaque joueuse (avec consentement)", when: "Jour de pratique", mode: "regle", state: "existe", validation: null, existing: "Tâche « photos à prendre » dans Aujourd'hui, consentement à l'image" },
      { title: "Message hebdomadaire aux parents par groupe : thème, défi maison, lien du Lab", when: "Chaque dimanche à 17 h (approuvé le vendredi)", mode: "brouillon", state: "a_construire", validation: "JP ou le coordonnateur", automation: "AU13" },
      { title: "Anniversaires : rappel 7 jours avant", when: "Chaque jour", mode: "regle", state: "a_construire", validation: null, automation: "AU12" },
      { title: "Voix des familles : sondages, familles à rappeler", when: "Sondage envoyé ; réponses reçues", mode: "brouillon", state: "partiel", validation: "JP", existing: "Sondages /admin/sondages, getFamiliesToCall", automation: "AU17" },
      { title: "Liste des familles à appeler pour la réinscription", when: "4 semaines avant la fin de saison", mode: "brouillon", state: "a_construire", validation: "JP" }
    ],
    reads: ["players", "player_evaluations", "player_objectives", "player_routines", "player_points", "point_rewards", "skill_tests", "skill_test_results", "activity_player_attendance", "lab_submissions", "lab_routines", "lab_access", "surveys", "survey_responses", "registrations"],
    writes: ["player_objectives", "player_routines", "lab_routines", "surveys", "survey_invites", "audit_log"],
    forbidden: ["revenue_income", "revenue_expenses", "coach_sessions", "employee_contracts", "registration_payment_plans"],
    tools: [MAIL, AUDIT, { module: "coach-portal-repo", fn: "getBulletinData", why: "Données du bulletin d'une joueuse." }, { module: "coach-portal-repo", fn: "getPlayerAttendanceHistory", why: "Repérer les absences." }, { module: "player-points-repo", fn: "getPointsSummaries", why: "Niveau et points de chaque joueuse." }, { module: "valkyria-lab", fn: "listSubmissions", why: "Vidéos du Lab à regarder." }, { module: "surveys-repo", fn: "getFamiliesToCall", why: "Familles qui demandent un appel." }],
    channels: ["Courriel aux parents (après validation)", "Espace parent /compte"],
    secrets: ["ANTHROPIC_API_KEY"],
    knowledge: ["Standards de progression (P1.2)", "Gestes de la méthode", "Loi 25 : vidéos et photos privées, consentement à l'image"]
  },
  {
    id: "A04",
    scope: "L'argent : encaissements, dépenses à payer, rapprochement Stripe, marges par programme et par match, contrats, inventaire, paie à préparer, verdict GO ou NO-GO.",
    missions: [
      { title: "Rapprochement de la semaine : Stripe contre les revenus du site", when: "Chaque lundi", mode: "regle", state: "partiel", validation: "JP ; le CPA pour les chiffres officiels", existing: "Skill fin-de-mois, module Revenus", automation: "AU18" },
      { title: "Solde Stripe et remboursements en attente faute de fonds", when: "Chaque jour", mode: "regle", state: "a_construire", validation: null, missing: "Alerte dans Aujourd'hui (ex. remboursement bloqué par un solde négatif)" },
      { title: "Dépenses à payer : arbitres, terrains (Rosemère), fournisseurs", when: "7 jours avant chaque échéance", mode: "regle", state: "partiel", validation: "JP paie", existing: "revenue_expenses « à payer », getRefereesToPay, tâches Mandalart à date fixe" },
      { title: "Bilan de chaque match et de chaque programme (prévu contre réel, marge < 35 %)", when: "Match passé ; fin de session", mode: "regle", state: "partiel", validation: null, existing: "matchFinance, historique et marges (academy-history)" },
      { title: "Calculateur GO ou NO-GO avant tout nouveau programme", when: "Nouveau programme ou idée de revenu", mode: "brouillon", state: "existe", validation: "JP décide", existing: "Calculateur de lancement /admin/revenus/calculateur", automation: "AU11" },
      { title: "Échéances des contrats (terrains, assurances, commandites)", when: "Chaque lundi ; 90 jours avant l'échéance", mode: "regle", state: "partiel", validation: "JP", existing: "Registre des contrats, alertes", automation: "AU10" },
      { title: "Inventaire : matériel à remplacer et fonds de remplacement", when: "Chaque mois", mode: "regle", state: "existe", validation: "JP achète", existing: "Inventaire /admin/inventaire, alertes" },
      { title: "Paie des éducateurs : heures retenues, rapports manquants, fichier prêt", when: "Avant chaque paie", mode: "regle", state: "partiel", validation: "JP paie", existing: "coach-payroll-data, export de paie" },
      { title: "Fin de mois : bilan et dossier pour le comptable", when: "Début de chaque mois", mode: "brouillon", state: "partiel", validation: "JP, puis le CPA", existing: "Skill fin-de-mois, export des revenus" }
    ],
    reads: ["revenue_income", "revenue_expenses", "revenue_budgets", "revenue_goals", "revenue_monthly_goals", "revenue_settings", "registration_payment_plans", "registration_payment_plan_installments", "stripe_events", "venue_rentals", "contract_registry", "inventory_items", "launch_scenarios", "match_slots", "match_slot_bookings", "referee_assignments", "coach_sessions", "coach_type_rates", "sponsor_payments"],
    writes: ["revenue_expenses", "revenue_income", "launch_scenarios", "contract_registry", "inventory_items", "audit_log"],
    forbidden: ["player_evaluations", "lab_submissions", "players", "survey_responses", "employee_contracts"],
    tools: [AUDIT, { module: "stripe", fn: "getStripeClient", why: "Lecture du solde, des paiements et des versements (clé restreinte live)." }, { module: "revenue-repo", fn: "getRevenueExpenses", why: "Dépenses et échéances." }, { module: "revenue-repo", fn: "getIncomeEntries", why: "Revenus saisis." }, { module: "referees-repo", fn: "matchFinance", why: "Bilan d'un match." }, { module: "launch-calculator", fn: "computeLaunch", why: "Verdict GO ou NO-GO." }, { module: "contracts-registry", fn: "getContractAlerts", why: "Contrats qui arrivent à échéance." }, { module: "inventory-repo", fn: "getInventoryAlerts", why: "Matériel à remplacer." }, { module: "coach-payroll-data", fn: "missingBeforePayroll", why: "Ce qui bloque la paie." }],
    channels: ["Rapport à JP (courriel du lundi, Aujourd'hui)"],
    secrets: ["STRIPE_LIVE_SYNC_KEY (lecture seulement, jamais de paiement)", "ANTHROPIC_API_KEY"],
    knowledge: ["Vrais coûts (terrains, coachs, matériel)", "Règle des 35 % de marge", "Trajectoire 1,5 M$ (section 3 bis du plan)"]
  },
  {
    id: "A05",
    scope: "Le contenu et l'image : quoi filmer, quand, avec quelles joueuses (consentement), quoi publier.",
    missions: [
      { title: "Plan de captation de la semaine : pratiques, matchs, événements", when: "Chaque dimanche", mode: "brouillon", state: "a_construire", validation: "JP approuve", existing: "Calendrier du mois (pratiques et matchs MonClubSportif)" },
      { title: "Brouillons de publications et de légendes", when: "Vidéo ou photo prête", mode: "brouillon", state: "partiel", validation: "JP publie", existing: "Publications et réseaux /admin/reseaux (marketing_posts)" },
      { title: "Vérifier le consentement à l'image avant toute publication d'une joueuse", when: "Avant chaque publication", mode: "regle", state: "partiel", validation: null, existing: "players.image_consent" },
      { title: "Projet entrevues avant/après et études des meilleurs clubs", when: "Chaque mois", mode: "brouillon", state: "a_construire", validation: "JP" }
    ],
    reads: ["coach_activities", "mcs_events", "match_slots", "marketing_posts", "marketing_channel_stats", "players"],
    writes: ["marketing_posts", "audit_log"],
    forbidden: ["registrations", "registration_payment_plans", "revenue_income", "lab_submissions", "player_evaluations"],
    tools: [AUDIT, { module: "marketing-posts", fn: "listPosts", why: "Publications prévues et faites." }, { module: "marketing-posts", fn: "addPost", why: "Déposer un brouillon de publication." }, { module: "mcs-teams-repo", fn: "getEventsBetween", why: "Matchs et événements à filmer." }],
    channels: ["Réseaux sociaux (publication par JP)"],
    secrets: ["ANTHROPIC_API_KEY"],
    knowledge: ["Voix et image de marque Valkyria", "Loi 25 : aucun nom d'enfant sans consentement écrit"]
  },
  {
    id: "A06",
    scope: "Les chiffres d'acquisition : d'où viennent les essais et les inscriptions, ce que coûte une inscription par canal.",
    missions: [
      { title: "Source d'acquisition de chaque inscription et essai", when: "Chaque formulaire", mode: "regle", state: "existe", validation: null, existing: "Champ source obligatoire (acquisition)", automation: "AU05" },
      { title: "Rapport du lundi : essais, inscriptions et coût par canal", when: "Chaque lundi", mode: "regle", state: "partiel", validation: null, existing: "getAcquisitionStats, statistiques des canaux", automation: "AU14" },
      { title: "Indicateurs du Mandalart mis à jour", when: "Chaque lundi", mode: "regle", state: "partiel", validation: null, existing: "computeKpis, mandalart_kpi_values" }
    ],
    reads: ["registrations", "leads", "marketing_channel_stats", "marketing_posts", "mandalart_kpi_values"],
    writes: ["mandalart_kpi_values", "marketing_channel_stats", "audit_log"],
    forbidden: ["players", "player_evaluations", "lab_submissions", "registration_payment_plans"],
    tools: [AUDIT, { module: "acquisition", fn: "getAcquisitionStats", why: "Inscriptions et essais par source." }, { module: "mandalart-kpis", fn: "computeKpis", why: "Indicateurs du plan." }, { module: "marketing-stats", fn: "getChannelStats", why: "Abonnés et portée par canal." }],
    channels: ["Rapport à JP et à l'agent marketing"],
    secrets: [],
    knowledge: ["Liste des canaux et des sources", "Aucune donnée nominative d'enfant dans les rapports"]
  },
  {
    id: "A07",
    scope: "La veille : offres et prix des autres académies, nouvelles idées de revenus.",
    missions: [
      { title: "Rapport mensuel des offres et prix observés", when: "Une fois par mois", mode: "brouillon", state: "a_construire", validation: "JP" },
      { title: "Chaque idée de revenu passée au calculateur", when: "Idée retenue par JP", mode: "brouillon", state: "a_construire", validation: "JP", existing: "Calculateur de lancement" }
    ],
    reads: ["launch_scenarios"],
    writes: ["launch_scenarios", "audit_log"],
    forbidden: ["registrations", "players", "revenue_income", "revenue_expenses"],
    tools: [AUDIT, { module: "launch-calculator", fn: "computeLaunch", why: "Premier calcul d'une idée." }],
    channels: ["Web public seulement"],
    secrets: ["ANTHROPIC_API_KEY"],
    knowledge: ["Échelle d'offres (P2.4)", "Prix actuels de la saison"]
  },
  {
    id: "A08",
    scope: "Les partenaires externes : commanditaires, subventions, écoles, et les clubs à qui on vend des matchs.",
    missions: [
      { title: "Prospection des commanditaires : 100 contacts par mois en période de vente", when: "Avril à août", mode: "brouillon", state: "partiel", validation: "JP présente et signe", existing: "Commandites 2027, offres de partenariat /partenariat/[token]" },
      { title: "Rapport aux commanditaires aux 3 à 4 mois", when: "Fin automne, fin hiver, fin été", mode: "brouillon", state: "a_construire", validation: "JP", automation: "AU15" },
      { title: "Vendre les plages de match libres aux clubs : relance avec le lien de paiement direct", when: "Plage libre à 3 semaines ou moins du match", mode: "brouillon", state: "partiel", validation: "JP approuve la liste des clubs", existing: "Clubs inscrits (match_team_profiles), liens de paiement direct par plage", missing: "Liste des clubs à relancer et brouillons" },
      { title: "Approuver ou refuser les demandes de match hors catégorie", when: "Demande reçue", mode: "brouillon", state: "existe", validation: "JP", existing: "Demandes de match dans l'admin, courriel de décision" },
      { title: "Subventions et écoles (parascolaire) : échéances et dossiers", when: "Échéance d'une demande", mode: "brouillon", state: "a_construire", validation: "JP" }
    ],
    reads: ["sponsors", "sponsor_slots_2027", "sponsor_payments", "partnership_offers", "partnership_offer_options", "match_team_profiles", "match_slots", "match_slot_bookings", "match_slot_requests", "contract_registry"],
    writes: ["sponsors", "partnership_offers", "match_slot_requests", "outreach_log", "audit_log"],
    forbidden: ["players", "registrations", "player_evaluations", "lab_submissions"],
    tools: [MAIL, AUDIT, { module: "match-links", fn: "matchLinks", why: "Lien de paiement direct d'une plage." }, { module: "match-slots-repo", fn: "getSlotsWithAvailability", why: "Plages libres à vendre." }, { module: "match-slots-repo", fn: "getAllTeamProfiles", why: "Clubs déjà connus." }, { module: "sponsors-repo", fn: "getSponsors", why: "Commanditaires et leur statut." }, { module: "outreach", fn: "logOutreach", why: "Noter chaque prospection." }],
    channels: ["Courriel info@ avec Christine en copie", "Liens de paiement de plages et d'offres de partenariat"],
    secrets: ["ANTHROPIC_API_KEY"],
    knowledge: ["Dossier de commandite (P6.2)", "Prix des plages et règles d'admissibilité par équipe"]
  },
  {
    id: "A09",
    scope: "Les opérations : terrains et gymnases, plages de match côté logistique, arbitres, location de terrains, matériel et uniformes à remettre.",
    missions: [
      { title: "Arbitres : postes ouverts quand un match est vendu, invitation 2 semaines avant s'il en manque", when: "Plage vendue ; chaque jour à 15 h", mode: "regle", state: "existe", validation: null, existing: "Postes d'arbitre, cron arbitres (autoInviteReferees), page /arbitres/match/[id]", automation: "AU22" },
      { title: "Payer les arbitres après le match (dépense à payer)", when: "Lendemain du match", mode: "regle", state: "existe", validation: "JP fait le virement", existing: "getRefereesToPay, dépense « à payer »" },
      { title: "Conflits d'horaire : une plage n'est jamais vendue quand l'équipe est prise", when: "Chaque lecture de MonClubSportif", mode: "regle", state: "existe", validation: null, existing: "getSlotConflicts (même âge, déplacement, match de la plage elle-même)" },
      { title: "Réservations de terrains : contrats, versements dus, plages par site", when: "Nouveau contrat ; 7 jours avant un versement", mode: "regle", state: "partiel", validation: "Le coordonnateur confirme", existing: "venue_rentals, location de terrains au public (terrain_rentals)" },
      { title: "Uniformes et sacs à remettre à la prochaine pratique", when: "Commande payée", mode: "regle", state: "partiel", validation: null, existing: "Commandes à distribuer (getOrdersToDistribute), kits d'uniformes", missing: "Rappel au coach du groupe le jour de la pratique" },
      { title: "Matériel par site et par semaine (camps multisites)", when: "Une semaine avant chaque camp", mode: "brouillon", state: "a_construire", validation: "Coordonnateur" }
    ],
    reads: ["match_slots", "match_slot_bookings", "referees", "referee_assignments", "mcs_events", "mcs_teams", "venue_rentals", "terrains", "terrain_rentals", "shop_orders", "registration_uniform_kits", "inventory_items", "coach_activities"],
    writes: ["referee_assignments", "match_slots", "shop_orders", "registration_uniform_kits", "audit_log"],
    forbidden: ["player_evaluations", "lab_submissions", "registration_payment_plans", "employee_contracts"],
    tools: [MAIL, AUDIT, { module: "referees-repo", fn: "autoInviteReferees", why: "Inviter les arbitres quand il en manque." }, { module: "referees-repo", fn: "openPositions", why: "Ouvrir les postes d'un match vendu." }, { module: "mcs-teams-repo", fn: "getSlotConflicts", why: "Bloquer une plage déjà prise." }, { module: "shop-repo", fn: "getOrdersToDistribute", why: "Ce qu'il faut remettre aux joueuses." }, { module: "terrain-rentals-repo", fn: "getRentals", why: "Locations de terrains." }],
    channels: ["Courriel aux arbitres", "Portail des éducateurs (remises de matériel)"],
    secrets: [],
    knowledge: ["Adresses et terrains de chaque site", "Contrats de terrains (Rosemère, Terrebonne)"]
  },
  {
    id: "A10",
    scope: "Les éducateurs : recrutement, contrats, présences et heures, confirmations, remplacements, suivi de la qualité.",
    missions: [
      { title: "Présences des éducateurs : confirmation de chaque activité, relance à 24 h", when: "Fin de chaque activité ; 2 fois par jour", mode: "regle", state: "existe", validation: null, existing: "Cron presences-educateurs, coach_assignments", automation: "AU20" },
      { title: "Remplaçant pour un coach absent", when: "Absence signalée", mode: "brouillon", state: "a_construire", validation: "Le coordonnateur confirme" },
      { title: "Recrutement : besoins, candidats, convocations", when: "Poste à combler ; début de saison", mode: "brouillon", state: "partiel", validation: "JP embauche", existing: "Dossier Structure et recrutement", automation: "AU23" },
      { title: "Contrats d'embauche à signer en ligne", when: "Embauche décidée", mode: "regle", state: "existe", validation: "JP", existing: "Contrats /contrat/[token], copie signée" },
      { title: "Certifications et vérification des antécédents qui expirent", when: "60 jours avant l'expiration", mode: "regle", state: "partiel", validation: "JP", existing: "getExpiringCertifications" },
      { title: "Suivi des éducateurs : observations, rapports de fin, qualité des pratiques", when: "Chaque semaine", mode: "brouillon", state: "partiel", validation: "JP", existing: "Observations des éducateurs, rapports du portail" }
    ],
    reads: ["coaches", "coach_assignments", "coach_activities", "coach_certifications", "coach_observations", "staff_members", "recruitment_needs", "recruitment_candidates", "employee_contracts"],
    writes: ["coach_assignments", "coach_observations", "recruitment_needs", "recruitment_candidates", "audit_log"],
    forbidden: ["registrations", "registration_payment_plans", "revenue_income", "lab_submissions"],
    tools: [MAIL, AUDIT, { module: "coaches-repo", fn: "getAllAssignments", why: "Qui coache quoi." }, { module: "structure-repo", fn: "getExpiringCertifications", why: "Certifications à renouveler." }, { module: "structure-repo", fn: "getStructure", why: "Postes, besoins, candidats." }, { module: "coach-observations-repo", fn: "listObservations", why: "Suivi de chaque éducateur." }],
    channels: ["Courriel aux éducateurs", "Portail des éducateurs"],
    secrets: ["ANTHROPIC_API_KEY"],
    knowledge: ["Règle de deux adultes", "Taux horaires par type d'activité", "NAS chiffré : jamais lu par un agent"]
  },
  {
    id: "A11",
    scope: "La direction : une seule page chaque lundi qui résume tout, et la journée de JP chaque matin.",
    missions: [
      { title: "Courriel du lundi : niveau, tâches en retard, 5 priorités, indicateurs", when: "Chaque lundi à 6 h", mode: "regle", state: "existe", validation: null, existing: "Cron mandalart-lundi", automation: "AU02" },
      { title: "Report des tâches non faites au lendemain, plan réorganisé", when: "Chaque matin", mode: "regle", state: "existe", validation: null, existing: "Cron mandalart-report (mandalart-reschedule)" },
      { title: "Aujourd'hui : la prochaine action de JP et les sections du jour", when: "JP ouvre l'admin", mode: "regle", state: "existe", validation: null, existing: "/admin/aujourdhui (getTodayActions)" },
      { title: "Compiler les rapports des autres agents en une page", when: "Chaque lundi", mode: "brouillon", state: "a_construire", validation: null, missing: "Les autres agents" }
    ],
    reads: ["mandalart_tasks_state", "mandalart_tasks_custom", "mandalart_kpi_values", "mandalart_events", "mandalart_agent_state", "weekly_reviews", "audit_log"],
    writes: ["mandalart_tasks_state", "mandalart_snapshots", "audit_log"],
    forbidden: ["players", "player_evaluations", "lab_submissions", "registration_payment_plans", "employee_contracts"],
    tools: [AUDIT, { module: "mandalart-repo", fn: "getMandalartOverview", why: "Avancement du plan." }, { module: "admin-today", fn: "getTodayActions", why: "Ce que JP a à faire aujourd'hui." }, { module: "weekly-review-repo", fn: "getReviews", why: "Bilans de semaine." }],
    channels: ["Courriel à JP", "Admin"],
    secrets: [],
    knowledge: ["Le Mandalart complet (data/mandalart.json)"]
  },
  {
    id: "A12",
    scope: "MonClubSportif tenu à jour sans JP : membres, équipes, activités, matchs, adversaires, présences des éducateurs.",
    missions: [
      { title: "Lire le calendrier de chaque équipe et signaler les écarts avec le site", when: "Chaque jour à 10 h (et à l'ouverture de l'admin)", mode: "regle", state: "existe", validation: null, existing: "16 liens « Sync », cron mcs-sync, page Équipes MonClubSportif" },
      { title: "Inscrire chaque joueuse payée dans la bonne équipe", when: "Inscription payée", mode: "autonome", state: "a_construire", validation: "JP pour les cas inhabituels", existing: "Liste « à faire dans MonClubSportif » (mcs-sync)", missing: "Robot navigateur avec le compte robot enregistré dans l'admin", automation: "AU19" },
      { title: "Écrire le nom de l'adversaire sur le match dès qu'il a payé sa plage", when: "Plage de match payée", mode: "autonome", state: "partiel", validation: null, existing: "Liste « adversaires à inscrire » (getOpponentsToSync)", missing: "Robot navigateur" },
      { title: "Créer ou déplacer les matchs, activités et tournois", when: "Activité créée ou modifiée sur le site", mode: "autonome", state: "a_construire", validation: "JP pour une suppression" },
      { title: "Retirer une joueuse remboursée", when: "Remboursement ou annulation", mode: "brouillon", state: "a_construire", validation: "JP valide chaque retrait" },
      { title: "Lire les présences des éducateurs dans MonClubSportif pour leurs heures", when: "Après chaque activité", mode: "regle", state: "a_construire", validation: "JP pour la paie", missing: "Lecture par le robot (pas d'API)" }
    ],
    reads: ["mcs_teams", "mcs_events", "mcs_sync_items", "registrations", "programs", "birth_categories", "match_slots", "match_slot_bookings", "coach_activities", "coach_assignments"],
    writes: ["mcs_teams", "mcs_events", "mcs_sync_items", "audit_log"],
    forbidden: ["registration_payment_plans", "revenue_income", "player_evaluations", "lab_submissions", "employee_contracts"],
    tools: [AUDIT, { module: "mcs-teams-repo", fn: "syncStaleTeams", why: "Relire les calendriers." }, { module: "mcs-teams-repo", fn: "getOpponentsToSync", why: "Adversaires à écrire dans MonClubSportif." }, { module: "mcs-sync", fn: "getMcsStatus", why: "Membres et événements à importer ou retirer." }, { module: "mcs-sync", fn: "markImported", why: "Cocher ce qui est fait." }, { module: "mcs-robot-config", fn: "getRobotCredentials", why: "Compte robot (déchiffré côté serveur, jamais affiché)." }],
    channels: ["Calendriers iCal « Sync » (lecture)", "Navigateur piloté avec le compte robot (écriture)"],
    secrets: ["Compte robot MonClubSportif chiffré (app_settings)"],
    knowledge: ["Correspondance des équipes MonClubSportif et des groupes du site", "Conditions d'utilisation de MonClubSportif (accord demandé à devops@)"]
  }
];

export function blueprintOf(id: string): AgentBlueprint | null {
  return AGENT_BLUEPRINTS.find((b) => b.id === id) ?? null;
}

/** Garde d'accès d'un agent : une table interdite ou non listée n'est jamais servie. L'écriture implique la lecture. */
export function agentCan(id: string, table: string, op: "read" | "write"): boolean {
  const b = blueprintOf(id);
  if (!b || b.forbidden.includes(table)) return false;
  if (op === "write") return b.writes.includes(table);
  return b.reads.includes(table) || b.writes.includes(table);
}

/** Totaux pour l'écran : missions par état et par mode. */
export function blueprintSummary(list: AgentBlueprint[] = AGENT_BLUEPRINTS) {
  const missions = list.flatMap((b) => b.missions);
  const count = (f: (m: Mission) => boolean) => missions.filter(f).length;
  return {
    missions: missions.length,
    existe: count((m) => m.state === "existe"),
    partiel: count((m) => m.state === "partiel"),
    aConstruire: count((m) => m.state === "a_construire"),
    regle: count((m) => m.mode === "regle"),
    brouillon: count((m) => m.mode === "brouillon"),
    autonome: count((m) => m.mode === "autonome")
  };
}

/** « Mon plan » (/admin/moi/plan) : le Mandalart dit à JP, en mots simples, quoi faire à chaque étape.
 *  Demande de JP (11 nov. 2026) : « rends le tout simple et digeste, liste ce qu'il y a à faire par étape,
 *  mais rien n'empêche d'avoir des détails clairs dans la description de la tâche ».
 *  - LEVEL_GUIDES : chaque palier en une phrase, ce qui doit être vrai pour passer au suivant.
 *  - TASK_GUIDES : pour une tâche du plan (code), le « comment faire » en étapes et le « fini quand ».
 *  Données pures, rien en base : l'état des tâches reste dans mandalart_tasks_state (mandalart-repo). */

export interface LevelGuide {
  /** Le palier dit comme JP le dirait. */
  plain: string;
  /** Ce qui doit être vrai pour passer au palier suivant. */
  pass: string[];
}

export interface TaskGuide {
  /** Les étapes, dans l'ordre, une action par ligne. */
  how: string[];
  /** Ce qui prouve que c'est fini. */
  done: string;
  /** Déjà réglé par le site : il ne reste qu'à vérifier et cocher. */
  already?: string;
  /** Page de l'admin où ça se fait. */
  link?: { href: string; label: string };
}

export const LEVEL_GUIDES: Record<number, LevelGuide> = {
  1: {
    plain: "Rendre l'académie solide : une méthode écrite et filmée, des comptes en ordre, et le premier argent de l'été grâce à Noël.",
    pass: [
      "La structure de séance, les gestes et les tests du passeport sont écrits et filmés.",
      "Chaque joueuse a son test du jour 1 filmé.",
      "Le CPA est engagé, les vrais coûts sont connus, la TPS/TVQ est réglée.",
      "L'académie publie 3 vidéos par semaine et a sa fiche Google.",
      "La carte-cadeau de Noël est vendue et l'été 2027 est prêt à vendre le 15 janvier."
    ]
  },
  2: {
    plain: "Vendre l'été 2027 avant qu'il arrive : prévente aux familles, nouveaux groupes 2017-2019, 2e coach, ta paie de 10 000 $ par mois.",
    pass: [
      "L'été est en vente depuis le 15 janvier et la prévente rentre (cible : 261 100 $ encaissés de janvier à mars).",
      "Les groupes 2017, 2018 et 2019 sont ouverts.",
      "Une 2e coach qualifiée est embauchée et la responsable de camp est trouvée.",
      "Ta paie de 10 000 $ brut par mois tourne depuis février, avec un mois d'avance en banque.",
      "50 écoles ont été contactées pour le parascolaire de l'automne."
    ]
  },
  3: {
    plain: "Le 1er avril, on regarde la prévente et on décide combien de sites de camp ouvrir, puis on embauche l'équipe d'été.",
    pass: [
      "Le nombre de sites est décidé le 1er avril (2e site si le 1er est vendu à 40 %).",
      "L'équipe d'été est embauchée et formée à la méthode, antécédents vérifiés.",
      "La réinscription 2027-28 est ouverte et les ententes de parascolaire sont signées.",
      "3 mois de salaire (≈ 33 000 $) sont en réserve avant le 1er juillet."
    ]
  },
  4: {
    plain: "Livrer l'été : camps et Valkyria Été pleins, et chaque campeuse repart avec une invitation pour l'automne.",
    pass: [
      "Les camps ont roulé (une semaine ouvre à 20 inscrites).",
      "Chaque campeuse a son rapport ball mastery et l'offre de fin de camp.",
      "Le curriculum de la saison suivante est validé."
    ]
  },
  5: {
    plain: "Grossir la base : parascolaire lancé, hiver 2027-28 vendu, premiers clients du conseil aux clubs.",
    pass: [
      "Le parascolaire est lancé dans les écoles.",
      "2 ou 3 pilotes « fait pour vous » avec des clubs sont démarrés.",
      "45 000 $ de commandites pour 2027 et 50 % de marge sur la saison."
    ]
  },
  6: {
    plain: "L'année du 1,5 M$ : Valkyria ≈ 1 M$ à 50 % de marge, et le conseil aux clubs (Valkyria Club System) ≈ 500 000 $.",
    pass: ["1 500 000 $ encaissés du 1er janvier au 31 décembre 2028.", "25 à 35 clubs signés au Valkyria Club System."]
  }
};

export const TASK_GUIDES: Record<string, TaskGuide> = {
  // ── Finances et structure (pilier 7) ──
  "P7.4.01": {
    how: [
      "Ouvre BMO et note le solde du compte d'affaires.",
      "Écris à Claude « solde Stripe » : il te donne le solde et les versements à venir.",
      "Envoie les deux chiffres à Claude, qui calcule l'argent qui rentre d'ici avril 2027."
    ],
    done: "Le solde BMO + Stripe et les encaissements prévus jusqu'en avril sont notés dans la tâche.",
    link: { href: "/admin/revenus", label: "Revenus" }
  },
  "P7.1.01": {
    how: ["Appelle ou écris à Pontbriand Lamarche CPA : « je suis prêt à signer le mandat ».", "Lis le mandat (prix, services : impôts, TPS/TVQ, paie).", "Signe et garde le PDF."],
    done: "Le mandat signé est rangé (lien du PDF dans la tâche)."
  },
  "P7.2.01": {
    how: [
      "Prends la facture du gymnase de Prévost : prix de l'heure et heures par semaine.",
      "Note le taux horaire et les heures de Noura.",
      "Fixe ce qu'Annie et toi êtes payés (même 0 $ pour l'instant, écris-le).",
      "Envoie tout à Claude : il met les vrais coûts dans les marges."
    ],
    done: "Les 4 coûts sont dans la tâche ; la marge par programme se recalcule avec."
  },
  "P7.1.02": {
    how: ["Demande au CPA la date d'inscription TPS/TVQ recommandée (seuil de 30 000 $ dépassé ?).", "Demande si les camps et les entraînements d'enfants sont taxables ou exonérés.", "Inscris-toi à Revenu Québec à cette date."],
    done: "Numéros TPS/TVQ reçus (ou date d'inscription fixée par écrit par le CPA)."
  },
  "P7.1.04": {
    how: ["Écris en une page : Christine fait quoi (familles, courriels, MonClubSportif, samedis).", "Écris ce qu'elle reçoit : la gratuité de ses filles (valeur en $ par saison).", "Faites-la signer à vous deux."],
    done: "L'entente signée est rangée dans Contrats.",
    link: { href: "/admin/contrats", label: "Contrats" }
  },
  "P7.8.01": {
    how: ["Lis la répartition proposée : Valkyria ≈ 1 M$ (camps, académie, parascolaire, commandites) + conseil 500 000 $.", "Garde-la ou change les chiffres.", "Fixe la cible de chiffre d'affaires de 2027."],
    done: "Tu as répondu « je valide » (ou tes chiffres) dans la tâche."
  },
  "P7.4.02": {
    how: [
      "Chaque bloc 🧲 : remplis une place libre ou une demi-saison (liste dans Capacité).",
      "Vends une plage de match par semaine (Vente de matchs).",
      "Relance les commanditaires 2027.",
      "Dès le 5 décembre : vends la carte-cadeau de Noël."
    ],
    done: "Novembre ≥ 6 300 $ et décembre ≥ 13 700 $ encaissés.",
    link: { href: "/admin/capacite", label: "Places libres" }
  },
  "P7.3.01": {
    how: ["Ouvre Capacité : regarde lundi 19 h 30, mercredi 18 h et jeudi 18 h 30 à Prévost.", "Pour chacun, choisis : remplir (relances ciblées), fusionner avec un autre groupe, ou déplacer.", "Préviens les familles touchées avant le 31 décembre."],
    done: "Les 3 créneaux sont au-dessus du seuil, ou fusionnés.",
    link: { href: "/admin/capacite", label: "Capacité" }
  },
  "P7.3.02": {
    how: ["Regarde les plages de Terrebonne encore vides dans Vente de matchs.", "Mets-les en vente aux clubs (règle des 100 : 10 clubs par semaine).", "Si elles ne partent pas, appelle Terrebonne pour renégocier 2027 (moins d'heures)."],
    done: "Plages vendues, ou nouveau contrat 2027 négocié.",
    link: { href: "/admin/plages", label: "Plages de matchs" }
  },

  // ── Méthode Valkyria (pilier 1) ──
  "P1.1.01": {
    how: [
      "Prends une feuille : 4 blocs dans l'ordre (jeu d'entrée, ball mastery, technique, forme jouée).",
      "Mets une durée à chaque bloc pour une séance de 75 et de 90 minutes.",
      "Pour chaque bloc, écris le but en une phrase.",
      "Envoie-la à Claude : il la range dans Coaching et l'utilise pour monter les pratiques."
    ],
    done: "La structure tient sur une page et toutes les pratiques suivent ces blocs.",
    link: { href: "/admin/coaching", label: "Coaching" }
  },
  "P1.1.02": {
    how: ["Pour chaque niveau (bronze, argent, or, mauve), choisis 5 gestes.", "Du plus facile au plus difficile, chaque niveau doit être plus dur que le précédent.", "Envoie la liste à Claude."],
    done: "20 gestes rangés par niveau dans le passeport."
  },
  "P1.1.03": {
    how: ["Range chaque geste dans une famille : semelle, intérieur/extérieur, changements de direction, feintes, contrôles orientés.", "Un geste = une seule famille."],
    done: "La bibliothèque des gestes est classée par famille."
  },
  "P1.2.01": {
    how: ["Pour chaque niveau, fixe le test : touches en 30 secondes, conduite chronométrée, passes des deux pieds.", "Écris le chiffre à atteindre pour réussir chaque niveau.", "Écris comment installer le test (cônes, distances)."],
    done: "Chaque niveau a un test chiffré qu'un éducateur peut faire passer seul."
  },
  "P1.2.02": {
    how: ["Pendant 2 semaines, à chaque pratique : même exercice, même angle de caméra, 30 secondes par joueuse.", "Nomme chaque vidéo Prénom-Nom_test_AAAA-MM-JJ.", "Dépose les vidéos (stockage privé, Loi 25)."],
    done: "Chaque joueuse inscrite a son test du jour 1 filmé."
  },
  "P1.3.03": {
    how: ["Demande à chaque éducateur de noter sur 10 chaque exercice fait en novembre (portail entraîneur).", "Relance ceux qui n'ont pas noté le vendredi."],
    done: "Chaque exercice de novembre a au moins une note.",
    link: { href: "/admin/exercices", label: "Banque d'exercices" }
  },
  "P1.3.14": {
    how: ["Pour chaque exercice de la banque, écris 3 organisations : 5 à 7, 8 à 10, 11 à 16 joueuses.", "Fais-en 5 par bloc de travail ; Claude peut proposer un brouillon."],
    done: "Tous les exercices de la banque ont les 3 organisations.",
    link: { href: "/admin/exercices", label: "Banque d'exercices" }
  },
  "P1.5.01": {
    how: ["Écris 4 principes en une phrase chacun : confiance, appartenance, erreur valorisée, modèles féminins.", "Pour chacun, ajoute un exemple de ce que la coach fait sur le terrain."],
    done: "Les principes tiennent sur une page, donnée aux éducateurs."
  },
  "P1.5.06": {
    how: ["À la fin de chaque pratique, l'éducatrice demande à chaque joueuse sa note sur 10 et sa fatigue sur 10.", "Elle les entre dans le portail (routine de fin).", "Le vendredi, regarde le taux d'appréciation."],
    done: "4 semaines de suite avec les notes de toutes les pratiques.",
    already: "Le portail des éducateurs a déjà la routine de fin (note et fatigue) : il reste à la faire faire à chaque pratique."
  },
  "P1.6.01": {
    how: ["Demande un prix pour des dossards corps noir, collet jaune (2 fournisseurs).", "Commande-en assez pour 2 groupes (environ 30)."],
    done: "La commande est passée (reçu dans la tâche)."
  },
  "P1.6.05": {
    how: ["Écris à 2 fournisseurs : échantillons de dossards bicolores, tapis de ball mastery, repères visuels.", "Demande le prix à l'unité et à 100."],
    done: "Les échantillons sont commandés chez les 2 fournisseurs."
  },
  "P1.7.01": {
    how: ["Pour chaque geste du passeport : une vidéo de moins d'une minute.", "Dans l'ordre : vitesse réelle, ralenti, 3 points clés, erreur à éviter, rôle du parent.", "Tourne 5 gestes par séance de tournage."],
    done: "Les 20 gestes du passeport ont leur vidéo."
  },
  "P1.7.02": {
    how: ["Choisis la routine du mois (3 gestes, 10 minutes par jour).", "Envoie les vidéos à Claude : il les met dans le Valkyria Lab.", "Envoie le lien aux familles avec le bouton « Envoyer ma vidéo »."],
    done: "Les familles ont reçu la routine et au moins 5 vidéos sont revenues."
  },
  "P1.7.03": {
    how: ["Choisis 4 jeux d'hiver à faire à la maison (un par semaine).", "Ajoute un défi vidéo par jeu.", "Demande à Claude de l'envoyer aux familles."],
    done: "Le courriel est parti à toutes les familles."
  },
  "P1.7.04": {
    how: ["Demande aux éducateurs de remplir l'évaluation de chaque joueuse (Ball mastery, Prestation, Attitude).", "Claude assemble le bulletin à partir des évaluations.", "Tu relis et tu envoies."],
    done: "Le premier bulletin est prêt pour chaque joueuse.",
    link: { href: "/admin/coaching/joueuses", label: "Progression des joueuses" }
  },

  // ── Offres et ventes (piliers 2 et 5) ──
  "P2.2.02": {
    how: ["Écris le déroulé de l'évaluation gratuite (45 min) : accueil, 3 tests filmés, jeu, mot au parent.", "Écris le gabarit du mini-rapport : 2 forces, 1 chose à travailler, le groupe conseillé.", "Le rapport part sous 48 h."],
    done: "Le déroulé et le gabarit sont écrits ; une évaluation a été faite avec."
  },
  "P2.4.01": {
    how: ["Les 5 places Solo sont vendues et Privilège est complet.", "Choisis : ajouter des places Solo, ou créer une offre plus haut de gamme.", "Écris ta décision dans la tâche ; Claude prépare l'offre."],
    done: "Ta décision est écrite."
  },
  "P2.4.05": {
    how: [
      "Fixe les prix et les dates de Valkyria Été (15 séances, 595 $), du Sport-Études d'août (399 $) et du Solo Été.",
      "Demande à Claude les pages du site et le courriel de mise en vente.",
      "Relis tout avant le 15 décembre."
    ],
    done: "Le 15 décembre, tout est prêt : on n'a qu'à ouvrir la vente le 15 janvier."
  },
  "P2.4.06": {
    how: [
      "Prends l'offre de l'été 2027.",
      "Écris le résultat rêvé du parent, ce qui le rend sûr que ça marche, le délai et l'effort demandé.",
      "Ajoute une garantie, un bonus, une rareté (places) et une urgence (date limite).",
      "Fais la même chose pour chaque offre après."
    ],
    done: "L'offre de l'été a sa garantie, son bonus, sa rareté et sa date limite écrits."
  },
  "P2.5.01": {
    how: ["Avec les vrais coûts (tâche P7.2.01), demande à Claude le prix plancher de chaque offre.", "Une offre sous son plancher : monte le prix ou baisse le coût."],
    done: "Chaque offre a son prix plancher et aucune n'est en dessous."
  },
  "P5.2.01": {
    how: [
      "Fixe le prix de la carte-cadeau « Semaine de camp Valkyria » (prix hâtif de l'été).",
      "Demande à Claude la page de vente et le courriel aux familles.",
      "Lance le 5 décembre et relance le 12 et le 19."
    ],
    done: "La carte-cadeau est en vente le 5 décembre.",
    link: { href: "/admin/boutique", label: "Boutique" }
  },
  "P5.2.10": {
    how: ["Fixe les prix hâtifs des camps 2027.", "Demande à Claude la page de prévente.", "Prends la liste des familles intéressées dans le sondage d'intérêt."],
    done: "La page de prévente des camps est prête le 20 décembre."
  },
  "P5.3.01": {
    how: ["Calcule le coût d'un camp des Fêtes : gymnase, coachs, matériel.", "Demande à Claude le prix plancher et le nombre d'inscrites pour couvrir les frais.", "Décide oui ou non."],
    done: "Ta décision oui/non est écrite avec le prix."
  },

  // ── Marketing et image (pilier 3) ──
  "P3.2.06": {
    how: ["Le 15 novembre, publie la première vidéo sur Instagram et Facebook.", "Ensuite 3 par semaine (lundi, mercredi, vendredi), tirées de tes tournages du lundi et du jeudi.", "Ne jamais arrêter : une semaine manquée se rattrape la suivante."],
    done: "Première publication le 15 nov., puis 3 par semaine."
  },
  "P3.2.07": {
    how: ["Choisis 6 joueuses dont les parents ont accepté les photos et vidéos.", "3 questions : ce que tu as appris, ce que tu aimes, ton progrès.", "1 minute chacune, au début d'une pratique."],
    done: "6 entrevues de joueuses tournées."
  },
  "P3.2.08": {
    how: ["Demande à 4 parents contents (note 9 ou 10) une entrevue de 2 minutes.", "2 questions : pourquoi New Valkyria, ce qui a changé chez votre fille.", "Publie-les comme témoignages."],
    done: "4 témoignages de parents tournés."
  },
  "P3.2.10": {
    how: ["Choisis le logo, 3 couleurs et 2 polices.", "Demande à Claude les gabarits : reel, carrousel, story, affiche.", "Chaque publication part de ces gabarits."],
    done: "La charte tient sur une page et les gabarits existent."
  },
  "P3.8.06": {
    how: [
      "Va sur business.google.com et crée la fiche « New Valkyria » (catégorie École de sport).",
      "Zone : Sainte-Thérèse, Blainville, Rosemère, Prévost, Saint-Jérôme, Mirabel, Terrebonne.",
      "Claude te donne la description, les horaires et le lien d'inscription à coller.",
      "Fais la vérification d'identité (toi seulement)."
    ],
    done: "La fiche Google est vérifiée et visible."
  },
  "P3.8.07": {
    how: ["Claude vérifie le site dans Google Search Console et Bing Webmaster Tools.", "Toi : tu cliques « Valider » si Google te demande de confirmer."],
    done: "Le plan du site est soumis aux deux."
  },
  "P3.1.02": {
    how: ["Choisis une pratique par mois où chaque joueuse peut amener une amie.", "Annonce-la aux familles 1 semaine avant.", "Chaque amie repart avec l'offre d'essai."],
    done: "La première séance « Amène ton amie » a eu lieu."
  },

  // ── Familles (pilier 4) ──
  "P4.8.06": {
    how: ["Claude prépare les questions : accueil, coachs, progrès de la fille, communication, bulletins, horaire et lieux, uniformes, note sur 10, idées.", "Tu enlèves ou ajoutes des questions.", "Tu dis « OK »."],
    done: "Le sondage de mi-saison est approuvé.",
    link: { href: "/admin/sondages", label: "Sondages" }
  },
  "P4.8.07": {
    how: ["Claude envoie le sondage à toutes les familles.", "Relance à 3 jours et à 7 jours.", "Objectif : 70 % de réponses."],
    done: "70 % des familles ont répondu.",
    link: { href: "/admin/sondages", label: "Sondages" }
  },
  "P4.8.09": {
    how: ["Claude prépare le sondage d'intérêt : été 2027, camps avec clubs pros, élite, voyages, Home Lab.", "Tu l'approuves.", "Il part avant la mise en vente de l'été."],
    done: "Le sondage d'intérêt est envoyé avant le 15 décembre.",
    link: { href: "/admin/sondages", label: "Sondages" }
  },
  "P4.8.08": {
    how: ["Chaque réponse se lit sous 48 h.", "Une note sous 7 sur 10 : tu appelles la famille.", "Tu notes la décision prise."],
    done: "Chaque famille sous 7 a été appelée."
  },

  // ── Organisation (pilier 8) ──
  "P8.2.01": {
    how: ["Écris l'annonce : 2 tournages par semaine, montage, 3 publications.", "Publie-la (Indeed, cégeps en cinéma, ton réseau).", "Rencontre 3 personnes, embauche-en une."],
    done: "La personne caméra a signé son contrat.",
    link: { href: "/admin/contrats", label: "Contrats" }
  },
  "P8.1.02": {
    how: ["Pendant 2 semaines, filme 2 ou 3 filles par pratique (consentement vidéo OK).", "3 questions : ce que tu veux apprendre, ta joueuse préférée, ton geste favori."],
    done: "30 à 40 entrevues de début de saison tournées."
  },
  "P8.4.04": {
    how: ["Liste ce que tu fais encore à la main dans MonClubSportif, avec le temps de chacune.", "Le robot fait déjà : ajouter une inscrite, la mettre dans son équipe, invitation, calendrier, rappels."],
    done: "La liste est écrite ; ce qui reste à la main est confié au robot ou à Christine.",
    already: "Le robot MonClubSportif fait déjà la plupart de ces tâches dès le paiement.",
    link: { href: "/admin/monclubsportif/robot", label: "Robot MonClubSportif" }
  },
  "P8.4.05": {
    how: ["Vérifie et coche."],
    done: "La réponse est connue et le robot est choisi.",
    already: "Réglé : MonClubSportif n'a pas d'API, et le robot (navigateur automatisé) est construit."
  },
  "P8.4.02": {
    how: ["Vérifie et coche."],
    done: "Les présences MCS arrivent dans le site.",
    already: "Réglé : chaque soir, les présences de MonClubSportif arrivent dans le site (paie des éducateurs comprise)."
  },
  "P8.4.08": {
    how: ["Vérifie et coche."],
    done: "Le calendrier de l'admin suit MonClubSportif.",
    already: "Réglé : le robot lit le calendrier de chaque équipe et le garde à jour dans le site."
  },
  "P8.2.03": {
    how: ["Liste ce que l'académie collecte : identité, date de naissance, santé, photos et vidéos, paiements.", "Pour chacun : pourquoi, qui y a accès, combien de temps on le garde.", "Toi : responsable désigné."],
    done: "Le registre Loi 25 tient sur une page et est à jour."
  },
  "P8.3.01": {
    how: ["Écris la règle de deux : jamais un adulte seul avec une mineure (vestiaire, auto, message privé).", "Fais-la signer par chaque coach."],
    done: "Tous les coachs ont signé."
  },

  // ── Commandites et matchs (pilier 6) ──
  "P6.3.01": {
    how: ["Ouvre Vente de matchs : les plages de Terrebonne encore libres.", "Écris à 10 clubs par semaine (règle des 100).", "Chaque plage vendue = 150 $."],
    done: "Les 23 plages sont vendues (3 450 $).",
    link: { href: "/admin/plages", label: "Plages de matchs" }
  },
  // ── Tâches ajoutées par JP dans l'admin (mandalart_tasks_custom) ──
  "P4.5.X01": {
    how: [
      "Choisis 2 soirs possibles dans la 3e semaine de novembre (mardi 17 ou jeudi 19, par exemple).",
      "Appelle 2 ou 3 salles : un amphithéâtre d'école, la salle de spectacle de la ville ou un cégep (capacité 150, projecteur).",
      "Réserve la salle libre la moins chère et écris l'adresse et l'heure dans la tâche.",
      "Dis à Claude « envoie l'invitation » : un courriel à toutes les familles, Christine en copie."
    ],
    done: "La salle est réservée et l'invitation est partie aux familles."
  },
  "P4.5.X02": {
    how: [
      "Prépare 10 diapos : la méthode, le passeport, les tests filmés, le Valkyria Lab, l'été 2027.",
      "Fais une répétition de 20 minutes la veille.",
      "Le soir même : 30 minutes de présentation, 15 minutes de questions, puis la carte-cadeau de Noël en avant-première."
    ],
    done: "La présentation a eu lieu et la liste des présents est notée."
  },
  "P4.8.X01": {
    how: [
      "Dans MonClubSportif, crée un sondage à toutes les équipes : « À quelles dates partez-vous en voyage cette saison ? ».",
      "Choix : Fêtes, relâche, autre date (champ libre).",
      "Relance après 3 jours ; Claude range les réponses pour prévoir les groupes."
    ],
    done: "Le sondage est parti dans MonClubSportif à toutes les équipes.",
    link: { href: "/admin/monclubsportif", label: "MonClubSportif" }
  },
  "P7.4.X01": {
    how: [
      "Paie 2 421 $ au Centre multisports de Rosemère : débit sur place, chèque à la CDCSR ou dépôt direct.",
      "Garde le reçu.",
      "Envoie la photo du reçu à Claude pour la dépense."
    ],
    done: "Le reçu de 2 421 $ est dans la tâche."
  },
  "P7.4.X02": {
    how: ["Paie le solde de 1 614 $ au Centre multisports de Rosemère avant le 1er février.", "Garde le reçu et envoie-le à Claude."],
    done: "Le reçu de 1 614 $ est dans la tâche."
  },
  // ── Ajouts du 11 nov. 2026 : vidéos explicatives, matériel et boutique, ligue d'hiver ──
  "P3.2.12": {
    how: [
      "Ouvre Mes tournages : les 21 idées des 5 séries sont déjà écrites (l'académie, les programmes, les projets, les preuves, les nouveaux parents).",
      "Avec la gérante, relis-les en 20 minutes : enlève, ajoute, corrige la phrase clé de chacune.",
      "Mets une durée visée sur chaque vidéo (2 minutes pour les vidéos d'identité, 45 secondes pour les autres)."
    ],
    done: "La liste des vidéos est validée avec la gérante, une phrase clé par vidéo.",
    link: { href: "/admin/moi/tournages", label: "Mes tournages" }
  },
  "P3.2.13": {
    how: ["La veille de chaque tournage, planifie UNE vidéo « Qui est New Valkyria » dans Mes tournages (accroche, message, plans).", "Tourne-la le matin (bloc 🎥 du lundi et du jeudi).", "Passe-la à Tourné, puis Monté, puis Publié."],
    done: "Les 4 vidéos d'identité sont tournées et montées.",
    link: { href: "/admin/moi/tournages", label: "Mes tournages" }
  },
  "P3.2.14": {
    how: ["Même méthode que les vidéos d'identité : une vidéo de la série « Nos programmes » planifiée la veille, tournée le matin."],
    done: "Les 4 vidéos des programmes sont publiées.",
    link: { href: "/admin/moi/tournages", label: "Mes tournages" }
  },
  "P2.6.04": {
    how: [
      "Choisis 2 fournisseurs (ex. un fournisseur d'uniformes, un d'équipement de soccer).",
      "Demande à chacun un échantillon de : ballon, maillot, pastilles, but rétractable, imperméable New Val.",
      "Note pour chaque article : prix à l'unité, prix à 50 et à 100, délai, quantité minimale.",
      "Range les prix dans Inventaire du matériel."
    ],
    done: "Les échantillons des 5 articles sont commandés chez 2 fournisseurs, prix et délais notés.",
    link: { href: "/admin/inventaire", label: "Inventaire du matériel" }
  },
  "P2.6.06": {
    how: [
      "Fixe la règle de fidélité : ex. 3e article à −15 %, ou un rabais après 100 $ d'achats.",
      "Crée 2 ensembles à prix réduit (ex. ballon + pastilles ; maillot + imperméable).",
      "Prix de consolation : à chaque tournoi ou concours, une fille qui n'a rien gagné reçoit un bon à utiliser à la boutique.",
      "Dis à Claude Code de brancher les rabais et les bons dans la boutique du site."
    ],
    done: "L'offre est écrite et en place dans la boutique du site.",
    link: { href: "/admin/boutique", label: "Boutique" }
  },
  "P7.2.04": {
    how: [
      "Dis à Claude : « Fais l'analyse de la ligue d'hiver » ; il sort les équipes, les matchs, les coûts (terrains, arbitres) et les revenus du site.",
      "Ajoute ce que les familles en pensent (sondage de mi-saison) et ce que font les autres ligues.",
      "Passe le tout au calculateur de lancement : prix plancher, seuil, GO ou NO-GO."
    ],
    done: "La décision go/no-go de la ligue d'hiver est prise, avec son prix plancher.",
    link: { href: "/admin/revenus/calculateur", label: "Calculateur de lancement" }
  }
};

export const guideFor = (code: string): TaskGuide | null => TASK_GUIDES[code] ?? null;

/** Tâche à JP : il est nommé dans le responsable (« JP », « JP + caméra »…). */
export const isForJp = (owner: string | null | undefined) => /\bJP\b/.test(owner ?? "");

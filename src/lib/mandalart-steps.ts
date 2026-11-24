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
      "Prends une feuille : les blocs dans l'ordre (ball mastery, rondo, technique, technique, forme jouée, routine de fin).",
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
  "P4.5.04": {
    how: ["La boîte à idées est en ligne : page publique /boite-a-idees et espace parent (Mon espace › Boîte à idées).", "Chaque nouvelle idée apparaît dans « Aujourd'hui » : répondre dans Voix des familles › Boîte à idées.", "Annoncer la boîte à idées aux familles (courriel ou publication MonClubSportif)."],
    done: "La boîte à idées est annoncée et chaque idée reçue a une réponse.",
    link: { href: "/admin/idees", label: "Boîte à idées" }
  },
  "P7.8.08": {
    how: ["Avec le CPA : fixer le salaire de dirigeant (100 000 $) et la façon de le verser (salaire, dividendes).", "L'inscrire comme charge dans le budget annuel (Revenus › Budget annuel).", "Vérifier chaque mois que le bénéfice après salaire suit le plan de l'hiver 2027-2028."],
    done: "Le salaire est dans le budget et le CPA a validé la façon de le verser.",
    link: { href: "/admin/revenus/budget", label: "Budget annuel" }
  },
  "P2.4.07": {
    how: ["Créer les programmes Académie (3 groupes de 16) et Pré-académie (3 villes, 2 groupes de 15) dans l'admin, aux prix de 950 $ et 690 $.", "Réserver les 3 gymnases de la pré-académie au printemps.", "Prévente en mai et juin aux familles actuelles, avant la fin de la saison."],
    done: "Les deux programmes sont en vente et la prévente est lancée.",
    link: { href: "/admin/revenus/calculateur", label: "Calculateur de lancement" }
  },
  "P5.1.06": {
    how: ["Liste de 50 écoles et services de garde, 100 contacts par semaine.", "Une démo gratuite par école intéressée.", "Signer l'entente : 30 jeunes au plus, 250 $ pour 10 semaines, 2 sessions."],
    done: "8 à 12 ententes signées pour l'automne 2027.",
    link: { href: "/admin/mandalart/piliers", label: "Pilier P5" }
  },
  "P5.4.04": {
    how: ["Choisir le ballon et le tapis (échantillons P1.6.05), calculer le coût (environ 60 $).", "Monter la page de vente à 149 $ avec les routines par code QR.", "Le proposer aux familles, au parascolaire et aux camps."],
    done: "120 kits vendus.",
    link: { href: "/admin/valkyria-lab", label: "Valkyria Lab" }
  },
  "P5.4.05": {
    how: ["Ajouter le paiement mensuel de 15 $ au Valkyria Lab (routine du mois + retour vidéo de l'éducatrice).", "L'offrir d'abord aux familles qui envoient déjà leurs vidéos.", "Suivre le nombre d'abonnées chaque mois."],
    done: "150 familles abonnées.",
    link: { href: "/admin/valkyria-lab", label: "Valkyria Lab" }
  },
  "P5.5.05": {
    how: ["Réserver le terrain 4 mois avant (P5.5.04).", "Inviter 30 équipes à 500 $, trouver un commanditaire principal.", "Boutique et kits Valkyria Lab sur place."],
    done: "Deux tournois tenus dans l'année, chacun avec 30 équipes.",
    link: { href: "/admin/sponsors-2027", label: "Commandites" }
  },
  "P3.2.18": {
    how: ["Avant la pratique : trépied au centre de la zone de ball mastery, caméra 360° au sommet, pastilles en arc de cercle à 3 ou 4 mètres.", "Lancer l'enregistrement avant le premier exercice, filmer tout le bloc sans arrêter.", "Après : téléverser la vidéo et coller le lien dans Contenu › Ball mastery 360° et photos."],
    done: "Chaque pratique en gymnase de la semaine est cochée « Filmé » avec son lien.",
    link: { href: "/admin/contenu/captation", label: "Ball mastery 360° et photos" }
  },
  "P3.2.19": {
    how: ["Avant le match : un portrait de chaque joueuse en chandail, même cadrage pour toutes.", "Pendant : au moins une photo de chaque fille en action.", "Le soir même : trier, ranger le dossier et coller son lien dans le suivi du match."],
    done: "Chaque match de la semaine est coché « Photos prises » avec le lien du dossier.",
    link: { href: "/admin/contenu/captation", label: "Ball mastery 360° et photos" }
  },
  "P3.2.20": {
    how: ["Chaque semaine, ouvre le calendrier de publication et remplis les 2 semaines suivantes.", "Pour chaque publication : le jour, organique, reel d'essai ou publicité, l'angle et les réseaux.", "Garde au moins 3 publications par semaine."],
    done: "Les 14 prochains jours ont au moins 6 publications prévues, chacune avec son angle.",
    link: { href: "/admin/contenu/calendrier", label: "Calendrier de publication" }
  },
  "P3.2.21": {
    how: ["Créer l'application Meta pour développeurs et relier le compte Instagram professionnel à la page Facebook.", "Créer la clé d'API YouTube de la chaîne.", "Claude Code branche la lecture automatique des vues et des abonnés."],
    done: "Les vues et les abonnés de chaque réseau arrivent sans saisie à la main.",
    link: { href: "/admin/contenu/calendrier", label: "Brancher nos réseaux" }
  },
  "P8.1.04": {
    how: ["Ajoute les journées d'entrevues (jour, heure, lieu, places) dans Contenu › Entrevues.", "Choisis les filles, puis envoie l'invitation : chaque famille choisit son heure.", "Le jour même, suis le guide de questions ; coche « Filmée » et colle le lien de la vidéo."],
    done: "Les journées sont ouvertes, les invitations parties et les premières entrevues filmées.",
    link: { href: "/admin/contenu/entrevues", label: "Entrevues" }
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
  },
  "P5.6.05": {
    how: [
      "Trouve 2 ou 3 parents responsables pour le comité (communiqué et collectes).",
      "Avec eux, fixe l'objectif par joueuse et le calendrier des collectes, une par mois, de mars 2027 à février 2028.",
      "Annonce la règle du temps de jeu avec le projet (matchs importants : les meilleures ; autres matchs : temps égal ; tournoi : tout le monde joue)."
    ],
    done: "Le comité est formé, le calendrier des collectes et l'objectif par joueuse sont écrits."
  },
  "P5.6.06": {
    how: [
      "Le comité lance la première collecte en mars 2027 (ex. emballage, vente, souper-bénéfice).",
      "Chaque collecte devient une tâche avec sa date et son responsable ; le montant ramassé est noté.",
      "Chaque mois, annonce aux familles où en est le financement."
    ],
    done: "La première collecte a eu lieu en mars 2027 et le calendrier suit son cours."
  },
  "P1.5.07": {
    how: [
      "Pour chaque thème de pratique, écris la fiche de la capitaine : 3 phrases à dire (encourager, organiser, corriger gentiment) et 1 action (rassembler son équipe, son temps mort).",
      "Explique les attentes à toutes les filles : la capitaine parle la première, encourage après une erreur, félicite un effort.",
      "Une capitaine différente chaque semaine ; l'éducateur note son leadership de 1 à 5 dans le portail (Équipes et capitaines)."
    ],
    done: "Chaque thème a sa fiche de capitaine et chaque fille a été capitaine au moins une fois dans la saison."
  },
  "P1.5.08": {
    how: [
      "Dans chaque pratique, garde un bloc de petits jeux à 2 contre 2 ou 3 contre 3, sur plusieurs mini-terrains en même temps.",
      "Les coachs parlent peu : 3 interventions au plus, le reste du temps on laisse jouer.",
      "Regarde la note de la pratique donnée par les filles : elle doit monter."
    ],
    done: "Chaque pratique a son bloc de petits jeux et les filles touchent le ballon au maximum."
  },
  "P1.4.11": {
    how: [
      "La veille, lis la pratique dans le portail (diapos et chaque exercice) et confirme-la.",
      "Au gymnase, lance le minuteur du portail à l'étape « Pendant » : quand il sonne, on passe à l'exercice suivant, même s'il reste quelque chose à dire.",
      "Compte tes interventions : 3 au plus par exercice, courtes et sur le thème ; chaque coach ne corrige que le thème.",
      "Tenue Valkyria complète pour tous les coachs, jamais en noir : c'est la dernière fois que JP a à le rappeler."
    ],
    done: "Toutes les cases du guide de l'éducateur sont cochées avant chaque pratique, aucun exercice sauté faute de temps."
  },
  "P1.4.12": {
    how: [
      "Avant le ball mastery, répartis les joueuses : chaque éducateur a les siennes, les plus faibles d'abord.",
      "Ajoute une séquence plus difficile : celles qui bloquent sont repérées et notées dans l'évaluation (gestes difficiles).",
      "Ces joueuses sont encadrées de près à la pratique suivante ; pas de discussion entre coachs pendant le bloc."
    ],
    done: "Les joueuses en difficulté sont repérées à chaque bloc de ball mastery et suivies à la pratique suivante."
  },
  "P1.4.13": {
    how: [
      "Réécoute les formations de Rhéal Dazé ; à chaque idée utile pour nos éducateurs, note le moment (minute) et pourquoi c'est important.",
      "Garde 3 à 6 extraits courts par sujet (moins de 5 minutes chacun) et relie chacun à un module de la formation (séance, principes, règle du coach…).",
      "Pour chaque extrait, écris une question simple à laquelle l'éducateur répond après l'avoir regardé : Claude Code monte le module interactif dans « Ma formation ».",
      "Ouvre le module aux éducateurs dans Suivi des éducateurs (« Ouvert ») et valide-le après les avoir observés."
    ],
    done: "Les modules Rhéal Dazé sont ouverts dans « Ma formation » et chaque éducateur les a terminés (barre de progression pleine)."
  },
  /* ── Stade 3 d'Alex Hormozi : stabiliser (guide Acquisition.com, 17 nov. 2026 ; docs/strategie/acq-stade-3-stabiliser.md) ── */
  "P4.8.15": {
    how: [
      "Le 1er de chaque mois, ouvre Voix des familles (sondages et boîte à idées) et le journal des relances : note les plaintes qui reviennent.",
      "Choisis UN seul problème : celui qui touche le plus de familles ou qui fait partir des familles.",
      "Règle-le à fond (une personne responsable, une date), sans toucher au reste.",
      "Annonce-le aux familles : « Vous avez dit, on a fait ». Le mois suivant, passe au problème suivant."
    ],
    done: "Le problème du mois est choisi, réglé et annoncé aux familles.",
    link: { href: "/admin/sondages", label: "Voix des familles" }
  },
  "P4.8.16": {
    how: [
      "Dans chaque entrevue vidéo, pose les 4 questions dans l'ordre : comment c'était avant, le moment où ça a changé, le résultat aujourd'hui, à qui vous nous recommanderiez.",
      "Ajoute les mêmes questions à la fin du sondage de fin de saison (avec la case d'accord pour publier).",
      "Garde les meilleures réponses comme témoignages (site, réseaux, vidéos explicatives)."
    ],
    done: "Au moins 10 témoignages au script Epiphany, avec l'accord des familles.",
    link: { href: "/admin/contenu/entrevues", label: "Entrevues" }
  },
  "P4.8.17": {
    how: [
      "Dis à Claude : « Écris le protocole des plaintes » (écouter, reconnaître, s'excuser, réparer, rappeler une semaine plus tard).",
      "Donne-le à la gérante et aux éducateurs ; chaque plainte se note dans Relances et suivi (type excuse ou réponse).",
      "Une semaine plus tard, rappelle la famille pour vérifier que c'est réglé."
    ],
    done: "Le protocole est écrit, connu de l'équipe, et chaque plainte est notée avec sa suite.",
    link: { href: "/admin/relances", label: "Relances et suivi" }
  },
  "P3.6.06": {
    how: [
      "Dis à Claude : « Prépare 8 courriels de valeur pour les familles intéressées » (un conseil, une vidéo, une preuve, les coulisses, puis l'offre).",
      "Relis-les et ajuste le ton ; Claude les programme, un par semaine, aux familles intéressées pas encore inscrites.",
      "Chaque mois, regarde combien de ces familles se sont inscrites."
    ],
    done: "La série de courriels part chaque semaine aux familles intéressées.",
    link: { href: "/admin/relances", label: "Relances et suivi" }
  },
  "P3.6.07": {
    how: [
      "Écris en 6 lignes la famille idéale : âge de la fille, ville, niveau, 2 séances par semaine, parents engagés, budget.",
      "Dis à Claude de classer chaque nouvelle demande chaude, tiède ou froide selon cette fiche.",
      "Appelle les chaudes d'abord, le jour même."
    ],
    done: "La fiche est écrite et chaque nouvelle demande arrive classée.",
    link: { href: "/admin/acquisition", label: "D'où viennent nos familles" }
  },
  "P3.6.08": {
    how: [
      "Dis à Claude : « Écris mon script d'appel CLOSER pour une famille intéressée ».",
      "Pratique-le à voix haute 5 fois, puis avec la gérante.",
      "Après chaque appel, note ce qui a marché et ajuste le script."
    ],
    done: "Le script est écrit et tu l'utilises à chaque appel sans le lire.",
    link: { href: "/admin/relances", label: "Relances et suivi" }
  },
  "P3.8.13": {
    how: [
      "Remplis chaque jour ton habitude « Actions de prospection (règle des 100) » dans Mes habitudes (100 actions, ou 100 minutes de marketing).",
      "Bloque le créneau dans ton agenda (bloc 🧲).",
      "Dans ces 100 minutes : publier, répondre aux messages, relancer, demander une référence. Un seul canal principal tant qu'il marche."
    ],
    done: "La règle des 100 est tenue au moins 25 jours sur 30.",
    link: { href: "/admin/moi/habitudes", label: "Mes habitudes" }
  },
  "P4.2.03": {
    how: [
      "Ouvre Parcours client et relis les 30 premiers jours d'une nouvelle famille.",
      "Dis à Claude d'automatiser les messages : jour 0 bienvenue + espace famille, rappel 2 jours avant la 1re pratique, mini-sondage au 30e jour.",
      "Donne à la gérante l'appel du 7e jour ; la première victoire du 14e jour (points, geste filmé) revient aux éducateurs."
    ],
    done: "Chaque nouvelle famille reçoit les 5 étapes, sans oubli.",
    link: { href: "/admin/parcours-client", label: "Parcours client" }
  },
  "P7.1.06": {
    how: [
      "Fais la liste de toutes les personnes payées (éducateurs, gérante, caméra, arbitres) et comment elles sont payées.",
      "Avec le CPA : employé ou travailleur autonome pour chacune, retenues à la source, relevés de fin d'année.",
      "S'il y a des employés, ouvre un service de paie recommandé par le CPA ; arrête tout paiement sans trace."
    ],
    done: "Chaque personne a son statut confirmé par le CPA et la paie passe par un système en règle.",
    link: { href: "/admin/entraineurs/paie", label: "Paie des éducateurs" }
  },
  "P7.1.07": {
    how: [
      "Demande au CPA quel logiciel comptable il veut (ex. QuickBooks) et ouvre-le.",
      "Relie-le au compte bancaire ; chaque dépense garde sa pièce dans Revenus.",
      "Ferme chaque mois avant le 10 (dis à Claude : « fais la fin de mois »)."
    ],
    done: "Le logiciel est relié à la banque et le mois précédent est fermé avant le 10.",
    link: { href: "/admin/revenus", label: "Revenus" }
  },
  "P7.4.06": {
    how: [
      "Coche chaque matin l'habitude « Solde du matin (banque + Stripe) » dans Mes habitudes.",
      "Chaque matin : regarde le solde de la banque et de Stripe (2 minutes), note-le si quelque chose surprend.",
      "À chaque gros encaissement, mets la part des taxes de côté."
    ],
    done: "L'habitude est cochée chaque jour depuis 30 jours.",
    link: { href: "/admin/moi/habitudes", label: "Mes habitudes" }
  },
  "P7.6.06": {
    how: [
      "Dis à Claude : « Liste tous mes abonnements » ; il les sort des dépenses et des relevés Stripe.",
      "Pour chacun : coût par mois, qui s'en sert, à garder ou à annuler.",
      "Annule ceux qui ne servent pas ; demande un rabais ou une prolongation pour les autres. Refais-le chaque trimestre."
    ],
    done: "La liste est faite et les abonnements inutiles sont annulés.",
    link: { href: "/admin/revenus", label: "Revenus" }
  },
  "P8.2.07": {
    how: [
      "Prends les 10 tâches qui reviennent le plus (inscription, paiement en retard, remplacement, MonClubSportif, uniformes, courriel aux familles, nouvelle famille, plainte, présences, fin de mois).",
      "Pour chacune, explique à Claude comment tu la fais (dicté) ; il l'écrit en étapes avec les modèles de messages.",
      "Fais-la faire une fois à la gérante avec la procédure, corrige la procédure là où elle a bloqué."
    ],
    done: "Les 10 procédures sont écrites et la gérante en a fait chacune au moins une fois.",
    link: { href: "/admin/moi/confiees", label: "Tâches confiées" }
  },
  "P8.2.08": {
    how: [
      "Chaque lundi, choisis une tâche que tu fais encore toi-même.",
      "Montre-la, faites-la ensemble, laisse la personne la faire, vérifie (et confie-la dans Tâches confiées).",
      "Après 3 fois réussies, ne vérifie plus."
    ],
    done: "Au moins 12 tâches transférées et l'indicateur « Tâches confiées » à 20 par mois.",
    link: { href: "/admin/moi/confiees", label: "Tâches confiées" }
  },
  "P8.2.09": {
    how: ["Dis à Claude : « Écris le guide de l'employé » (horaires, absences, tenue, code de conduite, Loi 25, mots de passe).", "Relis-le, fais-le signer à chaque personne de l'équipe."],
    done: "Le guide est signé par toute l'équipe.",
    link: { href: "/admin/structure", label: "Structure et recrutement" }
  },
  "P8.3.07": {
    how: [
      "Dis à Claude : « Écris les fiches de poste éducateur, gérante, caméra, coordonnateur ».",
      "Ajoute la grille : ce qu'on cherche dans une candidature, les questions d'entrevue, 2 références à appeler.",
      "Utilise-les au prochain recrutement dans Structure et recrutement."
    ],
    done: "Les 4 fiches et la grille sont prêtes et utilisées.",
    link: { href: "/admin/structure", label: "Structure et recrutement" }
  },
  "P8.4.10": {
    how: ["Choisis un gestionnaire de mots de passe d'équipe (ex. 1Password ou Bitwarden).", "Range-y les accès partagés (MonClubSportif, Veo, réseaux) par rôle.", "Au départ d'une personne, retire ses accès le jour même."],
    done: "Tous les accès partagés sont dans le gestionnaire, plus aucun mot de passe envoyé par message."
  },
  "P2.5.04": {
    how: [
      "En fin de saison, dis à Claude : « Sors nos meilleures familles » (assiduité, réinscription, références).",
      "Regarde ce qu'elles ont en commun et ajuste l'offre et les prix de l'an prochain pour elles.",
      "Écris ce qu'on refuse désormais (demandes qui ne nous ressemblent pas)."
    ],
    done: "Le portrait des meilleures familles est fait et l'offre 2027-2028 est ajustée.",
    link: { href: "/admin/revenus/calculateur", label: "Calculateur de lancement" }
  },
  // ── Contrainte n°1 jusqu'au 28 févr. 2027 : les prospects de l'été et une équipe qui livre sans JP (22 nov. 2026) ──
  "P2.4.08": {
    how: [
      "Ouvre le brouillon docs/strategie/offres-ete-2027-hiver-2028.md (ou demande-le à Claude) : chaque programme y a déjà sa ligne.",
      "Pour chaque programme, tranche les cases « à décider » : pour qui, la promesse en une phrase, où, quand, combien, combien de places.",
      "Enlève ce que tu n'es pas certain de pouvoir livrer : mieux vaut 4 offres claires que 10 floues.",
      "Dis à Claude : « Mets la grille en ligne dans une page Nos programmes » ; chaque programme garde sa page et son bouton d'inscription."
    ],
    done: "La grille est tranchée et la page « Nos programmes » est en ligne.",
    link: { href: "/admin/programme", label: "Programmes" }
  },
  "P2.4.09": {
    how: [
      "Pour chaque lieu de la grille, appelle la ville, l'école ou le club et demande la disponibilité aux dates et heures voulues.",
      "Garde la confirmation écrite (courriel) dans Documents ; note le coût à l'heure.",
      "Un programme sans lieu confirmé ne se vend pas encore."
    ],
    done: "Chaque programme de la grille a un lieu confirmé par écrit.",
    link: { href: "/admin/location-terrains", label: "Terrains" }
  },
  "P3.8.14": {
    how: [
      "Bloque 2 h par semaine dans ton agenda (bloc 🧲) : « Formation pub ».",
      "Suis la formation gratuite Meta Blueprint sur les bases du Gestionnaire de publicités (objectifs, audiences, budget, mesure).",
      "Crée le compte publicitaire de New Valkyria (séparé de JP Coach) et demande à Claude d'installer le pixel Meta sur le site.",
      "Après chaque séance, écris 3 choses apprises dans Mes connaissances."
    ],
    done: "Formation de base finie, compte publicitaire et pixel en place.",
    link: { href: "/admin/moi/connaissances", label: "Mes connaissances" }
  },
  "P3.8.15": {
    how: [
      "Un chapitre de $100M Leads par semaine (livre ou audio).",
      "Après chaque chapitre, écris dans Mes connaissances : l'idée principale et comment l'appliquer à New Valkyria cette semaine.",
      "Applique une chose avant de lire le chapitre suivant (ex. écrire aux contacts chauds, créer l'aimant à prospects)."
    ],
    done: "Le livre est fini et chaque chapitre a sa fiche et une action faite.",
    link: { href: "/admin/moi/connaissances", label: "Mes connaissances" }
  },
  "P3.8.16": {
    how: [
      "Choisis le petit problème que les parents veulent régler maintenant (ex. « ma fille veut essayer avant de s'inscrire au camp »).",
      "Choisis l'offre gratuite qui le règle : séance découverte du camp, ou évaluation ball mastery gratuite avec un rapport.",
      "Dis à Claude : « Crée la page de l'aimant à prospects » : formulaire, ajout à la liste chaude, courriels de suivi.",
      "Mets le lien dans ta bio Instagram et Facebook et dans chaque publication."
    ],
    done: "La page est en ligne et reçoit ses premières demandes.",
    link: { href: "/admin/relances", label: "Liste chaude et relances" }
  },
  "P3.8.17": {
    how: [
      "Prends la vidéo organique qui a le mieux marché (vues et messages).",
      "Crée une campagne vers la page de l'aimant à prospects : 10 à 20 $ par jour, parents à 25 km autour des sites.",
      "Laisse rouler 7 jours sans toucher, puis note la dépense et les prospects dans Réseaux (campagne payante)."
    ],
    done: "Une campagne a roulé au moins 2 semaines et son coût par prospect est connu.",
    link: { href: "/admin/reseaux", label: "Réseaux sociaux" }
  },
  "P3.8.18": {
    how: [
      "Chaque lundi, ouvre D'où viennent nos familles et Réseaux.",
      "Compte les nouvelles familles intéressées de la semaine par canal et note le total dans l'indicateur « Prospects par semaine ».",
      "Garde le canal qui donne le plus de prospects pour le moins cher ; coupe celui qui ne donne rien depuis 2 semaines."
    ],
    done: "Le relevé est fait 4 lundis de suite.",
    link: { href: "/admin/acquisition", label: "D'où viennent nos familles" }
  },
  "P3.2.22": {
    how: [
      "Chaque vidéo commence par un crochet de 3 secondes (une question ou un résultat que le parent veut).",
      "Format reel de 30 secondes ; finis toujours par une seule demande : « Lien en bio pour la séance découverte ».",
      "Une publication par jour sur les comptes de New Valkyria, planifiée dans le calendrier de publication ; JP Coach reste à part."
    ],
    done: "30 jours de suite avec une publication par jour et un appel à l'action.",
    link: { href: "/admin/contenu/calendrier", label: "Calendrier de publication" }
  },
  "P3.6.09": {
    how: [
      "Sors la liste chaude : familles actuelles, été 2026, essais, anciennes joueuses.",
      "Écris à chacune personnellement (pas un envoi de masse) avec la grille de l'été et le prix hâtif ; Claude prépare les messages, tu valides.",
      "Note chaque réponse dans les relances et rappelle celles qui ne répondent pas après 3 jours."
    ],
    done: "Chaque famille de la liste chaude a reçu l'offre de l'été et sa réponse est notée.",
    link: { href: "/admin/relances", label: "Relances et suivi" }
  },
  "P8.3.08": {
    how: [
      "Liste chaque plage de pratique de la semaine.",
      "Pour chacune, nomme l'éducateur principal qui peut la donner seul et un remplaçant.",
      "Là où il n'y a que toi, c'est la première plage à couvrir (formation ou recrutement)."
    ],
    done: "Chaque plage a un éducateur principal et un remplaçant, et aucune pratique n'a été annulée parce que tu étais absent.",
    link: { href: "/admin/structure", label: "Structure et recrutement" }
  },
  "P1.4.14": {
    how: [
      "Dès janvier, chaque éducateur principal dirige seul une pratique par semaine, du début à la fin.",
      "Tu observes sans intervenir, puis tu donnes ton retour (2 bons coups, 2 à améliorer).",
      "Quand c'est réussi 3 fois, tu ne viens plus à cette pratique."
    ],
    done: "Chaque éducateur principal a dirigé seul au moins 3 pratiques réussies.",
    link: { href: "/admin/entraineurs/suivi", label: "Suivi des éducateurs" }
  },
  // ── Machine d'acquisition : 90 jours sur le marketing (25 nov. 2026), plan docs/strategie/machine-acquisition-90-jours.md ──
  "P4.8.18": {
    how: ["Relis les 8 questions proposées dans le plan (section 7) et dis à Claude ce que tu changes.", "Claude met le sondage devant le bulletin : le parent répond, puis le bulletin s'ouvre.", "Le 15 décembre, les bulletins sont remis et les réponses arrivent dans Voix des familles."],
    done: "Les questions sont validées et le bulletin s'ouvre après le sondage.",
    link: { href: "/admin/sondages/bulletins", label: "Sondages des bulletins" }
  },
  "P3.8.19": {
    how: ["Crée la fiche Google de l'académie (P3.8.06) et copie son lien « écrire un avis ».", "Colle ce lien dans l'admin (avis Google) : le bouton du sondage l'ouvrira directement.", "Chaque lundi, note le nombre d'avis (indicateur Avis Google cumulés)."],
    done: "Le bouton fonctionne et les premiers avis arrivent.",
    link: { href: "/admin/avis", label: "Avis et témoignages" }
  },
  "P3.8.20": {
    how: ["Dis à Claude : « Construis les objectifs d'acquisition » (semaine, mois, trimestre, du plan section 2).", "Chaque lundi, regarde le tableau : prospects, essais, inscriptions, avis, publications, coût par canal.", "Double ce qui marche, coupe ce qui ne ramène rien."],
    done: "Le tableau est dans l'admin et tu le revois chaque lundi.",
    link: { href: "/admin/acquisition", label: "D'où viennent nos familles" }
  },
  "P3.8.21": {
    how: ["Chaque lundi, choisis 3 crochets et 2 angles dans la banque.", "Publie-les en reels d'essai (montrés aux non-abonnés).", "Le jeudi, garde le gagnant (rétention à 3 s, partages, messages) : vrai compte, puis publicité à 10-20 $ par jour.", "Arrête une publicité après 7 jours sans essai."],
    done: "4 semaines de tests notées, au moins une publicité qui ramène des essais.",
    link: { href: "/admin/reseaux", label: "Réseaux sociaux" }
  },
  "P3.2.23": {
    how: ["Confirme la personne caméra : pratiques, horaires, matériel (trépied, téléphone, micro).", "Donne-lui le guide de tournage (P3.2.24).", "Chaque sortie : la vidéo complète (Veo), les plans pour les reels, 2 blocs Valkyria Lab, tes vidéos JP Coach.", "Après décembre, transfère la tâche à Will (méthode montrer, faire ensemble, laisser faire, vérifier)."],
    done: "Chaque pratique de groupe et chaque pratique individuelle est filmée depuis 3 semaines.",
    link: { href: "/admin/contenu/captation", label: "Captation" }
  },
  "P3.2.24": {
    how: ["Dis à Claude : « Construis le guide de tournage » dans Création de contenu.", "Ajoute 1 ou 2 exemples de vidéos qu'on aime pour chaque format.", "Fais-le lire à la personne caméra et à Will."],
    done: "Le guide est en ligne et la personne caméra filme avec.",
    link: { href: "/admin/contenu", label: "Création de contenu" }
  },
  "P3.2.25": {
    how: ["Dis à Claude : « Remplis le calendrier de contenu de l'académie pour 90 jours ».", "Chaque dimanche, revois la semaine suivante (2 semaines d'avance).", "Chaque publication finit par « Réserve l'essai gratuit »."],
    done: "Le calendrier est rempli jusqu'au 28 février et une publication part chaque jour.",
    link: { href: "/admin/contenu/calendrier", label: "Calendrier de publication" }
  },
  "P3.2.26": {
    how: ["Reprends les bios proposées dans le plan (section 6).", "Mets le lien de l'essai gratuit en bio (Instagram, Facebook, TikTok de l'académie).", "Vérifie que le nom, la photo et la description sont les mêmes partout."],
    done: "Les 3 comptes ont la même bio claire et le lien de l'essai."
  },
  "P3.2.27": {
    how: ["Chaque lundi, choisis la joueuse (âges et niveaux en alternance) et préviens sa famille.", "Filme-la au Club des Recrues : son histoire, ce qu'elle aime, ce qu'elle a appris.", "Monte 3 contenus : reel 30 s, version longue, citation en image."],
    done: "Une entrevue par semaine depuis décembre.",
    link: { href: "/admin/contenu/entrevues", label: "Entrevues" }
  },
  "P3.2.28": {
    how: ["Bloque dans ton agenda : 100 min de marketing et 30 min de veille chaque jour.", "Ajoute 2 plages JP Coach et 1 plage Valkyria Lab par semaine.", "Ajoute 2 h de formation à la publicité."],
    done: "Les blocs sont dans l'agenda et tenus 3 semaines de suite.",
    link: { href: "/admin/moi/calendrier", label: "Mon calendrier" }
  },
  "P3.6.10": {
    how: ["Dis à Claude : « Construis le tableau des essais par étape ».", "Chaque matin, la gérante appelle les demandes de moins de 24 h et fait les relances du jour.", "Une famille pas prête va dans la liste chaude."],
    done: "Aucune demande sans réponse depuis plus de 24 h pendant un mois.",
    link: { href: "/admin/relances", label: "Relances et suivi" }
  },
  "P3.1.08": {
    how: ["Dis à Claude : « Ajoute la carte Invite une amie à l'essai » dans l'espace famille.", "Choisis la récompense par palier (P3.1.03).", "Annonce-le aux familles avec le bulletin."],
    done: "La carte est en ligne et les premiers essais viennent de parents.",
    link: { href: "/admin/apercu", label: "Aperçu de l'espace famille" }
  }
};

export const guideFor = (code: string): TaskGuide | null => TASK_GUIDES[code] ?? null;

/** Tâche à JP : il est nommé dans le responsable (« JP », « JP + caméra »…). */
export const isForJp = (owner: string | null | undefined) => /\bJP\b/.test(owner ?? "");

# Cahier des charges stratégique New Valkyria (version 1.0, novembre 2026)

Remis par JP le 7 nov. 2026. C'est la **vision long terme** : 18 modules, l'océan bleu, la seconde entreprise, le centre sportif.
Le texte original de JP est en annexe, sans modification. Les noms commerciaux des modules (Passport, Proof, Lab…) sont provisoires.

## 0. À lire en premier (pour Claude Code)

- **Ce document ne remplace pas le Mandalart.** Le plan en vigueur reste `docs/MANDALART_VALKYRIA.md` (1,5 M$ encaissés en 2028,
  niveaux, tâches datées). Le cahier donne la direction au-delà de 2028 (3 M$ académie + 3 M$ entreprise technologique :
  des **ambitions**, pas des prévisions). Une idée du cahier qui devient du travail daté entre dans la section 11 du Mandalart.
- **Règle d'or du dépôt** : presque chaque module a déjà un début sur le site (carte ci-dessous). On **étend** ce qui existe,
  on ne crée pas un deuxième système. Le cahier demande lui-même de ne pas tout programmer d'un coup.
- Avant de construire un module : relire sa ligne de la carte, la section du cahier en annexe, et le skill qui couvre le domaine.
- Garde-fous du cahier, à respecter partout : données des mineurs protégées dès la conception (Loi 25 : consentement,
  visibilité, retrait, conservation) ; une IA ne prend jamais seule une décision sportive importante, une évaluation humaine
  ou un engagement financier ; chaque dollar traçable ; « 50 % » doit toujours dire quel indicateur (marge brute,
  marge contributive ou bénéfice net).

## 1. Carte : les 18 modules et ce qui existe déjà (7 nov. 2026)

État : **En place** = utilisable aujourd'hui · **Commencé** = une partie existe · **À faire** = rien encore.
Au 7 nov., certains écrans cités sont terminés dans d'autres sessions mais pas encore en ligne : inventaire, acquisition,
réseaux sociaux, structure, calculateur de lancement, échéances des contrats, Valkyria Lab (`git status` le dit).

| # | Module du cahier | État | Où ça vit déjà | Ce qui manque surtout |
|---|---|---|---|---|
| 1 | Journal de bord intelligent | Commencé | Bilan de la semaine de JP (`weekly-review.ts`, `/admin/mandalart/semaine`), journal du Mandalart (`/admin/mandalart/journal`), Mes connaissances (`jp-repo.ts`, `/admin/moi/connaissances`), rapports des éducateurs (`coach-report.ts`) | Entrée vocale au téléphone, catégories, journal privé par employé, recherche, problèmes récurrents, rapport annuel. Se range dans l'**Espace JP** (et le portail des éducateurs pour leur journal) |
| 2 | Gestion financière complète | Commencé | `/admin/revenus` (vue d'ensemble, trésorerie, budget annuel, vue annuelle), `revenue-repo.ts`, Stripe, `/admin/historique` (marges), skills `finances` et `fin-de-mois` | Lien bancaire et logiciel comptable (à confirmer), centres de coûts par projet, réconciliation bancaire, alertes de dépassement |
| 3 | Rentabilité des projets avant lancement | Commencé | Calculateur de lancement GO / NO-GO (`launch-calculator.ts`, `/admin/revenus/calculateur`, P7.2, AU11) | Scénarios prudent / central / optimiste, revenus indirects, préfinancement, recommandation lancer / tester / modifier / abandonner |
| 4 | Subventions et financements | À faire | Prévu comme section du pilier finances (`mandalart-modules.ts`, slug `subventions`) ; revenus de subvention saisis dans `revenue-repo.ts` ; agent partenaires dans `agents-blueprint.ts` | Le registre : programmes, critères, échéances, documents, montants demandés et obtenus, rappels |
| 5 | Gestion des éducateurs | Commencé | `/admin/entraineurs` (profils, certifications `certifications-repo.ts`, paie, statistiques), observation filmée mensuelle sur 10 (`coach-observations.ts`), rapports et présences (portail), contrats (`/admin/contrats`), structure et recrutement (`/admin/structure`) | Grille d'évaluation complète (sécurité, psychologie de l'enfant…), plan de développement, commentaire de l'éducateur sur son rapport |
| 6 | Bibliothèque pédagogique / Coaching OS | Commencé | Banque d'exercices Valkyria (`exercise-bank.ts`, `/admin/exercices`), méthode Valkyria écrite (`coaching-method.ts`), espace Coaching, skill `coaching` | Thèmes manquants (neurocognition, psychologie, gestion émotionnelle), vidéo par exercice, philosophie de coaching de JP écrite |
| 7 | Planification et suivi des séances | En place | Pratiques préparées d'avance (`practices-repo.ts`, `/admin/pratiques`), périodisation (`season-plan.ts`), thèmes (`/admin/themes`), pratique du jour et routine de fin (portail), présences | Comparaison planifié / réalisé, historique des thèmes par groupe |
| 8 | Valkyria Passport (espace joueuse et famille) | Commencé | Compte parent (`/compte`, `parent-repo.ts`), passeport et tests (`skill-tests.ts`), points (`player-points.ts`), lien Valkyria Lab par famille (`/lab/[token]`) | Parcours sur plusieurs saisons, photos et vidéos, consentements parentaux détaillés et partage choisi par la famille |
| 9 | Valkyria Proof (progression) | Commencé | Tests de progression (`skill-tests.ts`), évaluations à chaque pratique (`player_evaluations`), progression des joueuses (`/admin/coaching/joueuses`), `/admin/evaluations` | Vidéos annotées avant / après, rapports de progression aux familles, historique multi-saisons ; analyse vidéo automatique = étude de faisabilité |
| 10 | Valkyria Lab × Ball Mastery (**prioritaire**) | Commencé | Valkyria Lab phase 1 (`valkyria-lab.ts`, `/admin/valkyria-lab`, routines, défis, page famille), échantillons de tapis (P1.6.05 à P1.6.08) | Le tapis physique et sa vente, suivi de réalisation à la maison relié au passeport, choix du modèle économique, test de la demande avant production |
| 11 | Entraînements individuels et semi-privés | Commencé | Séances privées (`private-sessions-repo.ts`, `/admin/seances-privees`), programmes privés et semi-privés (`private-programs*.ts`) | Forfaits, objectifs individuels et comptes rendus, rentabilité par séance et par éducateur |
| 12 | Récompenses et appartenance, gala | Commencé | Points des joueuses sans classement (`player-points.ts`, P4.6), gagnantes du jour | Badges, niveaux, récompenses physiques ; le gala annuel (événement à planifier dans le Mandalart, pilier événements) |
| 13 | Expérience parent | Commencé | Sondages Voix des familles (`/admin/sondages`), relances (`outreach.ts`), messages (`/admin/communications`), parcours Valkyria (`parcours-valkyria.ts`), agent courriels (chantier n° 1 de `PLAN_CHANTIERS.md`) | Accueil des nouvelles familles, suivi des problèmes et escalade, **avis automatique avant un changement sensible dans MonClubSportif** (cas des remplaçantes vu comme une rétrogradation : à brancher dans le robot MCS, `mcs-robot-runner.ts`) |
| 14 | Boutique et merchandising | Commencé | Boutique et uniformes (`shop-repo.ts`, `uniform-kits-repo.ts`, `/admin/boutique`, `/admin/uniformes`) | Coût d'achat et marge par produit, fournisseurs, réassort, précommandes, ensembles, tapis Ball Mastery en vente |
| 15 | Équipements pédagogiques | En place | Inventaire du matériel (`inventory-repo.ts`, `/admin/inventaire`, P7.6.02) | Entretien, fournisseurs |
| 16 | Marketing, acquisition et contenu | Commencé | Réseaux sociaux (`marketing-posts.ts`, `/admin/reseaux`), sources d'acquisition (`acquisition.ts`, `/admin/acquisition`), stats des canaux (`marketing-stats.ts`), skills `social-media-skills:*` | Banque d'idées et calendrier éditorial de **30 scripts et 30 vidéos par semaine**, statuts de production, autorisations de diffusion (droit à l'image P8.1.01), coût d'acquisition et valeur à long terme |
| 17 | Administration et automatisation | En place | Robot MonClubSportif, courriels programmés, crons (`cron-jobs.ts`), tâches confiées (`team-tasks-repo.ts`), cahier des agents (`agents-blueprint.ts`), Aujourd'hui | Numéro SMS centralisé avec transfert à un humain, analyse des postes administratifs (dans `/admin/structure`) |
| 18 | Commandites et partenariats (CRM) | Commencé | `/admin/sponsors-2027`, `/admin/commandites`, offres de partenariat (`partnership-offers.ts`), échéances des contrats (`contracts-registry.ts`) | Pipeline de prospects, contreparties et activations, résultats et renouvellements |

**Hors des 18 modules :**

- **C. Formations et développement professionnel** : pour JP, dans l'**Espace JP** (`/admin/moi/connaissances` a déjà les
  cours, livres, statuts « à lire / en cours / fini ») ; ajouter diplômes, attestations, pièces jointes et l'état
  souhaitée / commencée / **certifiée**. Pour les éducateurs : `certifications-repo.ts`. Recherche des 12 formations en nov.-déc. 2026.
- **D. Océan bleu** : une fiche par concept (Lab, Passport, Proof, Coaching OS, Legacy, Family, Commerce, Intelligence) avec
  la grille du cahier (problème, client, valeur, coût, prix, risques, test minimal). À ranger dans `docs/ocean-bleu/`,
  comme `docs/concurrence/`.
- **E. Propriété intellectuelle** : trois catégories (publique, vendue, interne confidentielle) ; validation juridique au Québec.
- **F. Long terme** : seconde entreprise (logiciel de gestion sportive : le site actuel, rangé par `club_id` dans `club.ts`,
  est déjà pensé pour être dupliqué) et centre sportif privé (étude de faisabilité plus tard).
- **G. Rôles** : aujourd'hui admin (JP), gérante (Christine), éducateurs (portail), parents (`/compte`). Les rôles du cahier
  (direction, responsable financier, responsable sportif, athlète, partenaire) s'ajoutent à `admin-auth.ts` au besoin.

## 2. Décisions à prendre par JP

1. Quel logiciel comptable et quelle banque relier (module 2).
2. Le « 50 % » : marge brute, marge contributive ou bénéfice net, et par quoi (programme, saison, académie).
3. Le modèle du tapis Ball Mastery : vendu seul, inclus au premium, tapis + abonnement, ou licence (module 10).
4. Qui a accès au journal privé d'un employé (module 1), écrit et connu de tous.
5. Le rythme réel du contenu : 30 vidéos par semaine demande une équipe de tournage et de montage (module 16).
6. L'ordre de construction : le cahier propose P0 à P4 ; le site a déjà les fondations (P0) et une bonne partie du P1.

## 3. Où en est la priorisation du cahier

- **P0 Fondations** : en place (authentification, rôles admin / gérante / éducateur / parent, base Supabase, familles et
  joueuses, éducateurs, programmes, audit `audit_log`).
- **P1 Première version utile** : presque en place. Manquent le journal de bord vocal, le passeport complet et l'espace
  de formation du personnel.
- **P2 Différenciation pédagogique** : Valkyria Lab × Ball Mastery en premier, puis vidéos avant / après et évaluations des éducateurs.
- **P3 Croissance** : boutique avec marges, CRM commandites, subventions, attribution marketing.
- **P4 Avancé** : analyse vidéo par IA, gala, B2B, multisport, centre sportif.

---

## Annexe : le cahier des charges tel que remis par JP

NEW VALKYRIA ACADEMY
Cahier des charges stratégique et fonctionnel — Version 1.0
Date : novembre 2026
Destination : Claude Code — conception, architecture et planification du développement
Statut : document de cadrage. Les idées et hypothèses doivent être validées avant leur mise en production.

### A. VISION GLOBALE

Construire New Valkyria Academy comme une académie de soccer privée de référence, avec une pédagogie de qualité, une expérience familiale exceptionnelle, une forte rentabilité et une structure capable de fonctionner à grande échelle.

Le projet repose sur quatre ambitions :

1. Développer les joueuses et joueurs de façon durable, avec une pédagogie documentée et des progrès observables.
2. Créer une expérience unique pour les familles, les éducateurs et les partenaires.
3. Automatiser et mesurer les opérations afin d'améliorer la qualité et la rentabilité.
4. Développer à terme une seconde entreprise commercialisant certains outils, méthodes et systèmes auprès d'autres organisations sportives.

Objectifs financiers aspiratoires à étudier :

- Académie : jusqu'à 3 M$ de chiffre d'affaires annuel.
- Entreprise technologique et de services : jusqu'à 3 M$ de chiffre d'affaires annuel.

Ces chiffres représentent des ambitions, non des prévisions validées.

Principes fondamentaux

- La qualité pédagogique demeure prioritaire.
- Chaque dollar doit être traçable.
- Chaque expérience importante doit pouvoir nourrir l'amélioration continue.
- Les familles doivent comprendre la valeur de leurs programmes.
- Le système doit être simple à utiliser.
- La confidentialité des données, particulièrement celles des mineurs, doit être intégrée dès la conception.
- La croissance doit reposer sur des processus reproductibles.
- La rentabilité doit financer l'innovation et l'amélioration des services.

### B. LES 18 MODULES DU SYSTÈME

#### Module 1 — Journal de bord intelligent

Créer un journal de bord accessible depuis un téléphone, idéalement avec dictée vocale.

Fonctionnalités :

- Entrées textuelles ou vocales.
- Transcription et synthèse assistées par IA.
- Ajout de photos, vidéos et documents.
- Catégorisation : coaching, parents, finances, administration, expérience client, personnel, incidents, innovations.
- Historique daté et consultable.
- Recherche par mots-clés, période, thème et auteur.
- Identification des problèmes récurrents.
- Suggestions d'actions correctives.
- Suivi des décisions et de leurs résultats.
- Rapports mensuels, saisonniers et annuels.
- Comparaison des saisons.

Confidentialité :

- Chaque employé dispose d'un journal personnel privé.
- La direction possède un tableau de bord global.
- Les droits d'accès doivent être explicites, connus des utilisateurs et configurables.
- Prévoir une distinction entre notes personnelles confidentielles, notes professionnelles et rapports partagés.

Livrable majeur : un rapport annuel qui résume ce qui a bien fonctionné, les erreurs commises, les solutions appliquées et les améliorations recommandées.

#### Module 2 — Gestion financière complète

Construire une vision financière centralisée.

Intégrations envisagées :

- Comptes bancaires professionnels.
- Logiciel comptable utilisé par l'académie, à confirmer.
- Stripe ou autres solutions de paiement.
- Plateforme d'inscription.
- Boutique.
- Commandites.
- Tournois et événements.

Fonctionnalités :

- Traçabilité des revenus et dépenses.
- Attribution des opérations à un projet, une activité ou un centre de coûts.
- Calcul des coûts directs et indirects.
- Suivi des frais bancaires, commissions, taxes et remboursements.
- Marge brute, marge contributive et bénéfice net.
- Prévisions de trésorerie.
- Budgets prévisionnels et dépenses réelles.
- Détection des écarts.
- Suivi des factures et paiements.
- Rapports par programme, équipe, événement, produit et saison.
- Alertes sur les dépassements budgétaires.
- Calcul du seuil de rentabilité.
- Réconciliation bancaire et contrôle des transactions.

Conserver un objectif stratégique de 50 % de bénéfice ou de marge selon le projet, en définissant précisément l'indicateur utilisé. Ne pas confondre marge brute et marge nette.
Prévoir des exceptions justifiées pour certains projets pédagogiques, stratégiques ou d'acquisition d'expérience.

#### Module 3 — Évaluation de rentabilité des projets

Avant chaque lancement :

- Définir le projet et ses objectifs.
- Estimer les investissements.
- Évaluer les coûts fixes et variables.
- Calculer les scénarios prudent, central et optimiste.
- Déterminer le nombre minimal d'inscriptions ou de ventes.
- Évaluer les risques.
- Chercher des revenus complémentaires.
- Étudier les possibilités de préfinancement.
- Identifier les partenaires et commanditaires potentiels.
- Produire une recommandation : lancer, tester, modifier ou abandonner.

Exemples :

- Préfinancer un terrain grâce à des commandites.
- Rentabiliser un tournoi avec la boutique et les services vidéo.
- Mutualiser les équipements entre plusieurs programmes.
- Évaluer les revenus indirects d'une activité.

#### Module 4 — Gestion des subventions et financements

Créer un registre des possibilités de financement :

- Aides gouvernementales.
- Programmes municipaux.
- Subventions sportives.
- Aides à l'emploi et à la formation.
- Soutiens à l'entrepreneuriat et à l'innovation.
- Financements privés.

Suivre :

- Conditions d'admissibilité.
- Échéances.
- Documents nécessaires.
- Montants demandés et obtenus.
- Historique des candidatures.
- Dates de renouvellement.
- Possibilités d'admissibilité future.

Prévoir des rappels et une veille périodique, avec vérification des critères à partir des sources officielles.

#### Module 5 — Gestion des éducateurs

Créer un profil professionnel pour chaque éducateur.

Informations :

- Expérience.
- Diplômes et certifications.
- Spécialités.
- Groupes encadrés.
- Disponibilités.
- Responsabilités.
- Formations suivies.
- Objectifs professionnels.

Système d'évaluation périodique :

- Préparation des séances.
- Qualité pédagogique.
- Communication.
- Gestion du groupe.
- Sécurité.
- Compréhension de la psychologie de l'enfant.
- Qualité des rétroactions.
- Adaptation aux différents niveaux.
- Professionnalisme.
- Progression individuelle des athlètes, interprétée avec prudence.

Prévoir :

- Grille d'évaluation transparente.
- Observations de séances.
- Rétroactions constructives.
- Rapports individuels.
- Plans de développement.
- Historique des évaluations.
- Possibilité pour l'éducateur de commenter son rapport.

#### Module 6 — Bibliothèque pédagogique et Coaching OS

Documenter la méthode New Valkyria.

Ressources :

- Ball Mastery.
- Technique individuelle.
- Duels offensifs et défensifs.
- Jeu de position.
- Transitions.
- Intelligence de jeu.
- Prise de décision.
- Neurocognition.
- Psychologie de l'enfant.
- Gestion émotionnelle.
- Gestion des groupes.
- Pédagogie des jeunes.

Pour chaque exercice :

- Objectif.
- Âge et niveau.
- Matériel.
- Dimensions du terrain.
- Nombre de participants.
- Durée.
- Consignes.
- Critères de réussite.
- Variantes.
- Vidéo de démonstration.
- Erreurs fréquentes.
- Points d'intervention du coach.

Documenter également la philosophie personnelle de coaching de JP afin de pouvoir transmettre les méthodes qui fonctionnent.

#### Module 7 — Planification et suivi des séances

Créer un planificateur de séances :

- Bibliothèque d'exercices.
- Plans par groupe et catégorie.
- Objectifs individuels et collectifs.
- Répartition des éducateurs.
- Liste du matériel.
- Présences.
- Observations.
- Compte rendu après séance.
- Historique des thèmes travaillés.
- Comparaison entre planification et réalisation.

Le système doit permettre de standardiser les fondamentaux tout en laissant de la liberté pédagogique aux éducateurs.

#### Module 8 — Valkyria Passport : espace personnel des joueuses

Créer un compte sécurisé pour chaque famille et un profil pour chaque athlète.

Contenu :

- Parcours sportif.
- Historique des saisons.
- Photos et souvenirs.
- Vidéos d'entraînement.
- Extraits de matchs.
- Évaluations.
- Objectifs.
- Progression.
- Récompenses.
- Présences.
- Défis réalisés.
- Réalisations importantes.

Les familles doivent pouvoir consulter le parcours et choisir volontairement certains éléments à partager.

Prévoir :

- Consentements parentaux spécifiques.
- Contrôles de visibilité.
- Possibilité de retrait des autorisations.
- Gestion des droits d'accès.
- Protection renforcée des données des mineurs.

#### Module 9 — Valkyria Proof : suivi de progression

Développer un système d'évaluation sportive.

- Évaluation initiale.
- Objectifs personnalisés.
- Tests techniques reproductibles.
- Comparaisons avant/après.
- Vidéos annotées.
- Observations des éducateurs.
- Rapports de progression.
- Historique sur plusieurs saisons.

Les statistiques de matchs et d'entraînements pourraient être ajoutées progressivement.
Toute statistique issue de vidéos doit être vérifiable. Les fonctions automatiques d'analyse vidéo nécessiteront une étude de faisabilité technique.

#### Module 10 — Valkyria Lab × Ball Mastery

Concept prioritaire.
Fusionner le programme Ball Mastery et Valkyria Lab autour d'un outil physique et numérique commun.

Produit envisagé :

- Tapis d'entraînement personnalisé New Valkyria.
- Repères visuels pour les exercices.
- Bibliothèque vidéo associée.
- Programmes progressifs.
- Défis à domicile.
- Suivi de réalisation.
- Récompenses.
- Historique de progression.

Parcours :

1. La joueuse découvre le tapis pendant les séances.
2. Le coach lui enseigne les mouvements.
3. Les parents comprennent son utilisation.
4. La famille peut acquérir le tapis.
5. La joueuse poursuit les exercices à domicile.
6. Ses activités alimentent son passeport sportif.
7. Le coach peut adapter les exercices.

Étudier plusieurs modèles économiques :

- Tapis vendu séparément.
- Tapis inclus dans un programme premium.
- Tapis + abonnement numérique.
- Licence pour d'autres académies.
- Offres groupées avec équipements.

Tester la valeur pédagogique et la demande avant de lancer une production importante.

#### Module 11 — Entraînements individuels et semi-privés

Développer une offre structurée :

- Séances individuelles.
- Séances semi-privées.
- Petits groupes spécialisés.
- Programmes techniques.
- Programmes de progression sur plusieurs semaines.
- Séances ponctuelles.
- Défis et concours.

Fonctionnalités :

- Réservation.
- Calendrier des disponibilités.
- Attribution d'un éducateur.
- Paiement.
- Forfaits.
- Objectifs individuels.
- Comptes rendus.
- Vidéos.
- Suivi des résultats.
- Calcul de rentabilité par séance et par éducateur.

Étudier un modèle de coaching spécialisé, dans lequel certains éducateurs développent une expertise reconnue.

#### Module 12 — Récompenses et sentiment d'appartenance

Créer un système de reconnaissance qui valorise plusieurs formes de réussite.

Récompenses possibles :

- Assiduité.
- Persévérance.
- Effort.
- Progression.
- Leadership.
- Esprit d'équipe.
- Respect.
- Défis techniques.
- Réussites sportives.

Fonctionnalités :

- Points et badges.
- Niveaux symboliques.
- Historique des réalisations.
- Photos.
- Récompenses physiques.
- Billets ou invitations à des événements.
- Tableau de progression individuel.

Éviter que le système ne favorise uniquement les joueuses les plus performantes.

Gala annuel

Organiser un événement réunissant :

- Joueuses.
- Familles.
- Éducateurs.
- Partenaires.

Récompenses sportives et humaines, vidéos de saison, moments marquants, célébration des progrès et distinctions pour les éducateurs.
Le gala doit devenir un événement attendu, festif et inclusif.

#### Module 13 — Gestion de l'expérience parent

Créer un système de suivi de la relation avec les familles.

- Accueil des nouvelles familles.
- Présentation des règles.
- Explication des programmes.
- Communication des horaires.
- Notifications.
- Gestion des demandes.
- Suivi des problèmes.
- Historique des solutions.
- Sondages de satisfaction.
- Rétroactions.
- Prévention des incompréhensions.

Exemple réel à documenter : l'ajout administratif de joueuses comme remplaçantes dans Mon Club Sportif a été interprété par certains parents comme une rétrogradation.
Solution à envisager : communication explicative automatique avant certaines modifications administratives sensibles.
Prévoir des procédures d'escalade vers un responsable humain.

#### Module 14 — Boutique et merchandising

Développer une boutique structurée.

Produits envisagés :

- Sacs à dos.
- Tracksuits.
- Maillots.
- Shorts.
- Bas.
- Vêtements d'entraînement.
- Tapis Ball Mastery.
- Accessoires techniques.
- Ensembles mère-fille.
- Produits personnalisés.

Fonctionnalités :

- Inventaire.
- Coût d'achat.
- Prix de vente.
- Marge.
- Fournisseurs.
- Commandes.
- Réassort.
- Précommandes.
- Offres groupées.
- Promotions.
- Produits commandités.
- Historique des ventes.
- Rentabilité par produit.

Étudier :

- Approvisionnement international.
- Négociation des volumes.
- Réduction des stocks dormants.
- Produits complémentaires.
- Gestion d'une éventuelle personne responsable de la boutique.

#### Module 15 — Équipements pédagogiques

Créer un inventaire du matériel :

- Ballons de qualité.
- Buts adaptés.
- Équipements pour Blazepod.
- Tapis techniques.
- Caméras vidéo.
- Accessoires pédagogiques.
- Équipements d'entraînement.

Suivre :

- Quantités.
- Emplacements.
- État.
- Entretien.
- Coût.
- Durée de vie.
- Besoins de remplacement.
- Fournisseurs.

#### Module 16 — Marketing, acquisition et contenu

Développer une stratégie de contenu récurrente.

Objectif opérationnel :

- Écrire au moins 30 scripts vidéo par semaine.
- Viser la production de 30 vidéos par semaine.
- Prévoir des journées de tournage.
- Organiser montage, validation, publication et analyse.

Formats :

- Progression avant/après.
- Témoignages des parents.
- Entrevues Zoom.
- Présentation des joueuses.
- Conseils techniques.
- Coulisses de l'académie.
- Explications pédagogiques.
- Présentation des éducateurs.
- Moments forts.
- Contenus éducatifs.
- Présentation des programmes.
- Produits Valkyria.

Fonctionnalités :

- Banque d'idées.
- Calendrier éditorial.
- Scripts.
- Statuts de production.
- Gestion des fichiers.
- Autorisations de diffusion.
- Historique des publications.
- Analyse des résultats.

Suivi marketing :

- Publicités Meta.
- Google Ads.
- Acquisition organique.
- Sources des inscriptions.
- Coût par prospect.
- Coût d'acquisition client.
- Conversion.
- Revenus attribuables.
- Rétention.
- Valeur client à long terme.

#### Module 17 — Administration et automatisation

Étudier l'automatisation des tâches répétitives :

- Inscriptions.
- Relances.
- Calendriers.
- Facturation.
- Réponses aux questions fréquentes.
- Demandes d'information.
- Réservations.
- Commandes.
- Gestion des fournisseurs.
- Suivi des partenariats.
- Rapports.
- Notifications.

Étudier un numéro de communication centralisé, notamment par SMS.
Les échanges sensibles, les situations impliquant des enfants et les décisions importantes doivent pouvoir être transférés à une personne responsable.

Analyser les postes administratifs des grandes organisations sportives afin d'identifier :

- Les fonctions indispensables.
- Les fonctions mutualisables.
- Les tâches automatisables.
- Les fonctions nécessitant une présence humaine.

La création de l'identité visuelle et certaines fonctions créatives devront conserver une supervision professionnelle.

#### Module 18 — Commandites et partenariats

Créer un CRM des partenaires :

- Prospects.
- Contacts.
- Offres.
- Contrats.
- Montants.
- Échéances.
- Contreparties.
- Visibilité.
- Activations.
- Résultats.
- Renouvellements.

Mesurer la valeur des commandites au-delà du logo :

- Événements.
- Recommandations.
- Services aux familles.
- Produits.
- Visibilité numérique.
- Programmes préfinancés.

Étudier les partenariats comme levier de réduction des coûts et de développement des revenus.

### C. FORMATIONS ET DÉVELOPPEMENT PROFESSIONNEL

Créer un espace personnel de développement professionnel pour JP, puis potentiellement pour tous les éducateurs.

Fonctionnalités :

- Photo de profil.
- Diplômes.
- Certifications.
- Attestations.
- Formations terminées.
- Formations en cours.
- Formations envisagées.
- Dates.
- Organismes.
- Spécialisations.
- Objectifs.
- Échéances.
- Pièces justificatives.

Formations à rechercher en novembre et décembre 2026 :

1. Neurocognition appliquée au soccer.
2. Coaching individuel.
3. Coaching semi-privé.
4. Jeu de position.
5. Jeux de transition.
6. Psychologie de l'enfant.
7. Business et entrepreneuriat.
8. Meta Ads.
9. Google Ads.
10. Création de contenu.
11. Production vidéo.
12. Analyse vidéo sportive.

Important : distinguer les formations souhaitées, commencées et réellement certifiées.

### D. STRATÉGIE OCÉAN BLEU

Utiliser le livre Stratégie Océan Bleu, de W. Chan Kim et Renée Mauborgne, comme référence de réflexion stratégique.

Méthode :

- Éliminer les éléments peu utiles.
- Réduire les coûts et frictions sans valeur pédagogique.
- Renforcer les éléments réellement importants pour les familles.
- Créer de nouvelles formes de valeur.

Concepts prioritaires à étudier :

1. Valkyria Lab × Ball Mastery.
2. Valkyria Passport.
3. Valkyria Proof.
4. Valkyria Coaching OS.
5. Valkyria Legacy.
6. Valkyria Family.
7. Valkyria Commerce.
8. Valkyria Intelligence.

Chaque concept doit faire l'objet d'une analyse :

- Problème résolu.
- Client cible.
- Proposition de valeur.
- Différenciation.
- Coût.
- Prix envisageable.
- Faisabilité.
- Risques.
- Impact pédagogique.
- Potentiel commercial.
- Test minimal avant déploiement.

### E. PROPRIÉTÉ INTELLECTUELLE

Protéger les ressources numériques et les méthodes.

Étudier :

- Comptes authentifiés.
- Limitation des connexions simultanées.
- Gestion des appareils.
- Abonnements.
- Licences.
- Contrôle des accès.
- Filigranes personnalisés.
- Journalisation des accès.
- Conditions d'utilisation.
- Contrats de confidentialité.
- Protection des marques et contenus.
- Procédures de retrait en cas de diffusion non autorisée.

Aucune protection technique ne peut garantir l'absence de copie.

Distinguer trois catégories :

1. Ressources publiques.
2. Produits et formations commercialisés.
3. Ressources stratégiques internes et confidentielles.

Prévoir une validation juridique adaptée au Québec et aux marchés ciblés.

### F. PROJETS DE CROISSANCE À LONG TERME

Entreprise technologique et de services

Créer potentiellement une seconde entreprise proposant :

- Logiciel de gestion sportive.
- Système d'acquisition client.
- Automatisation.
- CRM.
- Analyse marketing.
- Gestion financière.
- Plateforme pédagogique.
- Outils de fidélisation.
- Conseil et accompagnement.

Marchés envisageables :

- Académies de soccer.
- Clubs sportifs.
- Basketball.
- Autres sports.
- Écoles et institutions sportives.

Valider la demande, les coûts de support, la capacité technique et la disposition à payer avant de commercialiser.

Centre sportif privé

Étudier un futur centre avec :

- Terrain de soccer à 7.
- Gymnase.
- Espaces de formation.
- Bistrot.
- Boutique.
- Espaces vidéo.
- Activités privées.
- Ligues.
- Tournois.
- Compétitions.

Produire ultérieurement une étude de faisabilité :

- Terrain et bâtiment.
- Coûts de construction ou location.
- Équipements.
- Exploitation.
- Assurances.
- Revenus potentiels.
- Taux d'occupation.
- Seuil de rentabilité.
- Financement.
- Scénarios de développement.

### G. EXIGENCES TECHNIQUES

Architecture souhaitée :

- Application web adaptée au mobile.
- Comptes utilisateurs sécurisés.
- Gestion des rôles et permissions.
- Base de données centralisée.
- Stockage sécurisé des médias.
- Historique des modifications.
- Sauvegardes.
- Exports.
- API documentée.
- Intégrations externes.
- Tableaux de bord.
- Notifications.
- Modules évolutifs.
- Automatisations supervisées.
- Fonctions IA avec validation humaine pour les décisions sensibles.

Rôles envisagés :

- Superadministrateur.
- Direction.
- Responsable administratif.
- Responsable financier.
- Responsable sportif.
- Éducateur.
- Parent ou tuteur.
- Athlète.
- Partenaire externe.

Prévoir une séparation stricte des données selon les rôles.
Pour les données personnelles des mineurs, intégrer les exigences applicables en matière de consentement, confidentialité, conservation, suppression et sécurité.
Les décisions sportives importantes, les évaluations humaines et les décisions financières engageantes ne doivent pas être confiées sans contrôle à une IA.

### H. PRIORISATION INITIALE

P0 — Fondations

- Authentification.
- Rôles et permissions.
- Base de données.
- Gestion des familles et athlètes.
- Gestion des éducateurs.
- Structure des programmes.
- Sécurité et confidentialité.
- Journalisation.

P1 — Première version utile

- Journal de bord.
- Passeport sportif simple.
- Calendrier et présences.
- Bibliothèque pédagogique.
- Planification des séances.
- Suivi financier initial.
- Gestion des tâches.
- Espace de formation du personnel.

P2 — Différenciation pédagogique

- Valkyria Lab × Ball Mastery.
- Suivi de progression.
- Vidéos avant/après.
- Évaluations des éducateurs.
- Entraînements individuels et semi-privés.
- Récompenses.
- Expérience parent.

P3 — Croissance commerciale

- Boutique.
- Stocks.
- Commandites.
- Marketing et attribution.
- Gestion des subventions.
- Automatisations avancées.
- Analyses de rentabilité.

P4 — Développement avancé

- Analyse vidéo assistée par IA.
- Statistiques sportives avancées.
- Gala et gamification étendue.
- Commercialisation B2B.
- Développement multisport.
- Étude du centre sportif.

Les priorités sont provisoires et devront être ajustées selon les coûts, les dépendances et les retours des familles.

### I. MANDAT INITIAL À CLAUDE CODE

À partir de ce document :

1. Analyser la vision et identifier les besoins fonctionnels.
2. Distinguer les fonctionnalités confirmées, les hypothèses et les éléments nécessitant une décision.
3. Proposer une architecture logicielle modulaire.
4. Définir un modèle de données initial.
5. Définir les rôles et permissions.
6. Identifier les intégrations externes possibles et leurs contraintes.
7. Décomposer le développement en étapes indépendantes.
8. Proposer un MVP réaliste.
9. Estimer la complexité relative de chaque module.
10. Identifier les dépendances et les risques.
11. Proposer une stratégie de tests.
12. Préparer les spécifications techniques avant tout développement majeur.

Ne pas programmer immédiatement l'intégralité du système.
Commencer par l'architecture, le modèle de données, la sécurité, les flux utilisateurs et la feuille de route.
Les noms commerciaux des modules sont provisoires.

Objectif final : construire un système évolutif qui améliore la pédagogie, l'expérience familiale, l'efficacité opérationnelle et la rentabilité de New Valkyria Academy, puis qui pourrait être adapté à d'autres organisations sportives.

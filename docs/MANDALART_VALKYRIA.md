# Mandalart New Valkyria — 1 500 000 $ en 2028

Dossier de référence pour Claude Code. Mis à jour le 1er nov. 2026. Contenu identique à `mandalart.json` (même générateur) ; le texte de travail vit dans le doc « Mandalart New Valkyria » (https://claude.ai/artifact/7xpk4LiFTegzx6EUz4co5J, révision 96).

## 0. À lire en premier (pour Claude Code)

- **Qui** : Jean-Paul Aka Boidi (JP), fondateur de l'Académie New Valkyria Inc., académie de soccer féminin des Laurentides et de la Rive-Nord (Québec). Site : newvalkyria.com (Next.js 16 App Router, Supabase, Stripe, Gmail SMTP, Vercel, déploiement automatique depuis `main`).
- **Ce que JP veut** : voir son objectif dans son espace administrateur, cocher ce qu'il fait, voir une barre de progression sur chaque élément et sur l'objectif, et avancer par niveaux pour savoir sur quoi travailler maintenant. L'admin doit montrer « ce qui se trame » et faire le suivi.
- **Ce qu'il faut construire** : le module `/admin/mandalart` (section 6), qui charge `mandalart.json`, garde l'état des cases cochées dans Supabase et calcule les progressions (section 2). Puis, dans l'ordre des niveaux, les automatisations et les agents de la section 5.
- **Règles** : interface en français du Québec ; JP travaille surtout sur son téléphone ; ne jamais changer le contenu du plan sans JP ; ne jamais écraser une case cochée lors d'une nouvelle importation ; aucune donnée d'enfant dans les tables du Mandalart (Loi 25).
- **En chiffres** : 8 piliers × 8 objectifs = 64 objectifs ; 251 tâches, dont 69 ⭐ ; 6 niveaux ; 27 indicateurs ; 11 agents IA ; 16 automatisations.
- **Ce mois-ci (novembre 2026)** : JP travaille sur le pilier 1, Excellence pédagogique. C'est le pilier le plus détaillé ; ses ⭐ de novembre sont dues le 30 novembre.

## 1. La case centrale

**1 500 000 $ de chiffre d'affaires encaissés sur la même année civile, du 1er janvier au 31 décembre 2028, et au moins 400 000 $ par année pour JP.**

- **Valkyria (proposition à valider)** : ≈ 1 000 000 $ de CA à 50 % de marge (≈ 500 000 $ de profit). Répartition bâtie sur les chiffres du plan : saison d'hiver pleine sur 5 générations et été au scénario maximal.
  - Camps (été, relâche, Fêtes) : environ 370 000 $
  - Académie (hiver + Valkyria Été) : environ 285 000 $
  - Parascolaire : environ 160 000 $
  - Commandites : environ 80 000 $
  - Autres (élite, kits, tournoi, fêtes, Home Lab) : environ 105 000 $
- **Conseil aux clubs** : 500 000 $ de CA à environ 75 % de marge (25 à 35 clubs à ≈ 17 000 $) ; pilotes fin 2027, vrai départ en 2028.
- **Salaire de JP dès février 2027** : 10 000 $ brut par mois, sans exception : 230 000 $ brut de février 2027 à décembre 2028 (2027 : 110 000 $ ; 2028 : 120 000 $).
- **Rémunération de JP** : Environ 200 000 $ de salaire + 200 000 $ de dividendes, à valider avec Pontbriand Lamarche CPA.
- Palier intermédiaire : 1 000 000 $ sur l'année 2028.
- Valkyria est le laboratoire : chaque système documenté devient un futur produit pour les clubs.

### Indicateurs : point de départ et cible

| Id | Indicateur | Départ | Cible | Échéance | Source | Comment le mesurer |
| --- | --- | --- | --- | --- | --- | --- |
| `ca_annee` | Chiffre d'affaires de l'année civile (1er janvier au 31 décembre) | 106 986 $ (2026, encaissé d'avril à octobre) | 1 500 000 $ (palier 1 000 000 $) | 31 déc. 2028 | auto | Somme des paiements encaissés depuis le 1er janvier de l'année en cours, toutes lignes d'affaires (Stripe + autres). Repart à zéro chaque 1er janvier. L'objectif se juge sur l'année 2028 seulement. Module Revenus. |
| `ca_12m` | Rythme annuel : CA des 12 derniers mois | 106 986 $ (avril à octobre 2026) | 1 500 000 $ | 31 déc. 2028 | auto | Somme des encaissements sur 365 jours glissants. Sert à voir avant 2028 si le rythme approche 1,5 M$. |
| `ca_valkyria_annee` | CA Valkyria de l'année civile (académie, parascolaire, camps, commandites) | 112 000 $ (rythme de la 1re année) | 1 000 000 $ | 31 déc. 2028 | auto | Revenus Valkyria seulement (exclure garçons/JP Coach et conseil). Cible 2028 proposée, à valider. |
| `marge_valkyria` | Marge de Valkyria | 27 % (automne-hiver 2026, estimation optimiste ; été 2026 : 44 %) | 50 % | 31 déc. 2028 | manuel | Saisie après chaque bilan de session ; plus tard calculée à partir des coûts par programme. |
| `ca_conseil_annee` | CA du conseil aux clubs, année civile | 0 $ | 500 000 $ | 31 déc. 2028 | manuel | Entité séparée : saisie mensuelle. |
| `clubs_conseil` | Clubs clients du conseil | 0 clubs | 30 clubs | 31 déc. 2028 | manuel | 2 à 3 pilotes fin 2027, puis 25 à 35 clubs en 2028 ; à ≈ 17 000 $ par club, 30 clubs ≈ 500 000 $. |
| `remuneration_jp` | Rémunération annuelle de JP (salaire + dividendes) | à fournir | 400 000 $ | 31 déc. 2028 | manuel | Environ 200 000 $ de salaire + 200 000 $ de dividendes, à valider avec Pontbriand Lamarche CPA. |
| `salaire_jp` | Salaire de JP versé depuis février 2027 (10 000 $ brut par mois) | 0 $ | 230 000 $ | 31 déc. 2028 | auto | 23 mois × 10 000 $ brut, de février 2027 à décembre 2028, sans exception. Calculé à partir des mois cochés « salaire versé » (plus tard : module Paie). |
| `membres_actifs` | Joueuses filles actives | 83 joueuses | 200 joueuses | 30 sept. 2028 | auto | Inscriptions filles actives de la saison en cours (académie). |
| `cohortes_2017_2019` | Joueuses nées en 2017, 2018 et 2019 | 8 joueuses | 120 joueuses | 30 sept. 2028 | auto | Environ 40 par génération. Protège contre le départ de la génération 2015 en U13 (2028). |
| `retour_saison` | Familles qui reviennent d'une saison à l'autre | 74 % (37 familles sur 50, de l'été à l'automne) | 85 % | 31 déc. 2027 | auto | Familles actives à la saison N-1 réinscrites à la saison N (hors départs U13). |
| `remplissage` | Places remplies dans l'horaire filles | 85 % (78 places sur 92) | 90 % | 31 déc. 2027 | auto | Inscrites ÷ capacité de tous les créneaux filles. |
| `source_connue` | Inscriptions avec une source d'acquisition connue | 30 % (16 familles sur 54) | 100 % | 31 janv. 2027 | auto | Champ « Comment nous avez-vous connus ? » rempli à l'inscription et à l'essai. |
| `nouvelles_joueuses_an` | Nouvelles joueuses par année | à mesurer | 80 joueuses | 31 déc. 2027 | auto | Cible 60 à 80 par année, surtout U8-U9. |
| `cac` | Coût d'acquisition par inscription | à mesurer | ≤ 70 $ | 31 déc. 2027 | manuel | Dépenses d'acquisition ÷ nouvelles inscriptions, par canal. Valeur à vie ÷ CAC ≥ 3. |
| `commandites_annee` | Commandites vendues pour l'année | 5 100 $ (sur 27 300 $ visés pour 2027) | 45 000 $ (idéal 80 000 $) | 31 déc. 2027 | auto | Module Commandites. Cible 2028 : 80 000 $. |
| `plages_matchs` | Plages de matchs vendues (Terrebonne) | 0 plages | 23 plages | 31 mars 2027 | auto | Module Vente de matchs. 23 plages = 3 450 $, 38 % du contrat. |
| `benefice_ete_2027` | Bénéfice de l'été 2027 | 29 700 $ (été 2026) | 300 000 $ | 31 août 2027 | manuel | Prudent 58 400 $ · ambitieux 118 800 $ · maximal 300 000 $ (dont 150 000 $ pour JP). |
| `reserve_tresorerie` | Réserve de trésorerie (mois de dépenses fixes) | 0 mois (solde Stripe sous zéro) | 3 mois | 31 déc. 2027 | manuel | Compte réserve ÷ dépenses fixes mensuelles. |
| `joueuses_filmees_jour1` | Joueuses avec test du jour 1 filmé | 0 % | 100 % | 30 nov. 2026 | auto | Joueuses ayant au moins un test de type « jour 1 » dans la feuille de suivi. |
| `entrevues_saison` | Entrevues avant/après filmées cette saison | 0 filles | 40 filles | 30 avr. 2027 | manuel | Cible 30 à 40 filles par saison, chacune avec son entrevue de début et de fin. |
| `videos_semaine` | Vidéos publiées par semaine | 0 vidéos | 3 vidéos (idéal 5 vidéos) | 31 déc. 2026 | manuel | Instagram et Facebook. Cible 3, idéal 5. |
| `exercices_approuves` | Exercices approuvés dans la banque | 0 exercices | 150 exercices | 30 juin 2027 | auto | 30 par génération × 5 générations (U8 à U12). Statut calculé par la grille sur 10. |
| `seances_approuvees` | Séances bâties avec des exercices approuvés | 0 % | 80 % | 31 déc. 2027 | auto | Cible proposée (à confirmer par JP). |
| `familles_video_lab` | Familles qui envoient au moins une vidéo par mois (Valkyria Lab) | 0 % | 50 % | 30 juin 2027 | auto | 50 % = condition pour passer à la phase 2 du Lab. |
| `familles_profil` | Familles qui ouvrent le profil de leur enfant chaque mois | 0 % | 70 % | 31 déc. 2027 | auto | Connexions à l'espace parent ÷ familles actives. |
| `recommandation` | Note de recommandation des parents (sur 10) | à mesurer | 9/10 | 31 déc. 2027 | manuel | Question une fois par saison : « Sur 10, recommanderiez-vous Valkyria ? » |

## 2. Comment la progression est calculée

- **Statut d'une tâche** : à faire = 0 ; en cours = 0,5 ; fait = 1 ; abandonnée = exclue du calcul.
- **Poids** : une tâche ⭐ (priorité absolue) compte double ; une tâche ➜ (progressive) compte une fois.
- **Objectif** (une des 64 cases) = moyenne pondérée de ses tâches.
- **Pilier** = moyenne de ses 8 objectifs. **Exécution du plan** = moyenne des 8 piliers.
- **Résultats** (distance réelle à l'objectif) = pour chaque indicateur, (valeur actuelle − départ) ÷ (cible − départ), entre 0 et 100 %. La grande barre du haut = CA de l'année civile en cours ÷ 1 500 000 $, avec un repère au palier de 1 000 000 $. Elle repart à zéro chaque 1er janvier : seule l'année 2028 compte pour l'objectif. Le rythme sur 12 mois glissants (`ca_12m`) montre avant 2028 si on s'en approche.
- **Médailles** (comme le passeport des joueuses) : bronze à 25 % des tâches d'un objectif, argent à 50 %, or à 100 %, **mauve** quand les cibles de ses indicateurs sont atteintes.
- **Niveau actuel** = le premier niveau qui a encore des ⭐ non faites. Une tâche non faite dont l'échéance est passée est **en retard** (rouge).
- Afficher toujours les deux barres côte à côte : *Exécution* (ce que JP a fait) et *Résultats* (ce que ça donne). Un plan bien exécuté avec des résultats qui ne bougent pas est un signal d'alarme.

## 3. Les 6 niveaux

On passe au niveau suivant quand toutes les ⭐ du niveau sont faites (« une étape n'est lancée que si la précédente tient »). Les niveaux suivants restent visibles mais grisés.

| Niveau | Nom | Période | But | Tâches | ⭐ |
| --- | --- | --- | --- | --- | --- |
| N1 | Fondations | 1er nov. 2026 → 31 déc. 2026 | Poser les fondations : pilier 1 carré, preuve filmée, conformité, cash des Fêtes. | 88 | 28 |
| N2 | Vendre l'été d'avance | 1er janv. 2027 → 31 mars 2027 | Prévente de l'été, deuxième coach, réinscriptions, écoles pour le parascolaire. | 76 | 19 |
| N3 | Point de contrôle | 1er avr. 2027 → 31 mai 2027 | 1er avril : décider du nombre de sites selon la prévente ; embaucher l'équipe d'été. | 24 | 10 |
| N4 | Été 2027 : le vivier de cash | 1er juin 2027 → 31 août 2027 | Camps multisites et Valkyria Été ; chaque campeuse repart avec une invitation pour l'automne. | 17 | 5 |
| N5 | Élargir la base | 1er sept. 2027 → 31 déc. 2027 | Parascolaire lancé, hiver 2027-28 vendu, pilotes du conseil aux clubs. | 28 | 5 |
| N6 | 1,5 M$ en 2028 | 1er janv. 2028 → 31 déc. 2028 | 1 500 000 $ encaissés du 1er janvier au 31 décembre 2028 : Valkyria ≈ 1 000 000 $ à 50 % de marge + conseil aux clubs 500 000 $ à 75 %. | 18 | 2 |

### Niveau 1 : les ⭐ à faire maintenant

- [ ] `P7.4.01` Fournir le solde actuel (BMO + Stripe) et les encaissements prévus d'ici avril 2027. — 10 nov. 2026 · JP
- [ ] `P7.1.01` Signer le mandat avec Pontbriand Lamarche CPA. — 15 nov. 2026 · JP
- [ ] `P7.2.01` Fournir les vrais coûts : gymnase de Prévost, taux et heures de Noura, rémunération d'Annie et de JP. — 15 nov. 2026 · JP
- [ ] `P1.1.01` Écrire la structure de séance Valkyria sur une page, avec la durée de chaque bloc (jeu d'entrée, ball mastery, technique, forme jouée). — 30 nov. 2026 · JP
- [ ] `P1.1.02` Choisir les 5 gestes de base par niveau du passeport (bronze, argent, or, mauve). — 30 nov. 2026 · JP
- [ ] `P1.2.01` Fixer le test de chaque niveau : touches en 30 secondes, conduite chronométrée, passes des deux pieds. — 30 nov. 2026 · JP
- [ ] `P1.2.02` Filmer le test du jour 1 de chaque joueuse : même exercice, même angle, 30 secondes. — 30 nov. 2026 · Coachs + caméra
- [ ] `P1.3.01` Mettre en place le gabarit unique de fiche d'exercice : titre, objectif, geste ou thème, place dans la séance, âge, niveau, nombre de joueuses, espace, durée, matériel, déroulement, consignes, variantes facile, difficile et cognitive, schéma ou vidéo. — 30 nov. 2026 · JP + Claude Code
- [ ] `P1.3.02` Ajouter la grille d'évaluation sur 10 au rapport des 24 heures : 5 critères de 2 points + commentaire. — 30 nov. 2026 · Claude Code
- [ ] `P1.3.03` Faire noter par les coachs chaque exercice utilisé en novembre. — 30 nov. 2026 · Coachs
- [ ] `P1.6.01` Commander les dossards bicolores : corps d'une couleur, collet d'une autre (ex. corps noir, collet jaune). — 30 nov. 2026 · JP
- [ ] `P1.7.01` Filmer les démonstrations des gestes, moins d'une minute chacune : vitesse réelle, ralenti, 3 points clés, erreur à éviter, rôle du parent. — 30 nov. 2026 · Caméra
- [ ] `P1.7.02` Lancer la routine maison du mois (Valkyria Lab, phase 1) : page du site, vidéos non répertoriées, bouton « Envoyer ma vidéo ». — 30 nov. 2026 · JP + Claude Code
- [ ] `P1.7.03` Envoyer la banque de jeux d'hiver aux familles : jeu de la semaine et défi vidéo. — 30 nov. 2026 · JP
- [ ] `P1.7.04` Préparer le premier bulletin de suivi de la saison. — 30 nov. 2026 · Coachs
- [ ] `P3.8.01` Rendre obligatoire « Comment nous avez-vous connus ? » à l'inscription et à l'essai. — 30 nov. 2026 · Claude Code
- [ ] `P7.1.02` S'inscrire à la TPS/TVQ à la date recommandée par le CPA et fixer le traitement des taxes sur les camps et les entraînements. — 30 nov. 2026 · JP + CPA
- [ ] `P7.1.03` Obtenir l'assurance responsabilité de 5 M$ exigée par les écoles. — 30 nov. 2026 · JP
- [ ] `P7.1.04` Écrire l'entente avec la gérante : gratuité de ses filles en échange de son travail (rémunération en nature). — 30 nov. 2026 · JP
- [ ] `P8.1.02` Filmer l'entrevue de début de saison de 30 à 40 filles. — 30 nov. 2026 · Caméra
- [ ] `P8.2.01` Embaucher la personne caméra. — 30 nov. 2026 · JP
- [ ] `P8.8.01` Construire le module Mandalart dans l'admin (/admin/mandalart) : niveaux, cases à cocher, barres de progression, indicateurs. — 30 nov. 2026 · Claude Code
- [ ] `P5.2.01` Lancer la carte-cadeau « Semaine de camp Valkyria » pour Noël. — 5 déc. 2026 · JP + Claude Code
- [ ] `P2.5.01` Recalculer les prix planchers de toutes les offres avec les vrais coûts (méthode du pilier 7). — 15 déc. 2026 · JP
- [ ] `P3.2.01` Publier 3 vidéos par semaine sur Instagram et Facebook. — 31 déc. 2026 · Caméra
- [ ] `P7.3.01` Corriger les 3 créneaux sous le seuil (lundi 19 h 30, mercredi 18 h, jeudi 18 h 30 à Prévost) : remplir, fusionner ou déplacer. — 31 déc. 2026 · JP
- [ ] `P7.3.02` Revoir le contrat de Terrebonne : vendre les plages ou renégocier pour 2027. — 31 déc. 2026 · JP
- [ ] `P7.4.02` Exécuter le plan cash de novembre-décembre : places libres, demi-saisons, plages de matchs, commandites, carte-cadeau des Fêtes. — 31 déc. 2026 · JP

## 3 bis. Trajectoire d'encaissements, mois par mois (novembre 2026 à décembre 2028)

Novembre 2026 est le point de départ. Les cibles suivent les saisons réelles de Valkyria : en 2026, l'argent est arrivé en avril (dépôts de l'été, 16 500 $) et surtout en août, septembre et octobre (41 191 $, 19 740 $, 18 005 $) ; tous les versements de l'automne sont déjà payés. Un mois creux a donc une petite cible et des tâches de préparation, jamais un montant irréaliste.

- **Cible** : l'ambition de JP (été 2027 au scénario maximal, 1 500 000 $ en 2028).
- **Plancher** : le minimum acceptable (été 2027 prudent, palier de 1 000 000 $ en 2028).
- **On juge au cumul de l'année et au trimestre, pas au mois isolé** : un paiement qui glisse d'un mois n'est pas un échec. Signal d'alarme : cumul de l'année sous le plancher deux mois de suite.
- Montants encaissés, avant taxes. Le réel de chaque mois vient des paiements du site (module Revenus) ; en attendant, JP le saisit dans le Mandalart visuel.
- Conseil 2028 : Valkyria Club System à environ 17 000 $ par club, payé 50 % à la signature, 25 % à 3 mois et 25 % à 6 mois (règle B2B du pilier 7), plus formation d'entraîneurs et version en ligne. Clubs signés en 2028 : 30 (cible), 20 (plancher). Un club signé tard dans l'année ne paie pas tout en 2028 : il faut signer tôt.

### Salaire de JP : 10 000 $ brut par mois dès février 2027

- 10 000 $ brut par mois versés à JP à partir de février 2027, sans exception.
- De février 2027 à décembre 2028 : 23 mois × 10 000 $ = **230 000 $ brut** (2027 : 110 000 $ ; 2028 : 120 000 $).
- Coût pour l'entreprise avec les charges de l'employeur : environ 253 000 $ à 257 600 $. Charges de l'employeur estimées à 10 à 12 % (à confirmer avec le CPA). En 2028, ce salaire est le plancher : le reste des 400 000 $ visés vient des dividendes, décidés avec le CPA.
- Le salaire se paie aussi les mois creux (juillet, novembre, décembre) : il vient du compte rémunération rempli pendant la prévente et les inscriptions d'automne. Règle : 1 mois d'avance au 1er février 2027, 3 mois de réserve avant le 1er juillet 2027 (tâches `P7.8.05` à `P7.8.07`).
- **Vérification** : sur le chemin plancher, avec 40 % de marge, l'argent disponible couvre le salaire mois après mois mais manque d'environ 5 500 $ en décembre 2027 ; sur le chemin cible (50 % de marge), il en reste chaque mois. Le plancher de 2027 est donc le strict minimum pour payer le salaire sans exception, et remonter la marge (pilier 7) en est la condition.

### Par année

| Année | Cible | Plancher | Académie (automne-hiver) | Valkyria Été (soir) | Camps (été, relâche, Fêtes) | Parascolaire | Commandites | Élite, kits, tournoi, fêtes, Home Lab | Conseil aux clubs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026 (nov.-déc.) | 20 000 $ | 10 000 $ | 4 500 $ | 0 $ | 9 000 $ | 0 $ | 6 500 $ | 0 $ | 0 $ |
| 2027 | 814 600 $ | 284 200 $ | 142 000 $ | 90 000 $ | 370 000 $ | 30 000 $ | 45 000 $ | 117 500 $ | 20 000 $ |
| 2028 | 1 520 900 $ | 1 005 800 $ | 195 000 $ | 90 000 $ | 370 000 $ | 160 000 $ | 80 000 $ | 105 000 $ | 521 150 $ |

### Par 6 mois et par trimestre

| Période | Cible | Plancher |
| --- | --- | --- |
| **S2 2026** | **20 000 $** | **10 000 $** |
| T4 2026 | 20 000 $ | 10 000 $ |
| **S1 2027** | **548 200 $** | **148 800 $** |
| T1 2027 | 261 100 $ | 78 200 $ |
| T2 2027 | 287 100 $ | 70 600 $ |
| **S2 2027** | **266 400 $** | **135 400 $** |
| T3 2027 | 181 400 $ | 91 300 $ |
| T4 2027 | 85 000 $ | 44 100 $ |
| **S1 2028** | **871 900 $** | **570 700 $** |
| T1 2028 | 448 400 $ | 292 900 $ |
| T2 2028 | 423 500 $ | 277 800 $ |
| **S2 2028** | **649 000 $** | **435 100 $** |
| T3 2028 | 424 000 $ | 286 200 $ |
| T4 2028 | 225 000 $ | 148 900 $ |

### Par mois

| Mois | Type de mois | Cible | Plancher | Cumul de l'année (cible) | Ce qui fait rentrer l'argent |
| --- | --- | --- | --- | --- | --- |
| 2026-11 | Mois de livraison | 6 300 $ | 3 400 $ | 6 300 $ | Inscriptions fermées : peu d'argent nouveau possible. Remplir les places libres et les demi-saisons, vendre les plages de matchs et les commandites. Tout le reste du mois va au pilier 1. |
| 2026-12 | Prévente de Noël | 13 700 $ | 6 600 $ | 20 000 $ | Cartes-cadeaux « Semaine de camp Valkyria » et camp des Fêtes : premier argent de l'été 2027. |
| 2027-01 | Grand mois de prévente | 90 000 $ | 28 600 $ | 90 000 $ | Prévente des camps et de Valkyria Été aux familles actuelles, nouveaux groupes 2017-2019, campagne de la relâche. |
| 2027-02 | Prévente | 68 900 $ | 21 000 $ | 158 900 $ | Relâche, suite de la prévente, recrutement de la 2e coach et de la responsable de camp. |
| 2027-03 | Fin des prix fidèles | 102 200 $ | 28 600 $ | 261 100 $ | Date limite du 31 mars pour les prix hâtifs : grosse rentrée d'argent. |
| 2027-04 | Point de contrôle | 101 000 $ | 26 800 $ | 362 100 $ | 1er avril : nombre de sites selon la prévente ; ouverture au public ; début de la vente des commandites. |
| 2027-05 | Remplissage | 102 900 $ | 26 200 $ | 465 000 $ | Journée Valkyria pour remplir les dernières semaines de camp ; kits d'été. |
| 2027-06 | Début de l'été | 83 200 $ | 17 600 $ | 548 200 $ | Derniers paiements de camps ; commandites des sites ; tournoi en préparation. |
| 2027-07 | Livraison | 53 000 $ | 10 700 $ | 601 200 $ | Camps et Valkyria Été en cours : peu de nouvelles ventes, on livre et on filme. |
| 2027-08 | Inscriptions d'automne | 75 900 $ | 46 900 $ | 677 100 $ | Ouverture des inscriptions automne-hiver 2027-28 : le plus gros mois de l'année avec les camps qui finissent. |
| 2027-09 | Rentrée | 52 500 $ | 33 700 $ | 729 600 $ | Suite des inscriptions, essais de septembre, lancement du parascolaire. |
| 2027-10 | Saison lancée | 42 000 $ | 23 000 $ | 771 600 $ | Versements d'automne, parascolaire, premiers pilotes du conseil. |
| 2027-11 | Mois de livraison | 29 500 $ | 15 900 $ | 801 100 $ | Versements et pilotes du conseil. Préparer la prévente de l'été 2028. |
| 2027-12 | Prévente de Noël | 13 500 $ | 5 200 $ | 814 600 $ | Cartes-cadeaux de camp 2028 et camp des Fêtes ; signatures du conseil pour janvier. |
| 2028-01 | Départ de l'année du 1,5 M$ | 164 500 $ | 109 800 $ | 164 500 $ | Prévente de l'été 2028, session d'hiver du parascolaire, premières signatures du Valkyria Club System. |
| 2028-02 | Prévente | 141 800 $ | 95 000 $ | 306 300 $ | Relâche, parascolaire, signatures du conseil. |
| 2028-03 | Fin des prix fidèles | 142 100 $ | 88 100 $ | 448 400 $ | Date limite des prix hâtifs ; versements du conseil. |
| 2028-04 | Point de contrôle | 144 600 $ | 96 500 $ | 593 000 $ | Ventes de commandites, ouverture au public des camps. |
| 2028-05 | Remplissage | 146 200 $ | 97 300 $ | 739 200 $ | Derniers sites de camp, kits d'été, élite. |
| 2028-06 | Début de l'été | 132 700 $ | 84 000 $ | 871 900 $ | Paiements des camps, versements du conseil. |
| 2028-07 | Livraison | 100 300 $ | 69 700 $ | 972 200 $ | Camps en cours ; versements du conseil. |
| 2028-08 | Inscriptions d'automne | 161 000 $ | 109 800 $ | 1 133 200 $ | Saison 2028-29 : le plus gros mois Valkyria de l'année. |
| 2028-09 | Rentrée | 162 700 $ | 106 700 $ | 1 295 900 $ | Inscriptions, parascolaire d'automne, signatures du conseil. |
| 2028-10 | Saison lancée | 112 600 $ | 73 200 $ | 1 408 500 $ | Versements d'automne et du conseil. |
| 2028-11 | Dernière ligne droite | 72 100 $ | 49 500 $ | 1 480 600 $ | Versements, conseil, camp des Fêtes. |
| 2028-12 | Fin de l'année du 1,5 M$ | 40 300 $ | 26 200 $ | 1 520 900 $ | Bilan de l'année civile 2028. |

## 4. Le Mandalart en un coup d'œil

| Pilier | Les 8 objectifs |
| --- | --- |
| **P1 Excellence pédagogique** | 1 Méthode Valkyria écrite · 2 Standards de progression mesurables · 3 Séances sans improvisation et banque d'exercices approuvés · 4 Formation des coachs · 5 Pédagogie adaptée aux filles · 6 Développement cognitif · 7 Suivi individuel : Valkyria Lab et profil de l'enfant · 8 Amélioration continue et preuve externe |
| **P2 Offres et prix** | 1 Réinscription avant la fin de saison · 2 Offre d'attraction : évaluation gratuite de ball mastery · 3 Résultat promis et garantie · 4 Échelle d'offres sur 5 générations · 5 Prix et hausses · 6 Ventes complémentaires · 7 Paiements · 8 Offres B2B |
| **P3 Acquisition et marketing** | 1 Parrainage · 2 Vidéos portfolio et avant-après · 3 Journées et Rencontres Valkyria · 4 Parascolaire comme vivier · 5 Camps d'été comme vivier · 6 Liste chaude · 7 Clubs partenaires (hiver) · 8 Publicité payante et mesure |
| **P4 Expérience client et renouvellement** | 1 Accueil marquant · 2 Première victoire rapide · 3 Progression visible · 4 Personnalisation · 5 Communication aux parents · 6 Appartenance · 7 Signes de départ · 8 Réinscription, satisfaction et sortie U13 |
| **P5 Diversification et conseil aux clubs** | 1 Parascolaire (≈ 160 000 $ en 2028) · 2 Camps de jour d'été 2027 (multisites) · 3 Camps de relâche et des Fêtes · 4 Home Lab et analyse vidéo à distance · 5 Événements payants · 6 Projets pour les plus vieilles · 7 Garçons sous une marque séparée · 8 Conseil aux clubs (500 000 $ en 2028) |
| **P6 Partenariats et commandites** | 1 Audience et preuve · 2 Dossier de commandite · 3 Échelle de commandites · 4 Offre irrésistible · 5 Machine de vente · 6 Livraison et renouvellement · 7 Partenaires non financiers · 8 Subventions |
| **P7 Finance et marges** | 1 Conformité (urgent) · 2 Méthode de lancement : prix plancher et go/no-go · 3 Marge de 50 % par programme · 4 Trésorerie · 5 Valeur d'une famille et coût d'acquisition · 6 Contrôle des dépenses, fournisseurs et inventaire · 7 Rentabilité par ligne et tableau de bord du lundi · 8 Structure et rémunération de JP |
| **P8 Organisation, équipe et agents IA** | 1 Projet entrevues avant/après (priorité maintenant) · 2 Équipe humaine et rôles · 3 Recrutement et ressources humaines des coachs · 4 Les données avant les agents · 5 Agent administratif (priorité 1) · 6 Agents pédagogie et familles · 7 Agents d'affaires · 8 Plateforme Valkyria et application |

## 5. Agents IA et automatisations à créer

Deux choses différentes : les **automatisations** sont des règles fixes du site (cron, formulaires, alertes, pages) que Claude Code programme sans IA ; les **agents IA** lisent des données, rédigent et proposent, avec une validation humaine. On construit d'abord les automatisations, parce que les agents s'appuient sur leurs données.

### Règles communes à tous les agents

- Un agent à la fois : on mesure les heures sauvées avant de construire le suivant.
- Chaque agent commence en mode assistant et ne monte de mode qu'après 4 semaines sans erreur importante.
- Accès minimum : chaque agent lit seulement les données dont il a besoin.
- Validation humaine obligatoire pour l'argent (remboursement, rabais, prix), les plaintes, la santé, la sécurité, les conflits et toute situation familiale délicate.
- Aucun agent n'a accès aux vidéos ni aux photos des enfants, sauf l'agent suivi des familles, en lecture, pour les joueuses de la famille concernée.
- Aucun nom d'enfant dans les contenus publiés sans consentement écrit du parent (Loi 25, consentement à l'image).
- Journal de chaque action : date, agent, action, données touchées, humain qui a validé.
- Les appels à l'IA se font côté serveur (route API du site), jamais depuis le navigateur ; la clé reste dans les variables d'environnement.
- Un agent ne parle jamais au nom de JP sans signature claire « Équipe Valkyria » ou validation de JP.

### Les 3 modes d'un agent

1. **Assistant** : L'agent prépare des brouillons ; un humain lit, corrige et envoie. Aucun envoi automatique.
2. **Semi-automatique** : L'agent envoie seul les messages de modèles approuvés (bienvenue, rappels, FAQ). Tout le reste reste en brouillon.
3. **Autonome sur règles** : L'agent agit seul dans des règles écrites et testées ; un humain revoit le journal chaque semaine.

### Ordre de construction

| Ordre | Agent | Niveau de construction | Prérequis | Tâches du Mandalart |
| --- | --- | --- | --- | --- |
| 1 | A01 Agent administratif | N1 | Base de familles unique ; FAQ écrite ; Modèles de messages approuvés par JP ; Politique d'annulation (P7.1) | P3.6.02, P4.1.01, P4.5.02, P8.5.01, P8.5.02 |
| 2 | A02 Agent support coaching | N3 | Banque d'exercices approuvés construite (P1.3) ; Présences disponibles (P8.4) | P1.3.11, P8.6.01 |
| 3 | A03 Agent suivi des familles | N5 | Feuille de suivi en place (P1.2) ; Profil de l'enfant dans l'espace parent (P1.7) | P8.6.02 |
| 4 | A04 Agent financier | N5 | Vrais coûts fournis (P7.2) ; Calculateur de lancement (AU11) ; Inventaire (P7.6) | P7.2.03, P7.4.04, P7.7.02, P8.7.01 |
| 5 | A05 Agent stratégie marketing | N6 | Personne caméra embauchée (P8.2) ; Source d'acquisition obligatoire (AU05) | P8.7.02 |
| 6 | A06 Agent statistiques | N6 | Champ source obligatoire (AU05) | P7.5.02, P8.7.03 |
| 7 | A07 Agent veille commerciale | N6 | Agent financier en place (A04) | P8.7.04 |
| 8 | A08 Agent partenaires | N6 | Dossier de commandite (P6.2) | P5.1.01, P6.5.01, P6.5.02, P8.7.05 |
| 9 | A09 Agent opérations et logistique | N6 | Inventaire (P7.6) | P5.2.04, P8.7.06 |
| 10 | A10 Agent ressources humaines des coachs | N6 | Fiches entraîneurs à jour (existe dans l'admin) | P8.7.07 |
| 11 | A11 Agent tableau de bord direction | N6 | Courriel du lundi (AU02) en place | P8.7.08 |

#### A01 — Agent administratif

- **Rôle** : Répond aux parents et gère l'administratif répétitif : inscriptions, paiements, relances, bienvenue, questions fréquentes.
- **Se déclenche quand** : Nouvelle inscription ou nouvel essai réservé ; Paiement échoué ou versement en retard (1, 7 et 14 jours) ; Question reçue d'un parent (courriel, texto, Messenger, Instagram) ; 7 jours avant chaque séance « Amène ton amie » ; Période d'inscription : liste chaude, 100 messages par jour, jusqu'à 3 relances.
- **Lit** : Inscriptions, essais et familles ; Paiements et versements (Stripe) ; Horaires et créneaux ; FAQ et politique d'annulation ; Liste chaude ; Codes de référence.
- **Fait** : Courriel de bienvenue avec la vidéo de JP ; Rappels de paiement et de séance ; Réponses aux questions fréquentes sous 24 h (nouveau contact : sous 5 minutes) ; Invitations « Amène ton amie » et remerciements aux familles qui parrainent ; Relances de la liste chaude ; Transfert des cas sensibles au coordonnateur.
- **Validation humaine** : Remboursement, rabais ou exception de prix : JP ; Plainte, santé, sécurité, conflit, situation familiale : coordonnateur.
- **Accès** : Lecture : familles, inscriptions, paiements, horaires. Écriture : brouillons et envois de modèles approuvés, notes au dossier famille. Interdit : vidéos d'enfants, paie, contrats.
- **Comment savoir s'il fonctionne** : Heures sauvées par semaine ; délai de réponse moyen ; paiements à temps ; essais réservés depuis la liste chaude.
- **Construit au niveau** N1 ; objectif P8.5 ; tâches P3.6.02, P4.1.01, P4.5.02, P8.5.01, P8.5.02.

#### A02 — Agent support coaching

- **Rôle** : Remet à chaque coach une fiche de séance prête à utiliser, adaptée au groupe du jour.
- **Se déclenche quand** : 48 h avant chaque séance ; Présences confirmées le jour même ; Rapport des 24 heures reçu après la séance.
- **Lit** : Planification annuelle et thème de la semaine ; Banque d'exercices approuvés (P1.3) ; Présences et nombre de joueuses ; Terrain (gymnase, synthétique, dimensions) ; Format (groupe, semi-privé, privé).
- **Fait** : Fiche de séance en 4 blocs (jeu d'entrée, ball mastery, technique, forme jouée), d'abord avec des exercices approuvés ; Adaptation au nombre de joueuses, à l'espace et aux variantes cognitives ; Signale les exercices encore « à tester » ; Compile les notes des coachs pour la banque.
- **Validation humaine** : Le coach peut tout changer ; JP valide les nouveaux exercices avant le statut « approuvé ».
- **Accès** : Lecture : planification, banque d'exercices, présences (prénoms et nombre seulement), terrains. Écriture : fiches de séance. Interdit : paiements, données des parents, vidéos.
- **Comment savoir s'il fonctionne** : Part des séances bâties avec des exercices approuvés ; note moyenne des séances ; temps de préparation des coachs.
- **Construit au niveau** N3 ; objectif P8.6 ; tâches P1.3.11, P8.6.01.

#### A03 — Agent suivi des familles

- **Rôle** : Suit la progression de chaque joueuse et prépare ce que les parents reçoivent.
- **Se déclenche quand** : Nouveau test ou nouvelle vidéo maison dans la feuille de suivi ; Fin de mois (défi mensuel) ; Mi-saison et fin de saison (bulletins) ; Alerte de présence (AU03) ; 4 semaines avant la fin de saison (réinscription).
- **Lit** : Feuille de suivi des tests ; Vidéos de la joueuse (lecture seulement) ; Notes des coachs ; Présences ; Passeport.
- **Fait** : Repère les difficultés, surtout en ball mastery ; Prépare le rapport mensuel : forces, une correction, prochain défi ; Prépare le programme maison et le jeu de la semaine adaptés au niveau ; Prépare les bulletins et les données de progression pour les entrevues avant/après ; Prépare la liste des familles à appeler pour la réinscription.
- **Validation humaine** : Le coach valide chaque rapport ; JP ou le coach-chef le publie dans l'espace parent.
- **Accès** : Lecture : données de progression et vidéos des joueuses. Écriture : brouillons de rapports. Rien n'est publié au parent sans validation.
- **Comment savoir s'il fonctionne** : Rapports livrés à temps ; familles qui ouvrent le profil (cible 70 %) ; réinscription.
- **Construit au niveau** N5 ; objectif P8.6 ; tâches P8.6.02.

#### A04 — Agent financier

- **Rôle** : Connaît tout le pilier 7 et rend un verdict viable ou non viable avant chaque projet.
- **Se déclenche quand** : Nouveau programme ou nouvelle idée de revenu ; Fin de chaque session ; Chaque lundi ; Contrat à 90 jours de son échéance ; Dépense non prévue.
- **Lit** : Coûts des terrains, coachs, matériel ; Revenus par programme ; Préventes ; Inventaire ; Registre des contrats et des fournisseurs.
- **Fait** : Remplit le calculateur de lancement et rend GO ou NO-GO ; Bilan prévu contre réel par programme ; Volet financier du tableau de bord du lundi ; Signale les lignes sous 35 % de marge ; Tient l'inventaire, le comparatif fournisseurs et le fonds de remplacement ; Bloque toute dépense non prévue ou non approuvée.
- **Validation humaine** : JP décide ; le CPA valide les chiffres officiels, les taxes et la structure.
- **Accès** : Lecture : revenus, coûts, contrats, inventaire. Écriture : analyses et alertes. Interdit : effectuer un paiement.
- **Comment savoir s'il fonctionne** : Programmes lancés avec un GO ; marge réelle contre prévue ; dépenses hors budget.
- **Construit au niveau** N5 ; objectif P8.7 ; tâches P7.2.03, P7.4.04, P7.7.02, P8.7.01.

#### A05 — Agent stratégie marketing

- **Rôle** : Bâtit le calendrier de contenu et dit à la personne caméra où aller et quoi filmer.
- **Se déclenche quand** : Chaque dimanche (plan de la semaine) ; Nouvel événement au calendrier.
- **Lit** : Calendrier des pratiques, matchs et événements ; Statistiques des publications (A06) ; Consentements à l'image.
- **Fait** : Plan de captation de la semaine, formats variés ; Pilote le projet entrevues avant/après ; Études des meilleurs clubs (image de marque, fidélisation).
- **Validation humaine** : JP approuve le calendrier ; la personne caméra exécute.
- **Accès** : Lecture : calendrier, statistiques, liste des joueuses avec consentement. Interdit : publier sans approbation.
- **Comment savoir s'il fonctionne** : Vidéos publiées par semaine (cible 3 à 5) ; essais venant des vidéos.
- **Construit au niveau** N6 ; objectif P8.7 ; tâches P8.7.02.

#### A06 — Agent statistiques

- **Rôle** : Repère quelles publications et quels canaux amènent de vraies inscriptions.
- **Se déclenche quand** : Chaque lundi.
- **Lit** : Sources d'acquisition des inscriptions et des essais ; Statistiques des réseaux sociaux ; Dépenses publicitaires.
- **Fait** : Essais, inscriptions et coût par inscription par canal ; Ratio valeur à vie ÷ coût d'acquisition ; Données du rapport aux commanditaires.
- **Validation humaine** : Aucune décision ; il informe JP et l'agent marketing.
- **Accès** : Lecture : sources, statistiques, dépenses. Aucune donnée nominative d'enfant.
- **Comment savoir s'il fonctionne** : Part des inscriptions avec source connue (cible 100 %).
- **Construit au niveau** N6 ; objectif P8.7 ; tâches P7.5.02, P8.7.03.

#### A07 — Agent analyse de la concurrence

- **Rôle** : Son seul travail : connaître les concurrents mieux qu'eux-mêmes (offres, prix, remplissage, marketing, forces et faiblesses) et dire à JP quoi copier, quoi éviter et où attaquer. Tous ses rapports vont dans le dossier « Analyse de la concurrence » (`docs/concurrence/`), à commencer par Footie Elite (26 oct. 2026).
- **Se déclenche quand** : Une fois par mois ; dès qu'un concurrent ouvre un groupe, une ville ou une offre dans nos secteurs.
- **Lit** : Sites publics, tunnels de réservation (sans s'inscrire ni payer), avis Google, réseaux sociaux et bibliothèque publicitaire Meta des académies et clubs.
- **Fait** : Fiche par concurrent tenue à jour ; relevé mensuel du remplissage (ex. Footie Elite à Boisbriand, Mirabel, Saint-Jérôme) ; alerte si un concurrent ouvre un groupe filles 9-12 ans dans nos villes ; idées à copier, chacune envoyée à l'agent financier pour le calculateur.
- **Validation humaine** : JP choisit ce qui passe au calculateur.
- **Accès** : Web public seulement.
- **Comment savoir s'il fonctionne** : Idées testées ; idées passées en GO.
- **Construit au niveau** N6 ; objectif P8.7 ; tâches P8.7.04.

#### A08 — Agent partenaires

- **Rôle** : Prospection et suivi des commanditaires, des subventions et des écoles pour le parascolaire.
- **Se déclenche quand** : Période de vente (avril à août) : 100 contacts par mois ; Rapport aux commanditaires aux 3 à 4 mois ; Échéance d'une demande de subvention.
- **Lit** : Liste des 100 entreprises cibles ; Liste des écoles ; Registre des commandites ; Données du rapport (A06).
- **Fait** : Brouillons de messages de prospection et de relance ; Prépare le rapport aux commanditaires ; Suivi des demandes de subvention.
- **Validation humaine** : JP présente et signe chaque entente.
- **Accès** : Lecture : commandites, écoles, statistiques. Écriture : brouillons.
- **Comment savoir s'il fonctionne** : Contacts par mois ; rencontres ; ententes signées ; renouvellement (cible 80 %).
- **Construit au niveau** N6 ; objectif P8.7 ; tâches P5.1.01, P6.5.01, P6.5.02, P8.7.05.

#### A09 — Agent opérations et logistique

- **Rôle** : Réservations de terrains, matériel par site, conflits d'horaires (camps multisites, parascolaire).
- **Se déclenche quand** : Nouveau créneau ou nouveau site ; Conflit d'horaire détecté ; Une semaine avant chaque camp.
- **Lit** : Réservations de terrains ; Inventaire par site ; Horaires des coachs.
- **Fait** : Signale les conflits et les terrains manquants ; Liste du matériel par site et par semaine.
- **Validation humaine** : Le coordonnateur confirme les réservations.
- **Accès** : Lecture : horaires, réservations, inventaire.
- **Comment savoir s'il fonctionne** : Conflits évités ; séances annulées faute de terrain ou de matériel.
- **Construit au niveau** N6 ; objectif P8.7 ; tâches P5.2.04, P8.7.06.

#### A10 — Agent ressources humaines des coachs

- **Rôle** : Recrutement, intégration, disponibilités, remplacements et évaluations des coachs et moniteurs.
- **Se déclenche quand** : Poste à combler ; Absence d'un coach ; Fin de session (évaluation).
- **Lit** : Fiches entraîneurs ; Disponibilités ; Contrats ; Évaluations.
- **Fait** : Brouillons d'annonces et de convocations ; Propose un remplaçant disponible ; Rappelle la vérification des antécédents et la règle de deux.
- **Validation humaine** : JP embauche ; le coordonnateur confirme les remplacements.
- **Accès** : Lecture : fiches et disponibilités des coachs. Interdit : paie (lecture seule du statut).
- **Comment savoir s'il fonctionne** : Séances sans coach évitées ; délai d'embauche.
- **Construit au niveau** N6 ; objectif P8.7 ; tâches P8.7.07.

#### A11 — Agent tableau de bord direction

- **Rôle** : Chaque lundi, compile les rapports des autres agents et le Mandalart en une seule page pour JP.
- **Se déclenche quand** : Chaque lundi, 6 h.
- **Lit** : Mandalart (niveau, tâches en retard) ; Indicateurs ; Rapports des agents.
- **Fait** : Résumé d'une page : ce qui avance, ce qui bloque, les 5 priorités de la semaine.
- **Validation humaine** : Aucune décision.
- **Accès** : Lecture seule.
- **Comment savoir s'il fonctionne** : JP lit un seul résumé au lieu de onze rapports.
- **Construit au niveau** N6 ; objectif P8.7 ; tâches P8.7.08.

### Automatisations

| Id | Automatisation | Type | Se déclenche quand | Ce qu'elle fait | Pour qui | État | Niveau | Tâches |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AU01 | Module Mandalart dans l'admin | page | JP ouvre /admin/mandalart | Affiche les niveaux, les cases à cocher, les barres de progression et les indicateurs ; chaque changement de statut est journalisé. | JP (admin) | à créer | N1 | P8.8.01 |
| AU02 | Courriel du lundi à JP | cron | Chaque lundi à 6 h (cron existant, 4 h quotidien, filtré sur le lundi ou nouveau cron) | Envoie : niveau actuel et % des ⭐, tâches en retard, 5 prochaines priorités, indicateurs qui ont bougé. | JP (Gmail SMTP existant) | à créer | N1 | P8.8.02 |
| AU03 | Alerte de présence | cron | Chaque jour | Si une joueuse passe de 2 à 1 séance par semaine, ou manque 2 séances de suite : crée une tâche « appeler la famille sous 48 h » pour le coordonnateur. | Coordonnateur | à créer | N1 | P4.7.01 |
| AU04 | Relance des paiements en retard | cron | Chaque jour | Relance à 1, 7 et 14 jours ; à 30 jours, signale la joueuse au coordonnateur (pas de terrain sans entente). | Parent, puis coordonnateur | partiel | N2 | P2.7.03 |
| AU05 | Source d'acquisition obligatoire | formulaire | Formulaires d'inscription et d'essai | Champ obligatoire « Comment nous avez-vous connus ? » (parrainage + code, vidéo, Journée Valkyria, parascolaire, camp, liste chaude, club, pub, autre) + « Avez-vous une entreprise ? ». | Tableau de bord marketing | à créer | N1 | P3.8.01 |
| AU06 | Évaluation des exercices et statut automatique | evenement | Rapport des 24 heures soumis par le coach | Pour chaque exercice utilisé : note sur 10 (5 critères × 2 points) + commentaire ; recalcule le statut (voir la spécification de la banque). | Coach-chef, JP | partiel | N1 | P1.3.02, P1.3.07 |
| AU07 | Publication au parent et avis | evenement | JP ou le coach-chef publie un élément dans le profil de l'enfant | Rend l'élément visible au parent de cette joueuse seulement et envoie un avis par courriel ou texto. | Parent | partiel | N2 | P1.7.07 |
| AU08 | « Envoyer ma vidéo » (Valkyria Lab, phase 1) | formulaire | Le parent envoie la vidéo du défi maison | Dépose la vidéo dans le dossier privé de la joueuse, la renomme (Prénom-Nom_geste_AAAA-MM-JJ_maison), ajoute une ligne à la feuille de suivi et avise le coach. | Coach | à créer | N1 | P1.7.02 |
| AU09 | Rappels réinscription et « Amène ton amie » | cron | 7 jours avant chaque séance amie ; 4 semaines avant la fin de chaque saison | Envoie l'invitation avec le lien personnel de parrainage ; ouvre la réinscription avec l'avantage fidèle. | Parents | à créer | N1 | P2.1.03, P3.1.02 |
| AU10 | Échéances des contrats | cron | Chaque lundi | Alerte 90 jours avant l'échéance d'un contrat (terrains, assurances, logiciels, fournisseurs) et 60 jours avant la fin d'une commandite. | JP | à créer | N2 | P6.6.02, P7.6.03 |
| AU11 | Calculateur de lancement (go/no-go) | page | Création ou modification d'un programme | Calcule F, V, N, prix plancher, seuil de survie, seuil 50 %, scénario pessimiste ; affiche GO ou NO-GO. Deux semaines avant le début : alerte si préventes < seuil de survie. | JP | à créer | N1 | P7.2.02 |
| AU12 | Anniversaires | cron | Chaque jour | 7 jours avant l'anniversaire d'une joueuse : tâche au coordonnateur (cadeau, « bonne fête » d'équipe filmé). | Coordonnateur | à créer | N2 | P4.4.02 |
| AU13 | Message hebdomadaire aux parents | cron | Chaque dimanche à 17 h | Envoie le message de la semaine par groupe : thème, photo, défi maison, lien du Valkyria Lab. | Parents | à créer | N1 | P1.7.06, P4.5.01 |
| AU14 | Tableau de bord du lundi (finance et marketing) | page | Page de l'admin, mise à jour chaque lundi | CA de la semaine, encaissements à venir, marge par programme, essais et inscriptions par canal, coût par inscription, réinscription, réserve. | JP | partiel | N2 | P3.8.03, P7.7.01 |
| AU15 | Rapport aux commanditaires | page | Fin automne, fin hiver, fin été | Compile portée, utilisations du code promo, activations, photos ; produit le brouillon du rapport. | JP | à créer | N2 | P6.6.01 |
| AU16 | Alerte de réponse aux parents | cron | Toutes les heures | Toute question de parent sans réponse depuis 20 h déclenche une alerte au coordonnateur (promesse : réponse sous 24 h). | Coordonnateur | à créer | N2 | P4.5.02 |

Notes : **AU01** — Voir la section « Construire le module ». **AU02** — Deviendra l'agent A11. **AU03** — Dépend de P8.4 (présences exportables). **AU04** — Existe : versements automatiques Stripe (cron quotidien 4 h). À ajouter : relances et seuil de 30 jours. **AU05** — Débloque A05 et A06. **AU06** — Existe : portail entraîneur, exercices, outil d'évaluation sur le terrain. À ajouter : grille, statut calculé, recherche. **AU07** — Le plan des outils de coaching prévoit déjà « publication au parent sur décision de JP ». **AU08** — Accès par lien de la famille ; aucune vidéo publique. **AU09** — Envoi fait par A01 quand il existera. **AU10** — Le module Contrats et Commandites existe ; ajouter la date d'échéance et le préavis. **AU11** — Remplace la feuille Google prévue (Drive non connecté). **AU13** — JP ou le coordonnateur approuve le contenu le vendredi. **AU14** — Le module Revenus existe ; ajouter les vues par canal et par programme. **AU15** — Deviendra le travail de A08 avec A06. **AU16** — Dépend de A01.

## 6. Construire le module `/admin/mandalart`

### Tables Supabase (proposition)

```sql
create table mandalart_tasks_state (
  code text primary key,                -- ex. 'P1.3.02' (clé stable venant du JSON)
  status text not null default 'a_faire' check (status in ('a_faire','en_cours','fait','abandonne')),
  owner text, due date, note text, evidence_url text,
  done_at timestamptz, updated_at timestamptz default now(), updated_by uuid
);
create table mandalart_tasks_custom (     -- tâches ajoutées par JP dans l'admin
  code text primary key,                -- ex. 'P1.3.X01'
  objective text not null, title text not null, level smallint not null check (level between 1 and 6),
  priority text not null check (priority in ('star','progressive')), created_at timestamptz default now()
);
create table mandalart_events (           -- journal : « ce qui se trame »
  id bigserial primary key, code text not null, from_status text, to_status text,
  note text, at timestamptz default now(), by uuid
);
create table mandalart_kpi_values (       -- valeurs manuelles et instantanés automatiques
  id bigserial primary key, kpi_id text not null, value numeric not null,
  measured_at date not null default current_date, source text check (source in ('auto','manuel')), note text
);
create table mandalart_snapshots (        -- historique hebdomadaire pour les courbes
  week date primary key, execution numeric, pillars jsonb, level smallint, kpis jsonb
);
```

- Le **plan** (piliers, objectifs, tâches, niveaux, indicateurs) reste dans `mandalart.json`, versionné dans le dépôt (ex. `data/mandalart.json`). Seul l'**état** va en base. Une nouvelle version du JSON s'ajoute sans migration.
- **Codes stables** : une nouvelle tâche s'ajoute toujours à la fin de son objectif (prochain numéro libre) ; on ne renumérote jamais.
- **Importation** : clé = `code`. Une tâche nouvelle apparaît à « à faire » ; une tâche existante garde son statut, sa note et sa preuve ; une tâche retirée du JSON n'est jamais supprimée de la base : elle s'affiche « retirée du plan » si elle a un historique.
- **Sécurité** : RLS activé sur toutes les tables, aucune politique pour `anon` ; lecture et écriture réservées à l'admin, avec la même vérification que les autres pages `/admin`. Les entraîneurs n'y ont pas accès. Aucune donnée d'enfant dans ces tables.

### Écrans

1. **En-tête** : grande barre *Résultats* (CA de l'année civile ÷ 1 500 000 $, repère au palier de 1 M$), barre *Exécution du plan*, carte *Niveau actuel* (ex. « N1 Fondations — 6 ⭐ sur 30 faites, 29 jours restants »), compteur de tâches en retard.
2. **Grille 3 × 3** : la case centrale et les 8 piliers, chacun avec sa barre, son % et ses médailles. Toucher un pilier ouvre sa grille 3 × 3 : le pilier au centre, ses 8 objectifs autour.
3. **Objectif** : liste des tâches à cocher (3 états : à faire, en cours, fait), groupées par niveau ; ⭐ en premier ; échéance, responsable, agent ou automatisation liés, note et lien de preuve. Les tâches des niveaux futurs sont grisées mais cochables.
4. **À faire maintenant** : les ⭐ non faites du niveau actuel, triées par échéance, au maximum 7 à la fois, puis les ➜ du même niveau. C'est l'écran par défaut sur téléphone.
5. **Niveaux** : les 6 niveaux en ligne du temps, avec leur % et leur état (fait, en cours, à venir).
6. **Indicateurs** : une carte par indicateur (départ → actuel → cible, petite courbe des instantanés) ; saisie rapide pour les indicateurs manuels.
7. **Agents et automatisations** : la liste des sections 5 avec leur état (à créer, en construction, actif, mode) et leurs tâches liées.
8. **Journal** : les derniers changements de statut, qui, quand.

### Automatismes du module

- **Instantané du lundi** (AU02) : calcule les indicateurs automatiques (ex. `ca_annee` et `ca_12m` depuis les paiements, `membres_actifs` depuis les inscriptions), enregistre `mandalart_snapshots`, puis envoie le courriel du lundi à JP par le SMTP Gmail existant.
- Les identifiants d'indicateurs (`ca_12m`, `membres_actifs`, etc.) sont stables : Claude Code relie chacun aux vraies tables du site et note dans le code comment il est calculé.

### Critères d'acceptation

- Le module affiche les 8 piliers, les 64 objectifs et toutes les tâches du JSON.
- Cocher une tâche met à jour en direct l'objectif, le pilier, l'exécution, le niveau et les médailles, et écrit une ligne au journal.
- Réimporter le même JSON ne change aucun statut.
- L'écran « À faire maintenant » montre les ⭐ du niveau 1 dès le premier jour.
- Utilisable d'une main sur téléphone ; temps de chargement sous 2 secondes.

## 7. Spécifications liées

### A. Banque d'exercices approuvés (objectif P1.3)

Étendre les modules existants (Entraîneurs → entraînements, exercices, thèmes ; portail entraîneur ; outil d'évaluation sur le terrain), sans créer de doublon.

- **Fiche d'exercice** (gabarit unique) : titre ; objectif pédagogique ; geste ou thème (ball mastery, passe, conduite, finition, prise de décision) ; place dans la séance (jeu d'entrée, ball mastery, technique, forme jouée) ; génération ou âge ; niveau (développement, avancé) ; joueuses minimum et maximum ; espace (gymnase, synthétique, dimensions) ; durée ; matériel (dont dossards bicolores) ; déroulement ; consignes clés ; variante plus facile ; variante plus difficile ; variante cognitive ; schéma ou vidéo ; auteur.
- **Évaluation** (dans le rapport des 24 heures, une par exercice utilisé) : 5 critères notés 0, 1 ou 2 : engagement et plaisir ; volume de touches sans file d'attente ; objectif atteint ; adapté à l'âge et au nombre ; facile à expliquer et à organiser en moins de 2 minutes. Total sur 10 + commentaire (ce qui a marché, ce qu'il faut changer, adaptations).
- **Statut calculé** : *à tester* au départ ; *approuvé* si moyenne ≥ 8 sur au moins 3 utilisations (idéalement 2 coachs différents) **et** validation de JP ; *à améliorer* si moyenne entre 6 et 7,9 ; *retiré* si moyenne < 6 après 2 essais. Une modification d'exercice remet le compteur à zéro (nouvelle version).
- **Recherche** : filtres combinés par âge, thème, geste, place dans la séance, espace, nombre de joueuses, durée, statut et note. Exemple : « finition, U10, gymnase, 12 joueuses, approuvé ».
- **Pratiques complètes** : une séance de 4 blocs reçoit aussi une note ; les meilleures deviennent des *pratiques modèles* réutilisables.
- **Indicateurs** : `exercices_approuves` (par génération), `seances_approuvees`.

### B. Profil de l'enfant dans l'espace parent (objectif P1.7)

- Le parent connecté voit seulement le profil de ses enfants : fiche joueuse, niveau du passeport, vidéos avant-après et tests mensuels, bulletins, programme maison du mois, jeu de la semaine, présences.
- Chaque élément a un état *brouillon* ou *publié* ; seul JP ou le coach-chef publie. La publication envoie un avis au parent (AU07).
- Le parent envoie la vidéo du défi maison depuis le profil (AU08).
- Vidéos dans un stockage Supabase privé, liens signés de courte durée ; les entraîneurs n'ont pas accès à l'espace parent ; journal des accès.
- Indicateur : `familles_profil` (cible 70 % des familles par mois).

### C. Application Valkyria (à suivre, horizon 2028)

Rien à construire maintenant. Quand au moins 50 % des familles actives utilisent l'espace parent chaque mois : application web installable d'abord (même code Next.js), application native ensuite. Contenu visé : Valkyria Lab, profil de l'enfant et bulletins, horaires, avis et messages (remplace MonClubSportif), prise des présences par les coachs, achat de programmes, de camps et d'articles de la boutique avec la carte enregistrée ; plus tard, une version pour les clubs du conseil.

## 8. Contenu détaillé, pilier par pilier

Légende : ⭐ priorité absolue · ➜ progressif · N1 à N6 = niveau · [x] fait · [~] en cours. Format : `code` tâche — échéance · responsable · agent ou automatisation liés.

### P1 — Excellence pédagogique

Si les filles progressent de façon visible, tout le reste devient facile : vente, réinscription, conseil aux clubs. Promesse confirmée chaque saison par les parents : leur fille est plus à l'aise avec le ballon, plus confiante, plus créative.

**Chantier de JP en novembre 2026 : ce pilier doit être carré d'ici le 30 novembre.**

#### P1.1 Méthode Valkyria écrite

Structure de séance, bibliothèque des gestes et curriculum U8 à U12 avec les compétences par niveau (modèle Coerver).

- [ ] `P1.1.01` ⭐ N1 — Écrire la structure de séance Valkyria sur une page, avec la durée de chaque bloc (jeu d'entrée, ball mastery, technique, forme jouée). — 30 nov. 2026 · JP
- [ ] `P1.1.02` ⭐ N1 — Choisir les 5 gestes de base par niveau du passeport (bronze, argent, or, mauve). — 30 nov. 2026 · JP
- [ ] `P1.1.03` ➜ N1 — Classer la bibliothèque des gestes par famille : semelle, intérieur/extérieur, changements de direction, feintes, contrôles orientés. — 30 nov. 2026 · JP
- [ ] `P1.1.04` ➜ N1 — Écrire la fiche de chaque geste : exécution, 3 points clés, erreurs fréquentes, lien vers la vidéo de démonstration. — 31 déc. 2026 · JP
- [ ] `P1.1.05` ➜ N2 — Écrire la progression en 4 étapes de chaque geste : sur place, en mouvement, à vitesse, sous pression ou en jeu. — 31 mars 2027 · JP
- [ ] `P1.1.06` ⭐ N3 — Rédiger le curriculum U8 à U12 : compétences à maîtriser par génération et par niveau. — 31 mai 2027 · JP
- [ ] `P1.1.07` ➜ N4 — Valider pendant l'été le curriculum de la saison suivante (rôle de directeur technique de JP). — 31 août 2027 · JP

#### P1.2 Standards de progression mesurables

Grille de tests par génération (touches en 30 s, conduite chronométrée, passes des deux pieds), reliée au passeport et aux vidéos avant-après. Indicateurs : `joueuses_filmees_jour1`.

- [ ] `P1.2.01` ⭐ N1 — Fixer le test de chaque niveau : touches en 30 secondes, conduite chronométrée, passes des deux pieds. — 30 nov. 2026 · JP
- [ ] `P1.2.02` ⭐ N1 — Filmer le test du jour 1 de chaque joueuse : même exercice, même angle, 30 secondes. — 30 nov. 2026 · Coachs + caméra
- [ ] `P1.2.03` ➜ N1 — Créer la feuille de suivi, une ligne par test : joueuse, génération, offre, date, geste, contexte, score, écart avec le test précédent, niveau, lien vidéo, note du coach. — 30 nov. 2026 · Claude Code
- [ ] `P1.2.04` ➜ N1 — Appliquer la convention de nom des vidéos : Prénom-Nom_geste_AAAA-MM-JJ_type (test, maison, démo). — 30 nov. 2026 · Caméra
- [ ] `P1.2.05` ⭐ N2 — Faire le test mensuel filmé et le comparer au mois précédent. — 31 mars 2027 · Coachs
- [ ] `P1.2.06` ➜ N2 — Concevoir le passeport papier et les écussons bronze, argent, or et mauve. — 31 mars 2027 · JP
- [ ] `P1.2.07` ➜ N3 — Monter la vidéo de progression de chaque fille : jour 1, 1 mois, fin de saison. — 31 mai 2027 · Caméra

#### P1.3 Séances sans improvisation et banque d'exercices approuvés

Chaque exercice est créé avec un gabarit unique, testé, noté sur 10, puis classé. On retrouve en quelques secondes des exercices prouvés par âge, thème ou geste. Maximum une coach pour dix filles. Indicateurs : `exercices_approuves`, `seances_approuvees`.

- [ ] `P1.3.01` ⭐ N1 — Mettre en place le gabarit unique de fiche d'exercice : titre, objectif, geste ou thème, place dans la séance, âge, niveau, nombre de joueuses, espace, durée, matériel, déroulement, consignes, variantes facile, difficile et cognitive, schéma ou vidéo. — 30 nov. 2026 · JP + Claude Code
- [ ] `P1.3.02` ⭐ N1 — Ajouter la grille d'évaluation sur 10 au rapport des 24 heures : 5 critères de 2 points + commentaire. — 30 nov. 2026 · Claude Code · AU06 Évaluation des exercices et statut automatique
- [ ] `P1.3.03` ⭐ N1 — Faire noter par les coachs chaque exercice utilisé en novembre. — 30 nov. 2026 · Coachs
- [ ] `P1.3.04` ➜ N1 — Réunir dans la banque ce qui existe : bibliothèque du portail entraîneur, documents « Banque d'exercices U7/U9 » et « Création d'exercices ». — 31 déc. 2026 · JP + Claude Code
- [ ] `P1.3.05` ➜ N1 — Standard des 500 touches de ballon par fille par séance : un ballon par fille, aucune file d'attente, explications courtes. — 31 déc. 2026 · Coachs
- [ ] `P1.3.06` ➜ N1 — Intégrer l'échauffement FIFA 11+ Kids à chaque séance (prévention du ligament croisé). — 31 déc. 2026 · Coachs
- [ ] `P1.3.07` ⭐ N2 — Construire la banque dans l'admin : statut calculé (à tester, approuvé, à améliorer, retiré) et recherche par âge, thème, geste, place dans la séance, espace, nombre de joueuses, durée et note. — 31 mars 2027 · Claude Code · AU06 Évaluation des exercices et statut automatique
- [ ] `P1.3.08` ➜ N2 — Noter aussi les pratiques complètes (les 4 blocs) ; les meilleures deviennent des pratiques modèles. — 31 mars 2027 · Coachs
- [ ] `P1.3.09` ➜ N2 — Utiliser les petits jeux 3 contre 3 sur 4 mini-buts (Funino) dans la forme jouée. — 31 mars 2027 · Coachs
- [ ] `P1.3.10` ⭐ N4 — Atteindre 30 exercices approuvés par génération. — 30 juin 2027 · Coach-chef
- [ ] `P1.3.11` ➜ N5 — Brancher l'agent support coaching sur la banque : il propose d'abord les exercices approuvés. — 31 déc. 2027 · Claude Code · A02 Agent support coaching

#### P1.4 Formation des coachs

Certification interne Valkyria, observation filmée mensuelle avec rétroaction, parcours vers les licences C et B.

- [ ] `P1.4.01` ➜ N1 — Briefing de 5 minutes avant chaque séance : fiches joueuses, moment surprise prévu. — 31 déc. 2026 · Coach-chef
- [ ] `P1.4.02` ⭐ N2 — Écrire la certification interne Valkyria : ce qu'une coach doit maîtriser avant de diriger un groupe. — 31 mars 2027 · JP
- [ ] `P1.4.03` ➜ N2 — Observer et filmer une séance par coach chaque mois, avec rétroaction de JP. — 31 mars 2027 · JP
- [ ] `P1.4.04` ➜ N2 — Tenir une réunion technique mensuelle. — 31 mars 2027 · JP
- [ ] `P1.4.05` ➜ N2 — Former à la règle du coach : parler moins de 20 % du temps, poser des questions, nommer chaque fille avec un compliment précis. — 31 mars 2027 · JP
- [ ] `P1.4.06` ⭐ N3 — Former les responsables de site et les moniteurs des camps à la méthode avant l'été. — 31 mai 2027 · JP + coach-chef
- [ ] `P1.4.07` ➜ N5 — Inscrire chaque coach dans un parcours vers les licences C et B. — 31 déc. 2027 · JP

#### P1.5 Pédagogie adaptée aux filles

Confiance, appartenance, erreur valorisée, modèles féminins. Chaque fille est comparée à elle-même, jamais aux autres.

- [ ] `P1.5.01` ➜ N1 — Écrire les principes de la pédagogie Valkyria : confiance, appartenance, erreur valorisée, modèles féminins. — 30 nov. 2026 · JP
- [ ] `P1.5.02` ➜ N1 — Instaurer le « cri Valkyria » pour rebondir après une erreur. — 31 déc. 2026 · Coachs
- [ ] `P1.5.03` ➜ N1 — Comparer chaque fille à elle-même dans les tests et les bulletins, jamais aux autres (effet de l'âge relatif). — 31 déc. 2026 · JP
- [ ] `P1.5.04` ➜ N2 — Ajouter des capsules courtes sur le dialogue intérieur positif et la gestion de l'erreur. — 31 mars 2027 · JP
- [ ] `P1.5.05` ➜ N2 — Faire rencontrer aux filles une joueuse inspirante au moins une fois par saison. — 31 mars 2027 · JP

#### P1.6 Développement cognitif

Prise d'information, scanning et prise de décision dans chaque séance. Les dossards bicolores sont la signature visible de la méthode.

- [ ] `P1.6.01` ⭐ N1 — Commander les dossards bicolores : corps d'une couleur, collet d'une autre (ex. corps noir, collet jaune). — 30 nov. 2026 · JP
- [ ] `P1.6.02` ➜ N1 — Utiliser les dossards bicolores dans tous les exercices pour forcer la prise d'information. — 31 déc. 2026 · Coachs
- [ ] `P1.6.03` ➜ N2 — Ajouter une variante cognitive à chaque fiche d'exercice (scanning, prise de décision). — 31 mars 2027 · JP
- [ ] `P1.6.04` ➜ N2 — Mettre une forme jouée avec prises de décision dans chaque séance. — 31 mars 2027 · Coachs

#### P1.7 Suivi individuel : Valkyria Lab et profil de l'enfant

Routine maison, banque de jeux, bulletins, plan de développement. Le parent voit le profil de son enfant quand JP ou le coach-chef le publie. Indicateurs : `familles_video_lab`, `familles_profil`.

- [ ] `P1.7.01` ⭐ N1 — Filmer les démonstrations des gestes, moins d'une minute chacune : vitesse réelle, ralenti, 3 points clés, erreur à éviter, rôle du parent. — 30 nov. 2026 · Caméra
- [ ] `P1.7.02` ⭐ N1 — Lancer la routine maison du mois (Valkyria Lab, phase 1) : page du site, vidéos non répertoriées, bouton « Envoyer ma vidéo ». — 30 nov. 2026 · JP + Claude Code · AU08 « Envoyer ma vidéo » (Valkyria Lab, phase 1)
- [ ] `P1.7.03` ⭐ N1 — Envoyer la banque de jeux d'hiver aux familles : jeu de la semaine et défi vidéo. — 30 nov. 2026 · JP
- [ ] `P1.7.04` ⭐ N1 — Préparer le premier bulletin de suivi de la saison. — 30 nov. 2026 · Coachs
- [ ] `P1.7.05` ➜ N1 — Tourner la vidéo d'accueil de 60 secondes de JP et l'affiche frigo avec code QR. — 31 déc. 2026 · JP
- [ ] `P1.7.06` ➜ N1 — Envoyer un texto hebdomadaire aux parents : lien direct et défi de la semaine. — 31 déc. 2026 · Coordonnateur · AU13 Message hebdomadaire aux parents
- [ ] `P1.7.07` ⭐ N2 — Ouvrir le profil de l'enfant dans l'espace parent : publication par JP ou le coach-chef, avis au parent à chaque nouvel élément. — 31 mars 2027 · Claude Code · AU07 Publication au parent et avis
- [ ] `P1.7.08` ➜ N2 — Lancer l'Académie des parents : capsule de 2 minutes par geste, règle des 3 rôles (chrono, caméra, encouragement). — 31 mars 2027 · JP
- [ ] `P1.7.09` ➜ N2 — Tenir un atelier parents-filles par saison, filmé pour le contenu. — 31 mars 2027 · JP
- [ ] `P1.7.10` ➜ N3 — Créer le plan de développement personnel : page « mon parcours », rencontre fille-parent-coach de 10 minutes. — 31 mai 2027 · Coachs
- [ ] `P1.7.11` ➜ N4 — Envoyer la banque de jeux d'été en juin : variantes cour, parc, plage, vacances. — 31 août 2027 · JP

#### P1.8 Amélioration continue et preuve externe

Revue annuelle de la banque, étude des meilleures académies, et nombre de joueuses acceptées en sport-études et en AAA comme statistique vedette.

- [ ] `P1.8.01` ➜ N2 — Compter les joueuses acceptées en sport-études et en AAA : statistique vedette pour le marketing et le conseil. — 31 mars 2027 · JP
- [ ] `P1.8.02` ⭐ N4 — Faire la revue annuelle de la banque : les 20 meilleurs exercices par âge forment le curriculum suivant, les plus faibles sortent. — 31 août 2027 · JP
- [ ] `P1.8.03` ➜ N4 — Étudier les meilleures académies (Coerver, La Masia, académies féminines américaines). — 31 août 2027 · JP
- [ ] `P1.8.04` ➜ N4 — Faire le bilan « qu'est-ce qui a vraiment fait progresser les filles cette année ? ». — 31 août 2027 · JP

### P2 — Offres et prix

L'automne-hiver est la saison phare (2 à 3 séances par semaine) ; l'été est un perfectionnement d'une séance par semaine en complément du club. Les offres ne sont pas coulées dans le béton : elles s'ajustent selon les chiffres.

#### P2.1 Réinscription avant la fin de saison

Avantage aux fidèles qui se réinscrivent avant la dernière séance (rollover). Indicateurs : `retour_saison`.

- [ ] `P2.1.01` ⭐ N2 — Ouvrir la réinscription Valkyria Été au prix fidélité (549 $) jusqu'au 31 mars. — 31 mars 2027 · JP
- [ ] `P2.1.02` ➜ N2 — Offrir un bonus à la réinscription hâtive (ex. Home Lab) plutôt qu'un rabais. — 31 mars 2027 · JP
- [ ] `P2.1.03` ⭐ N3 — Ouvrir la réinscription automne-hiver 2027-28 de 3 à 4 semaines avant la fin de saison, avec avantage fidèle. — 31 mai 2027 · JP · AU09 Rappels réinscription et « Amène ton amie »

#### P2.2 Offre d'attraction : évaluation gratuite de ball mastery

Évaluation filmée, kit remis, mini-rapport aux parents sous 48 h. C'est le seul point d'entrée de tous les canaux.

- [x] `P2.2.01` ➜ N1 — Valider le kit d'essai Valkyria (chandail, bas) remis à chaque fille à l'essai. — 31 déc. 2026 · JP
- [ ] `P2.2.02` ➜ N1 — Écrire le déroulé de l'évaluation gratuite filmée et le gabarit du mini-rapport envoyé sous 48 h. — 30 nov. 2026 · JP
- [ ] `P2.2.03` ➜ N2 — Faire de l'évaluation le seul point d'entrée sur le site : un lien unique utilisé par tous les canaux. — 31 mars 2027 · Claude Code

#### P2.3 Résultat promis et garantie

« Ta fille maîtrise le ballon et arrive plus confiante dans son club. » Preuves : vidéos avant-après, bulletins, passeport. Indicateurs : `recommandation`.

- [ ] `P2.3.01` ➜ N1 — Écrire la promesse et les 5 promesses Valkyria (prénom dès la 1re séance, progrès montré chaque mois, réponse sous 24 h, un moment vedette par saison, aucun départ sans appel humain). — 31 déc. 2026 · JP
- [ ] `P2.3.02` ➜ N3 — Mettre en place la garantie de progression : séances privées de rattrapage si la fille, assidue, ne gagne pas de niveau dans la saison. — 31 mai 2027 · JP

#### P2.4 Échelle d'offres sur 5 générations

Trio Solo, Team et New Valkyria reproduit de U8 à U12, plus les offres d'été. Indicateurs : `cohortes_2017_2019`.

- [ ] `P2.4.01` ➜ N1 — Trancher le rôle du Solo : les 5 places sont vendues à 1 455 $ et Privilège est complet. Ajouter des places ou une offre plus haut de gamme. — 30 nov. 2026 · JP
- [ ] `P2.4.02` ⭐ N2 — Ouvrir des groupes 2017, 2018 et 2019 en janvier, selon les gymnases libres. — 31 janv. 2027 · JP
- [ ] `P2.4.03` ⭐ N2 — Mettre en vente l'été 2027 : Valkyria Été (15 séances, 595 $), Sport-Études d'août (399 $) et Solo Été. — 15 janv. 2027 · JP
- [ ] `P2.4.04` ➜ N2 — Reproduire le trio Solo, Team et New sur chaque génération U8 à U12. — 31 mars 2027 · JP

#### P2.5 Prix et hausses

Hausse graduelle pour les nouvelles familles, ancien prix garanti aux fidèles. Bonus plutôt que rabais. Indicateurs : `marge_valkyria`.

- [ ] `P2.5.01` ⭐ N1 — Recalculer les prix planchers de toutes les offres avec les vrais coûts (méthode du pilier 7). — 15 déc. 2026 · JP
- [ ] `P2.5.02` ➜ N3 — Tester la hausse 2027-28 sur une génération (ex. Team ≈ 1 100 $ avec Home Lab pour les nouvelles familles). — 31 mai 2027 · JP
- [ ] `P2.5.03` ➜ N3 — Écrire la lettre de hausse aux familles selon la méthode RAISE (Price Raise Playbook). — 31 mai 2027 · JP

#### P2.6 Ventes complémentaires

Privé, analyse vidéo, équipement ; élite individuelle l'été ; voyages et camps élite pour les U13 qui partent.

- [ ] `P2.6.01` ➜ N1 — Lister les extras et leur prix : séances privées, analyse vidéo, équipement, kits. — 31 déc. 2026 · JP
- [ ] `P2.6.02` ➜ N4 — Vendre l'élite individuelle d'été : 15 familles à 2 500 $ (scénario maximal). — 31 août 2027 · JP
- [ ] `P2.6.03` ➜ N5 — Créer une offre voyages et camps élite pour les U13 qui partent. — 31 déc. 2027 · JP

#### P2.7 Paiements

Paiement complet avec bonus, ou 3 versements. Paiements préautorisés.

- [x] `P2.7.01` ➜ N1 — Versements automatiques Stripe sur le site (cron quotidien). — 31 déc. 2026 · Claude Code
- [ ] `P2.7.02` ➜ N2 — Offrir partout le choix : paiement complet avec bonus, ou 3 versements. — 31 mars 2027 · JP
- [ ] `P2.7.03` ➜ N2 — Relancer automatiquement les paiements en retard ; aucune joueuse sur le terrain avec plus de 30 jours de retard sans entente. — 31 mars 2027 · Claude Code · AU04 Relance des paiements en retard

#### P2.8 Offres B2B

Parascolaire d'abord, puis conseil aux clubs : prix selon la valeur créée, pas selon les heures.

- [ ] `P2.8.01` ➜ N2 — Fixer le prix du parascolaire au-dessus du plancher (155 $ si le gymnase est gratuit ; 160 $ actuel). — 31 mars 2027 · JP
- [ ] `P2.8.02` ➜ N5 — Écrire l'offre pilote du conseil : prix réduit contre un témoignage filmé et l'accès aux chiffres. — 31 déc. 2027 · JP
- [ ] `P2.8.03` ➜ N6 — Fixer le prix du Valkyria Club System : environ 5 000 $ au départ + 1 000 $ par mois, garantie partielle. — 31 déc. 2028 · JP

### P3 — Acquisition et marketing

60 à 80 nouvelles joueuses par année. Chaque canal doit pouvoir en ramener 80 à lui seul. Tous les canaux mènent à l'évaluation gratuite. Base Hormozi : Core Four, Lead Getters, règle des 100.

#### P3.1 Parrainage

« Amène ton amie » une fois par mois, l'invitée repart habillée. Seuil : 20 essais par mois.

- [x] `P3.1.01` ➜ N1 — Créer les 126 codes de référence des familles. — 31 déc. 2026 · Claude Code
- [ ] `P3.1.02` ➜ N1 — Lancer la séance mensuelle « Amène ton amie ». — 30 nov. 2026 · Coordonnateur · AU09 Rappels réinscription et « Amène ton amie »
- [ ] `P3.1.03` ➜ N1 — Fixer les paliers : 1 inscription = article ; 2 = coton ouaté ; 3 = séance privée ; 5 = sac complet + mise en vedette. — 31 déc. 2026 · JP
- [ ] `P3.1.04` ➜ N1 — Mesurer combien d'inscriptions sont venues des 126 codes de référence. — 31 déc. 2026 · Claude Code
- [ ] `P3.1.05` ➜ N2 — Demander un parrainage aux moments clés : bulletin, vidéo portfolio, Journée Valkyria, réinscription. — 31 mars 2027 · JP

#### P3.2 Vidéos portfolio et avant-après

Contenu court, accroche locale dans les 3 premières secondes, un seul appel : l'évaluation gratuite. Indicateurs : `videos_semaine`.

- [ ] `P3.2.01` ⭐ N1 — Publier 3 vidéos par semaine sur Instagram et Facebook. — 31 déc. 2026 · Caméra
- [ ] `P3.2.02` ➜ N1 — Concept à essayer en vrai : remercier les nouveaux abonnés. Chaque nouvel abonné reçoit un merci personnel (message ou vidéo de 10 secondes de JP ou de la coach). Mesurer pendant 4 semaines : réponses, partages, essais réservés. — 31 déc. 2026 · JP + caméra
  - Les comptes qui prennent le temps de remercier leurs abonnés créent un lien fort et du bouche-à-oreille. Règle de sécurité : on remercie les parents et les comptes adultes en privé ; une joueuse mineure est remerciée seulement en public, sans message privé.
- [ ] `P3.2.03` ➜ N1 — Monter les « meilleurs moments » de chaque fille 2 fois par saison et les envoyer aux parents pour repartage. — 31 déc. 2026 · Caméra
- [ ] `P3.2.04` ➜ N4 — Produire un CV vidéo de joueuse en fin d'année (utile pour le sport-études). — 31 août 2027 · Caméra

#### P3.3 Journées et Rencontres Valkyria

Journées découverte gratuites et événements sociaux : brise-glace, atelier, pique-nique, mini-tournoi.

- [ ] `P3.3.01` ⭐ N2 — Organiser la première Journée Valkyria (relâche). — 15 mars 2027 · Coordonnateur
- [ ] `P3.3.02` ➜ N2 — Organiser la première Rencontre Valkyria : cartes brise-glace, atelier, pique-nique, mini-tournoi. — 31 mars 2027 · JP
- [ ] `P3.3.03` ➜ N3 — Tenir une Journée Valkyria en mai pour remplir les dernières semaines de camp. — 31 mai 2027 · JP
- [ ] `P3.3.04` ➜ N5 — Installer le rythme de 4 journées par année : rentrée, Halloween, relâche, fin d'année scolaire. — 31 déc. 2027 · JP

#### P3.4 Parascolaire comme vivier

150 filles exposées par année, invitées en exclusivité à l'académie.

- [ ] `P3.4.01` ➜ N5 — Remettre en fin de session une invitation exclusive et un rabais de bienvenue à l'académie. — 31 déc. 2027 · JP
- [ ] `P3.4.02` ➜ N5 — Mesurer les filles exposées et converties, école par école. — 31 déc. 2027 · Claude Code

#### P3.5 Camps d'été comme vivier

300 campeuses et plus, une sur quatre convertie vers l'hiver.

- [ ] `P3.5.01` ⭐ N4 — Faire l'évaluation ball mastery pendant le camp et remettre le rapport aux parents le dernier jour. — 31 août 2027 · Responsable de camp
- [ ] `P3.5.02` ⭐ N4 — Faire l'offre de fin de camp : place d'hiver réservée + kit, et invitation à l'évaluation gratuite de l'automne. — 31 août 2027 · JP
- [ ] `P3.5.03` ➜ N4 — Présenter un mini-spectacle aux parents le dernier jour du camp. — 31 août 2027 · JP

#### P3.6 Liste chaude

Une seule liste de tous les contacts ; 100 messages par jour en période d'inscription, 3 relances.

- [ ] `P3.6.01` ➜ N1 — Bâtir la liste unique : anciennes joueuses, essais, camps passés, journées, parents. — 31 déc. 2026 · Coordonnateur
- [ ] `P3.6.02` ➜ N2 — Envoyer 100 messages par jour en période d'inscription, jusqu'à 3 relances. — 31 mars 2027 · Agent administratif · A01 Agent administratif
- [ ] `P3.6.03` ➜ N5 — Atteindre 1 000 contacts dans la liste. — 31 déc. 2027 · JP

#### P3.7 Clubs partenaires (hiver)

72 joueuses sur une centaine viennent de FC Révolution, FC Boréal et Les Satellites. Pas de partenariat de club pour les camps en phase 1.

- [ ] `P3.7.01` ➜ N1 — Nommer un parent relais dans FC Révolution, FC Boréal et Les Satellites. — 31 déc. 2026 · JP
- [ ] `P3.7.02` ➜ N5 — Offrir une clinique gratuite aux coachs de 15 clubs contre le statut de programme d'hiver officiel. — 31 déc. 2027 · JP
- [ ] `P3.7.03` ➜ N5 — Signer un grand club ou trois petits. — 31 déc. 2027 · JP

#### P3.8 Publicité payante et mesure

Petit budget, coût par essai d'environ 25 $, coût par inscription sous 70 $. On augmente seulement ce qui fonctionne. Indicateurs : `source_connue`, `nouvelles_joueuses_an`, `cac`.

- [ ] `P3.8.01` ⭐ N1 — Rendre obligatoire « Comment nous avez-vous connus ? » à l'inscription et à l'essai. — 30 nov. 2026 · Claude Code · AU05 Source d'acquisition obligatoire
- [ ] `P3.8.03` ⭐ N2 — Afficher le tableau de bord marketing du lundi : essais, inscriptions et coût par inscription, par canal. — 31 mars 2027 · Claude Code · AU14 Tableau de bord du lundi (finance et marketing)
- [ ] `P3.8.02` ➜ N2 — Tester la pub Facebook et Instagram (rayon de 25 km, vidéos déjà prouvées) et Google Ads à forte intention. — 31 mars 2027 · JP
- [ ] `P3.8.04` ➜ N3 — Corriger tout canal sous son seuil pendant 2 mois (plus, mieux, nouveau) avant de l'abandonner. — 31 mai 2027 · JP

### P4 — Expérience client et renouvellement

« Il est facile d'annuler un abonnement, difficile de quitter une relation. » Chaque fille doit avoir plusieurs liens : coach, amies, parents entre eux. Les départs se jouent dans les premières semaines.

#### P4.1 Accueil marquant

Kit, message de JP, présentation du coach et du plan de saison.

- [ ] `P4.1.01` ➜ N1 — Envoyer à chaque inscription un courriel de bienvenue avec une vidéo de JP de 60 secondes. — 31 déc. 2026 · Agent administratif · A01 Agent administratif
- [ ] `P4.1.02` ➜ N1 — Écrire une carte à la main avec le prénom de la fille. — 31 déc. 2026 · JP
- [ ] `P4.1.03` ➜ N2 — Envoyer le questionnaire « fiche joueuse » avant la 1re séance ; la coach le lit avant d'arriver. — 31 mars 2027 · Claude Code
- [ ] `P4.1.04` ➜ N2 — Faire la cérémonie de remise du chandail et jumeler chaque nouvelle avec une « grande sœur ». — 31 mars 2027 · JP
- [ ] `P4.1.05` ➜ N5 — Présenter le kit dans une belle boîte avec une lettre personnalisée. — 31 déc. 2027 · JP

#### P4.2 Première victoire rapide

Un geste réussi dans le premier mois, montré en vidéo aux parents.

- [ ] `P4.2.01` ➜ N1 — Envoyer le clip « avant » de la semaine 1 au parent : « voici où elle part ». — 31 déc. 2026 · Coachs
- [ ] `P4.2.02` ➜ N2 — Filmer et envoyer au parent un geste réussi dans le premier mois. — 31 mars 2027 · Coachs

#### P4.3 Progression visible

Défi ball mastery mensuel, passeport, bulletins, vidéos avant-après, Home Lab.

- [ ] `P4.3.01` ➜ N1 — Lancer le défi ball mastery mensuel : vidéo à la maison et rapport personnalisé (forces, une correction, prochain défi). — 15 déc. 2026 · Coachs
- [ ] `P4.3.02` ➜ N2 — Remettre le passeport et les écussons à coudre sur le sac. — 31 mars 2027 · JP
- [ ] `P4.3.03` ➜ N5 — Tester le Home Lab sur une génération (tapis, ballon, affiche frigo) et mesurer réinscription et parrainages. — 31 déc. 2027 · JP

#### P4.4 Personnalisation

Fiche par fille, anniversaires, moments surprises.

- [ ] `P4.4.01` ➜ N1 — Remplir la fiche de chaque fille : joueur préféré, geste favori, objectifs. — 31 déc. 2026 · Coachs
- [ ] `P4.4.02` ➜ N2 — Souligner chaque anniversaire : petit cadeau et « bonne fête » d'équipe filmé. — 31 mars 2027 · Coordonnateur · AU12 Anniversaires
- [ ] `P4.4.03` ➜ N2 — Demander à chaque coach un moment surprise par semaine pour une fille. — 31 mars 2027 · JP

#### P4.5 Communication aux parents

Message hebdomadaire, réponse sous 24 h, soirée parents.

- [ ] `P4.5.01` ➜ N1 — Envoyer le message hebdomadaire aux parents : thème, photo, défi maison. — 31 déc. 2026 · Coordonnateur · AU13 Message hebdomadaire aux parents
- [ ] `P4.5.02` ➜ N1 — Garantir une réponse à toute question sous 24 h. — 31 déc. 2026 · Agent administratif · A01 Agent administratif ; AU16 Alerte de réponse aux parents
- [ ] `P4.5.03` ➜ N2 — Tenir une soirée parents par saison et nommer un parent ambassadeur par groupe. — 31 mars 2027 · JP

#### P4.6 Appartenance

Rituels, vedette du mois, événements de membres, vie de club pro.

- [ ] `P4.6.01` ➜ N2 — Installer les rituels : cri d'équipe, entrée sur le terrain, poignée de main Valkyria. — 31 mars 2027 · JP
- [ ] `P4.6.02` ➜ N2 — Nommer une vedette du mois par groupe. — 31 mars 2027 · JP
- [ ] `P4.6.03` ➜ N2 — Tenir un événement de membres environ toutes les 6 semaines (soirée film, match pro, tournoi parents-filles). — 31 mars 2027 · JP
- [ ] `P4.6.04` ➜ N5 — Organiser la journée média : photo officielle, carte de joueuse, mur des Valkyria. — 31 déc. 2027 · JP
- [ ] `P4.6.05` ➜ N6 — Tenir le gala de fin de saison avec trophées. — 31 déc. 2028 · JP

#### P4.7 Signes de départ

Absences ou silence repérés tôt, appel humain sous 48 h, entrevue de départ. Indicateurs : `retour_saison`.

- [ ] `P4.7.01` ➜ N1 — Activer l'alerte de présence : une fille qui passe de 2 à 1 séance par semaine déclenche un appel du coordonnateur sous 48 h. — 15 déc. 2026 · Claude Code · AU03 Alerte de présence
- [ ] `P4.7.02` ➜ N1 — Noter les raisons connues du départ des 13 familles de l'été. — 31 déc. 2026 · JP
- [ ] `P4.7.03` ➜ N2 — Rendre l'entrevue de départ obligatoire, annoncée dès l'inscription. — 31 mars 2027 · Coordonnateur

#### P4.8 Réinscription, satisfaction et sortie U13

Satisfaction mesurée, test du « waouh », sortie digne en U13 et club des anciennes. Indicateurs : `recommandation`.

- [ ] `P4.8.01` ➜ N1 — Envoyer des cartes à 3, 6 et 12 mois et pour les Fêtes. — 31 déc. 2026 · Coordonnateur
- [ ] `P4.8.02` ➜ N2 — Poser une fois par saison la question « Sur 10, recommanderiez-vous Valkyria ? ». — 31 mars 2027 · Claude Code
- [ ] `P4.8.03` ➜ N3 — Faire le test du « waouh » : JP vit le parcours complet comme un nouveau parent ; tout ce qui est sous 9 est corrigé. — 31 mai 2027 · JP
- [ ] `P4.8.04` ➜ N4 — Organiser la sortie U13 : cérémonie, CV vidéo, club des anciennes (assistante coach rémunérée). — 31 août 2027 · JP

### P5 — Diversification et conseil aux clubs

Cibles 2028 proposées : camps ≈ 370 000 $, parascolaire ≈ 160 000 $ ; conseil aux clubs 500 000 $ en ligne séparée. Critères : vendre d'abord aux familles actuelles, utiliser les actifs existants, forte marge, revenus récurrents. Garçons sous une autre marque.

#### P5.1 Parascolaire (≈ 160 000 $ en 2028)

Environ 1 000 inscriptions à 160 $ par année, une vingtaine d'écoles, sessions automne et hiver.

- [ ] `P5.1.01` ⭐ N2 — Contacter les écoles pour l'automne 2027 (elles planifient au printemps) : liste de 50 écoles et services de garde, règle des 100. — 31 mars 2027 · JP · A08 Agent partenaires
- [ ] `P5.1.02` ➜ N2 — Offrir une démo gratuite d'une séance par école. — 31 mars 2027 · JP
- [ ] `P5.1.03` ⭐ N3 — Signer les ententes de parascolaire. — 31 mai 2027 · JP
- [ ] `P5.1.04` ⭐ N5 — Lancer le parascolaire. — 15 oct. 2027 · JP
- [ ] `P5.1.05` ➜ N6 — Atteindre environ 1 000 inscriptions par année. — 31 déc. 2028 · JP

#### P5.2 Camps de jour d'été 2027 (multisites)

9 h à 16 h, 8 semaines du 28 juin au 20 août, 30 places par site, 339 $ la semaine (309 $ membres avant le 31 mars). Modèle Footy Elite : terrains réservés directement, sans club. Indicateurs : `benefice_ete_2027`.

- [ ] `P5.2.01` ⭐ N1 — Lancer la carte-cadeau « Semaine de camp Valkyria » pour Noël. — 5 déc. 2026 · JP + Claude Code
- [ ] `P5.2.02` ➜ N1 — Trouver les terrains possibles et leurs disponibilités de jour (terrain de jour visé : environ 25 $/h). — 31 déc. 2026 · JP
- [ ] `P5.2.03` ⭐ N2 — Prévendre les camps aux familles actuelles en janvier, aux prix hâtifs. — 31 janv. 2027 · JP
- [ ] `P5.2.04` ⭐ N2 — Réserver les terrains de jour et de soir. — 15 mars 2027 · JP · A09 Agent opérations et logistique
- [ ] `P5.2.05` ⭐ N2 — Recruter la responsable de camp, avec vérification des antécédents. — 31 mars 2027 · JP
- [ ] `P5.2.06` ⭐ N3 — 1er avril : point de contrôle. Le 2e site ouvre si 40 % du 1er est vendu ; les sites 3 et 4 si les sites 1 et 2 sont vendus à 50 %. — 1er avr. 2027 · JP
- [ ] `P5.2.07` ⭐ N3 — Embaucher et former les moniteurs (1 adulte pour 10 campeurs). — 31 mai 2027 · JP
- [ ] `P5.2.08` ⭐ N4 — Tenir les camps : une semaine ouvre à 20 inscrites deux semaines avant, sinon on fusionne. — 20 août 2027 · Responsable de camp
- [ ] `P5.2.09` ➜ N4 — Vendre la garde prolongée (40 $ par semaine) et le kit d'été. — 31 août 2027 · JP

#### P5.3 Camps de relâche et des Fêtes

Revenus d'hiver et solution de garde pour les parents.

- [ ] `P5.3.01` ➜ N1 — Évaluer un camp des Fêtes 2026 avec la méthode du prix plancher (cash de décembre). — 20 nov. 2026 · JP
- [ ] `P5.3.02` ⭐ N2 — Tenir le camp de la relâche 2027 (campagne en janvier). — 8 mars 2027 · JP

#### P5.4 Home Lab et analyse vidéo à distance

Phase 1 maintenant (QR, affiche, défi, passeport papier), phase 2 matériel, phase 3 vente en ligne.

- [ ] `P5.4.01` ➜ N1 — Phase 1 du Home Lab : routines par code QR, affiche à imprimer, défi mensuel, passeport papier (voir P1.7). — 30 nov. 2026 · JP
- [ ] `P5.4.02` ➜ N5 — Phase 2 : ballon, tapis personnalisé et boîte, coût validé par l'agent financier. — 31 déc. 2027 · JP
- [ ] `P5.4.03` ➜ N6 — Phase 3 : vente en ligne et abonnement d'analyse vidéo à distance, vendable partout au Québec. — 31 déc. 2028 · JP

#### P5.5 Événements payants

Fêtes d'anniversaire (rapide), tournoi Valkyria (gros revenus), ligue des mamans (fidélité).

- [ ] `P5.5.01` ➜ N2 — Lancer les fêtes d'anniversaire Valkyria, à partir de 300 $ ; chaque fête amène une dizaine d'amies à l'essai. — 31 mars 2027 · JP
- [ ] `P5.5.02` ➜ N3 — Préparer le tournoi Valkyria (environ 30 équipes, commanditaires, boutique sur place). — 31 mai 2027 · JP
- [ ] `P5.5.03` ➜ N5 — Lancer la ligue des mamans. — 31 déc. 2027 · JP

#### P5.6 Projets pour les plus vieilles

Sport-Études d'août, préparation au recrutement, voyages, camps élite, école de gardiennes.

- [ ] `P5.6.01` ➜ N4 — Tenir le Sport-Études d'août : diagnostic + 10 séances avec simulation d'évaluation, 399 $. — 31 août 2027 · JP
- [ ] `P5.6.02` ➜ N5 — Offrir la préparation au recrutement (sport-études, bourses universitaires américaines). — 31 déc. 2027 · JP
- [ ] `P5.6.03` ➜ N6 — Lancer les voyages internationaux et les camps élite U13 et plus. — 31 déc. 2028 · JP
- [ ] `P5.6.04` ➜ N6 — Ouvrir l'école de gardiennes, avec l'Académie des gardiens. — 31 déc. 2028 · JP

#### P5.7 Garçons sous une marque séparée

Valkyria reste 100 % féminine. Les programmes garçons passent sous un autre nom (ex. JP Coach), avec coachs, terrains et méthode partagés en coulisses.

- [ ] `P5.7.01` ➜ N1 — Confirmer le nom de la marque garçons et séparer ses revenus dans l'admin. — 31 déc. 2026 · JP
- [ ] `P5.7.02` ➜ N4 — Tenir l'offre garçons d'été sous l'autre marque (≈ 11 100 $ au scénario ambitieux). — 31 août 2027 · JP

#### P5.8 Conseil aux clubs (500 000 $ en 2028)

« Gym Launch du soccer » : pilotes fin 2027, puis Valkyria Club System (fait avec vous, 12 mois, ≈ 17 000 $ par club par an). Indicateurs : `ca_conseil_annee`, `clubs_conseil`.

- [ ] `P5.8.01` ➜ N1 — Documenter chaque système Valkyria comme futur produit : Valkyria est le laboratoire du conseil. — 31 déc. 2026 · JP
- [ ] `P5.8.02` ⭐ N5 — Trouver le plus gros problème actuel de l'Académie des gardiens (Pascal) et de Perfo Soccer. — 30 sept. 2027 · JP
- [ ] `P5.8.04` ⭐ N5 — Démarrer 2 ou 3 pilotes « fait pour vous » : 3 à 6 mois, un problème mesuré avant et après. — 30 nov. 2027 · JP
- [ ] `P5.8.03` ➜ N5 — Vérifier la concurrence de Perfo Soccer dans les Laurentides ; entente de non-concurrence au besoin. — 31 déc. 2027 · JP
- [ ] `P5.8.05` ⭐ N6 — Lancer le Valkyria Club System avec les études de cas des pilotes. — 28 févr. 2028 · JP
- [ ] `P5.8.06` ⭐ N6 — Signer 25 à 35 clubs. — 31 déc. 2028 · JP
- [ ] `P5.8.07` ➜ N6 — Ajouter la formation d'entraîneurs payante et la licence de la méthode (modèle Coerver). — 31 déc. 2028 · JP

### P6 — Partenariats et commandites

Un système de commandites carré et récurrent : environ 45 000 $ en 2027 et 80 000 $ en 2028. Sans audience, pas de commandite payante.

#### P6.1 Audience et preuve

Les réseaux du pilier 3 sont la base ; premiers partenaires = parents propriétaires d'entreprise.

- [ ] `P6.1.01` ➜ N1 — Tenir un compteur d'audience mensuel : familles, abonnés, vues, partages. — 31 déc. 2026 · Caméra
- [ ] `P6.1.02` ➜ N1 — Ajouter « Avez-vous une entreprise ? » au formulaire d'inscription. — 31 déc. 2026 · Claude Code

#### P6.2 Dossier de commandite

Une page + une vidéo de 60 secondes ; inventaire des actifs (≈ 1 800 familles par an, réseaux, chandails, kits, journées, tournois, gala).

- [ ] `P6.2.01` ⭐ N2 — Produire le dossier de commandite d'une page et la vidéo de 60 secondes. — 28 févr. 2027 · JP

#### P6.3 Échelle de commandites

Présentateur ≈ 15 000 $, Or ≈ 5 000 $, Communautaire ≈ 1 000 $, bourses, tables au gala, en nature. Indicateurs : `commandites_annee`, `plages_matchs`.

- [ ] `P6.3.01` ➜ N1 — Vendre les 23 plages de matchs de Terrebonne (3 450 $, 38 % du contrat). — 31 déc. 2026 · JP
- [ ] `P6.3.02` ➜ N2 — Fixer les paliers et les contreparties de chaque niveau. — 31 mars 2027 · JP
- [ ] `P6.3.03` ➜ N4 — Vendre la commandite des camps : maillot 2027 et bannières sur les sites (30 000 $ au scénario maximal). — 31 août 2027 · JP

#### P6.4 Offre irrésistible

Des clients, pas des vues : code promo exclusif, exclusivité par secteur, engagement de 3 ans avec rabais.

- [ ] `P6.4.01` ➜ N2 — Créer un code promo exclusif par commanditaire pour mesurer les ventes générées. — 31 mars 2027 · Claude Code
- [ ] `P6.4.02` ➜ N2 — Offrir l'exclusivité par secteur et l'engagement de 3 ans avec rabais. — 31 mars 2027 · JP

#### P6.5 Machine de vente

Liste de 100 entreprises, rencontre, offre, signature ; 100 contacts par mois d'avril à août. Indicateurs : `commandites_annee`.

- [ ] `P6.5.01` ➜ N2 — Bâtir la liste de 100 entreprises cibles (parents, commerces, banques, caisses, assurances). — 31 mars 2027 · JP · A08 Agent partenaires
- [ ] `P6.5.02` ⭐ N3 — Faire 100 contacts par mois d'avril à août. — 31 mai 2027 · JP · A08 Agent partenaires
- [ ] `P6.5.03` ⭐ N5 — Atteindre 45 000 $ de commandites pour 2027. — 31 déc. 2027 · JP

#### P6.6 Livraison et renouvellement

Rapport aux commanditaires aux 3 à 4 mois, rencontre de renouvellement 60 jours avant la fin, 80 % de renouvellement visé.

- [ ] `P6.6.01` ➜ N2 — Remettre le rapport aux commanditaires (portée, résultats, activations, impact humain, vidéo, prochaine période). — 31 mars 2027 · JP · AU15 Rapport aux commanditaires
- [ ] `P6.6.02` ➜ N5 — Tenir la rencontre de renouvellement 60 jours avant la fin de chaque contrat. — 31 déc. 2027 · JP · AU10 Échéances des contrats

#### P6.7 Partenaires non financiers

Équipementier, municipalités, partenaires santé, médias locaux.

- [ ] `P6.7.01` ➜ N2 — Négocier une entente équipementier (protège la marge de 50 %). — 31 mars 2027 · JP
- [ ] `P6.7.02` ➜ N2 — Faire avancer le partenariat santé (Action Sport Physio / Alowa) et les conférences aux parents. — 31 mars 2027 · JP
- [ ] `P6.7.03` ➜ N5 — Approcher les municipalités pour des terrains l'hiver. — 31 déc. 2027 · JP

#### P6.8 Subventions

Programmes pour le sport féminin et l'activité physique des jeunes.

- [ ] `P6.8.01` ➜ N2 — Rechercher les programmes de subvention admissibles. — 31 mars 2027 · JP
- [ ] `P6.8.02` ➜ N3 — Déposer les demandes retenues. — 31 mai 2027 · JP

### P7 — Finance et marges

2028 : 1 500 000 $ sur l'année civile. Valkyria ≈ 1 000 000 $ à 50 % de marge au minimum ; conseil 500 000 $ à environ 75 %. Aucun programme lancé sans calcul du prix plancher. Aucun dollar ne sort s'il n'est pas clair et prévu. Chiffres à valider avec Pontbriand Lamarche CPA.

#### P7.1 Conformité (urgent)

TPS/TVQ, assurance de 5 M$, entente avec la gérante, politique d'annulation.

- [ ] `P7.1.01` ⭐ N1 — Signer le mandat avec Pontbriand Lamarche CPA. — 15 nov. 2026 · JP
- [ ] `P7.1.02` ⭐ N1 — S'inscrire à la TPS/TVQ à la date recommandée par le CPA et fixer le traitement des taxes sur les camps et les entraînements. — 30 nov. 2026 · JP + CPA
- [ ] `P7.1.03` ⭐ N1 — Obtenir l'assurance responsabilité de 5 M$ exigée par les écoles. — 30 nov. 2026 · JP
- [ ] `P7.1.04` ⭐ N1 — Écrire l'entente avec la gérante : gratuité de ses filles en échange de son travail (rémunération en nature). — 30 nov. 2026 · JP
- [ ] `P7.1.05` ➜ N2 — Écrire la politique d'annulation et de remboursement, acceptée à l'inscription. — 31 mars 2027 · JP + Claude Code

#### P7.2 Méthode de lancement : prix plancher et go/no-go

Prix plancher = 2 × (F ÷ N + V), N = capacité × 80 %. Go seulement si prix ≥ plancher, seuil 50 % ≤ capacité, préventes ≥ seuil de survie 2 semaines avant, scénario pessimiste sans perte.

- [ ] `P7.2.01` ⭐ N1 — Fournir les vrais coûts : gymnase de Prévost, taux et heures de Noura, rémunération d'Annie et de JP. — 15 nov. 2026 · JP
- [ ] `P7.2.02` ➜ N1 — Créer le calculateur de lancement dans l'admin : prix plancher, seuils, scénario pessimiste, verdict GO ou NO-GO. — 15 déc. 2026 · Claude Code · AU11 Calculateur de lancement (go/no-go)
- [ ] `P7.2.03` ➜ N2 — Passer chaque programme au calculateur avant sa mise en vente, et comparer au réel en fin de session. — 31 mars 2027 · JP · A04 Agent financier

#### P7.3 Marge de 50 % par programme

Terrebonne ≈ 214 $/h (42 % des locations pour 10 % des heures) ; trois créneaux sous le seuil ; règle d'encadrement d'été. Indicateurs : `marge_valkyria`, `remplissage`.

- [ ] `P7.3.01` ⭐ N1 — Corriger les 3 créneaux sous le seuil (lundi 19 h 30, mercredi 18 h, jeudi 18 h 30 à Prévost) : remplir, fusionner ou déplacer. — 31 déc. 2026 · JP
- [ ] `P7.3.02` ⭐ N1 — Revoir le contrat de Terrebonne : vendre les plages ou renégocier pour 2027. — 31 déc. 2026 · JP
- [ ] `P7.3.03` ➜ N2 — Appliquer la règle d'encadrement : une coach responsable à 40 $/h + une adjointe à 25 $/h (marge d'été 45 % → 59 %). — 31 mars 2027 · JP
- [ ] `P7.3.04` ⭐ N5 — Atteindre 50 % de marge sur la saison 2027-28. — 31 déc. 2027 · JP

#### P7.4 Trésorerie

Cash serré jusqu'en janvier : 12 251 $ de location à payer, paie de Maeva dès le 12 novembre. Comptes séparés et réserve de 3 mois. Indicateurs : `reserve_tresorerie`.

- [ ] `P7.4.01` ⭐ N1 — Fournir le solde actuel (BMO + Stripe) et les encaissements prévus d'ici avril 2027. — 10 nov. 2026 · JP
- [ ] `P7.4.02` ⭐ N1 — Exécuter le plan cash de novembre-décembre : places libres, demi-saisons, plages de matchs, commandites, carte-cadeau des Fêtes. — 31 déc. 2026 · JP
- [ ] `P7.4.03` ➜ N2 — Ouvrir les comptes séparés : profit 10 %, impôts et taxes 15 %, rémunération de JP, opérations, réserve. — 31 mars 2027 · JP
- [ ] `P7.4.04` ➜ N2 — Tenir une prévision de trésorerie sur 12 mois glissants, mise à jour chaque mois. — 31 mars 2027 · JP · A04 Agent financier
- [ ] `P7.4.05` ➜ N5 — Constituer la réserve de 3 mois de dépenses fixes et ouvrir une marge de crédit d'urgence. — 31 déc. 2027 · JP

#### P7.5 Valeur d'une famille et coût d'acquisition

Valeur à vie ≈ 3 500 $ par famille ; coût d'acquisition sous 70 $ ; ratio ≥ 3 pour 1 ; les 30 premiers jours paient l'acquisition. Indicateurs : `cac`.

- [ ] `P7.5.01` ➜ N2 — Calculer la valeur à vie réelle d'une famille à partir des données du site. — 31 mars 2027 · Claude Code
- [ ] `P7.5.02` ➜ N3 — Suivre par canal le ratio valeur à vie ÷ coût d'acquisition (minimum 3 pour 1). — 31 mai 2027 · JP · A06 Agent statistiques

#### P7.6 Contrôle des dépenses, fournisseurs et inventaire

Seuils d'approbation, 3 soumissions, registre des contrats, inventaire synchronisé, fonds de remplacement.

- [ ] `P7.6.01` ➜ N1 — Appliquer les seuils d'approbation : sous 100 $ coordonnateur, 100 à 1 000 $ JP, plus de 1 000 $ JP avec 3 soumissions. — 31 déc. 2026 · JP
- [ ] `P7.6.02` ➜ N1 — Créer l'inventaire du matériel (quantité, emplacement, confié à, état, durée de vie, année de remplacement). — 31 déc. 2026 · Claude Code
- [ ] `P7.6.03` ➜ N2 — Tenir le registre des contrats avec alerte 90 jours avant chaque échéance. — 31 mars 2027 · Claude Code · AU10 Échéances des contrats
- [ ] `P7.6.04` ➜ N3 — Faire la revue annuelle des dépenses et voter le budget (fonds d'imprévus 5 %, fonds de remplacement). — 31 mai 2027 · JP

#### P7.7 Rentabilité par ligne et tableau de bord du lundi

Chaque ligne d'affaires a son bilan ; une ligne sous 35 % deux trimestres de suite est corrigée ou retirée.

- [ ] `P7.7.01` ⭐ N2 — Afficher le tableau de bord financier du lundi : CA de la semaine, encaissements à venir, marge par programme, coût d'acquisition, réinscription, réserve. — 31 mars 2027 · Claude Code · AU14 Tableau de bord du lundi (finance et marketing)
- [ ] `P7.7.02` ➜ N2 — Faire le bilan de chaque programme à la fin de sa session : seuil prévu contre réel. — 31 mars 2027 · JP · A04 Agent financier
- [ ] `P7.7.03` ➜ N3 — Tenir une rencontre mensuelle avec le CPA. — 31 mai 2027 · JP

#### P7.8 Structure et rémunération de JP

Valkyria et le conseil en entités distinctes, possiblement sous une société de gestion. 2028 : ≈ 200 000 $ de salaire + 200 000 $ de dividendes. Indicateurs : `remuneration_jp`, `salaire_jp`.

- [ ] `P7.8.01` ➜ N1 — Valider la répartition du 1,5 M$ de 2028 (Valkyria ≈ 1 M$, conseil 500 k$) et fixer la cible de CA de 2027. — 30 nov. 2026 · JP
- [ ] `P7.8.02` ➜ N1 — Noter les heures de JP par semaine et les tâches où elles passent. — 31 déc. 2026 · JP
- [ ] `P7.8.05` ⭐ N2 — Mettre en place la paie de JP : 10 000 $ brut par mois dès février 2027, sans exception (retenues à la source et charges de l'employeur avec le CPA). — 31 janv. 2027 · JP + CPA
  - Février 2027 à décembre 2028 : 23 mois = 230 000 $ brut (2027 : 110 000 $ ; 2028 : 120 000 $). Coût pour l'entreprise avec les charges de l'employeur (estimation 10 à 12 %, à confirmer) : environ 253 000 à 258 000 $.
- [ ] `P7.8.06` ⭐ N2 — Avoir un mois de salaire d'avance (≈ 11 000 $ avec les charges) dans le compte rémunération au 1er février 2027. — 1er févr. 2027 · JP
- [ ] `P7.8.03` ➜ N2 — Valider la structure avec le CPA : entités séparées, société de gestion. — 31 mars 2027 · JP
- [ ] `P7.8.07` ⭐ N3 — Avoir 3 mois de salaire en réserve (≈ 33 000 $) avant le 1er juillet 2027 : juillet, novembre et décembre sont des mois creux. — 30 juin 2027 · JP
- [ ] `P7.8.04` ➜ N5 — Fixer le plan de rémunération 2028 avec le CPA. — 31 déc. 2027 · JP

### P8 — Organisation, équipe et agents IA

Les données avant les agents ; un agent à la fois ; validation humaine pour les décisions sensibles ; journal de chaque action ; données des mineures protégées (Loi 25). Chaque dollar économisé par l'IA sert d'abord à mieux payer les coachs.

#### P8.1 Projet entrevues avant/après (priorité maintenant)

Chaque joueuse filmée au début et à la fin de la saison : la preuve sociale la plus forte. Indicateurs : `entrevues_saison`.

- [ ] `P8.1.02` ⭐ N1 — Filmer l'entrevue de début de saison de 30 à 40 filles. — 30 nov. 2026 · Caméra
- [x] `P8.1.01` ➜ N1 — Faire approuver le droit à l'image à l'inscription sur le site. — 31 déc. 2026 · Claude Code
- [ ] `P8.1.03` ⭐ N3 — Filmer l'entrevue de fin de saison et monter les avant-après. — 30 avr. 2027 · Caméra

#### P8.2 Équipe humaine et rôles

JP, coach-chef (qualité), coordonnateur, personne caméra, CPA, moniteurs à contrat.

- [ ] `P8.2.01` ⭐ N1 — Embaucher la personne caméra. — 30 nov. 2026 · JP
- [ ] `P8.2.02` ➜ N1 — Nommer le coach-chef responsable du contrôle de la qualité. — 31 déc. 2026 · JP
- [ ] `P8.2.03` ➜ N1 — Tenir le registre Loi 25 : renseignements collectés, consentements, qui a accès (JP responsable). — 31 déc. 2026 · JP
- [ ] `P8.2.04` ➜ N2 — Confier au coordonnateur les horaires, les remplacements, les cas délicats et la supervision des agents. — 31 mars 2027 · JP

#### P8.3 Recrutement et ressources humaines des coachs

Deuxième coach qualifiée, équipe d'été, règle de deux, vérification des antécédents.

- [ ] `P8.3.01` ➜ N1 — Écrire la règle de deux (jamais un adulte seul avec une mineure) et la faire signer par tous les coachs. — 31 déc. 2026 · JP
- [ ] `P8.3.02` ⭐ N2 — Recruter une deuxième coach qualifiée. — 28 févr. 2027 · JP
- [ ] `P8.3.03` ⭐ N3 — Recruter l'équipe d'été (jusqu'à une vingtaine de personnes au scénario maximal), antécédents vérifiés. — 30 avr. 2027 · JP

#### P8.4 Les données avant les agents

Base de familles unique, présences exportables, comptabilité propre, bibliothèque d'exercices.

- [x] `P8.4.01` ➜ N1 — Plateforme de base sur newvalkyria.com : inscriptions, essais, versements, codes de référence, commandites, contrats, paie, portail entraîneur, espace parent. — 31 déc. 2026 · Claude Code
- [ ] `P8.4.02` ➜ N1 — Vérifier qu'on peut exporter les présences de MonClubSportif, ou prendre les présences dans le portail entraîneur. — 30 nov. 2026 · Claude Code
- [ ] `P8.4.03` ➜ N1 — Mettre en place un logiciel comptable propre avec le CPA. — 31 déc. 2026 · JP

#### P8.5 Agent administratif (priorité 1)

Inscriptions, paiements, relances, bienvenue, questions des parents sur tous les canaux. Voir la fiche A01.

- [ ] `P8.5.01` ➜ N1 — Construire l'agent administratif en mode assistant (brouillons validés par un humain). — 31 déc. 2026 · Claude Code · A01 Agent administratif
- [ ] `P8.5.02` ➜ N2 — Passer l'agent administratif en mode semi-automatique et mesurer les heures sauvées. — 31 mars 2027 · JP · A01 Agent administratif

#### P8.6 Agents pédagogie et familles

Support coaching et suivi des familles. Voir les fiches A02 et A03.

- [ ] `P8.6.01` ➜ N3 — Construire l'agent support coaching (fiche de séance prête, adaptée aux présences et au terrain). — 31 mai 2027 · Claude Code · A02 Agent support coaching
- [ ] `P8.6.02` ➜ N5 — Construire l'agent suivi des familles (difficultés, rapports, programme maison, réinscriptions). — 31 déc. 2027 · Claude Code · A03 Agent suivi des familles

#### P8.7 Agents d'affaires

Financier, marketing, statistiques, veille, partenaires, opérations, RH, tableau de bord direction. Voir les fiches A04 à A11.

- [ ] `P8.7.01` ➜ N5 — Construire l'agent financier. — 31 déc. 2027 · Claude Code · A04 Agent financier
- [ ] `P8.7.02` ➜ N6 — Construire l'agent stratégie marketing. — 31 déc. 2028 · Claude Code · A05 Agent stratégie marketing
- [ ] `P8.7.03` ➜ N6 — Construire l'agent statistiques. — 31 déc. 2028 · Claude Code · A06 Agent statistiques
- [ ] `P8.7.04` ➜ N6 — Construire l'agent veille commerciale. — 31 déc. 2028 · Claude Code · A07 Agent veille commerciale
- [ ] `P8.7.05` ➜ N6 — Construire l'agent partenaires (commandites, subventions, écoles). — 31 déc. 2028 · Claude Code · A08 Agent partenaires
- [ ] `P8.7.06` ➜ N6 — Construire l'agent opérations et logistique. — 31 déc. 2028 · Claude Code · A09 Agent opérations et logistique
- [ ] `P8.7.07` ➜ N6 — Construire l'agent ressources humaines des coachs. — 31 déc. 2028 · Claude Code · A10 Agent ressources humaines des coachs
- [ ] `P8.7.08` ➜ N6 — Construire l'agent tableau de bord direction (résumé unique du lundi). — 31 déc. 2028 · Claude Code · A11 Agent tableau de bord direction

#### P8.8 Plateforme Valkyria et application

Module Mandalart dans l'admin, Valkyria Lab phase 2, puis application Valkyria (à suivre).

- [ ] `P8.8.01` ⭐ N1 — Construire le module Mandalart dans l'admin (/admin/mandalart) : niveaux, cases à cocher, barres de progression, indicateurs. — 30 nov. 2026 · Claude Code · AU01 Module Mandalart dans l'admin
- [ ] `P8.8.02` ➜ N1 — Activer le courriel du lundi à JP : niveau actuel, priorités en retard, indicateurs. — 15 déc. 2026 · Claude Code · AU02 Courriel du lundi à JP
- [ ] `P8.8.03` ➜ N6 — Lancer la phase 2 du Valkyria Lab (espace membre) quand 50 % des familles actives l'utilisent. — 31 déc. 2028 · JP
- [ ] `P8.8.04` ➜ N6 — Évaluer puis lancer l'application Valkyria (à suivre) : Lab, profil de l'enfant, horaires et messages, présences, boutique, programmes. — 31 déc. 2028 · Claude Code

## 9. Points à trancher par JP

- **Répartition du 1,5 M$ de 2028** (décision de JP du 1er novembre 2026 : l'objectif est 1 500 000 $ sur l'année civile 2028). Proposition : Valkyria ≈ 1 000 000 $ (camps ≈ 370 000 $, académie ≈ 285 000 $, parascolaire ≈ 160 000 $, commandites ≈ 80 000 $, autres ≈ 105 000 $) + conseil 500 000 $. Le doc parlait avant de Valkyria 500 000 $ + conseil 500 000 $ = 1 M$. Tâche `P7.8.01`.
- **Cible de CA de 2027** : étape intermédiaire à fixer pour juger la trajectoire.
- **Solo Valkyria** : le pilier 2 le présente comme un leurre à une place, mais les 5 places sont vendues à 1 455 $ et Privilège est complet. Tâche `P2.4.01`.
- **Cible de l'été 2027** : la feuille de route dit « jusqu'à 200 000 $ » ; le plan d'été prévoit 58 400 $ (prudent), 118 800 $ (ambitieux) et 300 000 $ de bénéfice au scénario maximal. L'indicateur `benefice_ete_2027` vise 300 000 $ ; à confirmer.
- **Agent support coaching** : placé au niveau 3, après la banque d'exercices, parce qu'il en dépend. Le document le classe 2e dans l'ordre des agents.
- **Cibles proposées** non écrites dans le doc : `seances_approuvees` 80 %, `cohortes_2017_2019` 120 joueuses (40 par génération), `recommandation` 9 sur 10.
- **Regroupements** pour tenir dans 8 cases : pilier 5 (Home Lab avec l'analyse vidéo ; tournoi, fêtes et ligue des mamans ensemble), pilier 7 (conformité, méthode de lancement et contrôle des dépenses deviennent des objectifs).

## 10. À coller dans le CLAUDE.md du dépôt

```md
## Mandalart (objectif 1,5 M$ sur l'année civile 2028)
- Plan : data/mandalart.json (ne pas modifier sans JP). Explications : docs/MANDALART_VALKYRIA.md.
- Module : /admin/mandalart. L'état des tâches vit dans Supabase (mandalart_tasks_state), clé = code de tâche.
- Réimporter le JSON ne doit jamais changer un statut existant.
- Agents et automatisations : section 5 du dossier ; on construit dans l'ordre des niveaux, un agent à la fois, en mode assistant d'abord.
- Loi 25 : aucune donnée d'enfant dans les tables mandalart_* ; vidéos d'enfants en stockage privé seulement.
```

## 11. Ajouts de JP (2 nov. 2026)

Demandés par JP le 2 nov. 2026. Ils complètent les objectifs existants (codes à la suite, jamais renumérotés).

### Règle d'anticipation

- Toute mise en vente, tout lancement ou tout événement a une tâche de préparation due **1 à 2 mois avant**. Exemple : l'été 2027 se vend le 15 janvier, donc tout est prêt le 15 décembre.
- L'écran « Ce mois-ci » montre aussi les ⭐ des 2 mois suivants qui doivent commencer maintenant.
- Aucun projet n'est lancé sans sondage d'intérêt auprès des familles : la liste des familles intéressées sert au lancement et aux offres ciblées.

### Voix des familles : sondages et satisfaction

On ne laisse rien au hasard : sondage de mi-saison, de fin de saison, après chaque bulletin, après chaque changement (« on a fait ça suite à vos réponses, comment vous trouvez ça ? ») et avant chaque nouveau projet (« seriez-vous intéressés par… ? »). On sait qui a répondu quoi, on rappelle les familles insatisfaites, on mesure le taux de satisfaction et on le met en valeur. Les familles contentes sont celles qui reviennent.

#### P4.8 Réinscription, satisfaction et sortie U13

- [ ] `P4.8.05` ⭐ N1 — Construire le module Sondages dans l'admin : lien personnel par famille, qui a répondu quoi, taux de réponse, note de recommandation sur 10, familles intéressées par un projet. — 30 nov. 2026 · Claude Code · AU17
- [ ] `P4.8.06` ⭐ N1 — Écrire les questions du sondage de mi-saison : accueil, coachs, progrès de la fille, communication, bulletins, horaire et lieux, uniformes, recommandation sur 10, idées. — 30 nov. 2026 · JP
- [ ] `P4.8.07` ⭐ N1 — Envoyer le sondage de mi-saison à toutes les familles et relancer jusqu'à 70 % de réponses. — 15 déc. 2026 · JP + Claude Code · AU17
- [ ] `P4.8.08` ⭐ N1 — Lire chaque réponse sous 48 h : appeler toute famille qui donne moins de 7 sur 10 et noter la décision prise. — 31 déc. 2026 · JP · AU17
- [ ] `P4.8.09` ⭐ N1 — Envoyer le sondage d'intérêt pour l'été 2027 et les projets (camps spécialisés avec des clubs professionnels, élite, voyages, Home Lab) avant la mise en vente. — 15 déc. 2026 · JP · AU17
- [ ] `P4.8.10` ➜ N2 — Envoyer le bilan « Vous avez dit, on a fait » : ce qui a changé suite au sondage, avec la question « comment vous trouvez ça ? ». — 31 janv. 2027 · JP · AU17
- [ ] `P4.8.11` ➜ N2 — Ajouter un sondage court après chaque bulletin : utile ou non, ce qui manque. — 31 mars 2027 · Claude Code · AU17
- [ ] `P4.8.12` ⭐ N2 — Envoyer le sondage de fin de saison avant d'ouvrir la réinscription. — 15 mars 2027 · JP · AU17
- [ ] `P4.8.13` ➜ N2 — Mettre en valeur la satisfaction : taux de satisfaction et témoignages (avec accord) sur le site et dans les réseaux. — 31 mars 2027 · JP · A05
- [ ] `P4.8.14` ➜ N3 — Faire passer chaque nouveau projet par un sondage d'intérêt 2 mois avant son lancement ; cibler le lancement et les offres sur les familles intéressées. — 31 mai 2027 · JP · AU17

### Valkyria Lab et innovations Valkyria

Le Valkyria Lab commence cette saison et ne s'arrête plus : il s'améliore chaque mois. Les innovations (dossards bicolores, tapis de ball mastery, repères visuels, prise d'information) se commandent en échantillon, se testent en séance, puis se commandent en volume 2 mois avant d'en avoir besoin.

#### P1.6 Développement cognitif

- [ ] `P1.6.05` ⭐ N1 — Commander les échantillons des innovations Valkyria chez 2 fournisseurs : dossards bicolores, tapis de ball mastery, repères visuels. — 15 nov. 2026 · JP
- [ ] `P1.6.06` ➜ N1 — Tester les échantillons en séance, les noter avec la grille sur 10 et choisir les modèles. — 30 nov. 2026 · Coachs
- [ ] `P1.6.07` ➜ N2 — Ajouter à la feuille de suivi une mesure de la prise d'information (regards avant la réception, test filmé). — 31 mars 2027 · JP + Claude Code
- [ ] `P1.6.08` ➜ N3 — Commander les tapis et le matériel des kits d'été, 2 mois avant les camps. — 30 avr. 2027 · JP

#### P1.7 Suivi individuel : Valkyria Lab et profil de l'enfant

- [ ] `P1.7.12` ⭐ N1 — Mesurer le Valkyria Lab chaque mois : familles qui envoient une vidéo, et un sondage court après le premier mois. — 31 déc. 2026 · JP · AU17

### Préparations à l'avance

#### P2.4 Échelle d'offres sur 5 générations

- [ ] `P2.4.05` ⭐ N1 — Préparer la mise en vente de l'été 2027 un mois d'avance : prix, dates, pages du site et courriel prêts. — 15 déc. 2026 · JP + Claude Code

#### P5.2 Camps de jour d'été 2027 (multisites)

- [ ] `P5.2.10` ⭐ N1 — Préparer la prévente des camps : page, prix hâtifs, liste des familles intéressées (sondage). — 20 déc. 2026 · JP + Claude Code

#### P5.5 Événements payants

- [ ] `P5.5.04` ➜ N2 — Réserver le lieu et la date du tournoi Valkyria, 4 mois avant. — 31 janv. 2027 · JP

### Banque d'exercices Valkyria et évaluation des joueuses

Le style de JP, écrit noir sur blanc. Chaque exercice est classé par type (ball mastery, analytique, jeu réduit à thème, forme jouée, physique, échauffement), passe la liste de vérification Valkyria (objectif, consignes, variantes, progression ; métriques pour le physique) et prévoit l'organisation selon le nombre de joueuses (5 à 7, 8 à 10, 11 à 16). Le gymnase sert surtout la technique et le ball mastery ; le synthétique, la tactique, le grand espace et la prise de décision ; les thèmes relient les deux et les acquis se vérifient en fin de bloc. Les éducateurs notent chaque exercice sur 10 : deux notes de 8 ou plus = exercice approuvé ; une note sous 8 = on change l'exercice (nouvelle version), on ne le remet pas la même semaine et on le réévalue. Ainsi, chaque saison repart d'une banque d'exercices prouvés. Les joueuses sont évaluées à chaque pratique, en moins de 2 minutes par fille (photo, ball mastery, prestation, attitude, une note d'au moins 30 caractères) : à la fin de la saison, on a un vrai portrait de chaque fille. Les documents de référence de JP (banques, création d'exercices, liste de vérification) servent de base.

#### P1.3 Séances sans improvisation et banque d'exercices approuvés

- [ ] `P1.3.12` ⭐ N1 — Classer chaque exercice par type : ball mastery, analytique (technique), jeu réduit à thème, forme jouée, physique (avec ses métriques), échauffement. — 30 nov. 2026 · JP + Claude Code
- [ ] `P1.3.13` ⭐ N1 — Ajouter à la fiche la liste de vérification Valkyria : objectif, consignes, variante plus facile, plus difficile et cognitive, progression, métriques pour les exercices physiques. — 30 nov. 2026 · Claude Code
- [ ] `P1.3.14` ⭐ N1 — Écrire pour chaque exercice l'organisation selon le nombre de joueuses : 5 à 7, 8 à 10, 11 à 16. — 30 nov. 2026 · JP
- [ ] `P1.3.15` ⭐ N1 — Appliquer la règle d'approbation : approuvé quand 2 éducateurs donnent 8 sur 10 ou plus ; une note sous 8 = on change l'exercice (nouvelle version), pas la même semaine, puis on le réévalue. — 30 nov. 2026 · Claude Code · AU06
- [ ] `P1.3.16` ➜ N1 — Importer les documents de référence de JP (banques d'exercices, création d'exercices, liste de vérification) comme base de la banque. — 15 déc. 2026 · JP + Claude Code
- [ ] `P1.3.17` ➜ N2 — Relier lieux et thèmes : gymnase = technique et ball mastery, synthétique = tactique, grand espace et prise de décision ; vérifier les acquis par thème en fin de bloc. — 31 janv. 2027 · JP

#### P1.2 Standards de progression mesurables

- [ ] `P1.2.08` ⭐ N1 — Mettre l'évaluation des joueuses dans le portail entraîneur, moins de 2 minutes par fille : photo de la joueuse, ball mastery, prestation, attitude, note d'au moins 30 caractères (sentiment, comportement). — 30 nov. 2026 · Claude Code
- [ ] `P1.2.09` ⭐ N1 — Faire remplir l'évaluation des joueuses par les éducateurs après chaque pratique. — 31 déc. 2026 · Coachs
- [ ] `P1.2.10` ➜ N2 — Produire le résumé de saison de chaque joueuse à partir de ses évaluations, pour les bulletins et le suivi. — 31 mars 2027 · Claude Code · A03

### MonClubSportif, présences des éducateurs et contrôle comptable automatiques

JP ne doit plus rien manipuler à la main. Une famille paie : la joueuse est dans MonClubSportif, dans le bon programme, son compte est activé et les courriels partent. Un remboursement : elle est retirée partout. Une activité ou un match est créé : il est aussi dans MonClubSportif. Les éducateurs confirment leur présence à chaque activité : les heures et la paie se calculent selon leur taux. L'agent financier vérifie chaque semaine que l'argent qui entre et l'argent qui sort concordent. Tout est relié : inscription, paiement, MonClubSportif, présences, paie, comptabilité.

#### P8.4 Les données avant les agents

- [ ] `P8.4.04` ⭐ N1 — Lister toutes les tâches faites à la main dans MonClubSportif (ajouter une inscrite, la mettre dans son programme, activer son compte, courriels, retirer une remboursée, créer les activités et les matchs) avec le temps de chacune. — 15 nov. 2026 · JP
- [ ] `P8.4.05` ⭐ N1 — Demander à MonClubSportif s'il existe une API ou une importation automatique ; sinon, choisir le robot (navigateur automatisé) qui fera ces tâches. — 30 nov. 2026 · JP + Claude Code · A12
- [ ] `P8.4.06` ⭐ N1 — Afficher dans l'admin la liste « à faire dans MonClubSportif » produite par le site : nouvelles inscrites payées, remboursées à retirer, activités et matchs à créer. — 15 déc. 2026 · Claude Code · AU19
- [ ] `P8.4.07` ➜ N2 — Synchroniser MonClubSportif sans intervention (inscription, programme, compte, retrait, activités), avec un journal de chaque action. — 31 mars 2027 · Claude Code · A12

#### P8.3 Recrutement et ressources humaines des coachs

- [ ] `P8.3.04` ⭐ N1 — Faire confirmer leur présence par les éducateurs à chaque activité dans le portail entraîneur ; heures et paie calculées selon leur taux. — 15 déc. 2026 · Claude Code · AU20
- [ ] `P8.3.05` ➜ N1 — Relancer l'éducateur qui n'a pas confirmé sa présence 24 h après l'activité ; liste des présences manquantes avant chaque paie. — 31 déc. 2026 · Claude Code · AU20

#### P7.7 Rentabilité par ligne et tableau de bord du lundi

- [ ] `P7.7.04` ⭐ N2 — Faire le rapprochement comptable chaque semaine : argent entré (Stripe, virements) contre inscriptions, argent sorti (paie, terrains, fournisseurs) contre budget ; tout écart est signalé. — 31 janv. 2027 · Claude Code · AU18

### Matchs, réseaux sociaux, portail des éducateurs et appréciation des joueuses

Chaque pratique est un laboratoire : rien n'est improvisé. Les matchs ont leur propre section (nous contre l'adversaire, score, résumé, vidéo, analyse, joueuses et temps de jeu) et leur bilan financier (coût, part de l'adversaire encaissée ou non). Les réseaux sociaux sont suivis publication par publication, organique et payant, pour savoir quel contenu amène des essais et des inscriptions. L'éducateur arrive et sait tout : thème, montage du terrain, matériel, qui fait quoi, points clés, variantes et progressions. Ses rapports sont complets ou ses heures ne comptent pas, et les copier-coller sont bloqués. À la fin de chaque pratique, chaque joueuse donne sa note de la pratique et sa fatigue : on suit le taux d'appréciation des joueuses.

#### P1.8 Amélioration continue et preuve externe

- [ ] `P1.8.05` ⭐ N1 — Ouvrir la section Matchs : chaque match (nous contre l'adversaire, logos), score, résumé de ce qui s'est passé, joueuses présentes et temps de jeu. — 31 déc. 2026 · Claude Code
- [ ] `P1.8.06` ➜ N2 — Déposer la vidéo de chaque match (lien YouTube non répertorié ou dépôt direct dans le stockage privé, sans alourdir le site) et en faire l'analyse. — 31 mars 2027 · JP + Claude Code
- [ ] `P1.8.07` ➜ N2 — Tenir les statistiques de chaque joueuse : matchs joués, minutes, évaluations ; bilan de fin d'année. — 31 mars 2027 · Claude Code

#### P1.4 Formation des coachs

- [ ] `P1.4.08` ⭐ N1 — Afficher la pratique du jour dans le portail entraîneur : thème, montage du terrain, matériel, qui fait quoi, points clés, variantes et progressions. — 31 déc. 2026 · Claude Code · A02
- [ ] `P1.4.09` ⭐ N1 — Contrôler la qualité des rapports des éducateurs : évaluations complètes avant que les heures comptent ; copier-coller et notes trop répétitives refusés. — 31 déc. 2026 · Claude Code · AU20
- [ ] `P1.4.10` ➜ N2 — Limiter les accès des éducateurs dans le portail à ce dont ils ont besoin. — 31 mars 2027 · Claude Code

#### P1.5 Pédagogie adaptée aux filles

- [ ] `P1.5.06` ⭐ N1 — À la fin de chaque pratique, chaque joueuse donne sa note de la pratique sur 10 et sa fatigue sur 10 (routine de fin avec la coach) ; taux d'appréciation suivi chaque semaine. — 15 déc. 2026 · Coachs + Claude Code

#### P3.2 Vidéos portfolio et avant-après

- [ ] `P3.2.05` ⭐ N1 — Suivre chaque publication (réseau, type : reel, vidéo, carrousel, photo, story ; organique ou payant ; vues, abonnés gagnés). — 31 déc. 2026 · JP + Claude Code · A06

#### P3.8 Publicité payante et mesure

- [ ] `P3.8.05` ➜ N2 — Relier vues, essais et inscriptions par canal et par type de contenu, organique et payant ; coût par essai et par inscription. — 31 mars 2027 · Claude Code · A06

#### P7.7 Rentabilité par ligne et tableau de bord du lundi

- [ ] `P7.7.05` ➜ N2 — Faire le bilan financier des matchs : coût (terrain, arbitres, éducateurs), part de l'adversaire encaissée ou non, relié au module Revenus. — 31 mars 2027 · Claude Code

### Matchs, arbitres et bilan de chaque match

Les arbitres réservent eux-mêmes les postes de nos matchs vendus (50 $ par arbitre, 2 par match), reçoivent les informations par courriel et sont payés par virement après le match ; la paie s'ajoute aux dépenses à payer. Chaque match a son bilan : ce que l'adversaire paie, moins le terrain, les arbitres et les éducateurs. Les matchs ne sont pas là pour faire 50 % de marge, mais un match ne doit jamais nous coûter : au moins faire ses frais. Même logique pour chaque cadeau ou avantage donné (sacs, chandails, rabais) : il est compté comme une dépense de son programme.

#### P7.7 Rentabilité par ligne et tableau de bord du lundi

- [x] `P7.7.06` ⭐ N1 — Ouvrir la section Arbitres : réservation des postes de nos matchs vendus par les arbitres (lien personnel), paie ajoutée aux dépenses à payer, bilan de chaque match. — 15 nov. 2026 · Claude Code · AU22
- [ ] `P7.7.07` ➜ N1 — Appliquer la règle des matchs : chaque match fait au moins ses frais ; sinon revoir le prix de la plage, le coût du terrain ou le nombre d'arbitres. — 31 déc. 2026 · JP · A04
- [ ] `P7.7.08` ➜ N2 — Compter chaque cadeau ou avantage donné (sacs, chandails, rabais) comme une dépense de son programme. — 31 mars 2027 · JP · A04

#### P7.6 Contrôle des dépenses, fournisseurs et inventaire

- [ ] `P7.6.05` ➜ N2 — Payer automatiquement les arbitres et contractuels après l'activité (virement, ou dossier de paiement prêt à envoyer). — 31 mars 2027 · Claude Code · A04

### Pratiques préparées 2 semaines d'avance

Chaque pratique (Académie, et celles que JP donne ailleurs : CF Montréal, St-Gabriel…) a son plan prêt d'avance : vert quand elle est prête 2 semaines avant, jaune à 1 semaine, rouge à 3 jours. « Aujourd'hui » montre les pratiques à préparer et JP reçoit un rappel 2 fois par jour tant qu'une pratique est en rouge. Le calendrier de l'admin et celui de MonClubSportif restent identiques dans les deux sens.

#### P1.3 Séances sans improvisation et banque d'exercices approuvés

- [ ] `P1.3.18` ⭐ N1 — Ouvrir la section Pratiques : chaque pratique à venir montre si son plan est prêt (vert 2 semaines d'avance, jaune 1 semaine, rouge 3 jours) ; « Aujourd'hui » l'affiche. — 30 nov. 2026 · Claude Code · AU21
- [ ] `P1.3.19` ⭐ N1 — Envoyer un rappel 2 fois par jour à JP tant qu'une pratique est en rouge. — 30 nov. 2026 · Claude Code · AU21
- [ ] `P1.3.20` ➜ N1 — Ajouter les pratiques que JP donne hors de l'Académie (CF Montréal, St-Gabriel…) dans une section à part, avec le même plan de séance. — 15 déc. 2026 · Claude Code

#### P8.4 Les données avant les agents

- [ ] `P8.4.08` ⭐ N1 — Lire le calendrier de MonClubSportif (exportation iCal, ou accès automatisé) et garder le calendrier de l'admin à jour. — 15 déc. 2026 · Claude Code · A12
- [ ] `P8.4.09` ➜ N2 — Créer dans MonClubSportif chaque pratique ou match ajouté dans l'admin. — 31 mars 2027 · Claude Code · A12

### Structure de l'Académie et recrutement

Une vue d'ensemble de qui travaille avec nous (coachs, consultants, gérante, caméra, arbitres) : rôle, diplômes et certifications, contrat, taux, assignations. Et un plan de recrutement chiffré par saison : combien de coachs certifiés à temps plein, à temps partiel, de moniteurs, selon les groupes prévus (une coach pour dix filles). La structure doit suivre la croissance, sans s'alourdir avant les revenus.

#### P8.2 Équipe humaine et rôles

- [ ] `P8.2.05` ⭐ N1 — Ouvrir le dossier Structure : chaque personne, son rôle, ses diplômes et certifications, son contrat, son taux et ses assignations. — 15 déc. 2026 · Claude Code · A10
- [ ] `P8.2.06` ➜ N2 — Écrire le plan de recrutement de chaque saison : coachs certifiés à temps plein, à temps partiel, moniteurs, selon les groupes prévus (1 coach pour 10 filles) et la marge. — 31 janv. 2027 · JP · A10

#### P8.3 Recrutement et ressources humaines des coachs

- [ ] `P8.3.06` ➜ N2 — Suivre chaque recrutement : annonce, candidats, entrevue, vérification des antécédents, formation, contrat signé. — 31 mars 2027 · JP + Claude Code · A10

### Un plan qui s'ajuste et qui se joue

Le Mandalart ne sert pas qu'à cocher. Chaque mois, il compare l'argent encaissé au plan (mois, trimestre), à la trésorerie jusqu'en avril et à l'argent que JP veut rattraper (ex. charges avancées), puis propose des leviers chiffrés à partir des vrais chiffres : places libres, programmes garçons, plages de matchs, commandites, préventes. Quand ça ne marche pas, il propose une autre voie. Et il se joue comme un jeu : une quête du jour de 3 petites bouchées, de l'XP (⭐ = 100, ➜ = 50), des rangs, une série de jours, et une carte des 6 mondes qui dit, au rythme réel des dernières semaines, si on arrive à temps.

### Agents ajoutés

| Ordre | Agent | Niveau de construction | Prérequis | Tâches du Mandalart |
| --- | --- | --- | --- | --- |
| 13 | A13 Agent identité visuelle | N1 | Charte graphique approuvée par JP (P3.2.10) | P3.2.10, P3.2.11 |
| 12 | A12 Agent MonClubSportif | N2 | Liste « à faire dans MonClubSportif » (AU19) ; Liste des tâches manuelles (P8.4.04) ; Réponse de MonClubSportif sur l'API (P8.4.05) | P8.4.05, P8.4.07 |

#### A12 — Agent MonClubSportif

- **Rôle** : Tient MonClubSportif à jour tout seul, à partir des inscriptions, des paiements, des remboursements et du calendrier du site.
- **Se déclenche quand** : Inscription payée ; Remboursement ou annulation ; Activité, match ou tournoi créé ou modifié ; Chaque soir (vérification de concordance).
- **Lit** : Inscriptions payées et programmes ; Remboursements (Stripe) ; Calendrier des activités et des matchs ; Liste « à faire dans MonClubSportif » (AU19).
- **Fait** : Ajoute la joueuse et l'inscrit dans le bon programme ; Active le compte et envoie l'invitation ; Retire une joueuse remboursée partout ; Crée les activités et les matchs ; Signale tout écart entre le site et MonClubSportif.
- **Validation humaine** : Aucune pour les cas simples une fois en mode autonome ; JP valide les retraits et les cas inhabituels.
- **Accès** : Lecture : inscriptions, paiements, calendrier. Écriture : MonClubSportif seulement (par API si elle existe, sinon navigateur automatisé avec un compte dédié dont JP garde le mot de passe). Interdit : paiements, données de santé.
- **Comment savoir s'il fonctionne** : Écarts entre le site et MonClubSportif (cible 0) ; minutes de saisie sauvées par semaine.
- **Construit au niveau** N2 ; objectif P8.4 ; tâches P8.4.05, P8.4.07.

#### A13 — Agent identité visuelle

- **Rôle** : Qu'on reconnaisse une publication de l'académie en une seconde, avant même de lire le nom : mêmes couleurs, mêmes polices, mêmes gabarits, même façon de filmer et de titrer.
- **Se déclenche quand** : Avant chaque publication ; chaque nouvelle campagne (concours, bourse, inscriptions) ; une fois par mois (revue du fil Instagram).
- **Lit** : Charte graphique Valkyria ; publications prévues (marketing_posts) ; fil Instagram et Facebook public.
- **Fait** : Tient la charte graphique (logo, couleurs, polices, gabarits de reel, carrousel, story et affiche) ; vérifie chaque publication contre la charte et la corrige avant que JP publie ; prépare les gabarits de chaque campagne.
- **Validation humaine** : JP approuve la charte et chaque gabarit ; ensuite la vérification est automatique.
- **Accès** : Lecture : publications prévues, charte. Écriture : brouillons de publications. Interdit : inscriptions, paiements, données des enfants.
- **Comment savoir s'il fonctionne** : Publications conformes à la charte (cible 100 %) ; reconnaissance de la marque dans le sondage de fin de saison.
- **Construit au niveau** N1 ; objectif P3.2 ; tâches P3.2.10, P3.2.11.

### Présence sur Google et référencement local (6 nov. 2026)

Une académie privée se choisit sur Google : une famille tape « soccer filles Sainte-Thérèse » ou « académie de soccer Laurentides » et appelle les trois premiers résultats de la carte. La fiche Google (catégorie **École de sport**, choix de JP), les avis des familles contentes et des pages par ville font ce travail gratuitement, toute l'année. Même nom, même adresse, même téléphone partout. Claude Code prépare et déploie les inscriptions dès le feu vert de JP ; JP fait seulement les vérifications qui demandent son identité (code postal ou appel de Google).

#### P3.8 Publicité payante et mesure

- [ ] `P3.8.06` ⭐ N1 — Créer la fiche Google de l'académie (Google Business Profile) : catégorie École de sport, zone desservie (Sainte-Thérèse, Blainville, Rosemère, Prévost, Saint-Jérôme, Mirabel, Terrebonne), description, photos, horaires, lien d'inscription ; JP fait la vérification d'identité. — 20 nov. 2026 · JP + Claude Code
- [ ] `P3.8.07` ⭐ N1 — Vérifier le site dans Google Search Console et Bing Webmaster Tools et soumettre le plan du site. — 20 nov. 2026 · Claude Code
- [ ] `P3.8.08` ⭐ N1 — Inscrire l'académie avec le même nom, la même adresse et le même téléphone : Apple Business Connect, Bing Places, Pages Jaunes, Facebook et Instagram à jour, bottins des organismes de loisirs des villes où nous louons des gymnases. — 15 déc. 2026 · Claude Code (feu vert de JP)
- [ ] `P3.8.09` ⭐ N1 — Demander un avis Google aux familles qui donnent 9 ou 10 sur 10 dans les sondages, automatiquement, une seule fois par famille. — 15 déc. 2026 · Claude Code · AU17
- [ ] `P3.8.10` ➜ N2 — Créer une page par ville et par besoin, avec du vrai contenu (groupes, horaires, lieu, photos) : soccer féminin à Sainte-Thérèse, Prévost, Blainville, Saint-Jérôme ; Sport-Études soccer Laurentides ; camp de soccer filles l'été. — 31 janv. 2027 · Claude Code
- [ ] `P3.8.11` ➜ N2 — Publier chaque semaine sur la fiche Google : photo de pratique, résultat de match, période d'inscription. — 31 janv. 2027 · JP · A05
- [ ] `P3.8.12` ➜ N2 — Suivre chaque mois les mots clés (position), les appels et les clics de la fiche Google et le nombre d'avis ; corriger ce qui ne monte pas. — 28 févr. 2027 · Claude Code · A06

### Acquisition : concours, bourses, vidéos d'entrevues et méthodes Hormozi (6 nov. 2026)

Ce qui ramène le plus de familles, confirmé autour de JP : **les concours**, surtout « tu gagnes et ton amie gagne la même chose » (chaque participation amène une nouvelle famille), et **la bourse** : les familles postulent pour une bourse ; celles qui ne la gagnent pas reçoivent une bourse partielle (un rabais) valable quelques jours, ce qui transforme chaque candidature en inscription probable. À essayer pour vrai, mesuré comme le reste.

Le contenu ne s'arrête plus : **à partir du 15 novembre, l'académie publie sans arrêt**, et **à la fin novembre on tourne les entrevues vidéo des joueuses et des parents** (la meilleure preuve qu'on puisse montrer).

Les livres d'Alex Hormozi servent de base partout : **$100M Offers** (équation de valeur, garantie, bonus, rareté, urgence) pour chaque offre ; **$100M Leads** (Core Four, règle des 100, Lead Getters) dans la tête du responsable marketing (agent A05) ; **$100M Money Models** (offre d'attraction, offre de montée en gamme, offre de repli, offre continue) dans la tête du responsable des finances (agent A04).

#### P3.1 Parrainage

- [ ] `P3.1.06` ⭐ N1 — Concept à essayer en vrai : concours « Toi et ton amie gagnez » (les deux gagnent la même chose, ex. une séance privée ou un sac Valkyria). Participation par le site avec le courriel des deux familles ; mesurer participations, nouvelles familles, essais et inscriptions. — 15 déc. 2026 · JP + Claude Code · A05
- [ ] `P3.1.07` ➜ N2 — Refaire un concours à chaque période d'inscription (été, saison) avec le prix qui a le mieux marché ; règlement du concours conforme (Régie des alcools, des courses et des jeux si la valeur l'exige). — 31 mars 2027 · JP · A05

#### P3.6 Liste chaude

- [ ] `P3.6.04` ⭐ N1 — Concept à essayer en vrai : la Bourse Valkyria. Les familles postulent (formulaire court : la joueuse, sa motivation) ; quelques bourses complètes, et chaque candidate non retenue reçoit une bourse partielle (rabais) valable 7 jours. Chaque candidature entre dans la liste chaude. — 31 janv. 2027 · JP + Claude Code
- [ ] `P3.6.05` ➜ N2 — Mesurer la Bourse : candidatures, bourses partielles utilisées, inscriptions, coût par inscription ; décider de la refaire chaque saison. — 31 mars 2027 · Claude Code · A06

#### P3.2 Vidéos portfolio et avant-après

- [ ] `P3.2.06` ⭐ N1 — Commencer à publier sur les comptes de l'académie le 15 novembre et ne plus arrêter (calendrier de publication tenu chaque semaine). — 15 nov. 2026 · JP + caméra · A05
- [ ] `P3.2.07` ⭐ N1 — Tourner les entrevues vidéo des joueuses (ce qu'elles ont appris, ce qu'elles aiment, leur progrès), avec le consentement écrit des parents. — 30 nov. 2026 · JP + caméra · A05
- [ ] `P3.2.08` ⭐ N1 — Tourner les entrevues vidéo des parents (pourquoi New Valkyria, ce qui a changé chez leur fille) et les publier comme témoignages. — 30 nov. 2026 · JP + caméra · A05
- [ ] `P3.2.09` ➜ N1 — Monter chaque entrevue en 3 formats : reel de 30 secondes, version longue pour le site, citation en image. — 15 déc. 2026 · Caméra · A13
- [ ] `P3.2.10` ⭐ N1 — Écrire la charte graphique Valkyria (logo, couleurs, polices, gabarits reel, carrousel, story, affiche) pour qu'une publication de l'académie se reconnaisse au premier coup d'œil. — 30 nov. 2026 · JP + Claude Code · A13
- [ ] `P3.2.11` ➜ N2 — Vérifier chaque publication contre la charte avant de publier (agent identité visuelle). — 31 janv. 2027 · Claude Code · A13

#### P2.4 Échelle d'offres sur 5 générations

- [ ] `P2.4.06` ⭐ N1 — Passer chaque offre à l'équation de valeur de $100M Offers (résultat rêvé, probabilité perçue, délai, effort) : ajouter garantie, bonus, rareté et urgence ; commencer par l'été 2027. — 15 déc. 2026 · JP + Claude Code · A05

#### P7.5 Valeur d'une famille et coût d'acquisition

- [ ] `P7.5.03` ⭐ N2 — Bâtir le modèle d'argent de l'académie selon $100M Money Models : offre d'attraction (essai, concours, bourse), montée en gamme (Solo, privé, Sport-Études), offre de repli (demi-saison, versements), offre continue (saison suivante, camps) ; une ligne par offre avec son prix et sa marge. — 31 janv. 2027 · JP + Claude Code · A04

#### P8.7 Agents d'affaires

- [ ] `P8.7.09` ➜ N2 — Construire l'agent analyse de la concurrence (A07) : fiche par concurrent dans `docs/concurrence/`, relevé mensuel, alerte si un concurrent ouvre un groupe filles dans nos villes. — 31 janv. 2027 · Claude Code · A07

### Indicateurs ajoutés

| Id | Indicateur | Départ | Cible | Échéance | Source | Comment le mesurer |
| --- | --- | --- | --- | --- | --- | --- |
| `taux_reponse_sondages` | Familles qui répondent aux sondages | 0 % | 70 % | 15 déc. 2026 | auto | Réponses ÷ familles invitées, dernier sondage envoyé. Module Sondages. |
| `solde_bancaire` | Solde du compte (BMO + Stripe) | 0 $ (2 nov. 2026, note de JP) | 3 mois de dépenses fixes | 31 déc. 2027 | manuel | Saisi par JP ; sert au calcul de la trésorerie jusqu'en avril dans « Écart et rattrapage ». |
| `entrees_attendues` | Entrées d'argent attendues hors versements des familles | 10 000 $ (2 × 5 000 $, novembre 2026) | à mesurer | 30 avr. 2027 | manuel | Montant total attendu d'ici avril (ex. 5 000 $ deux vendredis de suite) ; mis à jour par JP. |
| `appreciation_joueuses` | Note des pratiques donnée par les joueuses (sur 10) | à mesurer | 9/10 | 31 mars 2027 | auto | Moyenne des notes données par les joueuses à la fin des pratiques (routine de fin), saisies par l'éducateur dans le portail entraîneur ; suivie chaque semaine. |
| `avis_google` | Avis Google de l'académie | 0 (6 nov. 2026, pas de fiche) | 50 avis, moyenne 4,8 | 31 déc. 2027 | manuel | Nombre et moyenne des avis sur la fiche Google ; saisi chaque mois (tâche P3.8.12). |
| `satisfaction` | Familles satisfaites (8 sur 10 et plus) | à mesurer | 90 % | 31 déc. 2027 | auto | Part des répondants qui donnent 8 sur 10 ou plus à la question de recommandation. Module Sondages. |

### Automatisations ajoutées

| Id | Automatisation | Type | Se déclenche quand | Ce qu'elle fait | Pour qui | État | Niveau | Tâches |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AU17 | Sondages aux familles | page | JP crée et envoie un sondage | Lien personnel par famille, relances aux non-répondants, taux de réponse, note sur 10, classement par réponse, liste des familles intéressées par un projet ; une note sous 7 crée une tâche « appeler la famille ». | JP, coordonnateur | à créer | N1 | P4.8.05, P4.8.07, P4.8.08 |
| AU18 | Rapprochement comptable de la semaine | cron | Chaque lundi | Compare l'argent entré (Stripe, virements) aux inscriptions et l'argent sorti (paie, terrains, fournisseurs) au budget ; signale chaque écart à JP. Base de l'agent financier (A04). | JP, CPA | à créer | N2 | P7.7.04 |
| AU19 | Liste « à faire dans MonClubSportif » | page | Inscription payée, remboursement, activité créée | Liste dans l'admin de chaque action à faire dans MonClubSportif, cochée une fois faite ; devient la file de travail de l'agent A12. | JP, puis A12 | à créer | N1 | P8.4.06 |
| AU20 | Présences et heures des éducateurs | evenement | Fin de chaque activité | L'éducateur confirme sa présence dans le portail ; heures × taux = paie ; relance à 24 h ; liste des présences manquantes avant chaque paie. | Éducateurs, JP | actif | N1 | P8.3.04, P8.3.05 |
| AU21 | Pratiques préparées d'avance | cron | Deux fois par jour (8 h et 16 h) | Vérifie le plan de chaque pratique à venir : vert si prête 2 semaines avant, jaune à 1 semaine, rouge à 3 jours ; « Aujourd'hui » l'affiche et JP reçoit un rappel tant qu'une pratique est en rouge. | JP, éducateurs | à créer | N1 | P1.3.18, P1.3.19 |
| AU22 | Arbitres et bilan des matchs | page | Plage de match vendue, réservation d'un arbitre, match passé | Ouvre les postes d'arbitre des matchs vendus, envoie la liste aux arbitres, confirme les réservations, ajoute leur paie aux dépenses à payer et calcule le bilan de chaque match. | JP, arbitres | actif | N1 | P7.7.06 |
| AU23 | Dossier Structure et recrutement | page | JP ouvre l'admin, chaque début de saison | Qui travaille avec nous (rôle, diplômes, contrat, taux, assignations) et besoins de recrutement par saison selon les groupes prévus. | JP | à créer | N1 | P8.2.05, P8.2.06, P8.3.06 |

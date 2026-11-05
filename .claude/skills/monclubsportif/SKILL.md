---
name: monclubsportif
description: Relier MonClubSportif (MCS, la plateforme d'équipes de New Valkyria) au site : lire le calendrier de chaque équipe par son lien iCal « Sync », comparer avec le calendrier de l'admin, bloquer la vente d'une plage de match quand l'équipe est déjà prise, et écrire dans MCS (membres, pratiques, matchs) par un navigateur piloté. À utiliser dès que JP parle de MonClubSportif, MCS, de calendrier des équipes, de synchroniser, de matchs affichés disponibles à tort, ou de « tout est relié » (Mandalart P8.4, agent A12).
---

# MonClubSportif ↔ le site

## Ce que MCS permet (vérifié en nov. 2026)

- **Pas d'API publique.** Contact technique : devops@monclubsportif.com (tâche P8.4.05 : demander une API ou une importation automatique).
- **Lire le calendrier :**
  - dans chaque équipe, section Calendrier → bouton **« Sync »** → lien d'abonnement iCal ;
  - c'est **une URL par équipe**, toujours à jour, en lecture seule.
- **Membres :** importation d'un fichier .csv ou .xlsx dans la section Roster de l'équipe, sur ordinateur seulement.
  - Le site produit déjà ce fichier : `/admin/monclubsportif` (nouveautés, `mcs-sync.ts`, table `mcs_sync_items`) et `/admin/exports`.
- **Écrire dans MCS** (créer une activité, un match, ajouter une joueuse) :
  - par un **navigateur piloté**, Claude in Chrome, avec JP connecté à son compte ;
  - jamais avec un mot de passe saisi par Claude ;
  - c'est l'agent A12, en mode assistant d'abord : préparer les clics, JP regarde.

## Le robot A12 : état au 5 nov. 2026 (à lire avant de toucher au code)

**Où vit quoi.** Ce qui ne doit pas bouger quand le code change est en base, pas dans le code :
- Règles du club : `app_settings` clé `mcs_rules` (`mcs-rules.ts`, `normalizeRules`). Les champs absents prennent la valeur
  par défaut, donc un ajout de règle ne casse jamais les règles enregistrées. Écran : `/admin/monclubsportif/robot`.
- Mémoire du robot : `mcs_sync_items` (kind `membre`, `evenement`, `photo`, `adversaire`, `rappel`), clé = `personKey`
  (« beatrice prevost »). `photoKey` de `mcs-sync.ts` est la même clé. Sans cette mémoire, le robot refait tout à chaque heure.
- Équipes : `mcs_teams` (`mcs_team_id`, `mcs_season_id`, `kind`, `slot_ids`, `program_ids`, `session_program_slugs`).
- Courriels programmés : `scheduled_emails`.

**Code.** `mcs-site-map.ts` (adresses et noms de champs MCS : seul endroit à corriger si MCS change ses pages),
`mcs-robot.ts` (session, lecture des pages, formulaires), `mcs-robot-runner.ts` (`runMcsRobot`), `mcs-rules.ts` (règles pures).
Tests : `mcs-robot.test.ts`, `mcs-rules.test.ts`, `calendar-personal.test.ts`. Ils verrouillent les règles ci-dessous :
les faire passer avant tout commit qui touche au robot.

**Règles que JP a fixées (ne pas changer sans lui) :**
- JP (« Jean-Paul Aka Boidi », règle `alwaysAssigned`) est assigné à **toutes** les activités de toutes les équipes, même
  celles où il ne va pas. Son agenda Google (`/api/calendar/<jeton>.ics?perso=1`) montre tout MCS plus ses activités hors académie.
- **Remplaçantes** (section « Remplaçants » du roster) : jamais assignées par le robot. Le formulaire « nouvelle activité » de MCS
  les met dans `invite[]` et `include_reserve` : le robot ne les envoie jamais (`CREATE_EVENT_SKIPPED`). Une remplaçante n'est
  mise sur une activité qu'à la demande de JP (ex. 5 nov. : Béatrice Prévost sur le match du 7 nov., Stella Roy sur les
  pratiques du 15 et du 29 nov., équipe 2016-2017 AV).
- Une éducatrice peut rester dans un groupe sans être assignée (ex. Maéva chez les garçons 2014-2015 : seulement la semaine du 7 nov.).
- Photos du site → profil MCS dès l'inscription (fait à la main le 5 nov. pour les 34 inscrites, 96 profils, notées dans `mcs_sync_items`).

**Pages MCS utiles (pas d'API, Rails, session du compte organisation) :**
- `/team/T/seasons/S/roster` : sections Joueurs, Entraîneurs, Remplaçants ; `no_photo_thumb` = pas de photo.
- `/roster/M/modify?assignment=true` : les activités du membre (cases `assign[]`) ; le formulaire `/roster/M/assign`
  (`_method=patch`) remplace **exactement** la liste cochée.
- `/calendar/assignments` : assignation en lot (`events[]`, `assign[]`, `unassign=0` ne retire personne).
- `/roster/M/modify` : formulaire multipart, photo dans `member[picture]`.

**Ce qui manque pour qu'il tourne seul :** le compte robot (info+robot@newvalkyria.com) accepté dans l'organisation, ses accès
enregistrés dans Robot et règles, puis « Activer le robot » (`robotActive`). C'est JP qui le fait : Claude ne saisit
jamais de mot de passe. Tant que ce n'est pas fait, le cron horaire `api/cron/mcs-robot` ne fait rien dans MCS.

## Historique : lecture iCal (3 nov. 2026, commit 8a4067c)

- **Lecture par équipe :**
  - tables `mcs_teams` (nom, `birth_years`, genre, `ical_url` gardé côté serveur, dernière lecture, erreur) et `mcs_events` (cache sur 10 semaines, `opponent` lu dans le titre) ;
  - écran `/admin/monclubsportif/equipes` ;
  - code : `mcs-teams-repo.ts` (`syncTeam`, `syncStaleTeams`, `getSlotConflicts`) et `mcs-teams.ts` (règles pures testées : `opponentOf`, `needsOpponent`, `overlaps` à ±30 min, `slotConflict`, `parseBirthYears`).
- **Relecture :** toutes les 15 min à l'ouverture de l'écran, et chaque matin par le cron `api/cron/mcs-sync` (10 h UTC).
- **Vente des plages :** `getSlotsWithAvailability` rend une plage indisponible (`mcsConflict`) si une équipe du même âge est prise.
- **À faire ensuite :**
  - le robot d'écriture (inscriptions payées → bonne équipe, activités et matchs créés, match renommé quand l'adversaire paie) ;
  - il attend le compte robot de JP et `MCS_ROBOT_EMAIL` / `MCS_ROBOT_PASSWORD` dans Vercel.

## Ce qui existe déjà dans le code

- `src/lib/ical.ts` : lecture et développement d'un calendrier iCal (fuseau, répétitions, exceptions), avec ses tests (`ical.test.ts`).
- `src/lib/mcs-calendar.ts` + `mcs-calendar.test.ts` : comparaison calendrier MCS et calendrier de l'admin.
  - Il compare avec `listPractices` (horaire réel) et `listMatches` (matchs vendus), sur 6 semaines.
  - Rapprochement : même jour, début à 15 min près, lieu approximatif.
  - Résultat : identiques, différents, seulement dans MCS, seulement dans l'admin.
  - Réglage `mcs_ical_url` dans la table `app_settings` (migration `20261117_mcs_calendar.sql`).
- **Écrit le 2 nov. 2026 par une autre session, jamais commité ni mis en ligne. Il n'y a pas encore de page.**
  - Le reprendre (le lire, le tester), ne pas le refaire.
  - Prévoir **un lien par équipe** (clé par catégorie ou par plage), pas un seul.

## Le problème à régler en premier (demande de JP, 3 nov. 2026)

Des plages de match sont proposées en vente (`/prive/matchs`, `match_slots`, règles pures `match-slots-core.ts`) alors que l'équipe
Valkyria concernée a déjà un événement dans MCS : pratique, autre match, voyage.

À faire :

1. **Liens Sync par équipe.** JP colle le lien de chaque équipe dans l'admin (une ligne par équipe : nom, catégories, lien), ou on va les
   copier dans Chrome avec lui connecté. Les liens restent côté serveur (`app_settings`), jamais affichés en entier.
2. **Lecture au plus 10 minutes en cache.** Les événements MCS des 8 prochaines semaines, par équipe.
3. **Conflit.**
   - Règle pure, testée : une plage de match est **indisponible** si une équipe admise par la plage (catégories et années de
     naissance de `allowed_categories`) a un événement MCS qui chevauche le créneau, déplacement compris (30 min avant et après).
   - La page de vente ne la montre plus.
   - L'admin des plages affiche « En conflit avec MCS : <événement> ».
4. **Avis.** Dans Aujourd'hui et dans le courriel du lundi : les plages en conflit, et les écarts entre MCS et l'admin.
5. **Page Calendrier** dans l'admin (onglet de MonClubSportif) : la comparaison de `mcs-calendar.ts`.

## Ensuite

- **Liste « à faire dans MCS »** après chaque paiement, remboursement, nouvelle activité ou nouveau match (AU19), cochable.
- **Robot Chrome (A12) :** il exécute la liste avec JP connecté et note ce qui est fait.

Règles :

- Aucune donnée d'enfant dans `app_settings` ni dans les tables `mandalart_*` (Loi 25).
- Les pratiques de JP hors Académie ne vont pas dans MCS.

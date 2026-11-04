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

## En place (3 nov. 2026, commit 8a4067c)

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

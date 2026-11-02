---
name: mandalart
description: Le plan de guerre de New Valkyria (1,5 M$ encaissés en 2028) et son module /admin/mandalart. À utiliser dès que JP parle du Mandalart, d'objectifs, de tâches du mois, de niveaux, d'indicateurs, de piliers, d'agents IA à construire, ou qu'il ajoute une idée « à mettre dans le plan » ; aussi avant de construire une section d'un pilier (banque d'exercices, matchs, réseaux sociaux, MonClubSportif, sondages…).
---

# Mandalart : le plan 1,5 M$ en 2028

## Où est quoi
- **Le plan écrit avec JP** : `docs/MANDALART_VALKYRIA.md` (sections 0 à 10 = plan d'origine ; section 11 = ajouts de JP).
- **Le plan lu par le site** : `data/mandalart.json`, généré par `node scripts/mandalart-build.mjs` (relancer après toute modification du .md, puis `npx vitest run src/lib/mandalart-core.test.ts`).
- **L'état** (cases cochées, notes, valeurs d'indicateurs, agents) : tables `mandalart_*` + `marketing_channel_stats`, toutes avec `club_id` (`src/lib/club.ts`) pour pouvoir dupliquer le système chez un autre club.
- **Calculs purs** : `src/lib/mandalart-core.ts` (poids ⭐ ×2, médailles, niveau actuel, « Ce mois-ci », règle d'anticipation).
- **Données réelles** : `src/lib/mandalart-kpis.ts` (`computeRealFigures` : CA de l'année, 12 mois, rétention, cohortes, remplissage, commandites, matchs, sondages). Un indicateur non branché prend la dernière saisie manuelle.
- **Sections de chaque pilier** : `src/lib/mandalart-modules.ts` (`PILLAR_MODULES` : actif / partiel / à construire, lien vers l'écran existant, contenu prévu, prochaine étape).
- **Écrans** : `/admin/mandalart` (Ce mois-ci), `/piliers`, `/piliers/[p]`, `/piliers/[p]/[section]`, `/niveaux`, `/trajectoire`, `/indicateurs`, `/agents`, `/journal`. Sondages : `/admin/sondages` (`src/lib/surveys-repo.ts`), page famille `/sondage/[token]`.
- **Jeu et rattrapage** : `src/lib/mandalart-game.ts` (XP, rangs, série, quête du jour, carte des mondes et projection au rythme réel) et `src/lib/mandalart-levers.ts` (écart au plan, trésorerie jusqu'en avril, argent à rattraper `mandalart_recovery`, leviers chiffrés). Un nouveau levier = une entrée de plus dans `computeGap`, calculée à partir de vraies données.
- **Automatismes** : courriel et instantané du lundi `api/cron/mandalart-lundi` (vercel.json, lundi 11 h UTC) ; tâches en retard et familles à rappeler dans « Aujourd'hui » (`admin-today.ts`).

## Règles
1. **Ne jamais changer le contenu du plan sans JP.** Une idée de JP s'ajoute dans la section 11 du .md, sous l'objectif concerné (`#### P1.3 …`), avec le **prochain numéro libre** (jamais renuméroter), une échéance, un niveau, ⭐ ou ➜, un responsable et l'agent/automatisation lié ; puis régénérer le JSON.
2. **Règle d'anticipation** (JP, 2 nov. 2026) : tout lancement a une tâche de préparation due 1 à 2 mois avant. Ex. l'été se vend le 15 janvier → préparation due le 15 décembre.
3. Ne jamais écraser un statut en base ; une tâche retirée du plan n'est pas supprimée de la base.
4. Loi 25 : aucune donnée d'enfant dans `mandalart_*`. Vidéos d'enfants : stockage privé seulement.
5. Construire une section : partir de sa fiche dans `PILLAR_MODULES` (contenu prévu, prochaine étape), réutiliser l'existant (skill `admin-page`), puis passer la section à `partiel` ou `actif` et cocher la tâche du plan (statut `fait`, note « Construit par Claude Code le … »).
6. Agents : automatisation d'abord, un agent à la fois, mode assistant d'abord, validation humaine pour l'argent, les plaintes, la santé (page `/admin/mandalart/agents`). Mettre à jour son état dans `mandalart_agent_state`.
7. Un nouvel indicateur : ligne dans la table « Indicateurs ajoutés » du .md, puis son calcul dans `computeRealFigures` si les données existent.

## Prochains chantiers demandés par JP (2 nov. 2026)
Banque d'exercices (types, liste de vérification, organisation 5-7 / 8-10 / 11-16, approbation à 2 notes ≥ 8), évaluation rapide des joueuses dans le portail entraîneur (+ note de la pratique par les joueuses), pratique du jour pour les éducateurs (contrôle de qualité des rapports), section Matchs (résultats, vidéos, statistiques, coûts), réseaux sociaux par publication, liste « à faire dans MonClubSportif » puis agent A12, présences et heures des éducateurs, rapprochement comptable.

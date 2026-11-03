---
name: coaching
description: L'espace Coaching de New Valkyria (seulement le foot) et le portail des éducateurs : pratiques, pratique du jour, briefing, évaluation rapide des joueuses, routine de fin, tests et passeport, méthode Valkyria (structure de séance, principes, gestes), banque d'exercices, progression des joueuses, rapports et présences des éducateurs. À utiliser dès que JP parle de terrain, de pratique, de coach ou d'éducateur, d'évaluation, de test, de passeport, de geste, de méthode, de progression d'une joueuse ou de l'espace Coaching.
---

# Espace Coaching et portail des éducateurs

L'admin a deux espaces (sélecteur en haut du menu, champ `space` des sections dans `src/lib/admin-nav.ts`) :
**Académie** = le business (Aujourd'hui, familles, finances, paie, contrats) ; **Coaching** = seulement le foot.
Tout ce qui sert à faire progresser les filles va dans Coaching (section « Sur le terrain », « Joueuses » ou « Éducateurs »).

## Où est quoi
| Pièce | Écran | Code | Tables |
|---|---|---|---|
| Cette semaine sur le terrain | `/admin/coaching` | `coaching-repo.ts` (`getCoachingWeek`) | (lecture) |
| Pratiques préparées d'avance | `/admin/pratiques` | `practices-repo.ts` | `coach_activities`, `activity_session_blocks` |
| Pratique du jour (champs par bloc) | admin : activité → « Pratique du jour » ; portail : étape « Avant » | `session-plan-repo.ts` (`BLOCK_GUIDE_FIELDS`), `admin-block-guide.tsx` | `activity_session_blocks` (setup, material, roles, key_points, variants, progressions) |
| Briefing de 5 minutes | portail, étape « Avant » | `getBriefing` (`coach-portal-repo.ts`), `surprise-moment.tsx` | `coach_activities.surprise_moment` |
| Évaluation rapide + contrôle de qualité | portail, étape « Après » | `coach-report.ts` (règles pures, testées) | `player_evaluations.ratings` (Ball mastery, Prestation, Attitude) |
| Sondage de fin (présence, plaisir, fatigue, « plus de… ») | `/admin/coaching/sondage` (JP, pratiques des 7 derniers jours ; crée l'activité au besoin) ; portail, étape « Après » | `practice-survey.ts` (pur, testé : 5 choix = 2 à 10), `practice-survey-repo.ts`, composant partagé `practice-survey.tsx` ; `getFeedbackWeeks` → indicateur `appreciation_joueuses` | `activity_player_attendance` (practice_rating, fatigue, wants_more, wants_more_note) |
| Présence de l'éducateur, heures retenues, relance 24 h | portail + `/admin/entraineurs/paie` | `coach-payroll-data.ts`, cron `api/cron/presences-educateurs` | `coach_assignments` (confirmed_by, reminder_sent_at) |
| Progression des joueuses | `/admin/coaching/joueuses` (+ `[id]` = sa saison) | `getPlayersProgress`, `watchReasons` | (lecture) |
| Tests et passeport | `/admin/coaching/tests` | `skill-tests.ts` (pur, testé), `skill-tests-repo.ts` | `skill_tests`, `skill_test_results` |
| Méthode Valkyria | `/admin/coaching/methode`, `/admin/coaching/gestes` ; portail `/entraineur/methode` | `coaching-method.ts` (pur, testé), `coaching-method-repo.ts` | `coaching_method_docs`, `method_gestures` |
| Ce que chaque entraînement doit avoir (ligne directrice de JP) | `/admin/coaching/methode` (en tête) ; portail : Méthode et étape « Avant » | `getComponents`, `ComponentsEditor` (`COMPONENT_IDEAS` = idées, pas le contenu) | `coaching_method_docs` (slug `composantes`) |
| Observation mensuelle des coachs | `/admin/coaching/observations` ; portail : « Mon dernier retour » | `coach-observations.ts` (grille pure, testée), `coach-observations-repo.ts` | `coach_observations` |
| Plan de l'année | `/admin/coaching/plan` | `season-plan.ts` (pur, testé), `season-themes-repo.ts` (`themeFor`) | `season_themes` (block_label, test_week, by_category) |
| Points des joueuses et récompenses | rapport de l'éducateur (« Gagnantes du jour ») ; `/admin/coaching/points` | `player-points.ts` (pur, testé : présence 5, victoire 10, attitude 10, 3 gagnantes max par catégorie), `player-points-repo.ts` | `player_points`, `point_rewards` (présences comptées depuis `activity_player_attendance`) |
| Banque d'exercices | `/admin/exercices` | `exercise-bank.ts`, `exercises-repo.ts` | `exercises`, `exercise_ratings` |
| Galerie en diapos (approuvés, on balaie) | `/admin/exercices/galerie` (`?tous=1`) ; portail `/entraineur/exercices` | `exercise-gallery.ts` (pur, testé), `exercise-gallery.tsx` ; la diapo = `exercises.image_url`, sinon le schéma | (lecture de la banque) |

## Règles
1. **Aucun montant dans l'espace Coaching** ni dans le portail des éducateurs (pas de taux, de paie, de prix, ni de donnée des parents). La paie reste dans Académie → Équipe → Paie.
2. **Chaque fille est comparée à elle-même** (jour 1, test précédent, début de saison), jamais aux autres (P1.5.03).
3. **Loi 25** : vidéos d'enfants = lien YouTube non répertorié ou dossier privé, jamais un fichier public ; notes des éducateurs internes (le bulletin parent ne les montre pas : `getBulletinData(id, "parent")`).
4. **Accès de l'éducateur** : seulement ses activités et les joueuses de ses groupes (`getCoachActivityWithRoster`, `coachCanSeePlayer`). Toute nouvelle route `/api/coach/*` vérifie les deux.
5. **Effectif d'une pratique** = inscrites de la plage horaire (`rosterForActivity`), pas toute la catégorie.
6. **Contenu de la méthode** : c'est JP qui l'écrit et le valide. Ne jamais inventer de gestes, de seuils ou de principes : proposer à partir du plan Mandalart, marqué « proposition à valider ».
7. Les blocs de séance utilisent les mêmes clés que la banque d'exercices (`SESSION_PLACES` : jeu-entree, ball-mastery, technique, forme-jouee).
8. Règles métier dans des fichiers purs testés (`coach-report.ts`, `skill-tests.ts`, `coaching-method.ts`) ; l'écran ne fait qu'afficher.
9. Points : aucun classement entre les filles (chacune voit ses points) ; aucune photo d'enfant enregistrée sans consentement (`players.image_consent`).
10. Après une pièce : fiche dans `mandalart-modules.ts` à jour, tâche cochée dans `mandalart_tasks_state` (note « Construit et mis en ligne par Claude Code le … »), skill `mise-en-ligne`.

## Pièces qui restent (dans l'ordre)
1. Lien lieu ↔ thème et exercices de la banque proposés selon le thème de la semaine (P1.3.17).
2. Formation des coachs : certification interne (P1.4.02, critères de JP), réunion technique mensuelle (P1.4.04).
3. Test mensuel dans le portail des éducateurs (P1.2.05) ; curriculum U8 à U12 (P1.1.06) ; matchs joués et Valkyria Lab (construits par d'autres sessions : relier, ne pas refaire).

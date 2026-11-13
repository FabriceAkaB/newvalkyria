# New Valkyria : carte du projet

Site de l'académie de soccer New Valkyria (newvalkyria.com), dirigée par JP (Jean-Paul Aka Boidi).
JP écrit en français québécois familier, souvent par dictée vocale : comprendre l'intention, répondre en français.

**Règle d'or : ne jamais recréer ce qui existe.** Avant d'ajouter une table, une page, une route ou un module,
chercher dans `src/lib/*` et `src/app/(admin)` un module qui fait déjà presque la même chose et l'étendre
(une colonne, un `checkoutType`, un onglet). Une nouvelle table ou page ne se crée que si rien d'existant ne convient.

## Architecture

- **Next.js 16 App Router** + TypeScript + Tailwind, tests Vitest. Node est dans `~/.local/node` : toujours
  `export PATH="$HOME/.local/node/bin:$PATH"`. `npx tsc --noEmit` avant chaque commit.
- **Groupes de routes** (`src/app/`) :
  - `(main)` : site public filles (accueil, `/inscription`, `/programmes/[slug]`, `/sport-etudes`, `/boutique`, `/compte`, `/location-terrains`).
  - `(prive)` : pages non répertoriées : `/prive/[slug]` (programmes garçons privés), `/prive/matchs` (vente de matchs à d'autres clubs), `/partenariat/[token]` (offre de partenariat).
  - `(contrat)` : pages blanches à lien personnel : `/contrat/[token]` (contrat d'embauche), `/offre/[token]` (offre spéciale).
  - `(admin)` : `/admin/*`. Menu et onglets décrits dans **`src/lib/admin-nav.ts`** (6 sections + Outils, un lien par hub, onglets en en-tête) ; l'admin s'ouvre sur `/admin/aujourdhui` (`src/lib/admin-today.ts`). Quatre espaces (sélecteur en haut du menu, champ `space` des sections) : **Académie** (le business, s'ouvre sur Aujourd'hui), **Coaching** (seulement le foot : `/admin/coaching`, pratiques, exercices, progression des joueuses `/admin/coaching/joueuses`, suivi des éducateurs ; aucun montant, `src/lib/coaching-repo.ts`), **Contenu** (création de contenu : `/admin/contenu`, voir la carte des modules) et **JP** (admin seulement, `/admin/moi` : JP géré comme une ressource, rien d'autre que lui ; ne pas le mêler au Mandalart). Toute modification de l'admin suit le skill `admin-page`.
  - `(coach)` : `/entraineur/*` (portail entraîneurs). Aussi `(atlantic)` (`/programme/[slug]`, pages FC Atlantic). (`/qualification` retirée le 6 nov. 2026 : redirigée vers `/inscription/essai`.)
- **Supabase** : côté serveur, toujours `getSupabaseAdminClient()` (`src/lib/supabase-admin.ts`, service role ; pas de types
  générés, d'où les `as any`). Accès direct à la base pour vérifier ou corriger : node + `pg` + `SUPABASE_DB_URL` de `.env.local`.
- **Stripe** : `getStripeClient()` (`src/lib/stripe.ts`) utilise `STRIPE_SECRET_KEY`. En local c'est une clé **test** ;
  en production (Vercel) c'est la clé live. Pour toute opération réelle depuis cette machine (liens de paiement envoyés
  à des familles, remboursements, solde, versements), utiliser `STRIPE_LIVE_SYNC_KEY` (clé restreinte live). Voir le skill `paiement`.
- **Courriels** : toujours `getResendClient().emails.send({...})` (`src/lib/resend.ts`). Malgré le nom, l'envoi passe par
  Gmail SMTP **info@newvalkyria.com** (réglage dans `email_settings`, `src/lib/mail-config.ts`), sinon Resend.
  La signature d'Annie Tremblay (responsable administratif) est **ajoutée automatiquement** : ne jamais en écrire une.
  `headers: { "In-Reply-To": msgid, References: msgid }` + sujet `Re: …` pour répondre dans le fil d'un courriel reçu.
  Gabarits des courriels automatiques (confirmations, avis à JP) : `src/lib/email.ts`.

## Carte des modules

| Domaine | Code | Tables principales | Admin |
|---|---|---|---|
| Saison filles (TV, SV, NV, TVA, SVA, TVD = Demi-saison) | `season-2027.ts` (programmes, prix, plages : **statiques**), `season-2027-db-map.ts` (`SEASON_DB_ID`, `SLOT_DB_ID`), `season-admin-repo.ts`, `payment-plan.ts` | `seasons`, `programs`, `birth_categories`, `time_slot_templates` (`max_places`), `registrations`, `registration_payment_plans` | `/admin/saison/[seasonId]`, `/admin/inscriptions`, `/admin/capacite` |
| Programmes à dates fixes + garçons privés | `session-programs-repo.ts`, `private-programs.ts` (prix pur), `private-programs-repo.ts`, `-admin.ts`, `-lifecycle.ts`, `private-program-view.ts` | `session_programs` (`is_private`, `published`, `program_kind`), `session_program_dates`, `session_program_registrations`, `session_program_payment_plans` | `/admin/garcons-prives`, `/admin/programme`, `/admin/programme-intensif`, `/admin/inscriptions-garcons` |
| Sport-Études | `sport-etudes-repo.ts` | `sport_etudes_*` | `/admin/sport-etudes` |
| Essais garçons | `boys-trials-repo.ts`, `boys-registrations.ts` (vue unifiée garçons) | `boys_trials` | `/admin/essais`, `/admin/inscriptions-garcons` |
| Offres spéciales (lien personnel avec expiration, bonus produit) | `special-offers.ts`, page `/offre/[token]`, route `api/offre/[token]` | `special_offers` (`registrations` jsonb, `expires_at`, `bonus`, `bonus_product_id`) | (via skill `relance`) |
| Relances et suivi | `outreach.ts` (`logOutreach`, `getOutreachSummary`) | `outreach_log` (kind : relance, reponse, excuse, erreur, refus, plus-tard) | `/admin/relances` |
| Contrats d'embauche | `employee-contracts.ts`, page `/contrat/[token]` | `employee_contracts` (+ stockage privé) | `/admin/contrats` |
| Vente de matchs (plages) | `match-slots-core.ts` (règles pures), `match-slots-repo.ts` | `match_slots`, `match_slot_bookings`, `match_team_profiles`, `match_slot_requests` | `/admin/plages`, `/admin/matchs` |
| Commandites 2027 / partenariats | `sponsorship-2027.ts`, `partnership-offers.ts`, `sponsors-repo.ts` | `sponsor_slots_2027`, `sponsors`, `sponsor_payments`, `partnership_offers`, `partnership_offer_options` | `/admin/sponsors-2027`, `/admin/commandites` |
| Mandalart (plan 1,5 M$ 2028) | `mandalart-plan.ts`, `mandalart-core.ts` (calculs purs), `mandalart-repo.ts`, `mandalart-kpis.ts`, `mandalart-modules.ts`, `mandalart-pedagogy.ts`, `marketing-stats.ts`, `club.ts` | `mandalart_tasks_state`, `mandalart_tasks_custom`, `mandalart_events`, `mandalart_kpi_values`, `mandalart_snapshots`, `mandalart_agent_state`, `marketing_channel_stats` | `/admin/mandalart` |
| Arbitres et bilan des matchs | `referees-repo.ts` (postes, réservation, paie → dépense « à payer », `matchFinance`), pages `/arbitres/[token]`, `/arbitres/inscription` | `referees`, `referee_assignments`, colonnes de coûts sur `match_slots` | `/admin/arbitres` |
| Pratiques préparées d'avance | `practices-repo.ts` (horaire réel + activités, vert/jaune/rouge), cron `api/cron/pratiques` (2 fois par jour) | `coach_activities.organization` (pratiques de JP hors Académie) | `/admin/pratiques` |
| Banque d'exercices Valkyria (fiche, note sur 10, statut calculé) | `exercise-bank.ts` (règles pures : liste de vérification, approbation 2 éducateurs ≥ 8 + JP, « à changer », pas la même semaine, recherche), `exercises-repo.ts` (`getBank`, `getExercisesForPlanning`, `assertExerciseUsable`), note dans le portail `coach-exercise-ratings.tsx` | `exercises` (+ `version`, `validated_version`), `exercise_ratings` | `/admin/exercices`, `/admin/exercices/[id]` |
| Portail des éducateurs (pratique du jour, évaluation rapide, routine de fin, présence et paie) | `coach-report.ts` (règles pures : note ≥ 30 car., copier-coller refusé, rapport complet, heures retenues), `coach-portal-repo.ts` (effectif de la plage, accès limités, rapports en lot), `coach-payroll-data.ts`, cron `api/cron/presences-educateurs` (relance à 24 h) | `activity_session_blocks` (champs pratique du jour), `player_evaluations` (`ratings` : Ball mastery, Prestation, Attitude), `activity_player_attendance` (`practice_rating`, `fatigue`), `coach_assignments` (`confirmed_by`, `reminder_sent_at`) | `/entraineur`, `/admin/entraineurs/paie`, `/admin/entraineurs/activites/[id]` |
| MonClubSportif : robot A12 (dès le paiement : équipes, invitation, calendrier, photo ; adversaires ; présences modifiables en tout temps ; rappels 48 h / 24 h / jour même ; horaire du site recopié dans MCS `syncCalendar` ; présences MCS → site chaque soir `syncMcsAttendance`) | `mcs-site-map.ts` (balises du site MCS), `mcs-rules.ts` + `mcs-rules-repo.ts` (règles par club, `app_settings` « mcs_rules »), `mcs-robot.ts` (session et formulaires), `mcs-robot-runner.ts` (`runMcsRobot`, `sendPresenceReminders`), déclenché par le webhook Stripe (`after`) et le cron horaire `api/cron/mcs-robot` ; mode assistant tant que JP n'a pas activé ; `mcs-sync.ts` (liste à importer, photos) | `mcs_teams` (`mcs_team_id`, `kind`, `slot_ids`, `program_ids`, `session_program_slugs`), `mcs_events`, `mcs_sync_items` | `/admin/monclubsportif/robot` (règles, essai, journal, courriels programmés), `/admin/monclubsportif/equipes`, `/admin/monclubsportif` |
| Espace JP (Ma journée, tâches confiées, calendrier Google, habitudes, nutrition, connaissances) | `team-tasks-core.ts` + `team-tasks-repo.ts` (tâches de JP et tâches confiées : courriel + lien `/tache/[token]`, rappel la veille puis aux 2 jours dans le cron horaire `mcs-robot`, case du Mandalart cochée quand c'est fait ; bouton « Confier » du Mandalart `delegate-form.tsx`), `jp-core.ts` + `jp-repo.ts` (habitudes, nutrition, connaissances, calendrier lu par l'adresse iCal secrète `app_settings` « jp_calendar_ical » + pratiques de JP) | `team_tasks`, `jp_habits`, `jp_habit_logs`, `jp_meals`, `jp_knowledge`, `mandalart_tasks_state.owner` | `/admin/moi`, `/admin/moi/plan` (Mon plan : le Mandalart en mots simples, « comment faire » de chaque tâche dans `mandalart-steps.ts`, à compléter pour toute nouvelle tâche), `/admin/moi/tournages` (Mes tournages : la vidéo du lendemain planifiée la veille, idée → planifié → tourné → monté → publié, `video-shoots-core.ts`, `video-shoots-repo.ts`, table `jp_video_shoots`), « À développer en 2027 » (chantiers de l'année reliés aux tâches du Mandalart, `vision-2027.ts` : dans Mon plan pour JP, dans Aujourd'hui pour la gérante), `/admin/moi/confiees`, `/admin/moi/calendrier`, `/admin/moi/habitudes`, `/admin/moi/nutrition`, `/admin/moi/connaissances` |
| Matchs et pratiques filmés (caméra Veo ; le site garde le lien du fichier 1080p, l'aperçu, les périodes et les temps forts, et **télécharge chaque vidéo** dans le stockage privé `match-videos` (`video-archive.ts`, envoi reprenable par morceaux de 6 Mo dans le cron horaire) : lue chez Veo tant que Veo la garde (≈ 1 an), puis notre copie ; robot Veo toutes les heures ou lien collé dans l'admin : seuls les titres « Newval… », classés par le jour, l'heure et le titre, sinon « à classer » ; match → espace client des familles de l'équipe et des joueuses présentes ; pratique → éducateurs assignés, page de l'activité ; lecteur `match-player.tsx` : périodes, temps forts filtrables, frise, reprise) | `match-videos-core.ts` (règles pures), `match-videos.ts`, `video-archive.ts`, `veo-robot.ts` (`syncVeo`, `importVeoLinks`), `veo-config.ts` (compte Veo chiffré) ; comptes parents : courriel confirmé (`parent_email_checks`, `getVerifiedParentEmail`) | `match_videos`, `match_video_views`, `parent_email_checks` | `/admin/matchs/videos`, famille `/compte/matchs`, éducateurs `/entraineur/activites/[id]` |
| Création de contenu (espace Contenu : quotas de la personne caméra, calendrier de publication organique / reel d'essai / pub avec angle, tournages, ball mastery filmé à 360° à chaque pratique en gymnase, photos des joueuses à chaque match, garçons jamais filmés ; projet entrevues avant/après : journées, invitations aux familles avec lien `/entrevue/[token]` pour choisir l'heure, guide de questions ; portée des réseaux, branchement Instagram/Facebook/YouTube à venir) | `content-core.ts` (règles pures), `content-repo.ts`, `content-admin.tsx`, `content-format.ts` ; tournages partagés avec l'espace JP (`jp-shoots.tsx`, `video-shoots-schema.ts`, `endpoint`) ; route `api/admin/contenu` (admin et gérante), `api/entrevue/[token]` | `jp_video_shoots` (+ `publish_on`, `post_kind`, `angle`, `networks`, `filmed_by`), `content_captures` (`ball_mastery_360`, `photos_match`), `content_interview_slots`, `content_interviews` ; lit `marketing_posts`, `match_videos` | `/admin/contenu`, `/admin/contenu/calendrier`, `/admin/contenu/tournages`, `/admin/contenu/captation`, `/admin/contenu/entrevues`, `/admin/reseaux` (déplacé dans l'espace Contenu) |
| Sondages (Voix des familles) | `surveys-repo.ts`, page `/sondage/[token]` | `surveys`, `survey_invites`, `survey_responses` | `/admin/sondages` |
| D'où viennent nos familles (question « Comment nous avez-vous connus ? » + entreprise du parent, obligatoire dans tous les formulaires, jamais bloquante côté serveur) | `acquisition-core.ts` (règles pures), `acquisition.ts` (`acquisitionField`, `saveAcquisition`), `acquisition-fields.tsx` | colonnes `acquisition_source`, `acquisition_detail`, `has_business`, `business_name` sur `registrations`, `session_program_registrations`, `sport_etudes_registrations`, `boys_trials` | `/admin/acquisition` |
| Réseaux sociaux (publications, organique ou payant, conversions) | `marketing-posts-core.ts`, `marketing-posts.ts` | `marketing_posts`, `marketing_channel_stats` | `/admin/reseaux` |
| Nos matchs (score, résumé, vidéo privée, analyse, statistiques des joueuses ; leçons d'après-match → thème de la semaine suivante, bloc dans `match-panel.tsx`) | `match-results-core.ts`, `match-results.ts`, `match-results-admin.tsx` (`MatchLessonsLive`) | `match_details` (+ `summary`, `analysis`, `video_path`), `match_slot_results`, stockage privé `match-videos` | `/admin/matchs/resultats`, `/admin/matchs/resultats/joueuses` |
| Structure et recrutement (personnel, diplômes et certifications, besoins, candidats) | `structure-core.ts`, `structure-repo.ts` | `staff_members`, `recruitment_needs`, `recruitment_candidates` | `/admin/structure` |
| Calculateur de lancement (seuil de survie d'un nouveau programme, alerte à 14 jours) | `launch-calculator.ts` (pur), `launch-scenarios-repo.ts` | `launch_scenarios` | `/admin/revenus/calculateur` |
| Valkyria Lab (routine du mois, lien personnel par famille, vidéos des joueuses en stockage privé) | `valkyria-lab.ts`, page `/lab/[token]`, route `api/lab/[token]` | `lab_routines`, `lab_access`, `lab_submissions`, stockage privé `valkyria-lab` | `/admin/valkyria-lab` |
| Inventaire du matériel et échéances des contrats | `inventory-repo.ts`, `contracts-registry.ts` | `inventory_items`, `contract_registry` | `/admin/inventaire`, `/admin/registre-contrats` |
| Courriels programmés (« préviens-les demain 8 h ») | `scheduled-emails.ts` (`scheduleEmails`, `sendDueEmails` dans le cron horaire `api/cron/mcs-robot`) | `scheduled_emails` | `/admin/monclubsportif/robot` (annuler un envoi) |
| Calendrier de paie des éducateurs (aux 2 semaines) | `pay-periods.ts` | — | `/admin/entraineurs/paie` |
| Historique et marges | `academy-history.ts` (récit à la main, chiffres recalculés) | `venue_rentals` (contrats de gymnases/terrains) | `/admin/historique` |
| Boutique / uniformes | `shop-repo.ts`, `uniform-kits-repo.ts` | `products`, `shop_orders`, `registration_uniform_kits` | `/admin/boutique`, `/admin/uniformes` |
| Location de terrains | `terrain-rentals-core.ts`, `terrain-rentals-repo.ts` | `terrains`, `terrain_rentals` | `/admin/location-terrains` |
| Revenus, paie entraîneurs, audit | `revenue-repo.ts`, `coach-payroll.ts`, `audit-repo.ts` (`logAudit`) | `revenue_*`, `coach_*`, `audit_log` | `/admin/revenus`, `/admin/entraineurs`, `/admin/audit` |

### Types de paiement Stripe (`metadata.checkoutType`)

Tout paiement passe par `src/app/api/stripe/webhook/route.ts`, qui aiguille selon `metadata.checkoutType` :
`season-registration` (saison filles, aussi liens directs admin `isDirectLink`), `trial-conversion` (essai → inscription,
`registrationId` + `programId`/`timeSlotTemplateId` facultatifs), `special-offer` (`offerToken`), `season-completion`
(demi-saison → saison complète, `registrationId`), `installment-retry` (versement échoué), `sportetudes`, `sessionprogram`
(programmes à dates fixes et privés), `match-slot`, `terrain-rental`, `shop-order`, `sponsorship`, `partnership-offer`.
Un nouveau type de paiement = un nouveau `checkoutType` traité dans ce webhook, jamais un deuxième webhook.
Le webhook gère aussi `checkout.session.expired` (libère les réservations) et `charge.refunded` (programmes privés seulement).

## Conventions

- **Migrations** : `supabase/migrations/AAAAMMJJ_nom.sql` (date du jour, `if not exists`, RLS + politique `service_role`
  comme les autres). Les exécuter soi-même avec node + `pg` + `SUPABASE_DB_URL` (`ssl: { rejectUnauthorized: false }`).
- **Lire `.env.local`** dans un script : `for (const l of fs.readFileSync(".env.local","utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }`. Ne jamais afficher une clé.
- **Envois et opérations ponctuels** (courriels, création d'offres) : test vitest temporaire `src/lib/tmp-*.test.ts`
  (`// @vitest-environment node`, charge `.env.local` dans `process.env`, `await import("@/lib/…")`), lancé avec
  `npx vitest run src/lib/tmp-x.test.ts`, puis **supprimé** (`rm`) dans la même commande. Jamais commité.
- **Commits** : `git -c user.name="Jean-paul Aka" -c user.email="jean-paulaka@mac.home" commit …` (aucune identité git configurée).
  Messages en français, une phrase qui décrit le résultat pour JP.
- **Déploiement** = push sur `main` (Vercel déploie). `git push` ordinaire échoue : utiliser le `GITHUB_TOKEN` de `.env.local`,
  sans jamais l'afficher et **sans jamais demander à JP de se connecter à GitHub** :
  `T=$(grep '^GITHUB_TOKEN=' .env.local | cut -d= -f2- | tr -d '"'); git push "https://$T@github.com/FabriceAkaB/newvalkyria.git" main 2>&1 | sed "s/$T/***/g" | tail -3`
  (réseau : Bash sans sandbox).
- **Serveur de dev** : `nohup node node_modules/next/dist/bin/next dev > /tmp/nv-dev.log 2>&1 &` (le preview intégré casse Turbopack).
  Si une route répond succès sans effet en base après une édition de `src/lib`, redémarrer le serveur (cache HMR obsolète).
- **Tâches automatiques (cron)** : une seule liste, `src/lib/cron-jobs.ts` (doit égaler `vercel.json`, testé). Chaque route
  `api/cron/*` commence par `cronGate(request, "<nom>")` (`cron-gate.ts`) : trace dans `cron_runs`, secours Supabase
  (pg_cron + pg_net, 20 min après Vercel, ne refait rien si Vercel a roulé ; migration `20261135_cron_secours.sql` à
  regénérer pour une nouvelle tâche), alerte dans Aujourd'hui si une tâche n'a pas roulé. Une automatisation n'est « faite »
  qu'après une vraie trace en production.
- Liens dans les courriels : toujours `https://www.newvalkyria.com/…` (`env.publicSiteUrl`), jamais localhost.

## Règles métier

- **Avant toute relance ou offre** à une famille « non inscrite » : vérifier la joueuse par **NOM** (accents, majuscules,
  espaces ignorés ; prénoms composés) **et** par **courriel parent** dans toutes les inscriptions payées : `registrations`,
  `session_program_registrations`, `sport_etudes_registrations`, `special_offers` payées. L'autre parent a pu l'inscrire
  avec un autre courriel. Montrer la liste finale des destinataires à JP **avant** un envoi de masse. Skill `relance`.
- **Noter chaque relance, offre, réponse ou excuse** envoyée à une famille dans `outreach_log` (`logOutreach`), une ligne par joueuse.
- **Christine Durand** (gérante, `Christinedurand.2@hotmail.com`) en copie (`cc`) des courriels aux partenaires
  et des annonces aux familles. Skill `courriel-familles`.
- Jamais de surréservation : une offre ou un lien de paiement vers un groupe complet est bloqué (`fullGroupsForOffer`, `time_slot_templates.max_places`).
- Un nouveau programme ou une nouvelle saison se crée d'abord **en base et par l'admin**, pas en codant une nouvelle page. Skill `nouveau-programme`.
- Argent réel (remboursement, lien live, prélèvement) : dire à JP exactement ce qui sera fait (qui, combien) avant de le faire. Skill `paiement`.

## Mandalart (objectif 1,5 M$ sur l'année civile 2028)

- **Vision long terme** (au-delà de 2028) : `docs/CAHIER_DES_CHARGES.md`, le cahier des charges de JP (18 modules, océan bleu, seconde entreprise, centre sportif) avec la carte de ce qui existe déjà pour chaque module. Le lire avant de construire un de ces modules ; il ne remplace pas le Mandalart.
- Plan : `data/mandalart.json` (ne pas modifier sans JP), généré depuis `docs/MANDALART_VALKYRIA.md` par `node scripts/mandalart-build.mjs`. Les ajouts de JP vont dans la section 11 du .md.
- Module : `/admin/mandalart` (section « Plan 1,5 M$ » du menu). L'état des tâches vit dans Supabase (`mandalart_tasks_state`), clé = `club_id` + code de tâche ; réimporter le JSON ne change jamais un statut existant.
- Une tâche pas faite à sa date est reportée au lendemain chaque matin, la suite de son objectif réorganisée ; les tâches à date fixe (`fixed`) ne bougent jamais (`mandalart-reschedule.ts`, cron `api/cron/mandalart-report`).
- Chaque pilier a ses sections (`src/lib/mandalart-modules.ts`) : toute nouvelle section d'un pilier s'y branche.
- Voix des familles (sondages) : `/admin/sondages`, `surveys-repo.ts`, page famille `/sondage/[token]`.
- Agents et automatisations : section 5 du dossier + `/admin/mandalart/agents` ; on construit dans l'ordre des niveaux, un agent à la fois, en mode assistant d'abord.
- **Cahier de charges des agents** : `src/lib/agents-blueprint.ts` (chaque mission de l'académie dans la case d'un agent, ce qui existe / ce qui manque, tables lues, écrites, interdites, fonctions permises, clés ; `agentCan()` = garde d'accès). Toute nouvelle tâche répétitive s'y range ; le test vérifie que tables et fonctions existent.
- Loi 25 : aucune donnée d'enfant dans les tables `mandalart_*` ; vidéos d'enfants en stockage privé seulement.
- « Ce mois-ci » se joue (`mandalart-game.ts` : quête du jour, XP, série, carte des mondes) et s'ajuste (`mandalart-levers.ts` : écart au plan, trésorerie jusqu'en avril, argent à rattraper, leviers chiffrés).
- Analyse de la concurrence : `docs/concurrence/` (une fiche datée par concurrent, dont Footie Elite), tenue par l'agent A07. Identité visuelle : agent A13 (charte graphique, P3.2.10). Bases d'Alex Hormozi : $100M Offers et $100M Leads pour le marketing (A05), $100M Money Models pour les finances (A04).
- Duplicable pour un autre club : tout est rangé par `club_id` (`src/lib/club.ts`). Skill `mandalart`.

## Skills du projet (`.claude/skills/`)

`travail-efficace` (à lire avant de coder : recettes base, tests, session admin de test, push ; scripts `q.cjs`, `mig.cjs`, `inbox.py`) · `mandalart` · `coaching` · `pratique-diapos` (pratiques en diapos sur claude.ai, planification PSG) · `monclubsportif` · `boite-courriels` · `relance` · `courriel-familles` · `nouveau-programme` · `paiement` · `admin-page` · `finances` · `fin-de-mois` · `automatisation` · `rapport` · `mise-en-ligne` · `design-interface`

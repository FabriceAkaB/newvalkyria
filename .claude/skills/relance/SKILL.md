---
name: relance
description: Relancer des familles qui ne se sont pas (ré)inscrites, avec ou sans offre spéciale à expiration (/offre/[token]), et tenir le journal outreach_log. À utiliser dès que JP parle de relancer, de faire une offre, un 2 pour 1, un rabais, un sac offert, de « libérer la place » ou de répondre à une famille qui hésite.
---

# Relance de familles (+ offre spéciale)

Toujours dans cet ordre. Ne jamais sauter l'étape 2 ni l'étape 3 : en octobre 2026, des familles déjà inscrites
ont reçu une offre par erreur parce que l'autre parent avait inscrit la joueuse avec un autre courriel.

## 1. Construire la liste visée

Interroger la base (node + `pg` + `SUPABASE_DB_URL`, voir CLAUDE.md). Sources habituelles :
- `registrations` de la saison active (`seasons.is_active`) en `status = 'pending'` (formulaire rempli, pas payé), ou essais (`is_trial = true`) ;
- inscrites d'une saison précédente (`season_id = 'ete-2026'`, etc.) absentes de la saison active ;
- `session_program_registrations` / `sport_etudes_registrations` non payées pour les programmes garçons.

Pour chaque joueuse : prénom + nom, courriel et nom du parent, `registrations.id`, programme, groupe (`time_slot_template_id`).

## 2. Vérifier chaque joueuse (NOM et COURRIEL)

```bash
node .claude/skills/relance/verifier-joueuses.mjs /chemin/scratchpad/liste.json
```
`liste.json` = `[{ "player": "Prénom Nom", "parentEmail": "..." }]`. Le script cherche dans toutes les inscriptions payées
(`registrations`, `session_program_registrations`, `sport_etudes_registrations`, `special_offers` payées) :
- **MÊME NOM** (2 mots en commun, accents/majuscules ignorés) : presque sûrement déjà inscrite → retirer de la liste ;
- **MÊME COURRIEL** : la même enfant sous un autre prénom, ou une sœur → vérifier à la main ;
- **même nom de famille** : sœur possible → regarder.

Vérifier aussi `outreach_log` : combien de relances cette famille a déjà reçues, et si elle a répondu `refus` ou `plus-tard`
(ne pas relancer une famille qui a refusé, sauf demande de JP). La page `/admin/relances` montre le même suivi.

## 3. Montrer la liste à JP avant l'envoi

Tableau : joueuse, parent, courriel, programme/groupe, montant de l'offre, relances déjà faites, résultat de la vérification.
Attendre son accord explicite avant un envoi à plusieurs familles. Pour une réponse à une seule famille que JP a déjà dictée, pas besoin.

## 4. (Si offre) Créer l'offre spéciale

L'offre est une ligne `special_offers` ; la page `/offre/[token]` l'affiche, `api/offre/[token]` ouvre le paiement Stripe
(`checkoutType: "special-offer"`), refuse si l'offre est expirée, déjà payée ou si le groupe est complet. Le webhook passe
chaque inscription listée à `paid` dans son groupe, crée la commande du bonus et envoie la confirmation. Rien à coder.

- **Ne marche que pour la saison filles** (table `registrations`). Chaque joueuse doit avoir une ligne `registrations`
  (existante en `pending`, ou en créer une `pending` avec `season_id`, `program_id`, `category_id`, `time_slot_template_id`, infos parent/joueuse).
- `token` : `crypto.randomBytes(12).toString("base64url")`.
- `registrations` (jsonb) : `[{ registrationId, playerName, programId, timeSlotTemplateId, groupLabel }]`,
  `groupLabel` lisible, ex. `Team Valkyria (TV) · groupe 2016 · mercredi, 18 h 00 à 19 h 25 · Sainte-Thérèse`.
- `amount_cents` = montant total facturé tel quel (référence : `programs.price_cents`). `regular_amount_cents` = prix normal (barré sur la page).
- `expires_at` en heure de Montréal, ex. `'2026-11-01T23:59:00-05:00'` (`-04:00` l'été). Une offre précédente encore ouverte
  pour la même joueuse : la fermer (`update special_offers set expires_at = now() where token = …`).
- Bonus facultatif : `bonus` (texte affiché) + `bonus_product_id` (`products.id`, ex. sac à dos), remis gratuitement au paiement.
- Vérifier qu'il reste de la place : `time_slot_templates.max_places` vs inscriptions payées du groupe. Si JP ouvre une place, augmenter `max_places`.
- Ouvrir `https://www.newvalkyria.com/offre/<token>` après création pour vérifier l'affichage (montant, groupe, date limite).

## 5. Envoyer les courriels

Suivre le skill `courriel-familles` : un courriel par famille, test `src/lib/tmp-*.test.ts`, pause d'environ 1,5 s entre deux envois.
Contenu type d'une relance avec offre : rappel de ce que comprend le programme, l'offre (montant, groupe, jour, heure, lieu),
le bonus, la **date limite** (`⏳ Cette offre est valide jusqu'au dimanche 1er novembre à 23 h 59`), le bouton vers
`/offre/<token>` + le lien en clair, et une porte de sortie (« si ce n'est pas le bon moment, vous n'avez rien à faire »).
Si la famille a écrit, répondre dans son fil (`In-Reply-To` / `References` = son `Message-ID`, sujet `Re: …`).

## 6. Noter dans le journal (obligatoire)

Juste après chaque envoi réussi, dans le même test :
```ts
const { logOutreach } = await import("@/lib/outreach");
await logOutreach({ parentEmail, parentName, playerName, registrationId, campaign: "Offre sac à dos (nov. 2026)", subject, offerToken, kind: "relance" });
```
Une ligne **par joueuse**. `kind` : `relance` (premier contact ou rappel), `reponse` (réponse à un courriel de la famille),
`excuse` (relancée par erreur), `erreur`, `refus` (« libérez la place »), `plus-tard` (intéressée plus tard).
Une réponse reçue par JP (refus, plus tard) se note aussi, avec `notes` = ce que la famille a dit.
Si la famille libère sa place : passer son inscription `pending` à `cancelled` et désactiver son lien de paiement Stripe s'il en existe un (skill `paiement`).

## 7. Faire le bilan à JP

Nombre d'envois réussis / échecs, liens d'offre créés avec leur date limite, et rappel : le suivi est dans `/admin/relances`.

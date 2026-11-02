---
name: nouveau-programme
description: Créer ou préparer un nouveau programme (garçons, semi-privé, intensif, programme à dates fixes) ou une nouvelle saison filles en réutilisant la base et l'admin existants, sans coder une nouvelle page. À utiliser dès que JP parle d'un nouveau programme, d'un nouveau groupe, d'une nouvelle saison, d'un camp, d'un intensif, d'ouvrir des inscriptions ou de changer un prix, une capacité ou des dates.
---

# Nouveau programme ou nouvelle saison

Principe : **un programme = des lignes en base**. Les pages publiques, le paiement Stripe, le webhook, les courriels
et l'admin existent déjà et lisent la base. Avant d'écrire du code, trouver dans quelle famille tombe la demande.

## A. Programme à dates fixes (garçons, semi-privé, intensif) : aucun code

Table `session_programs` (une ligne par programme, clé `slug`) + `session_program_dates` (les séances).
Paiement `checkoutType: "sessionprogram"`, inscriptions dans `session_program_registrations`, plans de versements
dans `session_program_payment_plans`. Page publique **`/prive/<slug>`** (générée par `src/app/(prive)/prive/[slug]`),
visible seulement si `active` et `published` (l'admin la voit en brouillon).

1. **Créer** : `/admin/garcons-prives` → « + Nouveau programme juvénile semi-privé (gabarit) »
   (route `POST /api/admin/prives/programmes`). Il est créé en **brouillon** (`active = false`, `published = false`,
   `is_private = true`, `program_kind = 'semi_prive_juvenile'`, capacité max 6). Pour un programme plus gros (ex. intensif
   de 14 joueurs), créer la ligne de la même façon puis ajuster `max_capacity` dans l'admin ou en SQL.
2. **Régler** dans `/admin/garcons-prives` (route `PATCH /api/admin/prives`) : prix (`price_cents`), forfait samedi
   (`saturday_package_price_cents`), capacité min/max, supplément 2 versements (`installment_fee_cents`), date du
   2e versement, rabais de référencement, coûts (marges), et `presentation` (jsonb : `intro`, `objectives[]`,
   `advantages[]`, `location`, `coaches[]` ; options `brand: "atlantic"`, `waitlistOnly`, `trialOnly`).
3. **Dates** : ajouter les séances (`POST /api/admin/prives/dates`, ou section dates de l'admin).
4. **Années admissibles** : `eligible_birth_years` (liste) ; `gender` : `filles` / `garcons` / `mixte`.
5. **Essais gratuits** : `trial_capacity` (places par essai) ; les essais se réservent sur les séances à venir du
   programme (`session_program_dates`) et vont dans `boys_trials` (`boys-trials-repo.ts`), suivis dans
   `/admin/garcons-prives` et `/admin/inscriptions-garcons`. Page essai seulement : `presentation.trialOnly = true`.
6. **Vérifier** la page `/prive/<slug>` (prix, dates, places, versements) avant de publier, puis **publier**
   (`active` + `published`) seulement quand JP le confirme.
7. Suivi : `/admin/inscriptions-garcons` (toutes les inscriptions garçons) et `/admin/programme/<slug>`.
   Le menu admin a des liens fixes par programme dans `src/components/admin-topbar.tsx` : y ajouter une ligne
   si JP veut une section dédiée (une autre session réorganise ce menu : vérifier son état avant d'y toucher).

Programmes publics à dates fixes existants : `privilege-valkyria` (filles, `/programmes/privilege-valkyria`) et
`intensif-garcons` (`/programmes/intensif-garcons`). S'inspirer d'eux ; ne pas créer une troisième page du même genre.

## B. Saison filles (TV, SV, NV, TVA, SVA, TVD)

En base : `seasons` (une ligne par saison, `is_active`), `programs` (par saison : `price_cents`, `includes`, `active`),
`program_categories` (capacité par programme et catégorie), `time_slot_templates` (groupes : jour, heure, lieu,
`max_places`) + `time_slot_dates`, `registrations`. L'admin `/admin/saison/<seasonId>` gère horaire, capacités,
dates, groupes solo et inscriptions ; le prix facturé vient de `programs.price_cents`.

**Attention, point dur connu** : le tunnel public `/inscription` est encore lié en dur à une saison :
`SEASON_DB_ID = "automne-hiver-2026"` et la table `SLOT_DB_ID` dans `src/lib/season-2027-db-map.ts`, et les textes,
programmes et plages affichés viennent de `PROGRAMS` / `SLOTS` dans `src/lib/season-2027.ts`. Donc :
- **Changer un prix, une capacité, un groupe existant** : base / admin seulement.
- **Ajouter un groupe** : ligne `time_slot_templates` (admin Horaire) **et** son entrée dans `SLOTS` + `SLOT_DB_ID`, sinon il n'apparaît pas au public.
- **Nouvelle saison** : migration (`seasons`, `programs`, `program_categories`, `time_slot_templates` de la nouvelle saison),
  puis faire évoluer ces deux fichiers pour la nouvelle saison. Proposer à JP de profiter de ce moment pour lire la saison
  active depuis la base au lieu de la constante, plutôt que de copier `season-2027.ts` en `season-2028.ts`.

## C. Autres cas déjà couverts (ne rien recréer)

- Sport-Études : `sport-etudes-repo.ts`, `/admin/sport-etudes` (sessions, capacité, plans de 2 versements).
- Offre ponctuelle sans section du site : produit + lien Stripe (`POST /api/admin/stripe/produit`, skill `paiement`).
- Offre personnelle à une famille : `special_offers` (skill `relance`).
- Vente de matchs : `/admin/plages`. Location de terrains : `/admin/location-terrains`. Commandites : `/admin/sponsors-2027`.

## Règles

- Migration seulement si une colonne manque vraiment : `supabase/migrations/AAAAMMJJ_nom.sql`, exécutée avec `pg`.
- Ne jamais publier ni ouvrir les inscriptions sans le « go » de JP ; montrer d'abord la page en brouillon.
- Après création : ajouter le programme à l'historique si utile (`academy-history.ts` recalcule les chiffres tout seul).

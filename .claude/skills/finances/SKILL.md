---
name: finances
description: Comprendre, calculer et présenter les chiffres de New Valkyria (revenus encaissés par saison et par mois, dépenses, marges, coût par heure de terrain, trésorerie Stripe, versements à venir, remboursements) et les rapprocher avec Stripe. À utiliser dès que JP demande ses chiffres, sa marge, combien il a fait, ce qui reste à encaisser ou à payer, l'espace Revenus/Comptabilité, ou une analyse financière.
---

# Finances de New Valkyria

## D'où viennent les chiffres
- **Revenus encaissés** : `computeRevenueSummary()` (`src/lib/revenue-calc.ts`) — par saison (`ete-2026`, `automne-hiver-2026`,
  `sport-etudes`, `boutique`, `general`) et par mois. Sources : inscriptions payées, versements, boutique, Sport-Études, programmes
  à dates fixes, plus les revenus saisis à la main (`revenue_income` : commandites, séances privées…). Ne jamais saisir à la main un
  revenu déjà suivi automatiquement (double comptage).
- **Dépenses** : `revenue_expenses` (catégories : Location / Terrain, Équipement, Salaires / Contractants, Marketing / Pub, Assurance,
  Frais Stripe / Bancaires, Autre ; `status` paid/due + `due_date`). La paie des entraîneurs vient du module Paie (`coach-payroll.ts`).
- **Tableau de bord** : `computeFinancialDashboard()` (encaisse, revenus du jour/semaine/mois/saison, à payer, santé, alertes) ;
  `getUpcomingMovements()` (entrées et sorties à venir) ; `getBudgetVsActual()`.
- **Marges par saison** : `buildAcademySnapshot().margins` (`src/lib/academy-history.ts`) = revenus − terrains (`venue_rentals`)
  − entraîneurs (heures de terrain × `COACHES_PER_HOUR` (2) × `COACH_RATE_CENTS` (40 $)) − autres dépenses.
- **Repères au 24 oct. 2026** : 106 986 $ encaissés depuis avril ; marge ≈ 44 % l'été, ≈ 27 % l'automne ; une heure de terrain coûte
  ≈ 134 $ (location + 2 entraîneurs) ; Terrebonne ≈ 214 $/h contre 35 $/h dans les écoles. Objectif à long terme : 1 M$.

## Rapprochement avec Stripe (clé `STRIPE_LIVE_SYNC_KEY`, voir skill `paiement`)
- Solde : `stripe.balance.retrieve()` (disponible / en attente). Un solde négatif bloque les remboursements (déjà arrivé en oct. 2026).
- Virements vers BMO : `stripe.payouts.list()` ; frais : `stripe.balanceTransactions.list({ type: "charge" })` (`fee`).
- Comparer le total des paiements Stripe d'une période avec les revenus du site de la même période ; expliquer tout écart
  (frais, remboursements, paiements hors site, saisies manuelles). Ne jamais « corriger » un écart sans le montrer à JP.

## Présenter les chiffres à JP
- Toujours en premier : **encaissé**, **reste à encaisser**, **reste à payer**, **marge** — en dollars arrondis, avec la période.
- Une phrase d'interprétation (« la marge baisse parce que… ») et une action concrète.
- Graphiques : skill `dataviz` (barres par mois, progression vers l'objectif). Export comptable : skill `xlsx` / `getRevenueExportRows()`.
- Les taxes : l'entreprise n'est pas encore inscrite TPS/TVQ (`revenue_settings.revenue_tax_rate` = 0) ; le dire si ça change un chiffre.
- Pages admin : hub « Revenus & paiements » (admin seulement). Respecter le skill `admin-page` pour tout ajout.

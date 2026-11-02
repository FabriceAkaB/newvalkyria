---
name: fin-de-mois
description: Bilan financier mensuel de New Valkyria et préparation pour le comptable (Pontbriand Lamarche CPA) : revenus et dépenses du mois, rapprochement avec Stripe et la banque, ce qui reste à encaisser et à payer, export Excel. À utiliser quand JP demande le bilan du mois, la fermeture du mois, quoi envoyer au comptable, ou chaque début de mois.
---

# Fin de mois

1. **Période** : du 1er au dernier jour du mois (heure de l'Est).
2. **Revenus du mois** : `computeRevenueSummary().months` (mois `AAAA-MM`), détail par saison et par source.
3. **Stripe** (skill `paiement`, clé live) : total des paiements, frais, remboursements et virements vers BMO du mois ;
   comparer avec les revenus du site et lister les écarts avec leur explication.
4. **Dépenses du mois** : `revenue_expenses` (payées dans le mois) + paie des entraîneurs du mois (module Paie).
   Signaler les dépenses connues qui manquent (location, assurance, paie, uniformes) et les factures `due` du mois suivant.
5. **À encaisser** : versements prévus (`registration_payment_plan_installments`, `session_program_payment_plan_installments`,
   `sport_etudes_payment_plan_installments` non payés), offres spéciales ouvertes, soldes de matchs.
6. **À payer** : `revenue_expenses` `status = 'due'` et la paie à venir.
7. **Livrables pour JP** : un résumé en 5 lignes (encaissé, dépensé, marge, à encaisser, à payer) + les écarts Stripe ;
   pour le comptable : un classeur Excel (skill `xlsx`) avec revenus, dépenses, frais Stripe et remboursements du mois,
   à partir de `getRevenueExportRows()` filtré sur le mois.
8. Ne rien envoyer au comptable sans l'accord de JP. Ne rien modifier dans les données pour « faire concorder ».

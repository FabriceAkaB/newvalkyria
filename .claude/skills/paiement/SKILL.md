---
name: paiement
description: Opérations Stripe réelles pour New Valkyria : créer un lien de paiement pour une famille (essai converti, complément de saison, versement, produit ponctuel), désactiver un lien, rembourser, vérifier un paiement, consulter le solde Stripe et les versements bancaires. À utiliser dès que JP parle de lien de paiement, de payer, de rembourser, d'argent reçu, de solde, de dépôt ou de versement Stripe.
---

# Paiements Stripe

## Quelle clé ?

- `STRIPE_SECRET_KEY` de `.env.local` = **clé test** (`sk_test_`). `getStripeClient()` l'utilise en local : un lien créé
  avec elle **ne peut pas** être payé par une vraie carte et n'arrive jamais au webhook de production.
- `STRIPE_LIVE_SYNC_KEY` = **clé live restreinte** (`rk_live_`) : liens, sessions, remboursements, solde, versements.
  À utiliser pour tout ce qui touche de l'argent réel depuis cette machine. Ne jamais afficher une clé.
- En production (Vercel), `STRIPE_SECRET_KEY` est la clé live : les boutons de l'admin en ligne
  (www.newvalkyria.com/admin) créent donc de vrais liens.

Script node direct :
```js
const fs = require("fs"); const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const Stripe = require("stripe"); const s = new Stripe(env.STRIPE_LIVE_SYNC_KEY);
```
Pour réutiliser une fonction du site (ex. `buildOptionLinkParams`) dans un test `src/lib/tmp-*.test.ts` :
`process.env.STRIPE_SECRET_KEY = env.STRIPE_LIVE_SYNC_KEY` **avant** `await import("@/lib/stripe")`. Vérifier `livemode === true` dans le résultat.

**Toujours** dire à JP, avant une opération réelle : qui, quoi, combien. Après : le lien ou la référence Stripe.

## Créer un lien de paiement (Payment Link)

Le webhook (`src/app/api/stripe/webhook/route.ts`) agit selon `metadata.checkoutType` ; le lien est inutile sans la bonne métadonnée.

| Cas | Comment | `metadata` |
|---|---|---|
| Lien d'inscription saison sans formulaire | route `POST /api/admin/inscription/lien-direct` (aucun bouton dans l'admin actuel : appeler la route ou reproduire son code en script live) | `season-registration`, `registrationId`, `isDirectLink` |
| Essai → inscription payée | script live | `checkoutType: "trial-conversion"`, `registrationId`, (option) `programId`, `timeSlotTemplateId` |
| Demi-saison → saison complète | script live | `checkoutType: "season-completion"`, `registrationId` |
| Versement échelonné en échec | admin Revenus → Paiements échelonnés (`/api/admin/paiements-echelonnes/[id]/lien-paiement`) ou « prélever » | `installment-retry`, `installmentId`, `planId` |
| Offre personnelle avec expiration | **pas de Payment Link** : `special_offers` + `/offre/[token]` (skill `relance`) | `special-offer` |
| Produit ponctuel sans section du site | route `POST /api/admin/stripe/produit` (sans bouton ; non suivi en base : suivre dans Stripe) | aucune |
| Commandite / partenariat | `/admin/sponsors-2027`, `partnership-offers.ts` (`buildOptionLinkParams`) | `sponsorship` / `partnership-offer` |

Modèle (essai converti) :
```js
const link = await s.paymentLinks.create({
  payment_method_types: ["card"],
  line_items: [{ quantity: 1, price_data: { currency: "cad", unit_amount: 87595, product_data: { name: "Team Valkyria — Saison Automne/Hiver 2026 — Justine Alexandre" } } }],
  restrictions: { completed_sessions: { limit: 1 } },              // usage unique
  metadata: { checkoutType: "trial-conversion", registrationId, programId: "TV", timeSlotTemplateId },
  after_completion: { type: "redirect", redirect: { url: "https://www.newvalkyria.com/confirmation" } }
});
console.log(link.url, link.livemode);
```
Montant : celui de `programs.price_cents` (ou le prix convenu avec JP). Vérifier la place libre dans le groupe
(`time_slot_templates.max_places` vs inscriptions `paid`) avant d'envoyer le lien.

**Retrouver / désactiver un lien** : `for await (const pl of s.paymentLinks.list({ limit: 100 }))` puis filtrer sur
`pl.metadata.registrationId` ou la fin de `pl.url` ; `s.paymentLinks.update(pl.id, { active: false })` quand une famille
libère sa place ou qu'un nouveau lien remplace l'ancien.

## Vérifier un paiement

1. En base : `status = 'paid'` + `stripe_payment_intent_id` sur `registrations` / `session_program_registrations` /
   `sport_etudes_registrations` / `special_offers.paid_at` / `match_slot_bookings` / `shop_orders`.
2. Dans Stripe : `s.paymentIntents.retrieve(pi)` ou `s.checkout.sessions.list({ payment_link: pl.id })`.
3. Payé dans Stripe mais pas en base : le webhook a échoué. Regarder `stripe_events` (événements reçus) et appliquer à la main
   ce que le webhook aurait fait pour ce `checkoutType` (statut, `logAudit`, courriel de confirmation) ; ne pas re-facturer.

## Rembourser

- Toujours confirmer avec JP : famille, montant (total ou partiel), raison.
- **Programmes privés / à dates fixes** : `cancelRegistrationAdmin()` (`src/lib/private-programs-admin.ts`, bouton de
  `/admin/garcons-prives`) rembourse tous les versements payés et annule l'inscription.
- **Matchs** : `/admin/matchs` (annuler + rembourser la plage). **Location de terrain** : `/admin/location-terrains`.
- **Saison filles, Sport-Études, autres** : pas de bouton. Script live :
  `await s.refunds.create({ payment_intent: pi, amount /* centimes, omettre = total */ })`, puis passer l'inscription
  à `cancelled` (`updated_at = now()`) et noter dans `audit_log` (`logAudit`, action `refund`, montant, raison).
  Le webhook `charge.refunded` ne met à jour **que** les programmes privés : le reste est à faire soi-même.
- Paiement en versements : rembourser chaque versement payé (`*_payment_plan_installments.stripe_payment_intent_id`)
  et arrêter les versements à venir : le cron `/api/cron/charge-installments` (4 h UTC chaque jour) prélève ceux en
  `pending` / `failed` ; les passer à `failed_final` (seul statut d'arrêt permis) et l'expliquer dans l'audit.

## Solde Stripe et versements bancaires

```js
const b = await s.balance.retrieve();                         // available / pending, en centimes CAD
const payouts = await s.payouts.list({ limit: 10 });          // dépôts vers le compte bancaire (arrival_date, amount, status)
const tx = await s.balanceTransactions.list({ payout: payouts.data[0].id, limit: 100 }); // détail d'un dépôt
```
Présenter en dollars (`(c / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })`), dates en heure de Montréal.
Les revenus et la trésorerie suivis par l'académie sont dans `/admin/revenus` (`revenue-repo.ts`) : ne pas créer de tableau parallèle.

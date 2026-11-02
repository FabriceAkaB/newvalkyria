---
name: automatisation
description: Comment automatiser une tâche répétitive de New Valkyria (rappels, prélèvements, expirations d'offres, avis, rapports réguliers) pour qu'elle tourne seule, laisse une trace et alerte JP si elle échoue. À utiliser quand JP dit « automatiquement », « chaque semaine », « rappelle », « dès que quelqu'un paie », ou qu'une même tâche a déjà été faite à la main plusieurs fois.
---

# Automatiser une tâche

## Choisir le bon déclencheur
| Besoin | Mécanisme |
|---|---|
| Réagir à un paiement | Webhook Stripe `src/app/api/stripe/webhook/route.ts` (nouveau `checkoutType` ou nouvel effet dans un type existant) |
| Réagir à un formulaire du site | La route API du formulaire (avec `after()` de `next/server` pour les envois après la réponse) |
| Tâche quotidienne sur le site | Cron Vercel : `vercel.json` → `/api/cron/...` (protégé par `CRON_SECRET` ; il existe déjà `charge-installments` à 4 h). Ajouter des étapes à ce cron plutôt que d'en créer un nouveau, sauf horaire différent |
| Tâche qui demande Claude (rapport, analyse, courriel rédigé) | Tâche planifiée (skill `schedule`) |

## Règles
- **Idempotent** : relancer la tâche ne doit jamais envoyer deux fois le même courriel ni prélever deux fois (marquer ce qui est fait :
  colonne `*_sent_at`, statut, `stripe_events` déjà traités).
- **Trace** : chaque action automatique écrit une ligne (`audit_log` via `logAudit`, `outreach_log` pour les familles).
- **Échec visible** : un échec apparaît dans « Aujourd'hui » (`src/lib/admin-today.ts`) et, si c'est urgent, un courriel à JP
  (`OWNER_NOTIFY_EMAIL`). Jamais d'échec silencieux.
- **Un seul courriel par événement** pour JP (il l'a demandé) : pas de copie à info@ en plus.
- Toute automatisation qui touche des familles ou de l'argent : décrire à JP ce qu'elle fera (qui, quand, combien) avant de l'activer.
- Tester en local avec des données `@example.com`, puis supprimer les données de test. Ensuite skill `mise-en-ligne`.

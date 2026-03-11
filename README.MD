# New Valkyria - Site Académie (V1)

Site professionnel de conversion pour l'académie de coaching soccer féminin New Valkyria.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS
- Sanity Studio (CMS)
- Supabase (leads + idempotence webhook)
- Stripe Checkout (paiement)
- Resend (email confirmation)
- Vitest (tests de validation)

## Pages (V1)

- `/` Accueil
- `/methode`
- `/equipe`
- `/vision`
- `/inscription`
- `/confirmation`
- `/studio` (CMS Sanity)

## API Routes

- `POST /api/leads`
- `POST /api/checkout`
- `POST /api/checkout/direct`
- `POST /api/stripe/webhook`
- `GET /api/content-preview`

## Lancer le projet

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Variables d'environnement

Renseigner au minimum:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`

## Base de données Supabase

Appliquer la migration:

- `supabase/migrations/202602281200_init.sql`

Elle crée:

- table `leads`
- table `stripe_events` (idempotence webhook)

## Stripe webhook (local)

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Confirmation email après paiement

Pour envoyer automatiquement un email de confirmation après paiement:

1. Configurer `RESEND_API_KEY` dans `.env.local`
2. Configurer `RESEND_FROM` avec un domaine expéditeur vérifié dans Resend
3. Configurer `STRIPE_WEBHOOK_SECRET`
4. S'assurer que Stripe envoie l'événement `checkout.session.completed` vers:
   - `/api/stripe/webhook`

Le webhook envoie l'email de confirmation dès réception du paiement, que le checkout vienne du formulaire ou du paiement direct.

## Tests

```bash
npm run test
npm run typecheck
npm run lint
```

## Notes CMS

`/studio` permet d'éditer les réglages de base via le document `Site Settings`.
`GET /api/content-preview` renvoie le contenu fallback + contenu CMS quand disponible.

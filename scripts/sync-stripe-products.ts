/**
 * Crée (ou retrouve, si déjà créés) les produits et prix Stripe correspondant
 * aux programmes de saison et aux produits boutique actifs — pour pouvoir
 * ensuite générer des liens de paiement (Stripe → Payment Links) et les
 * envoyer directement à un parent (ex. après un essai gratuit).
 *
 * Relançable en tout temps sans créer de doublons (chaque produit Stripe
 * porte un metadata.syncKey unique, retrouvé au prochain lancement).
 *
 * Usage :
 *   npx tsx scripts/sync-stripe-products.ts          (mode test — STRIPE_SECRET_KEY)
 *   npx tsx scripts/sync-stripe-products.ts --live    (mode live — STRIPE_LIVE_SYNC_KEY)
 */
import Stripe from "stripe";

import { env } from "../src/lib/env";
import { getSeasonPrograms } from "../src/lib/season-admin-repo";
import { getProducts } from "../src/lib/shop-repo";

const SEASON_DB_ID = "automne-hiver-2026";

async function main() {
  const isLive = process.argv.includes("--live");
  const key = isLive ? process.env.STRIPE_LIVE_SYNC_KEY : env.stripeSecretKey;
  if (!key) throw new Error(isLive ? "STRIPE_LIVE_SYNC_KEY manquant" : "STRIPE_SECRET_KEY manquant");
  console.log(`Mode : ${isLive ? "LIVE (argent réel)" : "TEST"}`);
  const stripe = new Stripe(key);

  const [programs, products] = await Promise.all([
    getSeasonPrograms(SEASON_DB_ID),
    getProducts(false)
  ]);

  const items = [
    ...programs.map((p) => ({
      key: `program:${p.id}`,
      name: `${p.name} — Saison Automne/Hiver 2026`,
      amount: p.price_cents
    })),
    ...products.map((p) => ({
      key: `product:${p.id}`,
      name: p.name,
      amount: p.price_cents
    }))
  ];

  const existing = await stripe.products.list({ limit: 100 });
  const byKey = new Map(
    existing.data.filter((p) => p.metadata?.syncKey).map((p) => [p.metadata.syncKey, p])
  );

  const results: { key: string; name: string; productId: string; priceId: string; amount: number }[] = [];

  for (const item of items) {
    let product = byKey.get(item.key);
    if (!product) {
      product = await stripe.products.create({ name: item.name, metadata: { syncKey: item.key } });
    } else if (product.name !== item.name) {
      product = await stripe.products.update(product.id, { name: item.name });
    }

    const prices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
    let price = prices.data.find((p) => p.unit_amount === item.amount && p.currency === "cad");
    if (!price) {
      price = await stripe.prices.create({ product: product.id, unit_amount: item.amount, currency: "cad" });
    }

    results.push({ key: item.key, name: item.name, productId: product.id, priceId: price.id, amount: item.amount / 100 });
  }

  console.log(JSON.stringify(results, null, 2));
  console.log(`\n${results.length} produits synchronisés avec Stripe.`);
  console.log("Pour créer un lien de paiement : Stripe Dashboard → Payment Links → New → choisir le produit.");
}

main().catch((err) => {
  console.error("Erreur:", err.message);
  process.exit(1);
});

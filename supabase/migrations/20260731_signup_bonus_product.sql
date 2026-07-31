-- Marque un produit boutique comme "cadeau des 30 premiers clients" pour une saison.
-- Additive uniquement.

alter table public.products add column if not exists is_signup_bonus boolean not null default false;

-- Un seul produit peut être le cadeau à la fois.
create unique index if not exists idx_products_single_signup_bonus
  on public.products ((is_signup_bonus))
  where is_signup_bonus = true;

-- Bonus d'une offre spéciale (ex. sac à dos offert) : affiché sur la page d'offre et,
-- au paiement, ajouté comme commande gratuite à remettre (module Uniformes / Boutique).
alter table public.special_offers add column if not exists bonus text;
alter table public.special_offers add column if not exists bonus_product_id uuid references public.products(id);

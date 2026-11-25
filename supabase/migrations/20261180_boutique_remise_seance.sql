-- Boutique : remise à la séance de son choix (JP, 25 nov. 2026). Une commande dont tous les articles sont en stock
-- au moment du paiement reçoit un lien personnel (/remise/<pickup_token>) où le parent choisit la pratique de la
-- semaine (ou de la suivante) où il passera chercher son colis, et peut cocher « C'est un cadeau » : l'éducateur
-- assigné à cette séance voit alors « Cadeau : remettre discrètement au parent, pas devant la joueuse ».
-- La séance est gardée telle que le parent l'a vue (date, heure, lieu, groupe) ; pickup_activity_id seulement si
-- l'activité existait déjà au moment du choix (sinon le portail la retrouve par la date et l'heure).
-- shop_orders a déjà RLS + politique service_role (20260730_shop.sql).
alter table public.shop_orders add column if not exists in_stock boolean not null default false;
alter table public.shop_orders add column if not exists pickup_token text;
alter table public.shop_orders add column if not exists pickup_activity_id uuid references public.coach_activities(id) on delete set null;
alter table public.shop_orders add column if not exists pickup_date date;
alter table public.shop_orders add column if not exists pickup_start text;
alter table public.shop_orders add column if not exists pickup_location text;
alter table public.shop_orders add column if not exists pickup_group text;
alter table public.shop_orders add column if not exists is_gift boolean not null default false;
alter table public.shop_orders add column if not exists pickup_chosen_at timestamptz;

create unique index if not exists shop_orders_pickup_token_idx on public.shop_orders (pickup_token) where pickup_token is not null;
create index if not exists shop_orders_pickup_date_idx on public.shop_orders (pickup_date) where pickup_date is not null;

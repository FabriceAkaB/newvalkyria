-- Offre "2e uniforme" — chandail + short au prix régulier, bas offerts.
-- Marque quel produit joue quel rôle dans le bundle (un seul produit par rôle).

alter table public.products add column if not exists uniform_bundle_role text;

alter table public.products drop constraint if exists products_uniform_bundle_role_check;
alter table public.products add constraint products_uniform_bundle_role_check
  check (uniform_bundle_role is null or uniform_bundle_role in ('jersey', 'short', 'socks'));

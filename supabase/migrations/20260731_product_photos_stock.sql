-- Boutique — plusieurs photos par produit + stock au niveau produit
-- (utilisé quand un produit n'a pas de variantes, ex. un sac vendu tel quel).

create table if not exists public.product_photos (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.product_photos enable row level security;
drop policy if exists "service_role_all" on public.product_photos;
create policy "service_role_all" on public.product_photos
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create index if not exists idx_product_photos_product on public.product_photos(product_id);

alter table public.products add column if not exists inventory_count integer not null default 0;

-- Migre la photo unique existante vers la nouvelle table, puis retire la colonne.
insert into public.product_photos (product_id, url, display_order)
select id, photo_url, 0 from public.products where photo_url is not null;

alter table public.products drop column if exists photo_url;

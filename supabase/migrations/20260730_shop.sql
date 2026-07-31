-- Phase 6 — Boutique intégrée
-- Additive only : nouvelles tables, aucune table existante touchée.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price_cents integer not null,
  photo_url text,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;
drop policy if exists "service_role_all" on public.products;
create policy "service_role_all" on public.products
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  label text not null,
  size text,
  color text,
  sku text,
  inventory_count integer not null default 0,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.product_variants enable row level security;
drop policy if exists "service_role_all" on public.product_variants;
create policy "service_role_all" on public.product_variants
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create index if not exists idx_product_variants_product on public.product_variants(product_id);

create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  shipping_address text,
  shipping_city text,
  shipping_postal_code text,
  status text not null default 'pending', -- pending | paid | fulfilled | cancelled
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  total_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shop_orders enable row level security;
drop policy if exists "service_role_all" on public.shop_orders;
create policy "service_role_all" on public.shop_orders
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create index if not exists idx_shop_orders_status on public.shop_orders(status);

create table if not exists public.shop_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  variant_label text,
  unit_price_cents integer not null,
  quantity integer not null default 1
);

alter table public.shop_order_items enable row level security;
drop policy if exists "service_role_all" on public.shop_order_items;
create policy "service_role_all" on public.shop_order_items
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create index if not exists idx_shop_order_items_order on public.shop_order_items(order_id);

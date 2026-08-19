-- Séances privées individuelles (Espace membre) — voir le plan pour le
-- détail. La fenêtre publique vendue au parent est 1h ; le bloc admin
-- interne est 1h30 (30 min de rangement/préparation) — les deux bornes sont
-- calculées et stockées côté serveur à la création du créneau, jamais à la
-- réservation.

create table public.private_session_slots (
  id uuid primary key default gen_random_uuid(),
  slot_date date not null,
  public_start_time text not null,
  public_end_time text not null,
  admin_start_time text not null,
  admin_end_time text not null,
  location text,
  terrain_id uuid references public.terrains(id),
  status text not null default 'open' check (status in ('open','booked','closed')),
  closed_reason text,
  coach_id uuid references public.coaches(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_private_slots_date on public.private_session_slots(slot_date);

create table public.private_session_bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.private_session_slots(id) on delete cascade,
  player_id uuid references public.players(id),
  parent_user_id uuid references auth.users(id) on delete set null,
  child_id uuid references public.children(id),
  parent_name text not null,
  parent_email text not null,
  parent_phone text,
  status text not null default 'reserved' check (status in ('reserved','cancelled','completed')),
  payment_status text not null default 'n/a' check (payment_status in ('none','paid','n/a')),
  price_cents integer,
  notes text,
  created_by_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_private_bookings_slot on public.private_session_bookings(slot_id);
create index idx_private_bookings_parent on public.private_session_bookings(parent_user_id);

alter table public.private_session_slots enable row level security;
alter table public.private_session_bookings enable row level security;
create policy private_session_slots_service_role_all on public.private_session_slots
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy private_session_bookings_service_role_all on public.private_session_bookings
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

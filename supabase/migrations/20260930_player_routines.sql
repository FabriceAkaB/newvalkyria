-- Routines maison — une liste d'exercices (de la bibliothèque partagée)
-- qu'un entraîneur assigne à une joueuse pour pratiquer à la maison entre
-- les séances. Même schéma/convention que player_objectives (désactivation
-- plutôt que suppression, pour garder l'historique visible dans le dossier).

create table if not exists public.player_routines (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  title text not null,
  notes text,
  exercise_ids uuid[] not null default '{}',
  created_by uuid references public.coaches(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists player_routines_registration_idx on public.player_routines (registration_id);

alter table public.player_routines enable row level security;
drop policy if exists "service_role_all" on public.player_routines;
create policy "service_role_all" on public.player_routines
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Invitations à l'avancé (JP, 18 nov. 2026) : des filles du groupe avancé sont absentes d'avance (MonClubSportif) ;
-- autant de filles de l'intermédiaire du même âge sont invitées à leur place, après confirmation de JP.
create table if not exists public.practice_invitations (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  slot_id uuid not null,
  practice_date date not null,
  start_time text not null,
  end_time text,
  location text,
  group_label text not null,
  mcs_event_id bigint,
  registration_id uuid not null,
  player_name text not null,
  parent_name text,
  parent_email text,
  rank integer,
  reason text,
  status text not null default 'proposee' check (status in ('proposee', 'envoyee', 'acceptee', 'refusee', 'expiree', 'annulee')),
  token text not null unique,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  answered_at timestamptz,
  mcs_added_at timestamptz,
  mcs_error text,
  updated_at timestamptz not null default now(),
  unique (slot_id, practice_date, registration_id)
);
create index if not exists practice_invitations_date_idx on public.practice_invitations (club_id, practice_date, status);
do $$
begin
  execute 'alter table public.practice_invitations enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'practice_invitations' and policyname = 'practice_invitations_service_role_all') then
    execute 'create policy practice_invitations_service_role_all on public.practice_invitations for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')';
  end if;
end $$;

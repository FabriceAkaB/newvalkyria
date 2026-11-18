-- Formation des éducateurs (JP, 17 nov. 2026 ; plan des deux espaces, phase 4) : un parcours de modules tirés de la
-- méthode Valkyria ; l'éducateur marque « lu et compris », JP valide après l'avoir observé.
create table if not exists public.coach_training (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  coach_id uuid not null references public.coaches(id) on delete cascade,
  module text not null,
  read_at timestamptz,
  validated_at timestamptz,
  validation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists coach_training_one on public.coach_training (coach_id, module);
alter table public.coach_training enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'coach_training' and policyname = 'service_role_all') then
    create policy service_role_all on public.coach_training for all to service_role using (true) with check (true);
  end if;
end $$;

-- Laboratoire des éducateurs (JP, 17 nov. 2026) : un concept entendu (formation, vidéo, livre, autre coach) testé à une
-- pratique, ce qu'il a changé à la séance, et s'il a beaucoup de succès, il entre dans la méthode Valkyria.
create table if not exists public.coach_experiments (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  title text not null,
  source text,
  hypothesis text,
  how_to text,
  status text not null default 'a_tester' check (status in ('a_tester', 'en_test', 'concluant', 'a_revoir', 'abandonne', 'dans_methode')),
  created_by uuid references public.coaches(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.coach_experiment_trials (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.coach_experiments(id) on delete cascade,
  activity_id uuid references public.coach_activities(id) on delete set null,
  coach_id uuid references public.coaches(id) on delete set null,
  rating smallint check (rating between 1 and 5),
  observation text,
  created_at timestamptz not null default now()
);
create index if not exists coach_experiment_trials_exp_idx on public.coach_experiment_trials (experiment_id);
alter table public.coach_experiments enable row level security;
alter table public.coach_experiment_trials enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'coach_experiments' and policyname = 'service_role_all') then
    create policy service_role_all on public.coach_experiments for all to service_role using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'coach_experiment_trials' and policyname = 'service_role_all') then
    create policy service_role_all on public.coach_experiment_trials for all to service_role using (true) with check (true);
  end if;
end $$;

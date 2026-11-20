-- Courriel automatique à l'éducateur quand tous ses rapports d'une même journée sont finis (JP, 20 nov. 2026) :
-- « votre heure a été ajoutée à votre banque d'heures ». Un seul par éducateur et par jour.
create table if not exists public.coach_report_notices (
  coach_id uuid not null references public.coaches(id) on delete cascade,
  day date not null,
  sent_at timestamptz not null default now(),
  primary key (coach_id, day)
);
do $$
begin
  execute 'alter table public.coach_report_notices enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'coach_report_notices' and policyname = 'coach_report_notices_service_role_all') then
    execute 'create policy coach_report_notices_service_role_all on public.coach_report_notices for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')';
  end if;
end $$;

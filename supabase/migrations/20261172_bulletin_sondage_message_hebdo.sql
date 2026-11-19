-- Sondage court après chaque bulletin (Mandalart P4.8.11, JP 19 nov. 2026) : « Ce bulletin vous est-il utile ? »
-- (oui, en partie, non) + « Qu'est-ce qui manque ? ». Une réponse par parent, par fille et par bulletin, modifiable.
create table if not exists public.bulletin_feedback (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  parent_user_id uuid not null,
  parent_email text,
  registration_id uuid not null,
  period text not null check (period in ('mi-saison', 'fin-saison')),
  useful text not null check (useful in ('oui', 'en_partie', 'non')),
  missing text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bulletin_feedback_registration_fk') then
    alter table public.bulletin_feedback add constraint bulletin_feedback_registration_fk foreign key (registration_id) references public.registrations (id) on delete cascade;
  end if;
end $$;
create unique index if not exists bulletin_feedback_parent_reg_period_idx on public.bulletin_feedback (parent_user_id, registration_id, period);
create index if not exists bulletin_feedback_club_updated_idx on public.bulletin_feedback (club_id, updated_at desc);
do $$
begin
  execute 'alter table public.bulletin_feedback enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'bulletin_feedback' and policyname = 'bulletin_feedback_service_role_all') then
    execute 'create policy bulletin_feedback_service_role_all on public.bulletin_feedback for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')';
  end if;
end $$;

-- Message de la semaine aux parents (Mandalart P4.5.01 et P1.7.06) : éteint par défaut (mode assistant).
insert into public.app_settings (club_id, key, value, updated_at)
values ('new-valkyria', 'message_hebdo_parents', '{"actif":false,"jour":"dimanche","heure":18}', now())
on conflict (club_id, key) do nothing;

notify pgrst, 'reload schema';

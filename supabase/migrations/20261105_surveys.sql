-- Voix des familles : sondages avec lien personnel par famille (on sait qui a répondu quoi),
-- taux de réponse, note de recommandation sur 10, suivi des familles insatisfaites et
-- listes de familles intéressées par un projet (pour cibler les lancements et les offres).

create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  title text not null,
  kind text not null default 'autre' check (kind in ('mi-saison', 'fin-saison', 'bulletin', 'changement', 'interet', 'lab', 'autre')),
  intro text,
  -- [{ id, type: note10 | echelle5 | choix | choix_multiple | oui_non | texte, label, help?, options?, required? }]
  questions jsonb not null default '[]'::jsonb,
  status text not null default 'brouillon' check (status in ('brouillon', 'envoye', 'ferme')),
  audience_label text,
  project_label text,
  closes_on date,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.survey_invites (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  token text not null unique,
  parent_email text not null,
  parent_name text,
  player_names text,
  segment text,
  sent_at timestamptz,
  reminder_count integer not null default 0,
  last_reminded_at timestamptz,
  opened_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (survey_id, parent_email)
);
create index if not exists survey_invites_survey_idx on public.survey_invites (survey_id);

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  invite_id uuid unique references public.survey_invites(id) on delete set null,
  answers jsonb not null default '{}'::jsonb,
  recommend_score integer check (recommend_score between 0 and 10),
  followup_status text not null default 'aucun' check (followup_status in ('aucun', 'a_appeler', 'appele', 'regle')),
  followup_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists survey_responses_survey_idx on public.survey_responses (survey_id);

alter table public.surveys enable row level security;
alter table public.survey_invites enable row level security;
alter table public.survey_responses enable row level security;

do $$
declare t text;
begin
  foreach t in array array['surveys', 'survey_invites', 'survey_responses'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = t || '_service_role_all') then
      execute format('create policy %I on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', t || '_service_role_all', t);
    end if;
  end loop;
end $$;

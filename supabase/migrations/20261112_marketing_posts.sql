-- Réseaux sociaux : une ligne par publication (Mandalart P3.2.05, P3.8.05, indicateur videos_semaine).
-- Une même vidéo publiée sur Instagram et Facebook = deux lignes (chiffres propres à chaque réseau)
-- qui partagent le même group_id : elle compte pour UNE publication dans le rythme de la semaine.
-- Abonnés par réseau : table marketing_channel_stats (20261104_mandalart.sql), inchangée.
-- Aucune donnée d'enfant ici (Loi 25) : le sujet décrit le contenu, jamais le nom d'une joueuse.

create table if not exists public.marketing_posts (
  id bigserial primary key,
  club_id text not null default 'new-valkyria',
  group_id uuid not null default gen_random_uuid(),
  network text not null check (network in ('instagram', 'facebook', 'youtube', 'tiktok', 'autre')),
  format text not null check (format in ('reel', 'video', 'carrousel', 'photo', 'story', 'texte')),
  paid boolean not null default false,
  posted_on date not null default current_date,
  url text,
  title text,
  theme text,
  views integer check (views is null or views >= 0),
  likes integer check (likes is null or likes >= 0),
  comments integer check (comments is null or comments >= 0),
  shares integer check (shares is null or shares >= 0),
  saves integer check (saves is null or saves >= 0),
  followers_gained integer,
  spend_cents integer check (spend_cents is null or spend_cents >= 0),
  leads integer check (leads is null or leads >= 0),
  registrations integer check (registrations is null or registrations >= 0),
  note text,
  stats_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketing_posts_club_day_idx on public.marketing_posts (club_id, posted_on desc);
create index if not exists marketing_posts_group_idx on public.marketing_posts (group_id);

alter table public.marketing_posts enable row level security;

do $$
declare t text;
begin
  foreach t in array array['marketing_posts'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = t || '_service_role_all') then
      execute format('create policy %I on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', t || '_service_role_all', t);
    end if;
  end loop;
end $$;

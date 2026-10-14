-- Programme de partenariat 2027 : 13 emplacements (Titre 1, Majeur 1, Signature 1, Manche 2, Site 8).
-- Chaque emplacement a son lien de paiement Stripe à usage unique ; le webhook le marque « vendu ».
create table if not exists public.sponsor_slots_2027 (
  slot_key text primary key,
  tier text not null,
  tier_label text not null,
  placement text not null,
  price_cents integer not null check (price_cents >= 0),
  sort_order integer not null,
  status text not null default 'available' check (status in ('available', 'reserved', 'sold')),
  sponsor_id uuid references public.sponsors(id) on delete set null,
  payment_link_id text,
  payment_link_url text,
  notes text,
  updated_at timestamptz not null default now()
);
alter table public.sponsor_slots_2027 enable row level security;
create policy sponsor_slots_2027_service_role_all on public.sponsor_slots_2027 for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

insert into public.sponsor_slots_2027 (slot_key, tier, tier_label, placement, price_cents, sort_order) values
  ('titre', 'titre', 'Partenaire Titre', 'Poitrine, centre avant', 1000000, 1),
  ('majeur', 'majeur', 'Partenaire Majeur', 'Haut du dos, sous le col', 500000, 2),
  ('signature', 'signature', 'Partenaire Signature', 'Bas du dos, sous le numéro', 350000, 3),
  ('manche-gauche', 'manche', 'Partenaire Manche', 'Manche gauche', 300000, 4),
  ('manche-droite', 'manche', 'Partenaire Manche', 'Manche droite', 300000, 5),
  ('site-1', 'site', 'Partenaire de Site', 'Bannière mobile (4 sites)', 60000, 6),
  ('site-2', 'site', 'Partenaire de Site', 'Bannière mobile (4 sites)', 60000, 7),
  ('site-3', 'site', 'Partenaire de Site', 'Bannière mobile (4 sites)', 60000, 8),
  ('site-4', 'site', 'Partenaire de Site', 'Bannière mobile (4 sites)', 60000, 9),
  ('site-5', 'site', 'Partenaire de Site', 'Bannière mobile (4 sites)', 60000, 10),
  ('site-6', 'site', 'Partenaire de Site', 'Bannière mobile (4 sites)', 60000, 11),
  ('site-7', 'site', 'Partenaire de Site', 'Bannière mobile (4 sites)', 60000, 12),
  ('site-8', 'site', 'Partenaire de Site', 'Bannière mobile (4 sites)', 60000, 13)
on conflict (slot_key) do nothing;

-- Le forfait Signature (3 500 $, bas du dos) est déjà payé : commanditaire à préciser dans l'admin.
with s as (
  insert into public.sponsors (company_name, category, partnership_type, proposed_amount_cents, status, notes)
  select 'Partenaire Signature (nom à préciser)', 'equipement', 'Partenaire Signature — Bas du dos, sous le numéro (2027)', 350000, 'paye',
         'Forfait 3 500 $ déjà payé avant la mise en place des liens Stripe. Modifier le nom de l''entreprise.'
   where not exists (select 1 from public.sponsor_slots_2027 where slot_key = 'signature' and sponsor_id is not null)
  returning id
)
update public.sponsor_slots_2027 t set status = 'sold', sponsor_id = s.id, updated_at = now() from s where t.slot_key = 'signature';

-- Famille qui a payé (lien de paiement Stripe) mais n'a pas rempli le formulaire du joueur :
-- on lui envoie un lien personnel pour compléter l'inscription, qui crée alors l'inscription interne.
create table if not exists public.registration_completions (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  program_slug text not null references public.session_programs(slug),
  parent_name text,
  parent_email text not null,
  parent_city text,
  amount_cents integer not null check (amount_cents >= 0),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  status text not null default 'sent' check (status in ('sent', 'completed', 'cancelled')),
  registration_id uuid references public.session_program_registrations(id) on delete set null,
  sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.registration_completions enable row level security;
create policy registration_completions_service_role_all on public.registration_completions for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Entonnoir des essais (Mandalart P3.6.10, JP 25 nov. 2026) : chaque étape faite pour un essai (premier contact,
-- rappel la veille, offre, relances jour 3, 7, 14, absente, liste chaude, refus) est une ligne du journal des
-- relances (outreach_log), reliée à l'essai par trial_ref (« registrations:<id> », « boys_trials:<id> »,
-- « sport_etudes_registrations:<id> »). Aucune nouvelle table : /admin/relances voit les mêmes lignes.
alter table public.outreach_log add column if not exists trial_ref text;
alter table public.outreach_log add column if not exists trial_step text;
create index if not exists outreach_log_trial_ref_idx on public.outreach_log (trial_ref) where trial_ref is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'outreach_log_trial_step_check') then
    alter table public.outreach_log add constraint outreach_log_trial_step_check check (
      trial_step is null or trial_step in ('contact', 'rappel', 'offre', 'relance-3', 'relance-7', 'relance-14', 'absente', 'liste-chaude', 'refus')
    );
  end if;
end $$;

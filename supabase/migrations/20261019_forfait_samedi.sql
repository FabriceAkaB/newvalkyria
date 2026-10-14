-- Forfait « samedi seulement » des programmes garçons : les pratiques du samedi + les 3 matchs inclus.
-- Prix = la moitié du programme complet (8 pratiques sur 16), matchs inclus. Nul = forfait non offert.
alter table public.session_programs add column if not exists saturday_package_price_cents integer check (saturday_package_price_cents is null or saturday_package_price_cents >= 0);
alter table public.session_program_registrations add column if not exists package text not null default 'complet' check (package in ('complet', 'samedi'));

update public.session_programs set saturday_package_price_cents = round(price_cents / 2.0)::int
 where slug in ('intensif-garcons', 'garcons-2014-2015') and saturday_package_price_cents is null;

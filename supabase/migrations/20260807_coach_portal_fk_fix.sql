alter table public.player_objectives
  drop constraint if exists player_objectives_created_by_fkey;

alter table public.player_objectives
  add constraint player_objectives_created_by_fkey
  foreign key (created_by) references public.coaches(id) on delete set null;

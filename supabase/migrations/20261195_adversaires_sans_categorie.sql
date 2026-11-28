-- Adversaire ajouté à la main sans catégorie connue (JP, 27 nov. 2026 : ex. Primo, Stanley 3v3) : genre et année à préciser.
alter table match_team_profiles alter column team_gender drop not null;
alter table match_team_profiles alter column team_birth_year drop not null;

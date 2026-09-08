-- 0010 : la suppression utilise un soft delete status='deleted' mais le CHECK
-- initial ne l'autorise pas → l'API répondait 500 « Impossible de supprimer ».
-- À exécuter dans le SQL Editor (comme les migrations 0008/0009).
alter table public.games drop constraint if exists games_status_check;
alter table public.games add constraint games_status_check check (status in ('active', 'finished', 'failed', 'deleted'));
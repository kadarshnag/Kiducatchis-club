-- Kiducatchis strategy links upgrade
-- Run this ONCE in Supabase SQL Editor if upgrading an existing database.

alter table public.strategies add column if not exists link_url text;
alter table public.strategies drop constraint if exists strategies_media_type_check;
alter table public.strategies add constraint strategies_media_type_check check(media_type in ('image','video','whiteboard','link','other'));

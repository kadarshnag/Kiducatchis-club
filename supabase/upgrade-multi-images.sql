-- Kiducatchis multi-images & captions upgrade
-- Run this ONCE in Supabase SQL Editor if upgrading an existing database.

alter table public.posts add column if not exists images jsonb not null default '[]'::jsonb;
grant insert (author_id,type,title,body,image_path,images,published) on public.posts to authenticated;
grant update (title,body,image_path,images,published) on public.posts to authenticated;

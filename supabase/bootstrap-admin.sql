-- Run AFTER schema.sql. First create the user in Supabase Authentication > Users > Add user,
-- BEFORE schema.sql (otherwise the invite-only trigger rejects the new user).
-- Replace with the exact email you created. Never place a service_role key in frontend env vars.
insert into public.profiles (id, full_name, role)
select id, 'Kiducatchis Admin', 'admin'
from auth.users where lower(email)=lower('YOUR_ADMIN_EMAIL@example.com')
on conflict(id) do update set role='admin';
-- Confirm exactly one admin exists:
select p.id,p.full_name,p.role,u.email from public.profiles p
join auth.users u on u.id=p.id where p.role='admin';

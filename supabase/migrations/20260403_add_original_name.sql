-- Run in Supabase SQL editor if the table already existed without original_name.
alter table public.resumes
  add column if not exists original_name text;

comment on column public.resumes.original_name is 'Optional; best-effort extracted name for audited demo reveal. Not shown until reveal API.';

-- HireBlind (Supabase Postgres) schema
-- Notes:
-- - This schema is designed to store ONLY anonymised resume text (no raw files, no PII).
-- - UUIDs use gen_random_uuid() (pgcrypto).

create extension if not exists "pgcrypto";

-- USERS
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('admin', 'recruiter')),
  created_at timestamptz not null default now()
);

-- SCREENING SESSIONS
create table if not exists public.screening_sessions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.users(id) on delete restrict,
  title text not null,
  job_description text not null,
  status text not null default 'open' check (status in ('open', 'ranked', 'closed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

-- RESUMES: anonymised_text for screening; optional original_name for audited demo reveal only
create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.screening_sessions(id) on delete cascade,
  candidate_code text not null,
  anonymised_text text not null,
  original_name text,
  file_type text not null,
  score double precision,
  score_breakdown jsonb,
  uploaded_at timestamptz not null default now(),
  unique (session_id, candidate_code)
);

-- RANKINGS
create table if not exists public.rankings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.screening_sessions(id) on delete cascade,
  resume_id uuid not null references public.resumes(id) on delete cascade,
  rank int not null check (rank > 0),
  explainability_tags jsonb not null default '[]'::jsonb,
  ranked_at timestamptz not null default now(),
  unique (session_id, resume_id),
  unique (session_id, rank)
);

-- AUDIT LOGS
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid references public.resumes(id) on delete set null,
  action_type text not null check (action_type in ('pii_removal','ai_ranking','human_override','reveal_identity')),
  fields_removed jsonb,
  actor_id text,
  override_reason text,
  logged_at timestamptz not null default now()
);

-- OVERRIDES
create table if not exists public.overrides (
  id uuid primary key default gen_random_uuid(),
  ranking_id uuid not null references public.rankings(id) on delete cascade,
  override_by text not null,
  reason text not null,
  overridden_at timestamptz not null default now()
);

-- BONUS: blind interview scheduler storage (no PII, candidate_code only)
create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.screening_sessions(id) on delete cascade,
  resume_id uuid not null references public.resumes(id) on delete cascade,
  slot text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  unique (session_id, resume_id)
);


-- =============================================================================
-- HirecWallp — Phase 2 (Automation) schema
--
-- Adds the generation/review/social/pricing-automation tables, the jobs log,
-- and commercial-licence pricing. All new tables are admin-read only; writes
-- happen via the service role from verified job routes.
-- =============================================================================

-- --- Enums ------------------------------------------------------------------
create type generation_status as enum (
  'queued', 'generating', 'filtering', 'upscaling',
  'awaiting_review', 'approved', 'rejected', 'failed'
);
create type social_platform as enum ('instagram', 'pinterest', 'youtube_shorts');
create type social_format   as enum ('image', 'carousel', 'reel', 'pin');
create type social_status   as enum ('scheduled', 'posted', 'failed', 'skipped');
create type job_status      as enum ('started', 'succeeded', 'failed');

-- --- Prompt library ----------------------------------------------------------
create table prompt_library (
  id             uuid primary key default gen_random_uuid(),
  niche          text not null,
  festival       text,
  prompt         text not null,
  negative_prompt text,
  aspect         text not null default 'phone',
  style_notes    text,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
create index prompt_library_active_idx on prompt_library (active, niche);

-- --- Generation jobs ---------------------------------------------------------
create table generation_jobs (
  id             uuid primary key default gen_random_uuid(),
  prompt_id      uuid references prompt_library(id) on delete set null,
  provider       text,
  status         generation_status not null default 'queued',
  candidates     jsonb not null default '[]'::jsonb,   -- [{key,width,height,phash,bucket}]
  quality_scores jsonb not null default '{}'::jsonb,   -- {key: {score, reasons}}
  metadata       jsonb,                                 -- Claude-suggested title/tags/etc.
  wallpaper_id   uuid references wallpapers(id) on delete set null, -- set on publish
  cost_minor     int not null default 0,
  error          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index generation_jobs_status_idx on generation_jobs (status, created_at desc);

-- --- Social posts ------------------------------------------------------------
create table social_posts (
  id            uuid primary key default gen_random_uuid(),
  wallpaper_id  uuid references wallpapers(id) on delete cascade,
  platform      social_platform not null,
  format        social_format not null default 'image',
  caption       text,
  hashtags      text,
  media_url     text,
  scheduled_for timestamptz,
  status        social_status not null default 'scheduled',
  external_id   text,
  error         text,
  created_at    timestamptz not null default now()
);
create index social_posts_due_idx on social_posts (status, scheduled_for);

-- --- Jobs log ----------------------------------------------------------------
create table jobs_log (
  id          uuid primary key default gen_random_uuid(),
  job_name    text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      job_status not null default 'started',
  details     jsonb
);
create index jobs_log_name_idx on jobs_log (job_name, started_at desc);

-- --- Commercial licence pricing ---------------------------------------------
-- Commercial licence price = personal price × multiplier (per region).
-- Configurable; flagged for CA review on tax treatment.
alter table regions add column commercial_multiplier numeric not null default 5;

-- --- RLS: admin-read only; writes via service role --------------------------
alter table prompt_library  enable row level security;
alter table generation_jobs enable row level security;
alter table social_posts    enable row level security;
alter table jobs_log        enable row level security;

create policy "prompt_library: admin read"  on prompt_library  for select using (public.is_admin());
create policy "generation_jobs: admin read" on generation_jobs for select using (public.is_admin());
create policy "social_posts: admin read"    on social_posts    for select using (public.is_admin());
create policy "jobs_log: admin read"        on jobs_log        for select using (public.is_admin());

-- Keep generation_jobs.updated_at fresh.
create or replace function public.touch_generation_job()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger generation_jobs_touch
  before update on generation_jobs
  for each row execute function public.touch_generation_job();

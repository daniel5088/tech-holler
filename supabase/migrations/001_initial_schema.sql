create extension if not exists pgcrypto;

create type public.article_status as enum ('draft', 'published', 'unpublished', 'blocked');
create type public.article_confidence as enum ('low', 'medium', 'high');
create type public.job_status as enum ('queued', 'running', 'completed', 'blocked', 'failed');

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null,
  dek text not null,
  category text not null check (category in (
    'ai-robotics',
    'computing-gadgets',
    'cyber-internet',
    'space-science',
    'sci-fi-reality',
    'futurecasting'
  )),
  status public.article_status not null default 'draft',
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  reading_minutes integer not null default 1 check (reading_minutes > 0),
  author text not null default 'Buckley Byte',
  confidence public.article_confidence not null,
  is_breaking boolean not null default false,
  trend_score integer not null default 0 check (trend_score between 0 and 100),
  forecast_horizon text,
  hero_image_url text,
  hero_image_alt text not null,
  quick_take jsonb not null default '[]'::jsonb,
  sections jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  revision_note text,
  search_document tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(dek, '')), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  constraint published_date_required check (status <> 'published' or published_at is not null)
);

create index articles_published_at_idx on public.articles (published_at desc)
  where status = 'published';
create index articles_category_idx on public.articles (category, published_at desc)
  where status = 'published';
create index articles_search_idx on public.articles using gin (search_document);

create view public.published_articles
with (security_invoker = true)
as select * from public.articles where status = 'published';

create table public.article_sources (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  title text not null,
  publisher text not null,
  url text not null,
  source_type text not null check (source_type in ('primary', 'top-tier', 'specialist', 'social-signal')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (article_id, url)
);

create table public.article_revisions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  reason text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (article_id, revision_number)
);

create table public.trend_sweeps (
  id bigint generated always as identity primary key,
  captured_at timestamptz not null default now(),
  item_count integer not null,
  channel_count integer not null,
  clusters jsonb not null default '[]'::jsonb,
  adapter_errors jsonb not null default '[]'::jsonb
);
create index trend_sweeps_captured_idx on public.trend_sweeps (captured_at desc);

create table public.trend_snapshots (
  id uuid primary key default gen_random_uuid(),
  sweep_id bigint references public.trend_sweeps(id) on delete cascade,
  external_id text not null,
  channel text not null,
  title text not null,
  url text not null,
  engagement numeric not null default 0,
  velocity numeric not null default 0,
  credibility numeric not null default 0,
  relevance numeric not null default 0,
  captured_at timestamptz not null default now()
);

create table public.research_packets (
  id uuid primary key default gen_random_uuid(),
  trend_key text not null,
  packet jsonb not null,
  source_gate_passed boolean not null,
  created_at timestamptz not null default now()
);

create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  status public.job_status not null default 'queued',
  slot text,
  details jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index job_runs_type_finished_idx on public.job_runs (job_type, finished_at desc);
create unique index job_runs_completed_slot_idx on public.job_runs (job_type, slot)
  where status = 'completed' and slot is not null;

alter table public.articles enable row level security;
alter table public.article_sources enable row level security;
alter table public.article_revisions enable row level security;
alter table public.trend_sweeps enable row level security;
alter table public.trend_snapshots enable row level security;
alter table public.research_packets enable row level security;
alter table public.job_runs enable row level security;

create policy "Published articles are public"
on public.articles for select
using (status = 'published');

create policy "Published article sources are public"
on public.article_sources for select
using (
  exists (
    select 1 from public.articles
    where articles.id = article_sources.article_id
      and articles.status = 'published'
  )
);

grant select on public.published_articles to anon, authenticated;
grant select on public.articles to anon, authenticated;
grant select on public.article_sources to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('article-images', 'article-images', true)
on conflict (id) do update set public = excluded.public;

create policy "Article images are publicly readable"
on storage.objects for select
using (bucket_id = 'article-images');

create policy "Service role manages article images"
on storage.objects for all
to service_role
using (bucket_id = 'article-images')
with check (bucket_id = 'article-images');

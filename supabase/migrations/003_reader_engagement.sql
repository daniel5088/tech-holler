-- Reader engagement: anonymous, per-device article likes with public counts.
-- Version-controlled only. Apply manually (supabase db push / SQL editor) — see
-- docs/plans/share-and-like.md. Local .env.local points at production, so applying
-- locally hits the live database.

-- 1. Public like counter on the article itself.
alter table public.articles
  add column if not exists like_count integer not null default 0
    check (like_count >= 0);

-- 2. Recreate the public view so the new column is exposed. The view is
--    `select *`, but Postgres freezes the column list at creation time, so it
--    must be dropped and recreated to pick up like_count.
drop view if exists public.published_articles;
create view public.published_articles
with (security_invoker = true)
as select * from public.articles where status = 'published';
grant select on public.published_articles to anon, authenticated;

-- 3. Per-device like ledger. One row per (article, device); ip_hash is kept only
--    for best-effort rate limiting. RLS is enabled with NO anon/authenticated
--    policies — the table is reachable only via the service role and the
--    SECURITY DEFINER RPC below.
create table if not exists public.article_likes (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  visitor_hash text not null,
  ip_hash text,
  created_at timestamptz not null default now(),
  unique (article_id, visitor_hash)
);

create index if not exists article_likes_article_idx
  on public.article_likes (article_id);
create index if not exists article_likes_ip_recent_idx
  on public.article_likes (ip_hash, created_at desc);

alter table public.article_likes enable row level security;
-- Intentionally no policies: anon/authenticated roles get no access.

-- 4. Toggle RPC. Upserts-or-deletes the like row, atomically adjusts the
--    counter under a row lock, enforces a per-IP-hash rate limit, and returns
--    the new public count plus whether the device now likes the article.
create or replace function public.toggle_article_like(
  p_article_id uuid,
  p_visitor_hash text,
  p_ip_hash text
)
returns table (like_count integer, liked boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing uuid;
  v_recent integer;
  v_rate_limit constant integer := 30; -- max like writes per IP per window
begin
  -- Lock the article row so concurrent toggles serialize on the counter.
  perform 1 from public.articles where id = p_article_id for update;
  if not found then
    raise exception 'article_not_found' using errcode = 'no_data_found';
  end if;

  select id into v_existing
  from public.article_likes
  where article_id = p_article_id and visitor_hash = p_visitor_hash;

  if v_existing is not null then
    -- Unlike: remove the row and decrement (guarded at >= 0 by the check).
    delete from public.article_likes where id = v_existing;
    update public.articles
      set like_count = greatest(0, like_count - 1)
      where id = p_article_id
      returning articles.like_count into like_count;
    liked := false;
    return next;
    return;
  end if;

  -- Like: best-effort per-IP rate limit before inserting.
  if p_ip_hash is not null then
    select count(*) into v_recent
    from public.article_likes
    where ip_hash = p_ip_hash
      and created_at > now() - interval '1 minute';
    if v_recent >= v_rate_limit then
      raise exception 'rate_limited' using errcode = 'check_violation';
    end if;
  end if;

  insert into public.article_likes (article_id, visitor_hash, ip_hash)
  values (p_article_id, p_visitor_hash, p_ip_hash);

  update public.articles
    set like_count = like_count + 1
    where id = p_article_id
    returning articles.like_count into like_count;
  liked := true;
  return next;
end;
$$;

-- Only the service role may execute the toggle.
revoke all on function public.toggle_article_like(uuid, text, text) from public;
grant execute on function public.toggle_article_like(uuid, text, text) to service_role;

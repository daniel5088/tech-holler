-- Newsletter subscribers for the email digest.
-- Applied to the production project via Supabase MCP; kept here for version control.

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  status text not null default 'subscribed' check (status in ('subscribed', 'unsubscribed')),
  source text,
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

-- Case-insensitive uniqueness so Reader@x.com and reader@x.com are one subscriber.
create unique index if not exists newsletter_subscribers_email_key
  on public.newsletter_subscribers (lower(email));

-- RLS on with no public policies: only the service-role key (used server-side)
-- can read or write, so subscriber emails are never exposed to the anon client.
alter table public.newsletter_subscribers enable row level security;

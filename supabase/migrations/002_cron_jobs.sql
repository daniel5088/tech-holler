create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

-- Run these once with deployment-specific values before enabling the schedules:
-- select vault.create_secret('https://your-domain.example', 'tech_holler_site_url');
-- select vault.create_secret('the-same-value-as-CRON_SECRET', 'tech_holler_cron_secret');

create or replace function public.invoke_tech_holler(path text)
returns void
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  site_url text;
  cron_secret text;
begin
  select decrypted_secret into site_url
  from vault.decrypted_secrets
  where name = 'tech_holler_site_url';

  select decrypted_secret into cron_secret
  from vault.decrypted_secrets
  where name = 'tech_holler_cron_secret';

  if site_url is null or cron_secret is null then
    raise exception 'Tech Holler cron secrets are not configured';
  end if;

  perform net.http_post(
    url := rtrim(site_url, '/') || path,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || cron_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;

revoke all on function public.invoke_tech_holler(text) from public;

select cron.schedule(
  'tech-holler-trend-sweep',
  '*/30 * * * *',
  $$select public.invoke_tech_holler('/api/cron/trends');$$
);

select cron.schedule(
  'tech-holler-breaking-watch',
  '7,37 * * * *',
  $$select public.invoke_tech_holler('/api/cron/breaking');$$
);

-- The endpoint checks America/New_York and maps fixed hours to category publishing slots.
select cron.schedule(
  'tech-holler-daily-publisher',
  '5 * * * *',
  $$select public.invoke_tech_holler('/api/cron/daily');$$
);

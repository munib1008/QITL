set search_path = public, extensions;

-- Daily retention jobs with pg_cron (docs/OPERATIONS.md, "Scheduled jobs"):
--   qitl-purge-expired-dream-requests  03:17 UTC  public.purge_expired_dream_requests(): deletes dream requests past their
--                                                 retain_until (every child row cascades). The privacy promise of the
--                                                 dreams module depends on it running.
--   qitl-purge-rate-limit-events       03:27 UTC  public.purge_rate_limit_events(): the throttle log older than 2 days.
--
-- Guarded: where pg_cron is not available (PGlite in the tests, a plain local Postgres) or cannot be created by the
-- migration role, this is a no-op with a NOTICE, and the jobs must be run by another trusted scheduler with the service
-- role. cron.schedule() with a job name replaces an existing job of that name, so re-running is safe.
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron is not available: dream-request retention is NOT scheduled here (see docs/OPERATIONS.md)';
    return;
  end if;
  begin
    -- On Supabase pg_cron lives in its own "cron" schema; enable it from the dashboard or here.
    execute 'create extension if not exists pg_cron';
  exception when others then
    raise notice 'pg_cron could not be enabled (%): retention is NOT scheduled here (see docs/OPERATIONS.md)', sqlerrm;
    return;
  end;
  execute $sql$select cron.schedule('qitl-purge-expired-dream-requests', '17 3 * * *', 'select public.purge_expired_dream_requests()')$sql$;
  execute $sql$select cron.schedule('qitl-purge-rate-limit-events', '27 3 * * *', 'select public.purge_rate_limit_events()')$sql$;
end $$;

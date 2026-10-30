-- Used only inside the publish trigger (runs as the owner); not an API function.
revoke execute on function public.interpretation_checks_passed(uuid) from public, anon, authenticated;

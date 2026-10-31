-- Quran reading progress: the last-read ayah per surah, per signed-in reader (reading_progress covers story chapters
-- only). Private to its owner (RLS), never readable by anon, removed with the account (on delete cascade), and
-- included in the reader's data export (export_my_quran_progress, called by /api/me/export).
create table public.quran_reading_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  surah smallint not null check (surah between 1 and 114),
  ayah smallint not null check (ayah between 1 and 286),
  updated_at timestamptz not null default now(),
  primary key (user_id, surah)
);
create index quran_reading_progress_recent on public.quran_reading_progress (user_id, updated_at desc);

create or replace function public.quran_progress_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger quran_reading_progress_touch before insert or update on public.quran_reading_progress
  for each row execute function public.quran_progress_touch();

alter table public.quran_reading_progress enable row level security;
alter table public.quran_reading_progress force row level security;
revoke all on public.quran_reading_progress from anon, authenticated;
grant select, insert, update, delete on public.quran_reading_progress to authenticated;
create policy owner_all on public.quran_reading_progress for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.export_my_quran_progress()
returns jsonb language sql stable security invoker set search_path = public, extensions as $$
  select coalesce((select jsonb_agg(jsonb_build_object('surah', p.surah, 'ayah', p.ayah, 'updated_at', p.updated_at) order by p.surah)
                   from public.quran_reading_progress p where p.user_id = auth.uid()), '[]'::jsonb);
$$;
revoke all on function public.export_my_quran_progress() from public, anon;
grant execute on function public.export_my_quran_progress() to authenticated;

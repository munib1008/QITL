-- Story production: scripts in eight scenes, Lara translation of approved prose, licensed TTS narration, ambience
-- and non-figurative visuals, played by the QITL Story Player. Nothing generated publishes by itself: a script, a
-- translation and every audio file each need their own human approval, and a change upstream flags everything
-- built from it (content_dependency_versions, migration 1200).

-- ---------- Scripts and scenes ----------
create table public.story_scripts (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.people (id) on delete cascade,
  event_id uuid references public.historical_events (id) on delete cascade,
  creation_slug text, -- Creation Atlas stories (migration 1400) are keyed by profile slug
  language text not null default 'en' check (language in ('en', 'ar', 'ur', 'hi')),
  audience text not null default 'full' check (audience in ('kids', 'young', 'full')),
  title text not null,
  origin text not null check (origin in ('human', 'ai_assisted')),
  model text,
  prompt_version text,
  translated_from uuid references public.story_scripts (id), -- set on a translation; the source script must be published
  translated_from_version integer,
  version integer not null default 1,
  status public.publication_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(person_id, event_id, creation_slug) = 1),
  check (origin = 'human' or (model is not null and prompt_version is not null)),
  check ((translated_from is null) = (translated_from_version is null))
);
create trigger story_scripts_touch before update on public.story_scripts for each row execute function public.touch_updated_at();
create trigger story_scripts_audit after insert or update or delete on public.story_scripts for each row execute function public.audit();

create table public.story_scenes (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references public.story_scripts (id) on delete cascade,
  position smallint not null check (position between 1 and 200),
  scene_kind text not null check (scene_kind in ('world', 'central_issue', 'message', 'sequence', 'turning_point', 'outcome', 'lessons', 'explore')),
  step_role text check (step_role in ('situation', 'challenge', 'action', 'response', 'consequence')), -- Scene 4's chain
  title text not null,
  narration_text text not null check (char_length(narration_text) between 1 and 5000),
  captions_vtt text, -- WebVTT; generated from timings, reviewed with the audio
  est_duration_ms integer check (est_duration_ms between 500 and 600000),
  animation_key text check (animation_key in ('rain-flood', 'sea-path', 'wheat-cycles', 'cave-daylight', 'foundations-rising', 'palace-architecture', 'beginning-timeline', 'desert-route')),
  ambient_key text,
  lessons text[] not null default '{}',
  version integer not null default 1,
  status public.publication_status not null default 'draft',
  updated_at timestamptz not null default now(),
  unique (script_id, position),
  check (scene_kind = 'sequence' or step_role is null)
);
create trigger story_scenes_touch before update on public.story_scenes for each row execute function public.touch_updated_at();
create trigger story_scenes_audit after insert or update or delete on public.story_scenes for each row execute function public.audit();

-- Every meaningful statement in a scene rests on reviewed claims (Quran or graded hadith from the four collections,
-- enforced on claim_references by migration 1100).
create table public.scene_claim_references (
  scene_id uuid not null references public.story_scenes (id) on delete cascade,
  claim_id uuid not null references public.evidence_claims (id),
  anchor text, -- the phrase in the narration it supports
  primary key (scene_id, claim_id)
);

-- ---------- Terminology and translation ----------
create table public.translation_glossary (
  id uuid primary key default gen_random_uuid(),
  term_en text not null,
  term_ar text not null,
  term_ur text,
  kind text not null check (kind in ('prophet_name', 'honorific', 'concept', 'expression', 'place', 'other')),
  keep_as text check (keep_as in ('arabic', 'transliteration')), -- never translated (e.g. honorifics)
  note text,
  lara_glossary_id text,
  status public.publication_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (term_en, kind)
);

create table public.translation_jobs (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references public.story_scripts (id) on delete cascade,
  script_version integer not null,
  target_language text not null check (target_language in ('en', 'ar', 'ur', 'hi')),
  engine text not null default 'lara' check (engine in ('lara', 'human')),
  idempotency_key text not null unique, -- script id + version + language: one job per input, retried in place
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  attempts smallint not null default 0 check (attempts between 0 and 5),
  characters integer, -- billed characters, for cost control
  result_script_id uuid references public.story_scripts (id),
  error text,
  requested_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.story_translations (
  id uuid primary key default gen_random_uuid(),
  source_script_id uuid not null references public.story_scripts (id) on delete cascade,
  source_version integer not null,
  translated_script_id uuid not null unique references public.story_scripts (id) on delete cascade,
  target_language text not null,
  engine text not null check (engine in ('lara', 'human')),
  engine_detail text,
  translator_id uuid references auth.users (id),
  created_at timestamptz not null default now()
);

-- Linguistic and religious review of a translated script (both are required).
create table public.translation_reviews (
  id uuid primary key default gen_random_uuid(),
  translated_script_id uuid not null references public.story_scripts (id) on delete cascade,
  script_version integer not null,
  aspect text not null check (aspect in ('linguistic', 'religious', 'terminology')),
  decision text not null check (decision in ('approved', 'changes_requested', 'rejected')),
  reviewer_id uuid not null references auth.users (id),
  comment text,
  created_at timestamptz not null default now()
);

-- ---------- Narration ----------
create table public.narration_voices (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_voice_id text not null,
  language text not null,
  label text not null,
  style text not null default 'warm' check (style in ('warm', 'gentle_kids', 'neutral')),
  licence_source_id uuid references public.sources (id), -- the provider's commercial-use agreement
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (provider, provider_voice_id, language),
  check (not active or licence_source_id is not null)
);

create table public.narration_jobs (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.story_scenes (id) on delete cascade,
  scene_version integer not null,
  voice_id uuid not null references public.narration_voices (id),
  text_sha256 text not null check (text_sha256 ~ '^[0-9a-f]{64}$'),
  idempotency_key text not null unique, -- scene + voice + text hash: identical input is never synthesised twice
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  attempts smallint not null default 0 check (attempts between 0 and 5),
  characters integer,
  error text,
  requested_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.narration_audio (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.story_scenes (id) on delete cascade,
  scene_version integer not null,
  voice_id uuid not null references public.narration_voices (id),
  text_sha256 text not null,
  storage_path text not null unique,
  duration_ms integer not null check (duration_ms > 0),
  bytes integer not null check (bytes between 1 and 52428800),
  mime_type text not null check (mime_type in ('audio/mpeg', 'audio/ogg', 'audio/webm', 'audio/wav')),
  status text not null default 'pending_qa' check (status in ('pending_qa', 'approved', 'rejected', 'stale')),
  pronunciation_ok boolean,
  approved_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  check (status <> 'approved' or (approved_by is not null and coalesce(pronunciation_ok, false)))
);

create table public.scene_ambient_audio (
  key text primary key check (key ~ '^[a-z0-9-]{2,40}$'),
  label text not null,
  storage_path text not null,
  licence_source_id uuid not null references public.sources (id),
  default_gain real not null default 0.15 check (default_gain between 0 and 0.4), -- ambience never overpowers narration
  kids_ok boolean not null default true,
  illustrative_note text not null default 'An artistic, illustrative ambience, not a recording of the event.',
  approved_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
alter table public.story_scenes add constraint story_scenes_ambient_fk foreign key (ambient_key) references public.scene_ambient_audio (key);

create table public.scene_visual_assets (
  scene_id uuid not null references public.story_scenes (id) on delete cascade,
  asset_id uuid not null references public.assets (id), -- assets.depicts_person is always false
  role text not null default 'background' check (role in ('background', 'infographic', 'map', 'detail')),
  position smallint not null default 1,
  primary key (scene_id, asset_id)
);

-- Timings that drive synchronised playback, set when the approved audio is in.
create table public.scene_animation_manifest (
  scene_id uuid primary key references public.story_scenes (id) on delete cascade,
  audio_id uuid references public.narration_audio (id) on delete set null,
  cues jsonb not null default '[]', -- [{ "at_ms": 0, "cue": "rain-start" }, ...]
  updated_at timestamptz not null default now()
);

-- ---------- Readers ----------
create table public.story_playback_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  mode text not null default 'read' check (mode in ('read', 'listen', 'immersive')),
  language text not null default 'en',
  speed real not null default 1 check (speed between 0.5 and 2),
  voice_id uuid references public.narration_voices (id) on delete set null,
  narration_volume real not null default 1 check (narration_volume between 0 and 1),
  ambient_volume real not null default 0.15 check (ambient_volume between 0 and 0.4),
  ambient_on boolean not null default true,
  subtitles boolean not null default true,
  show_refs boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.story_playback_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  script_id uuid not null references public.story_scripts (id) on delete cascade,
  scene_id uuid references public.story_scenes (id) on delete set null,
  position_ms integer not null default 0 check (position_ms >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, script_id)
);

create table public.story_publication_versions (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references public.story_scripts (id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  published_by uuid references auth.users (id),
  published_at timestamptz not null default now(),
  unique (script_id, version)
);

-- ---------- Rules ----------
-- A scene's text change makes a new version: its audio goes stale and must be regenerated and re-approved; the
-- script version moves and its translations are flagged.
create or replace function public.scene_versioning()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.narration_text is distinct from old.narration_text or new.title is distinct from old.title then
    if old.status = 'published' then
      raise exception 'a published scene cannot be edited in place; move its script to correction first' using errcode = 'P0001';
    end if;
    new.version := old.version + 1;
    update public.narration_audio set status = 'stale' where scene_id = new.id and status <> 'stale';
    update public.story_scripts set version = version + 1 where id = new.script_id;
  end if;
  return new;
end $$;
create trigger story_scenes_version before update on public.story_scenes for each row execute function public.scene_versioning();

create or replace function public.script_versioning()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.version > old.version then
    perform public.mark_dependants_stale('story_script', new.id, new.version);
  end if;
  return new;
end $$;
create trigger story_scripts_version after update on public.story_scripts for each row execute function public.script_versioning();

-- Publishing a script: every scene (but "explore") has approved claims, no scene lacks text, a scholarly approval
-- for this script, and for a translation: its source is published at the same version and both translation reviews
-- approve this version.
create or replace function public.guard_script_publish()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  n_scenes integer;
  n_unsupported integer;
  n_unapproved integer;
  src public.story_scripts;
begin
  if new.status <> 'published' or (tg_op = 'UPDATE' and old.status = 'published') then
    return new;
  end if;
  select count(*) into n_scenes from public.story_scenes where script_id = new.id;
  if n_scenes = 0 then
    raise exception 'no scenes, no publish: script % is empty', new.id using errcode = 'P0001';
  end if;
  select count(*) into n_unsupported from public.story_scenes s
  where s.script_id = new.id and s.scene_kind <> 'explore'
    and not exists (select 1 from public.scene_claim_references r where r.scene_id = s.id);
  if n_unsupported > 0 then
    raise exception 'no evidence, no publish: % scene(s) have no claims', n_unsupported using errcode = 'P0001';
  end if;
  select count(*) into n_unapproved from public.scene_claim_references r join public.story_scenes s on s.id = r.scene_id
    join public.evidence_claims c on c.id = r.claim_id where s.script_id = new.id and c.status not in ('approved', 'published');
  if n_unapproved > 0 then
    raise exception 'no evidence, no publish: % unapproved claim(s)', n_unapproved using errcode = 'P0001';
  end if;
  if new.translated_from is not null then
    select * into src from public.story_scripts where id = new.translated_from;
    if src.status <> 'published' or src.version <> new.translated_from_version then
      raise exception 'translation of an outdated or unpublished script: source is at version %', src.version using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.translation_reviews where translated_script_id = new.id and script_version = new.version and aspect = 'linguistic' and decision = 'approved')
       or not exists (select 1 from public.translation_reviews where translated_script_id = new.id and script_version = new.version and aspect = 'religious' and decision = 'approved') then
      raise exception 'a translation needs an approved linguistic and religious review of this version' using errcode = 'P0001';
    end if;
  end if;
  if not public.latest_review_approved('story_script', new.id) then
    raise exception 'no review, no publish: script % lacks a scholarly approval', new.id using errcode = 'P0001';
  end if;
  update public.story_scenes set status = 'published' where script_id = new.id and status <> 'published';
  insert into public.story_publication_versions (script_id, version, snapshot, published_by)
  values (new.id, new.version, (select jsonb_agg(to_jsonb(s) order by s.position) from public.story_scenes s where s.script_id = new.id), auth.uid())
  on conflict (script_id, version) do nothing;
  return new;
end $$;
create trigger story_scripts_guard before insert or update on public.story_scripts for each row execute function public.guard_script_publish();

-- Audio is approved only for the current scene version, by an audio producer, and only from an active licensed voice.
create or replace function public.guard_audio()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then
    if new.scene_version <> (select version from public.story_scenes where id = new.scene_id) then
      raise exception 'audio was generated from an outdated scene version' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.narration_voices where id = new.voice_id and active) then
      raise exception 'voice is not active (no licence recorded)' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger narration_audio_guard before insert or update on public.narration_audio for each row execute function public.guard_audio();

revoke execute on function public.scene_versioning(), public.script_versioning(), public.guard_script_publish(), public.guard_audio() from public, anon, authenticated;

alter table public.editorial_reviews drop constraint editorial_reviews_entity_type_check;
alter table public.editorial_reviews add constraint editorial_reviews_entity_type_check
  check (entity_type in ('claim', 'story', 'chapter', 'event', 'relationship', 'place_geometry', 'person', 'story_section', 'quiz', 'media',
    'interpretation', 'quran_word_senses', 'hadith_commentary_links', 'story_script', 'creation'));

-- ---------- Access ----------
do $$
declare t text;
begin
  foreach t in array array['story_scripts', 'story_scenes', 'scene_claim_references', 'translation_glossary', 'translation_jobs', 'story_translations',
    'translation_reviews', 'narration_voices', 'narration_jobs', 'narration_audio', 'scene_ambient_audio', 'scene_visual_assets',
    'scene_animation_manifest', 'story_playback_preferences', 'story_playback_progress', 'story_publication_versions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

create or replace function public.script_public(sid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.story_scripts where id = sid and status = 'published');
$$;
create or replace function public.scene_public(scid uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.story_scenes s join public.story_scripts p on p.id = s.script_id where s.id = scid and p.status = 'published');
$$;
create or replace function public.is_producer()
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select public.is_staff() or public.has_role('translation_reviewer') or public.has_role('audio_producer');
$$;

grant select on public.story_scripts, public.story_scenes, public.scene_claim_references, public.translation_glossary, public.narration_voices,
  public.narration_audio, public.scene_ambient_audio, public.scene_visual_assets, public.scene_animation_manifest, public.story_publication_versions to anon, authenticated;
grant insert, update, delete on public.story_scripts, public.story_scenes, public.scene_claim_references, public.translation_glossary,
  public.narration_voices, public.narration_audio, public.scene_ambient_audio, public.scene_visual_assets, public.scene_animation_manifest to authenticated;
grant select, insert, update on public.translation_jobs, public.narration_jobs to authenticated;
grant select, insert on public.story_translations, public.translation_reviews to authenticated;
grant select, insert, update, delete on public.story_playback_preferences, public.story_playback_progress to authenticated;

create policy read_public on public.story_scripts for select using (status = 'published' or public.is_producer());
create policy editor_insert on public.story_scripts for insert to authenticated with check (
  status in ('draft', 'in_review') and (public.has_role('editor') or (translated_from is not null and public.has_role('translation_reviewer'))));
create policy staff_update on public.story_scripts for update to authenticated
  using (public.has_role('editor') or public.has_role('scholarly_reviewer') or public.has_role('translation_reviewer'))
  with check (public.has_role('editor') or public.has_role('scholarly_reviewer') or public.has_role('translation_reviewer'));
create policy admin_delete on public.story_scripts for delete to authenticated using (public.has_role('admin') and status <> 'published');

create policy read_public on public.story_scenes for select using (public.script_public(script_id) or public.is_producer());
create policy staff_write on public.story_scenes for all to authenticated
  using (public.has_role('editor') or public.has_role('translation_reviewer')) with check (public.has_role('editor') or public.has_role('translation_reviewer'));
create policy read_public on public.scene_claim_references for select using (public.scene_public(scene_id) or public.is_producer());
create policy editor_write on public.scene_claim_references for all to authenticated using (public.has_role('editor')) with check (public.has_role('editor'));

create policy read_public on public.translation_glossary for select using (status = 'published' or public.is_producer());
create policy staff_write on public.translation_glossary for all to authenticated
  using (public.has_role('editor') or public.has_role('translation_reviewer')) with check (public.has_role('editor') or public.has_role('translation_reviewer'));

create policy producer_rw on public.translation_jobs for all to authenticated
  using (public.is_producer()) with check (public.has_role('editor') or public.has_role('translation_reviewer'));
create policy producer_read on public.story_translations for select to authenticated using (public.is_producer());
create policy producer_insert on public.story_translations for insert to authenticated with check (public.has_role('editor') or public.has_role('translation_reviewer'));
create policy producer_read on public.translation_reviews for select to authenticated using (public.is_producer());
create policy reviewer_insert on public.translation_reviews for insert to authenticated with check (
  reviewer_id = auth.uid() and (
    (aspect in ('linguistic', 'terminology') and public.has_role('translation_reviewer'))
    or (aspect = 'religious' and public.has_role('scholarly_reviewer'))));

create policy read_active on public.narration_voices for select using (active or public.is_producer());
create policy admin_write on public.narration_voices for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));
create policy producer_rw on public.narration_jobs for all to authenticated using (public.is_producer()) with check (public.has_role('audio_producer') or public.has_role('editor'));
create policy read_public on public.narration_audio for select using ((status = 'approved' and public.scene_public(scene_id)) or public.is_producer());
create policy producer_write on public.narration_audio for all to authenticated using (public.has_role('audio_producer')) with check (public.has_role('audio_producer'));
create policy read_approved on public.scene_ambient_audio for select using (approved_by is not null or public.is_producer());
create policy producer_write on public.scene_ambient_audio for all to authenticated using (public.has_role('audio_producer')) with check (public.has_role('audio_producer'));
create policy read_public on public.scene_visual_assets for select using (public.scene_public(scene_id) or public.is_producer());
create policy staff_write on public.scene_visual_assets for all to authenticated using (public.has_role('editor')) with check (public.has_role('editor'));
create policy read_public on public.scene_animation_manifest for select using (public.scene_public(scene_id) or public.is_producer());
create policy producer_write on public.scene_animation_manifest for all to authenticated
  using (public.has_role('audio_producer') or public.has_role('editor')) with check (public.has_role('audio_producer') or public.has_role('editor'));
create policy read_public on public.story_publication_versions for select using (true);

create policy own_rows on public.story_playback_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on public.story_playback_progress for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

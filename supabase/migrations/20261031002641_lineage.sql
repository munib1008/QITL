set search_path = public, extensions;

-- QITL Lineage of Humanity: from Adam to Muhammad (peace be upon them). docs/LINEAGE.md.
-- Extends the existing genealogy (people, relationships, evidence_claims, claim_references): no parallel family tree.
--  * the evidence CLASS of an edge is DERIVED from its claim and references (relationship_evidence view); editors never colour it;
--  * a GAP is a stored, cited statement that generations between two people are undocumented or differ by tradition;
--  * a NODE CLAIM is a cited statement about one person (identity, name, lifespan, dates): never invented;
--  * counts of published / under-review items are public, titles are not.

-- ---------- 1. relationships: what is uncertain, and published rows are fixed ----------
alter table public.relationships add column uncertainty_note text
  check (uncertainty_note is null or char_length(uncertainty_note) between 3 and 800);

create trigger relationships_freeze before update on public.relationships for each row execute function public.lineage_freeze_published();

-- ---------- 2. Evidence class (single source of truth; src/lib/lineage/classes.ts mirrors it and a test compares them) ----------
-- The class says WHERE a link comes from, never how worthy a person is.
--   quran      the claim is Quranic evidence AND cites a verse
--   hadith     the claim is hadith evidence AND cites a narration
--   scholar    classical Sunni scholarship (tafsir / scholar references)
--   scripture  ancient biblical manuscripts: ONLY earlier-scripture witnesses are cited (not independently authenticated Islamic revelation)
--   history    historical / archaeological research
--   unknown    disputed or unknown, or the claim does not cite what its label says
create or replace function public.lineage_ref_classes(cid uuid)
returns text[] language sql stable security invoker set search_path = public, extensions as $$
  select coalesce(array_agg(distinct x order by x), '{}') from (
    select case r.kind when 'quran' then 'quran' when 'hadith' then 'hadith' when 'tafsir' then 'scholar' when 'scholar' then 'scholar'
                       when 'scripture' then 'scripture' when 'history' then 'history' end as x
    from public.claim_references r where r.claim_id = cid
  ) q where x is not null;
$$;

create or replace function public.lineage_evidence_class(conf public.evidence_kind, cid uuid)
returns text language sql stable security invoker set search_path = public, extensions as $$
  select coalesce((
    select case
      when conf in ('disputed', 'unknown') or c.evidence in ('disputed', 'unknown') then 'unknown'
      when c.evidence = 'quran' then case when 'quran' = any (k.refs) then 'quran' else 'unknown' end
      when c.evidence = 'hadith' then case when 'hadith' = any (k.refs) then 'hadith' else 'unknown' end
      when c.evidence = 'scholar' then case
        when 'scholar' = any (k.refs) then 'scholar'
        when 'scripture' = any (k.refs) then 'scripture'
        when 'history' = any (k.refs) then 'history'
        else 'unknown' end
      when c.evidence = 'estimate' then case
        when 'history' = any (k.refs) then 'history'
        when 'scripture' = any (k.refs) then 'scripture'
        when 'scholar' = any (k.refs) then 'scholar'
        else 'unknown' end
      else 'unknown' end
    from (select evidence from public.evidence_claims where id = cid) c
    cross join (select public.lineage_ref_classes(cid) as refs) k
  ), 'unknown');
$$;

create view public.relationship_evidence with (security_invoker = true) as
  select r.id, r.person_from, r.person_to, r.kind, r.claim_id, r.status, r.competing_group, r.tradition, r.confidence,
         public.lineage_evidence_class(r.confidence, r.claim_id) as evidence_class,
         public.lineage_ref_classes(r.claim_id) as reference_classes
  from public.relationships r;
revoke all on public.relationship_evidence from anon, authenticated;
grant select on public.relationship_evidence to anon, authenticated;

-- ---------- 3. Gap nodes ----------
-- "Undocumented intermediate generations": a stored statement between an ancestor and a descendant that the chain between
-- them is not established. It carries NO count of generations and NO names; the note says what the sources say.
create table public.lineage_gaps (
  id uuid primary key default gen_random_uuid(),
  person_from uuid not null references public.people (id) on delete restrict, -- the earlier person (ancestor)
  person_to uuid not null references public.people (id) on delete restrict,   -- the later person (descendant)
  claim_id uuid not null references public.evidence_claims (id) on delete restrict,
  confidence public.evidence_kind not null,
  note text not null check (char_length(btrim(note)) between 10 and 800),
  competing_group uuid,
  tradition text check (tradition is null or char_length(tradition) between 2 and 120),
  status public.publication_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (person_from <> person_to),
  check (competing_group is null or confidence = 'disputed')
);
create unique index lineage_gaps_unique on public.lineage_gaps (person_from, person_to, claim_id);
create index lineage_gaps_people on public.lineage_gaps (person_from, person_to);
create trigger lineage_gaps_audit after insert or update or delete on public.lineage_gaps for each row execute function public.audit();

-- ---------- 4. Node claims ----------
create table public.lineage_node_claims (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete restrict,
  aspect text not null check (aspect in ('identity', 'name', 'lifespan', 'dates')),
  claim_id uuid not null references public.evidence_claims (id) on delete restrict,
  confidence public.evidence_kind not null,
  note text check (note is null or char_length(note) between 3 and 500),
  status public.publication_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index lineage_node_claims_unique on public.lineage_node_claims (person_id, aspect, claim_id);
create trigger lineage_node_claims_audit after insert or update or delete on public.lineage_node_claims for each row execute function public.audit();

-- ---------- 5. Publish guard (gaps and node claims) ----------
create or replace function public.guard_lineage_publish()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  etype text := case tg_table_name when 'lineage_gaps' then 'lineage_gap' else 'lineage_node_claim' end;
  claim record;
  n_unpublished integer;
begin
  if new.status <> 'published' or (tg_op = 'UPDATE' and old.status = 'published') then
    return new;
  end if;
  select c.status, c.evidence into claim from public.evidence_claims c where c.id = new.claim_id;
  if claim.status is null or claim.status not in ('approved', 'published') then
    raise exception 'no evidence, no publish: % % has an unapproved claim', etype, new.id using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.claim_references r where r.claim_id = new.claim_id) then
    raise exception 'no evidence, no publish: % % has a claim without references', etype, new.id using errcode = 'P0001';
  end if;
  if tg_table_name = 'lineage_gaps' then
    select count(*) into n_unpublished from public.people p where p.id in (new.person_from, new.person_to) and p.status <> 'published';
  else
    select count(*) into n_unpublished from public.people p where p.id = new.person_id and p.status <> 'published';
  end if;
  if n_unpublished > 0 then
    raise exception 'publish the people first: % % names an unpublished person', etype, new.id using errcode = 'P0001';
  end if;
  if not public.latest_review_approved(etype, new.id) then
    raise exception 'no review, no publish: % % lacks a scholarly approval', etype, new.id using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger lineage_gaps_guard before insert or update on public.lineage_gaps for each row execute function public.guard_lineage_publish();
create trigger lineage_node_claims_guard before insert or update on public.lineage_node_claims for each row execute function public.guard_lineage_publish();
create trigger lineage_gaps_freeze before update on public.lineage_gaps for each row execute function public.lineage_freeze_published();
create trigger lineage_node_claims_freeze before update on public.lineage_node_claims for each row execute function public.lineage_freeze_published();

-- ---------- 6. Public counts (no titles) ----------
-- The designed empty state of the lineage view says how many items are under review without exposing one title.
create table public.lineage_stats (
  item text primary key check (item in ('links', 'gaps', 'node_claims', 'witnesses')),
  published integer not null default 0,
  under_review integer not null default 0
);
insert into public.lineage_stats (item) values ('links'), ('gaps'), ('node_claims'), ('witnesses');

create or replace function public.refresh_lineage_stats()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.lineage_stats s set
    published = case s.item
      when 'links' then (select count(*) from public.relationships r where r.kind in ('parent_of', 'descendant_of') and r.status = 'published')
      when 'gaps' then (select count(*) from public.lineage_gaps g where g.status = 'published')
      when 'node_claims' then (select count(*) from public.lineage_node_claims n where n.status = 'published')
      else (select count(*) from public.scripture_witnesses w where w.status = 'published') end,
    under_review = case s.item
      when 'links' then (select count(*) from public.relationships r where r.kind in ('parent_of', 'descendant_of') and r.status in ('draft', 'in_review', 'approved', 'correction'))
      when 'gaps' then (select count(*) from public.lineage_gaps g where g.status in ('draft', 'in_review', 'approved', 'correction'))
      when 'node_claims' then (select count(*) from public.lineage_node_claims n where n.status in ('draft', 'in_review', 'approved', 'correction'))
      else (select count(*) from public.scripture_witnesses w where w.status in ('draft', 'in_review', 'approved', 'correction')) end;
  return null;
end $$;
create trigger relationships_lineage_stats after insert or update or delete on public.relationships for each statement execute function public.refresh_lineage_stats();
create trigger lineage_gaps_stats after insert or update or delete on public.lineage_gaps for each statement execute function public.refresh_lineage_stats();
create trigger lineage_node_claims_stats after insert or update or delete on public.lineage_node_claims for each statement execute function public.refresh_lineage_stats();
create trigger scripture_witnesses_stats after insert or update or delete on public.scripture_witnesses for each statement execute function public.refresh_lineage_stats();

-- ---------- 7. The lineage graph (published rows only; RLS decides, SECURITY INVOKER) ----------
-- One document: the people, the lineage links (parent_of / descendant_of, normalised to ancestor -> descendant), the gaps
-- and the node claims. Every item carries its derived evidence class, its claim and its references. The path from Adam
-- to Muhammad is computed from this document by the application (src/lib/lineage/path.ts), never stored.
create or replace function public.lineage_graph()
returns jsonb language sql stable security invoker set search_path = public, extensions as $$
  with refs as (
    select cr.claim_id,
           jsonb_agg(jsonb_build_object(
             'kind', cr.kind, 'surah', cr.quran_surah, 'from', cr.quran_ayah_from, 'to', cr.quran_ayah_to,
             'locator', cr.locator, 'source', s.work,
             'witness', case when w.id is null then null else jsonb_build_object('slug', w.slug, 'name', w.name_en, 'layer', w.layer) end
           ) order by cr.created_at, cr.id) as refs
    from public.claim_references cr
    left join public.sources s on s.id = cr.source_id
    left join public.scripture_witnesses w on w.id = cr.scripture_witness_id
    group by cr.claim_id
  ), pub as (select p.id, p.slug, p.name_en, p.name_ar, p.kind from public.people p where p.status = 'published')
  select jsonb_build_object(
    'people', coalesce((select jsonb_agg(jsonb_build_object('id', p.slug, 'name', p.name_en, 'nameAr', p.name_ar, 'kind', p.kind) order by p.name_en) from pub p), '[]'),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'kind', r.kind,
        'ancestor', case when r.kind = 'parent_of' then pf.slug else pt.slug end,
        'descendant', case when r.kind = 'parent_of' then pt.slug else pf.slug end,
        'confidence', r.confidence, 'evidenceClass', public.lineage_evidence_class(r.confidence, r.claim_id),
        'referenceClasses', public.lineage_ref_classes(r.claim_id),
        'competingGroup', r.competing_group, 'tradition', r.tradition, 'uncertainty', r.uncertainty_note,
        'claim', jsonb_build_object('id', c.id, 'statement', c.statement, 'evidence', c.evidence, 'references', coalesce(rf.refs, '[]'))
      ) order by r.created_at, r.id)
      from public.relationships r
      join pub pf on pf.id = r.person_from join pub pt on pt.id = r.person_to
      join public.evidence_claims c on c.id = r.claim_id
      left join refs rf on rf.claim_id = c.id
      where r.status = 'published' and r.kind in ('parent_of', 'descendant_of')), '[]'),
    'gaps', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'ancestor', pf.slug, 'descendant', pt.slug, 'note', g.note,
        'confidence', g.confidence, 'evidenceClass', public.lineage_evidence_class(g.confidence, g.claim_id),
        'referenceClasses', public.lineage_ref_classes(g.claim_id),
        'competingGroup', g.competing_group, 'tradition', g.tradition,
        'claim', jsonb_build_object('id', c.id, 'statement', c.statement, 'evidence', c.evidence, 'references', coalesce(rf.refs, '[]'))
      ) order by g.created_at, g.id)
      from public.lineage_gaps g
      join pub pf on pf.id = g.person_from join pub pt on pt.id = g.person_to
      join public.evidence_claims c on c.id = g.claim_id
      left join refs rf on rf.claim_id = c.id
      where g.status = 'published'), '[]'),
    'nodeClaims', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id, 'person', p.slug, 'aspect', n.aspect, 'note', n.note,
        'confidence', n.confidence, 'evidenceClass', public.lineage_evidence_class(n.confidence, n.claim_id),
        'claim', jsonb_build_object('id', c.id, 'statement', c.statement, 'evidence', c.evidence, 'references', coalesce(rf.refs, '[]'))
      ) order by n.created_at, n.id)
      from public.lineage_node_claims n
      join pub p on p.id = n.person_id
      join public.evidence_claims c on c.id = n.claim_id
      left join refs rf on rf.claim_id = c.id
      where n.status = 'published'), '[]')
  );
$$;
grant execute on function public.lineage_graph() to anon, authenticated;

-- ---------- 8. Row-level security ----------
alter table public.lineage_gaps enable row level security;
alter table public.lineage_node_claims enable row level security;
alter table public.lineage_stats enable row level security;
alter table public.lineage_gaps force row level security;
alter table public.lineage_node_claims force row level security;
alter table public.lineage_stats force row level security;

revoke all on public.lineage_gaps, public.lineage_node_claims, public.lineage_stats from anon, authenticated;
grant select on public.lineage_gaps, public.lineage_node_claims, public.lineage_stats to anon, authenticated;
grant insert, update, delete on public.lineage_gaps, public.lineage_node_claims to authenticated;

create policy read_published on public.lineage_gaps for select using (status = 'published' or public.is_staff());
create policy editor_insert on public.lineage_gaps for insert to authenticated with check (public.has_role('editor') and status in ('draft', 'in_review'));
create policy editor_update on public.lineage_gaps for update to authenticated
  using (public.has_role('editor') or public.has_role('scholarly_reviewer')) with check (public.has_role('editor') or public.has_role('scholarly_reviewer'));
create policy admin_delete on public.lineage_gaps for delete to authenticated using (public.has_role('admin') and status <> 'published');

create policy read_published on public.lineage_node_claims for select using (status = 'published' or public.is_staff());
create policy editor_insert on public.lineage_node_claims for insert to authenticated with check (public.has_role('editor') and status in ('draft', 'in_review'));
create policy editor_update on public.lineage_node_claims for update to authenticated
  using (public.has_role('editor') or public.has_role('scholarly_reviewer')) with check (public.has_role('editor') or public.has_role('scholarly_reviewer'));
create policy admin_delete on public.lineage_node_claims for delete to authenticated using (public.has_role('admin') and status <> 'published');

-- Counts only (no titles): readable by anyone; written only by the trigger above.
create policy read_counts on public.lineage_stats for select using (true);

-- ---------- 9. Review types and author registration ----------
insert into public.review_entity_types (type, module) values ('lineage_gap', 'lineage'), ('lineage_node_claim', 'lineage');
insert into public.review_entity_authors (entity_type, table_name, author_column) values
  ('lineage_gap', 'lineage_gaps', 'created_by'),
  ('lineage_node_claim', 'lineage_node_claims', 'created_by');
create trigger a0_stamp_author before insert or update on public.lineage_gaps for each row execute function public.stamp_author('created_by');
create trigger a0_stamp_author before insert or update on public.lineage_node_claims for each row execute function public.stamp_author('created_by');

revoke execute on function public.guard_lineage_publish(), public.refresh_lineage_stats() from public, anon, authenticated;

-- Review targets become rows, not a check constraint: each module registers its own entity types with one insert
-- instead of rewriting a shared constraint (which made parallel migrations collide).
create table public.review_entity_types (
  type text primary key check (type ~ '^[a-z_]{2,40}$'),
  module text not null,
  created_at timestamptz not null default now()
);
insert into public.review_entity_types (type, module) values
  ('claim', 'knowledge'), ('story', 'knowledge'), ('chapter', 'knowledge'), ('event', 'knowledge'), ('relationship', 'knowledge'),
  ('place_geometry', 'knowledge'), ('person', 'knowledge'), ('story_section', 'storytelling'), ('quiz', 'storytelling'),
  ('media', 'storytelling'), ('interpretation', 'interpretation'), ('quran_word_senses', 'interpretation'),
  ('hadith_commentary_links', 'interpretation'), ('story_script', 'narration'), ('creation', 'creation_atlas');

alter table public.editorial_reviews drop constraint editorial_reviews_entity_type_check;
alter table public.editorial_reviews add constraint editorial_reviews_entity_type_fk foreign key (entity_type) references public.review_entity_types (type);

alter table public.review_entity_types enable row level security;
alter table public.review_entity_types force row level security;
revoke all on public.review_entity_types from anon, authenticated;
grant select on public.review_entity_types to authenticated;
create policy staff_read on public.review_entity_types for select to authenticated using (public.is_staff());

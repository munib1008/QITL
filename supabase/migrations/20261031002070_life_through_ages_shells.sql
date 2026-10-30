-- Life Through the Ages: empty "How They Lived" shells for the 25 prophets named in the Quran, as DRAFT.
-- Every one of the 20 template fields starts "not established" (known = false, no text, no category). This seeds
-- structure only: no content, no citation, no lifespan. Editors fill fields; each is published only after review.
-- person_slug matches the journey stop ids (content/journey); Harun shares the Musa stop. person_id is resolved
-- from public.people when those rows exist (trigger lifestyle_profile_person).
insert into public.prophet_lifestyle_profiles (person_slug, status)
select s, 'draft'
from unnest(array['adam', 'idris', 'nuh', 'hud', 'salih', 'ibrahim', 'lut', 'ismail', 'ishaq', 'yaqub', 'yusuf', 'ayyub',
  'shuayb', 'musa', 'harun', 'dhulkifl', 'dawud', 'sulayman', 'ilyas', 'alyasa', 'yunus', 'zakariya', 'yahya', 'isa', 'muhammad']) s
on conflict (person_slug) do nothing;

insert into public.prophet_lifestyle_fields (profile_id, field_key, known, status)
select p.id, f, false, 'draft'
from public.prophet_lifestyle_profiles p
cross join unnest(array['period', 'region', 'community', 'lifespan', 'daily_activities', 'occupation', 'foods_beverages',
  'farming_livestock', 'clothing_care', 'housing', 'transport', 'family_community', 'customs_leisure', 'education',
  'health_treatment', 'climate', 'worship', 'challenges', 'differences_modern', 'lessons']) f
on conflict (profile_id, field_key, position) do nothing;

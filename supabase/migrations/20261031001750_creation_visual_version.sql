-- Creation Atlas fix: guard_creation_publish raises new.version when a draft row changes, but creation_visual_assets had
-- no version column, so any draft edit (including setting approved_by, which publishing requires) failed with
-- 'record "new" has no field "version"' and a visual could never be published. Visuals get a version like every
-- other Creation Atlas row. Tested in tests/db/creation.test.ts.
alter table public.creation_visual_assets add column version integer not null default 1;

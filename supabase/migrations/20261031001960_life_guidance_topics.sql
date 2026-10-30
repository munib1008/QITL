-- The starting Life Guidance topics, as DRAFT rows: titles and icons only. No lesson text, verses or advice is seeded;
-- each lesson is written by an editor from approved claims and published only after a scholarly approval.
-- The Arabic titles are a first draft and need review by a qualified translator.
-- Keep in step with src/lib/guidance/topics.ts (the planned list shown before anything is published).
insert into public.guidance_topics (slug, title_en, title_ar, icon_key, distress, position, status) values
  ('feeling-overwhelmed', 'Feeling overwhelmed', 'الشعور بالإرهاق', 'wave', true, 1, 'draft'),
  ('betrayal-and-forgiveness', 'Betrayal and forgiveness', 'الخيانة والعفو', 'bond', false, 2, 'draft'),
  ('illness-and-hardship', 'Illness and hardship', 'المرض والشدة', 'leaf', true, 3, 'draft'),
  ('financial-difficulty', 'Financial difficulty', 'الضيق المالي', 'scale', true, 4, 'draft'),
  ('anger-and-conflict', 'Anger and conflict', 'الغضب والخلاف', 'flame', false, 5, 'draft'),
  ('feeling-guilty', 'Feeling guilty', 'الشعور بالذنب', 'return', true, 6, 'draft'),
  ('grief-and-loss', 'Grief and loss', 'الحزن والفقد', 'moon', true, 7, 'draft'),
  ('fear-and-anxiety', 'Fear and anxiety', 'الخوف والقلق', 'shield', true, 8, 'draft'),
  ('family-difficulties', 'Family difficulties', 'الخلافات الأسرية', 'home', false, 9, 'draft'),
  ('waiting-and-patience', 'Waiting and patience', 'الانتظار والصبر', 'hourglass', false, 10, 'draft')
on conflict (slug) do nothing;

-- The starting Shifa topics, as DRAFT rows: titles and icons only, as navigation labels (a title is not a claim). No text,
-- verse, hadith, remedy or advice is seeded; each entry is written by an editor from approved claims and published only
-- after the religious and/or clinical review. The Arabic titles are a first draft that needs a qualified translator.
-- Keep in step with src/lib/shifa/model.ts (the planned list shown before anything is published).
insert into public.shifa_topics (slug, section, title_en, title_ar, icon_key, position, status) values
  ('quranic-healing', 'quranic_healing', 'Quranic healing', 'الشفاء بالقرآن', 'calligraphy', 1, 'draft'),
  ('authentic-ruqyah', 'ruqyah', 'Authentic ruqyah', 'الرقية الشرعية', 'light', 1, 'draft'),
  ('honey', 'prophetic_remedies', 'Honey', 'العسل', 'vessel', 1, 'draft'),
  ('black-seed', 'prophetic_remedies', 'Black seed (Nigella sativa)', 'الحبة السوداء', 'leaf', 2, 'draft'),
  ('dates', 'prophetic_remedies', 'Dates', 'التمر', 'leaf', 3, 'draft'),
  ('olive-oil', 'prophetic_remedies', 'Olive oil', 'زيت الزيتون', 'vessel', 4, 'draft'),
  ('water-and-zamzam', 'prophetic_remedies', 'Water and zamzam', 'الماء وزمزم', 'water', 5, 'draft'),
  ('cupping-hijama', 'prophetic_remedies', 'Cupping (hijama)', 'الحجامة', 'vessel', 6, 'draft'),
  ('sleep-and-rest', 'prophetic_remedies', 'Sleep and rest', 'النوم والراحة', 'moon', 7, 'draft'),
  ('moderation-in-eating', 'prophetic_remedies', 'Moderation in eating', 'الاعتدال في الطعام', 'scale', 8, 'draft'),
  ('cleanliness-and-hygiene', 'prophetic_remedies', 'Cleanliness and hygiene', 'النظافة والطهارة', 'water', 9, 'draft'),
  ('grief-and-distress', 'wellbeing', 'Grief and distress', 'الحزن والكرب', 'moon', 1, 'draft'),
  ('anxiety-and-worry', 'wellbeing', 'Anxiety and worry', 'القلق والهمّ', 'light', 2, 'draft'),
  ('patience-in-illness', 'wellbeing', 'Patience in illness', 'الصبر على المرض', 'pattern', 3, 'draft')
on conflict (slug) do nothing;

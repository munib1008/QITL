set search_path = public, extensions;

-- The scripture witness REGISTRY: reference data for comparative research (docs/LINEAGE.md). Ten rows, all DRAFT: nothing
-- is published until a scholarly reviewer and a historical/scientific reviewer approve each one in /admin/scriptures.
-- These rows hold no scripture text and make no religious claim beyond what the LIMITATION says. A broad dating is given
-- only where it is a standard scholarly range; otherwise it is NULL and the application shows "Not established".
-- Names in Arabic and Urdu are left empty on purpose: they are for the translators.

insert into public.scripture_witnesses (slug, layer, kind, name_en, language, dating_note, what_it_is, limitation, sort_order) values
('dead-sea-scrolls-pentateuch', 'tawrah', 'manuscript_collection', 'Dead Sea Scrolls (manuscripts of the five books of Moses)', 'Hebrew',
 'Roughly the 3rd century BCE to the 1st century CE',
 'A collection of manuscripts found near Qumran in the 20th century. It includes fragments of the five books of Moses (the Pentateuch) among many other texts, and gives scholars Hebrew witnesses far earlier than the medieval codices.',
 'Significant textual traditions and variants exist; no surviving witness can be certified as Musa''s original revelation. The scrolls are fragmentary, and their readings agree sometimes with one later tradition and sometimes with another. Being early does not by itself show that a text is unaltered.', 10),
('masoretic-hebrew-pentateuch', 'tawrah', 'manuscript_tradition', 'Masoretic Hebrew tradition (the five books of Moses)', 'Hebrew',
 'Main surviving codices from about the 10th to 11th centuries CE; the tradition they preserve is older',
 'The Hebrew text tradition preserved and standardised by Jewish scribes known as the Masoretes. It is the base of most Hebrew Bibles used in Judaism today, and its main surviving manuscripts are medieval codices.',
 'Significant textual traditions and variants exist; no surviving witness can be certified as Musa''s original revelation. Careful copying over centuries does not by itself show that this text is identical with the revelation given to Musa.', 20),
('samaritan-pentateuch', 'tawrah', 'manuscript_tradition', 'Samaritan Pentateuch', 'Hebrew (Samaritan tradition)',
 null,
 'The version of the five books of Moses transmitted by the Samaritan community, which accepts these books as its scripture. It differs from the Masoretic text in a number of readings, and scholars study when and how this tradition took its form.',
 'Significant textual traditions and variants exist; no surviving witness can be certified as Musa''s original revelation. When this tradition took its present form is debated among scholars, so no date is given here.', 30),
('septuagint-pentateuch', 'tawrah', 'translation_tradition', 'Greek Septuagint (the five books of Moses)', 'Greek',
 'Translation of the five books begun in the 3rd century BCE',
 'The Greek translation of the Hebrew scriptures made by Jewish scholars in the last centuries BCE, beginning with the five books of Moses. It witnesses the Hebrew text its translators had, which sometimes differs from the Masoretic text, and it was later used by early Christians.',
 'Significant textual traditions and variants exist; no surviving witness can be certified as Musa''s original revelation. A translation shows what its translators had before them and the choices they made; it is not a copy of the words revealed to Musa.', 40),
('dead-sea-scrolls-psalms', 'zabur', 'manuscript_collection', 'Psalms among the Dead Sea Scrolls', 'Hebrew',
 'Roughly the 3rd century BCE to the 1st century CE',
 'Many copies of psalms were found among the Dead Sea Scrolls. Some present psalms in a different order, or with additional compositions, compared with the later Hebrew Psalter. Scholars interpret these differences in more than one way.',
 'The surviving Book of Psalms is a collection; it cannot simply be equated in its entirety with the original Zabur given to Dawud. Scholars disagree about what the differences between these scrolls and the later Psalter show.', 110),
('hebrew-psalter', 'zabur', 'manuscript_tradition', 'Hebrew Psalter (Masoretic tradition)', 'Hebrew',
 'Main surviving codices from about the 10th to 11th centuries CE; the tradition they preserve is older',
 'The Book of Psalms as transmitted in the Hebrew Masoretic tradition, used in Jewish and Christian worship. Its headings attribute many psalms to Dawud and others to different named figures.',
 'The surviving Book of Psalms is a collection; it cannot simply be equated in its entirety with the original Zabur given to Dawud. Its headings and attributions belong to the transmitted text and are studied by scholars; they are not independent proof of authorship.', 120),
('septuagint-psalms', 'zabur', 'translation_tradition', 'Greek Septuagint Psalms', 'Greek',
 null,
 'The Greek translation of the Psalms within the Septuagint. Its numbering and some of its readings differ from the Hebrew Psalter, and some Christian traditions still use it as their Psalter.',
 'The surviving Book of Psalms is a collection; it cannot simply be equated in its entirety with the original Zabur given to Dawud. A translation shows what its translators had before them and the choices they made.', 130),
('early-greek-gospel-papyri', 'injil', 'papyri', 'Early Greek Gospel papyri', 'Greek',
 'The earliest fragments are generally dated to the 2nd to 3rd centuries CE',
 'Fragments of the canonical Gospels written on papyrus, the earliest surviving manuscripts of these texts. They are partial and were copied some time after the events the Gospels describe. They differ from one another, and from later codices, in places.',
 'The four canonical Gospels are ancient accounts about Isa (Jesus), not manuscripts demonstrably identical to the Injil revealed to Isa. Papyrus fragments are partial, and variant readings exist between them.', 210),
('codex-vaticanus', 'injil', 'codex', 'Codex Vaticanus', 'Greek',
 '4th century CE',
 'A Greek codex of the Bible, usually dated to the 4th century CE and kept in the Vatican Library. It is one of the oldest nearly complete manuscripts of the Greek Bible and a major witness for the text of the Gospels.',
 'The four canonical Gospels are ancient accounts about Isa (Jesus), not manuscripts demonstrably identical to the Injil revealed to Isa. A single codex is one witness among many and differs from others in its readings.', 220),
('codex-sinaiticus', 'injil', 'codex', 'Codex Sinaiticus', 'Greek',
 '4th century CE',
 'A Greek codex of the Bible from the 4th century CE. Its surviving parts are held in several libraries, including the British Library and St Catherine''s Monastery in Sinai, and it contains the whole of the New Testament and a large part of the Old Testament.',
 'The four canonical Gospels are ancient accounts about Isa (Jesus), not manuscripts demonstrably identical to the Injil revealed to Isa. This codex carries corrections made by later scribes and differs from other witnesses in its readings.', 230);

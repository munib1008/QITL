import { getDict } from "./index";
import { asmaStrings } from "./modules/asma";
import { atlasStrings, genealogyStrings } from "./modules/atlas";
import { creationStrings } from "./modules/creation";
import { dreamsT } from "./modules/dreams";
import { eventStrings, lastHourStrings, timelineStrings } from "./modules/events";
import { guidanceT } from "./modules/guidance";
import { encyclopediaStrings } from "./modules/encyclopedia";
import { hadithStoryStrings } from "./modules/hadithStories";
import { hadithStrings } from "./modules/hadith";
import { homeStrings, journeyStrings } from "./modules/home";
import { interpretationT } from "./modules/interpretation";
import { lifestyleStrings } from "./modules/lifestyle";
import { muftiT } from "./modules/mufti";
import { partnersT } from "./modules/partners";
import { muftiApplyT } from "./modules/muftiApply";
import { notificationsT } from "./modules/notifications";
import { siteAdminT } from "./modules/siteAdmin";
import { peopleAdminStrings } from "./modules/peopleAdmin";
import { getPlayerStrings } from "./modules/player";
import { prophetStrings, storiesStrings } from "./modules/prophets";
import { qiraatStrings } from "./modules/qiraat";
import { quranPageStrings, readerStrings } from "./modules/reader";
import { quranReaderStrings } from "./modules/quranReader";
import { compareStrings, learnStrings, searchStrings } from "./modules/search";
import { accountStrings } from "./modules/account";
import { apiStrings } from "./modules/api";
import { communityStrings } from "./modules/community";
import { storyStrings } from "./modules/story";
import { storyChaptersStrings } from "./modules/storyChapters";
import { uiStrings } from "./modules/ui";
import { adminStrings } from "./modules/admin";
import { lineageStrings, scriptureStrings } from "./modules/lineage";
import { adminChapterStrings } from "./modules/adminChapter";
import { adminCoverageStrings } from "./modules/adminCoverage";
import { adminCreationStrings } from "./modules/adminCreation";
import { adminGuidanceStrings } from "./modules/adminGuidance";
import { adminHadithStoriesStrings } from "./modules/adminHadithStories";
import { adminInterpretationStrings } from "./modules/adminInterpretation";
import { adminLicencesStrings } from "./modules/adminLicences";
import { adminLifestyleStrings } from "./modules/adminLifestyle";
import { adminLineageStrings } from "./modules/adminLineage";
import { adminMediaStrings } from "./modules/adminMedia";
import { adminQiraatStrings } from "./modules/adminQiraat";
import { adminSharedStrings } from "./modules/adminShared";
import { adminAsmaStrings } from "./modules/adminAsma";
import { adminShifaStrings } from "./modules/adminShifa";
import { adminStoryStrings } from "./modules/adminStory";
import { adminToolsStrings } from "./modules/adminTools";
import { adminUniverseStrings } from "./modules/adminUniverse";
import { draftPreviewStrings } from "./modules/draftPreview";

/**
 * Every interface strings file, with the module it serves. Used by the inventory (scripts/i18n-inventory.ts,
 * docs/LOCALISATION_STATUS.md) and by tests/unit/i18n.test.ts to check that Arabic and Urdu cover every English key.
 * A module that adds a strings file adds it here.
 */
export const STRING_FILES: Array<{ module: string; file: string; get: (locale: string) => unknown }> = [
  { module: "shell", file: "dict.ts", get: (l) => getDict(l).t },
  { module: "shell", file: "modules/ui.ts", get: uiStrings },
  { module: "home", file: "modules/home.ts", get: (l) => ({ home: homeStrings(l), journey: journeyStrings(l) }) },
  { module: "stories", file: "modules/prophets.ts", get: (l) => ({ prophets: prophetStrings(l), stories: storiesStrings(l) }) },
  { module: "stories", file: "modules/story.ts", get: storyStrings },
  { module: "stories", file: "modules/storyChapters.ts", get: storyChaptersStrings },
  { module: "stories", file: "modules/draftPreview.ts", get: draftPreviewStrings },
  { module: "events", file: "modules/events.ts (events)", get: eventStrings },
  { module: "timeline", file: "modules/events.ts (timeline)", get: timelineStrings },
  { module: "last-hour", file: "modules/events.ts (last hour)", get: lastHourStrings },
  { module: "atlas", file: "modules/atlas.ts (atlas)", get: atlasStrings },
  { module: "genealogy", file: "modules/atlas.ts (genealogy)", get: genealogyStrings },
  { module: "hadith", file: "modules/hadith.ts", get: hadithStrings },
  { module: "quran", file: "modules/reader.ts", get: (l) => ({ reader: readerStrings(l), page: quranPageStrings(l), nav: quranReaderStrings(l) }) },
  { module: "search", file: "modules/search.ts (search)", get: searchStrings },
  { module: "learn", file: "modules/search.ts (learn)", get: learnStrings },
  { module: "compare", file: "modules/search.ts (compare)", get: compareStrings },
  { module: "community", file: "modules/community.ts", get: communityStrings },
  { module: "account", file: "modules/account.ts", get: accountStrings },
  { module: "api", file: "modules/api.ts", get: apiStrings },
  { module: "admin", file: "modules/admin.ts", get: adminStrings },
  { module: "creation", file: "modules/creation.ts", get: creationStrings },
  { module: "dreams", file: "modules/dreams.ts", get: dreamsT },
  { module: "guidance", file: "modules/guidance.ts", get: guidanceT },
  { module: "hadith-stories", file: "modules/hadithStories.ts", get: hadithStoryStrings },
  { module: "encyclopedia", file: "modules/encyclopedia.ts", get: encyclopediaStrings },
  { module: "interpretation", file: "modules/interpretation.ts", get: interpretationT },
  { module: "lifestyle", file: "modules/lifestyle.ts", get: lifestyleStrings },
  { module: "mufti", file: "modules/mufti.ts", get: muftiT },
  { module: "mufti", file: "modules/muftiApply.ts", get: muftiApplyT },
  { module: "partners", file: "modules/partners.ts", get: partnersT },
  { module: "account", file: "modules/notifications.ts", get: notificationsT },
  { module: "admin", file: "modules/siteAdmin.ts", get: siteAdminT },
  { module: "admin", file: "modules/peopleAdmin.ts", get: peopleAdminStrings },
  { module: "player", file: "modules/player.ts", get: getPlayerStrings },
  { module: "qiraat", file: "modules/qiraat.ts", get: qiraatStrings },
  { module: "lineage", file: "modules/lineage.ts", get: (l) => ({ lineage: lineageStrings(l), scriptures: scriptureStrings(l) }) },
  { module: "admin", file: "modules/adminChapter.ts", get: adminChapterStrings },
  { module: "admin", file: "modules/adminCoverage.ts", get: adminCoverageStrings },
  { module: "admin", file: "modules/adminCreation.ts", get: adminCreationStrings },
  { module: "admin", file: "modules/adminGuidance.ts", get: adminGuidanceStrings },
  { module: "admin", file: "modules/adminHadithStories.ts", get: adminHadithStoriesStrings },
  { module: "admin", file: "modules/adminInterpretation.ts", get: adminInterpretationStrings },
  { module: "admin", file: "modules/adminLicences.ts", get: adminLicencesStrings },
  { module: "admin", file: "modules/adminLifestyle.ts", get: adminLifestyleStrings },
  { module: "admin", file: "modules/adminLineage.ts", get: adminLineageStrings },
  { module: "admin", file: "modules/adminMedia.ts", get: adminMediaStrings },
  { module: "admin", file: "modules/adminQiraat.ts", get: adminQiraatStrings },
  { module: "admin", file: "modules/adminShared.ts", get: adminSharedStrings },
  { module: "admin", file: "modules/adminShifa.ts", get: adminShifaStrings },
  { module: "admin", file: "modules/adminAsma.ts", get: adminAsmaStrings },
  { module: "asma", file: "modules/asma.ts", get: asmaStrings },
  { module: "admin", file: "modules/adminStory.ts", get: adminStoryStrings },
  { module: "admin", file: "modules/adminTools.ts", get: adminToolsStrings },
  { module: "admin", file: "modules/adminUniverse.ts", get: adminUniverseStrings },
];

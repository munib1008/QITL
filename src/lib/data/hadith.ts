/**
 * The seven catalogued Sunni collections. This is a catalogue, not a grade: each narration is graded on its own
 * by a named scholar. Bukhari and Muslim carry a collection-level note, and their narrations still show gradings.
 */
export interface Collection {
  id: "bukhari" | "muslim" | "abudawud" | "tirmidhi" | "nasai" | "ibnmajah" | "muwatta";
  name: string;
  arabic: string;
  compiler: string;
  note: string;
}

export const COLLECTIONS: Collection[] = [
  { id: "bukhari", name: "Sahih al-Bukhari", arabic: "صحيح البخاري", compiler: "Muhammad ibn Ismail al-Bukhari", note: "Compiled with the aim of including only authentic narrations; the scholarly consensus on its status is shown as context, and each narration still shows its gradings." },
  { id: "muslim", name: "Sahih Muslim", arabic: "صحيح مسلم", compiler: "Muslim ibn al-Hajjaj", note: "Compiled with the aim of including only authentic narrations; the scholarly consensus on its status is shown as context, and each narration still shows its gradings." },
  { id: "abudawud", name: "Sunan Abi Dawud", arabic: "سنن أبي داود", compiler: "Abu Dawud al-Sijistani", note: "Contains narrations of differing grades. Each one is graded individually." },
  { id: "tirmidhi", name: "Jami' at-Tirmidhi", arabic: "جامع الترمذي", compiler: "Muhammad ibn Isa at-Tirmidhi", note: "Contains narrations of differing grades. Each one is graded individually." },
  { id: "nasai", name: "Sunan an-Nasa'i", arabic: "سنن النسائي", compiler: "Ahmad ibn Shu'ayb an-Nasa'i", note: "Contains narrations of differing grades. Each one is graded individually." },
  { id: "ibnmajah", name: "Sunan Ibn Majah", arabic: "سنن ابن ماجه", compiler: "Muhammad ibn Yazid Ibn Majah", note: "Contains narrations of differing grades. Each one is graded individually." },
  { id: "muwatta", name: "Muwatta Malik", arabic: "موطأ مالك", compiler: "Malik ibn Anas", note: "Contains narrations of differing grades and reports from Companions and later authorities. Each one is graded individually." },
];

export const collectionById = (id: string) => COLLECTIONS.find((c) => c.id === id);

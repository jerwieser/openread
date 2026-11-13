// The reader's languages, the most wanted first: the reading languages they set in Settings, or else
// their browser's, each also as its main language ("nl-NL" and "nl"). The API sends books' titles
// and authors' names in these (GET /works?languages=), in Wikidata's codes, which are the same
// lower-cased. Trying the site in other languages without changing either: localStorage
// "openread.languages" = "nl,en".
function stored() {
  try {
    return localStorage.getItem("openread.languages")?.split(",") ?? null;
  } catch {
    return null; // storage blocked
  }
}

function expand(tags) {
  const codes = tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
  return [...new Set(codes.flatMap((code) => [code, code.split("-")[0]]))].slice(0, 10);
}

function browsers() {
  return navigator.languages?.length ? [...navigator.languages] : [navigator.language ?? "en"];
}

// (a live binding: who imports it sees it change when a reader logs in or saves theirs)
export let READER_LANGUAGES = expand(stored() ?? browsers());

// The logged-in reader's reading languages (none: the browser's). True when that changes the
// languages, so the books and tracks are asked for again.
export function setReadingLanguages(codes) {
  const next = expand(stored() ?? (codes?.length ? codes : browsers()));
  if (next.join() === READER_LANGUAGES.join()) return false;
  READER_LANGUAGES = next;
  return true;
}

export const mainLanguage = (code) => code.split("-")[0];

// a language's name in English, the site's language: "Dutch", "Ancient Greek"
const names = new Intl.DisplayNames(["en"], { type: "language", fallback: "none" });
export function languageName(code) {
  try {
    return names.of(code) ?? null;
  } catch {
    return null;
  }
}

// The languages the site itself is in, for Settings: English only, for now. A new one comes with its
// translation of the site's texts.
export const SITE_LANGUAGES = ["en"];

// The languages a reader can choose to read in, in Settings: the world's most read, by their names.
// Books have titles in many more (from Wikidata); these are the ones to choose from.
export const READING_LANGUAGES = [
  "af", "ar", "bg", "bn", "ca", "cs", "cy", "da", "de", "el", "en", "eo", "es", "et", "eu", "fa", "fi", "fr",
  "ga", "gl", "he", "hi", "hr", "hu", "hy", "id", "is", "it", "ja", "ka", "ko", "la", "lt", "lv", "mk", "ms",
  "nb", "nl", "pl", "pt", "ro", "ru", "sk", "sl", "sq", "sr", "sv", "sw", "ta", "te", "th", "tr", "uk", "ur",
  "vi", "yo", "zh",
].sort((a, b) => (languageName(a) ?? a).localeCompare(languageName(b) ?? b));

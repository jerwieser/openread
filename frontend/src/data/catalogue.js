// Editorial data the site shows alongside the books from the API: what the difficulty ratings mean,
// the eras a book's year puts it in, and the categories the books page has a shelf for.

export const DIFFICULTY = {
  approachable: {
    label: "Approachable",
    tone: "success",
    why: "It reads quickly and the story pulls you along. Talking it over with others shows you what is going on beneath it, and why readers still argue about it.",
  },
  challenging: {
    label: "Challenging",
    tone: "warning",
    why: "Long, old-fashioned or slow in places. Readers who know it fill in the context you are missing, and can tell you which stretches are worth pushing through.",
  },
  demanding: {
    label: "Demanding",
    tone: "danger",
    why: "Dense, experimental or far removed from today. This is where reading with others makes the difference between giving up at chapter three and finishing it glad you did.",
  },
};

export const ERAS = [
  { id: "ancient", label: "Ancient", until: 500, note: "Written for listeners in a world of gods, fate and honour, often in verse and in translation. Knowing who is who, and what the audience already knew, unlocks it." },
  { id: "medieval", label: "Medieval & Renaissance", until: 1650, note: "Older English or translated verse and a worldview built on faith and hierarchy. A guide to the language and the references makes it far more alive." },
  { id: "enlightenment", label: "17th & 18th century", until: 1800, note: "Long sentences, digressions and a love of argument. Knowing what the author was arguing against makes the slow parts make sense." },
  { id: "nineteenth", label: "19th century", until: 1900, note: "Big casts, serial instalments and slow openings. Once you know whom to follow and what the period took for granted, these books race." },
  { id: "early-modern", label: "Early 20th century", until: 1946, note: "Modernist experiments with time, memory and points of view. Talking it through helps you find your footing when the narration shifts under you." },
  { id: "modern", label: "1946 to 2000", until: 2000, note: "Closer to our time but often playful with form or rooted in histories readers may not know. Context turns a puzzling read into a moving one." },
  { id: "contemporary", label: "21st century", until: Infinity, note: "Written for readers like us, which doesn't make it simple: the best new books argue with the old ones and with the news. Talking them over while everyone is still reading them is half the fun." },
];

// the kinds of book the books page has a shelf of popular ones for, in its order: the API's
// (api/services/categories.py), which says which each book is
export const CATEGORIES = [
  { id: "classics", label: "Classics" },
  { id: "thrillers", label: "Thrillers & mystery" },
  { id: "fantasy", label: "Fantasy & science fiction" },
  { id: "romance", label: "Romance" },
  { id: "history", label: "History" },
  { id: "biography", label: "Biography & memoir" },
  { id: "sports", label: "Sports" },
  { id: "philosophy", label: "Philosophy" },
  { id: "self-help", label: "Self-help & business" },
];

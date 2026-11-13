// A short film of the tag search, for the landing page: someone types a few letters, the matching tags
// show up, they pick one, it lands in the bar as a chip, they narrow it down with a second, and the
// tracks they found appear underneath. Then the bar empties and the next search starts, over and
// over, in Bootstrap's secondary grey, so it stands apart from the blue buttons under it. The bar is
// the real search's field; the suggestions and results share one slim line under it instead of the
// real dropdown, so the demo takes little room. Nothing in it can be clicked: it only shows how the
// search on the tracks page works. With reduced motion the finished first search shows, standing
// still. It plays as soon as the page shows, without waiting for the API: its tracks and tags are its
// own (TRACKS below).
import { useEffect, useState } from "react";

import { plain } from "../data/books.js";
import Icon from "./Icon.jsx";
import "./TagSearch.css";
import "./TagSearchDemo.css";

// Each search, as steps: ["type", keys, tag] types the keys ("<" is a Backspace, for a typo put right)
// and picks the tag from the suggestions; ["pick", tag] picks it straight from the list, without
// typing; ["back"] takes the last chip off again, someone changing their mind. They use one, two or
// three tags. The first plays first; the others come in a new order every round.
const SEARCHES = [
  [["type", "fra", "france"], ["type", "nov", "novels"], ["type", "cla", "classics"]],
  [["type", "cyc", "cycling"], ["type", "dop", "doping"]],
  [["type", "his", "history"], ["type", "col", "cold war"]],
  [["type", "foo", "food"], ["type", "coo", "cooking"], ["back"], ["type", "mem", "memoir"]],
  [["type", "box", "boxing"]],
  [["type", "art", "art"], ["pick", "netherlands"]],
  [["type", "nat", "nature"], ["type", "bir", "birds"]],
  [["type", "sprot<<<ort", "sport"], ["type", "foo", "football"]],
  [["type", "dut", "dutch canon"], ["type", "gol", "golden age"]],
  [["type", "mus", "music"], ["type", "roc", "rock"]],
  [["type", "eur", "europe"], ["pick", "politics"]],
  [["type", "cli", "climate change"]],
  [["type", "pol", "politics"]],
];

// the first search, then the rest shuffled, a new order each round
function* rounds() {
  for (;;) {
    const rest = SEARCHES.slice(1);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    yield* [SEARCHES[0], ...rest];
  }
}

// Our tracks and their tags, as the site had them in November 2026: a snapshot, so the film plays
// straight away, and the same everywhere, an empty local database included. Its
// searches only need the tags in it, and how the tracks share them.
const TRACKS = [
  { title: "Behind the riots in France", tags: ["france", "politics", "colonialism", "algeria", "immigration", "banlieue", "riots", "novels", "non-fiction"] },
  { title: "The European Union", tags: ["european union", "europe", "politics", "brexit", "economics", "history"] },
  { title: "Israel and Palestine", tags: ["israel", "palestine", "middle east", "politics", "conflict", "history", "memoir", "gaza"] },
  { title: "The climate crisis", tags: ["climate change", "environment", "science", "politics", "novels", "nature"] },
  { title: "The Dutch canon in ten books", tags: ["netherlands", "dutch canon", "history", "classics"] },
  { title: "The Dutch canon: Romans to the Revolt", tags: ["netherlands", "dutch canon", "history", "middle ages", "renaissance", "dutch revolt"] },
  { title: "The Dutch canon: the Golden Age", tags: ["netherlands", "dutch canon", "history", "golden age", "17th century", "colonialism", "art"] },
  { title: "The Dutch canon: Republic to kingdom", tags: ["netherlands", "dutch canon", "history", "19th century", "colonialism", "novels"] },
  { title: "The Dutch canon: since 1940", tags: ["netherlands", "dutch canon", "history", "second world war", "20th century", "europe"] },
  { title: "The French Revolution", tags: ["france", "history", "revolution", "18th century", "politics", "novels", "philosophy"] },
  { title: "The Cold War", tags: ["history", "cold war", "20th century", "politics", "spies", "russia", "germany", "usa", "novels"] },
  { title: "The ancient world", tags: ["classics", "ancient greece", "ancient rome", "poetry", "philosophy", "mythology"] },
  { title: "The great Russians", tags: ["classics", "russia", "novels", "19th century"] },
  { title: "The English novel", tags: ["classics", "britain", "novels", "18th century", "19th century", "20th century"] },
  { title: "Paris and the French novel", tags: ["classics", "france", "paris", "novels", "19th century"] },
  { title: "The American novel", tags: ["classics", "usa", "novels", "19th century", "20th century"] },
  { title: "Modernism", tags: ["classics", "modernism", "novels", "20th century", "europe"] },
  { title: "Beyond Europe", tags: ["classics", "novels", "world literature", "japan", "china", "latin america", "africa", "india"] },
  { title: "Crime and mystery", tags: ["crime", "detective", "thriller", "mystery", "novels"] },
  { title: "Worlds gone wrong", tags: ["dystopia", "science fiction", "novels", "politics"] },
  { title: "Football", tags: ["football", "sport", "fans", "netherlands", "memoir"] },
  { title: "The Tour de France", tags: ["cycling", "tour de france", "sport", "france", "doping", "memoir"] },
  { title: "Amateur boxing", tags: ["boxing", "sport", "training", "memoir", "usa"] },
  { title: "Running, riding, climbing", tags: ["sport", "running", "cycling", "mountaineering", "tennis", "rowing", "memoir"] },
  { title: "Looking at art", tags: ["art", "painting", "art history", "novels", "netherlands"] },
  { title: "Modern art", tags: ["art", "modern art", "painting", "art history", "20th century"] },
  { title: "Music", tags: ["music", "classical music", "rock", "memoir", "novels"] },
  { title: "Journeys", tags: ["travel", "travel writing", "hiking", "memoir", "usa"] },
  { title: "Food and cooking", tags: ["food", "cooking", "recipes", "france", "memoir"] },
  { title: "Nature writing", tags: ["nature", "birds", "trees", "environment", "memoir"] },
  { title: "Chess", tags: ["chess", "games", "novels"] },
  { title: "Big ideas", tags: ["science", "non-fiction", "evolution", "psychology", "history", "ideas"] },
  { title: "The 21st century so far", tags: ["novels", "contemporary fiction", "21st century"] },
];
const TAGS = [...new Set(TRACKS.flatMap((t) => t.tags))];

const SHOWN = 3; // suggestions at a time, side by side

const tracksWith = (selected) => TRACKS.filter((t) => selected.every((tag) => t.tags.includes(tag)));

// the suggestions the real search would show: tags still found among the tracks left, the ones
// starting with what's typed first, the most used first
function suggest(selected, text) {
  const count = {};
  for (const t of tracksWith(selected)) for (const tag of t.tags) count[tag] = (count[tag] ?? 0) + 1;
  const query = plain(text).toLowerCase();
  return TAGS.filter((tag) => count[tag] && !selected.includes(tag) && plain(tag).includes(query))
    .map((tag) => ({ tag, count: count[tag] }))
    .sort((a, b) => plain(b.tag).startsWith(query) - plain(a.tag).startsWith(query) || b.count - a.count)
    .slice(0, SHOWN);
}

const START = { selected: [], text: "", open: false, active: 0, pressed: false, typing: false, results: null, hit: 0 };

// the first search's tags, and the search finished: what shows when motion is reduced
const EXAMPLE = SEARCHES[0].map(([, , tag]) => tag);
const finished = () => ({ ...START, selected: EXAMPLE, results: tracksWith(EXAMPLE) });

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// a person's typing: fast and a little uneven
const keystroke = () => 25 + Math.random() * 30 + (Math.random() < 0.12 ? 45 : 0);

export default function TagSearchDemo() {
  const [state, setState] = useState(START);

  useEffect(() => {
    if (reducedMotion()) {
      setState(finished());
      return undefined;
    }
    let stopped = false;
    const timers = new Set();
    const wait = (ms) =>
      new Promise((resolve) => {
        const timer = setTimeout(() => {
          timers.delete(timer);
          resolve();
        }, ms);
        timers.add(timer);
      });
    const set = (changes) => !stopped && setState((s) => ({ ...s, ...changes }));

    // the keys, one by one, with the suggestions opening at the first one; "<" deletes one
    async function typeKeys(keys, text) {
      for (const key of keys) {
        text = key === "<" ? text.slice(0, -1) : text + key;
        set({ text, open: true, active: 0, typing: true });
        await wait(key === "<" ? 45 : keystroke());
      }
      set({ typing: false });
      return text;
    }

    // down the suggestions to the tag, "click" it, and the chip lands in the bar with a pulse
    async function choose(selected, text, tag) {
      let target = suggest(selected, text).findIndex((s) => s.tag === tag);
      // not among the suggestions shown: type its first letters to bring it up
      if (target < 0) {
        text = await typeKeys(tag.slice(0, 3), text);
        await wait(110);
        target = suggest(selected, text).findIndex((s) => s.tag === tag);
      }
      for (let i = 1; i <= target; i++) {
        set({ active: i });
        await wait(120);
      }
      set({ pressed: true });
      await wait(60);
      set({ selected: [...selected, tag], text: "", active: 0, pressed: false, hit: Date.now() });
      await wait(220);
      return [...selected, tag];
    }

    async function play(search) {
      let selected = [];
      await wait(150);
      for (const [action, a, b] of search) {
        if (action === "type") {
          const text = await typeKeys(a, "");
          await wait(110);
          selected = await choose(selected, text, b);
        } else if (action === "pick") {
          // a look at the list first, then straight to the tag
          set({ open: true });
          await wait(200);
          selected = await choose(selected, "", a);
        } else {
          await wait(160);
          selected = selected.slice(0, -1);
          set({ selected });
          await wait(200);
        }
      }
      // done: the list closes and the tracks found show underneath
      set({ open: false, results: tracksWith(selected), hit: Date.now() });
      await wait(1300);
      set({ results: null });
      await wait(80);
      // the chips come off again, one Backspace at a time
      while (selected.length) {
        selected = selected.slice(0, -1);
        set({ selected });
        await wait(60);
      }
    }

    (async () => {
      for (const search of rounds()) {
        if (stopped) break;
        await play(search);
      }
    })();
    return () => {
      stopped = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  const { selected, text, open, active, pressed, typing, results, hit } = state;
  const suggestions = open ? suggest(selected, text) : [];

  return (
    // as wide as the text above and the buttons below, so their edges line up
    <div className="tag-demo text-start mb-3">
      <p className="visually-hidden">
        An example of the search on the tracks page: typing shows matching tags, and picking{" "}
        {EXAMPLE.join(" and ")} finds {tracksWith(EXAMPLE).length === 1 ? "a track" : `${tracksWith(EXAMPLE).length} tracks`}.
      </p>
      <div aria-hidden="true">
        {/* the bar, as the real one looks while in use, always one line high so nothing below jumps */}
        <div className="tag-search form-control rounded-pill position-relative d-flex flex-nowrap align-items-center gap-2 py-2 px-3 shadow-sm">
          {/* a ring that flashes out from the field each time a tag lands or tracks are found */}
          {hit > 0 && <span key={hit} className="tag-demo-pulse rounded-pill" />}
          <Icon name="search" className="text-body-secondary flex-shrink-0" />
          {selected.map((tag) => (
            <span key={tag} className="tag-demo-chip badge rounded-pill d-inline-flex align-items-center gap-1 fw-medium fs-6 flex-shrink-0">
              {tag}
              <span className="btn-close btn-close-white ms-1" style={{ fontSize: "0.55rem" }} />
            </span>
          ))}
          <span className="flex-grow-1 text-truncate" style={{ minWidth: 0 }}>
            {text}
            <span className={`tag-demo-caret ${typing ? "is-typing" : ""}`} />
            {!text && <span className="text-body-secondary">{selected.length ? "Add another tag" : "Search tags"}</span>}
          </span>
        </div>

        {/* one slim line close under the bar, always the same height: the suggestions while typing, the
            tracks found at the end */}
        <div className="tag-demo-line d-flex align-items-center gap-2 px-3 mt-1 overflow-hidden text-nowrap">
          {suggestions.length > 0 && (
            <div key={`${selected.length}-${text ? "typing" : "narrow"}`} className="tag-demo-panel d-flex align-items-center gap-2">
              {suggestions.map(({ tag, count }, i) => (
                <span
                  key={tag}
                  className={`badge rounded-pill fw-medium ${i === active ? "is-active" : "text-bg-light border text-body"} ${i === active && pressed ? "is-pressed" : ""}`}
                  // one after the other, quickly
                  style={{ animationDelay: `${i * 45}ms` }}
                >
                  {tag} <span className="opacity-75 fw-normal">{count}</span>
                </span>
              ))}
            </div>
          )}
          {results && (
            <div className="tag-demo-results d-flex align-items-center gap-2 small text-truncate">
              <Icon name="arrow-right" className="tag-demo-arrow flex-shrink-0" />
              <span className="tag-demo-count fw-semibold flex-shrink-0">
                {results.length} {results.length === 1 ? "track" : "tracks"}:
              </span>
              <span className="text-body-secondary text-truncate">{results.map((t) => t.title).join(", ")}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

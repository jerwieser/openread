// One search bar for finding tracks by their tags, like picking topics on Reddit: typing pops up the
// matching tags with how many tracks have each; choosing one puts it in the bar as a chip, and more
// can be added. The arrow keys move through the suggestions, Enter picks one, Backspace in an empty
// bar takes the last chip off again and Escape closes the list. Whatever is typed without picking a
// tag stays as plain text, which the page searches too. onChange(tags, text) gets both at once, the
// typed text used up when a tag is picked, so the page can store them in one go.
import { useId, useRef, useState } from "react";

import { plain } from "../data/books.js";
import Icon from "./Icon.jsx";
import "./TagSearch.css";

const SHOWN = 8; // suggestions at a time

export default function TagSearch({ id, tags, selected, onChange, text, onText, placeholder = "Search tags", autoFocus = false }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef(null);
  const list = useId();

  const query = plain(text).toLowerCase().trim();
  // tags that start with what's typed first, then those that contain it; the most used first in each
  const suggestions = tags
    .filter(({ tag }) => !selected.includes(tag) && (!query || plain(tag).includes(query)))
    .sort((a, b) => (query ? plain(b.tag).startsWith(query) - plain(a.tag).startsWith(query) : 0))
    .slice(0, SHOWN);
  const showList = open && suggestions.length > 0;

  function add(tag) {
    onChange([...selected, tag], "");
    setActive(0);
    input.current.focus();
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown" && suggestions.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && suggestions.length) {
      e.preventDefault();
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" && showList && query) {
      e.preventDefault();
      add(suggestions[active].tag);
    } else if (e.key === "Backspace" && !text && selected.length) {
      onChange(selected.slice(0, -1), text);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="position-relative">
      {/* the field: a search icon, the chosen tags as chips, and the input */}
      <div className="tag-search form-control form-control-lg rounded-pill d-flex flex-wrap align-items-center gap-2 py-2 px-4" onClick={() => input.current.focus()}>
        <Icon name="search" className="text-body-secondary flex-shrink-0" />
        {selected.map((tag) => (
          <span key={tag} className="badge rounded-pill text-bg-primary d-inline-flex align-items-center gap-1 fw-medium fs-6">
            {tag}
            <button
              type="button"
              className="btn-close btn-close-white ms-1"
              style={{ fontSize: "0.55rem" }}
              aria-label={`Remove ${tag}`}
              onClick={(e) => {
                e.stopPropagation();
                onChange(selected.filter((t) => t !== tag), text);
              }}
            />
          </span>
        ))}
        <input
          ref={input}
          id={id}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={list}
          aria-activedescendant={showList ? `${list}-${active}` : undefined}
          aria-label={id ? undefined : placeholder}
          className="border-0 bg-transparent flex-grow-1 p-0"
          placeholder={selected.length ? "Add another tag" : placeholder}
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => {
            onText(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          // after a click on a suggestion has had its turn
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
        />
      </div>

      {/* the suggestions: Bootstrap's dropdown menu, the full width of the field */}
      {showList && (
        <ul id={list} role="listbox" className="dropdown-menu show w-100 shadow-sm mt-1 rounded-4 overflow-hidden" aria-label="Tags">
          {!query && <li className="dropdown-header">{selected.length ? "Narrow it down" : "Popular tags"}</li>}
          {suggestions.map(({ tag, count }, i) => (
            <li key={tag} id={`${list}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                className={`dropdown-item d-flex justify-content-between align-items-center ${i === active ? "active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(tag)}
              >
                <span>{tag}</span>
                <span className={`small ${i === active ? "" : "text-body-secondary"}`}>
                  {count} {count === 1 ? "track" : "tracks"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

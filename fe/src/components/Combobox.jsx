import { useId, useState } from "react";
import { Form } from "react-bootstrap";

// A text field with a list of choices under it while the reader types, the ARIA combobox pattern:
// the arrow keys move through the choices, Enter takes one, Escape closes the list, and typing on
// is always allowed. Choices come in groups ({ label, options: [{ key, label, content, onChoose }] }),
// each option with its text for screen readers (label) and what it shows (content). The first choice
// is the active one, so Enter takes it. children: anything in the field's box before the input, like
// the authors already chosen. It looks like Bootstrap's select, chevron and all, so it reads as a
// field with choices, and a click opens the list.
export default function Combobox({ value, onChange, groups, children, onKeyDown, onBlur, className = "", ...inputProps }) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const options = groups.flatMap((g) => g.options);
  const shown = open && options.length > 0;
  const current = Math.min(active, options.length - 1);

  function choose(option) {
    option.onChoose();
    setOpen(false);
    setActive(0);
  }

  function keyDown(e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!shown) return setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((current + step + options.length) % options.length);
    } else if (e.key === "Enter" && shown) {
      e.preventDefault();
      choose(options[current]);
    } else if (e.key === "Escape" && shown) {
      e.preventDefault();
      setOpen(false);
    } else {
      onKeyDown?.(e);
    }
  }

  let index = -1;
  return (
    <div className="position-relative">
      <div className={children ? `form-select d-flex flex-wrap align-items-center gap-1 py-1 ${className}` : ""}>
        {children}
        <Form.Control
          {...inputProps}
          // a select's look on a text field: Bootstrap's chevron, and its focus and invalid states
          bsPrefix={children ? "form-control" : "form-select"}
          className={children ? "border-0 shadow-none p-1 flex-grow-1 w-auto bg-transparent" : className}
          style={children ? { minWidth: "10rem" } : undefined}
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={shown}
          aria-controls={listId}
          aria-activedescendant={shown ? `${listId}-${current}` : undefined}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={(e) => {
            setOpen(false);
            onBlur?.(e);
          }}
          onKeyDown={keyDown}
        />
      </div>
      {shown && (
        <ul id={listId} role="listbox" className="dropdown-menu show w-100 shadow mt-1 py-1" style={{ maxHeight: "24rem", overflowY: "auto" }}>
          {groups.map(
            (group) =>
              group.options.length > 0 && (
                <li key={group.label ?? "choices"} role="presentation">
                  {group.label && <div className="dropdown-header small text-uppercase">{group.label}</div>}
                  <ul role="group" aria-label={group.label} className="list-unstyled">
                    {group.options.map((option) => {
                      index += 1;
                      const i = index;
                      return (
                        <li
                          key={option.key}
                          id={`${listId}-${i}`}
                          role="option"
                          aria-selected={i === current}
                          aria-label={option.label}
                          className={`dropdown-item text-wrap ${i === current ? "active" : ""}`}
                          style={{ cursor: "pointer" }}
                          // keeps the focus in the field, so the list doesn't close before the click lands
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setActive(i)}
                          onClick={() => choose(option)}
                        >
                          {option.content}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ),
          )}
        </ul>
      )}
    </div>
  );
}

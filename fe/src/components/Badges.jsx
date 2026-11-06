import { Badge } from "react-bootstrap";

import { eraById } from "../data/books.js";
import { DIFFICULTY } from "../data/catalogue.js";
import Icon from "./Icon.jsx";

// a signal-strength meter for how hard a book is
const DIFFICULTY_ICON = { approachable: "reception-1", challenging: "reception-3", demanding: "reception-4" };

// Bootstrap's subtle badges: a pale background with matching dark text, optionally with an icon
export function SubtleBadge({ tone = "secondary", icon, className = "", children, ...props }) {
  return (
    <Badge bg={`${tone}-subtle`} text={`${tone}-emphasis`} className={`fw-medium ${className}`} {...props}>
      {icon && <Icon name={icon} className="me-1" />}
      {children}
    </Badge>
  );
}

// the meter, in the difficulty's colour. On lists it's just the meter, its name on hover like the
// bookmark's; a book's own page has the room to spell it out (labelled). Books we haven't rated (from
// Open Library) have none, and show nothing.
export function DifficultyBadge({ level, labelled = false }) {
  const d = DIFFICULTY[level];
  if (!d) return null;
  if (labelled) return <SubtleBadge tone={d.tone} icon={DIFFICULTY_ICON[level]}>{d.label}</SubtleBadge>;
  return (
    <SubtleBadge tone={d.tone} title={d.label}>
      <Icon name={DIFFICULTY_ICON[level]} label={d.label} />
    </SubtleBadge>
  );
}

export function EraBadge({ era }) {
  if (!era) return null;
  return <SubtleBadge>{eraById(era).label}</SubtleBadge>;
}

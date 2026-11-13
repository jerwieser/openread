// The small pieces Discover's views share: a section's title row, the topic chips and a row of track
// cards.
import { Badge, Button, Col, Row } from "react-bootstrap";

import Icon from "../../components/Icon.jsx";
import { GridPlaceholder, Loader, TrackCardPlaceholder } from "../../components/Loading.jsx";
import TrackCard from "../../components/TrackCard.jsx";
import { BOOK_GRID, TRACK_GRID } from "../../components/grids.js";
import { toneOf } from "./discover.js";

// A section's title on the left, with its icon in a coloured circle and how many there are, and its
// "See all" (or another action) on the right: quicker to scan down than the big centred headers the
// other pages have, which suits a page of many short sections
export function SectionTitle({ icon, tone = "primary", title, count, action, children, id }) {
  return (
    <div className="d-flex align-items-center gap-3 mb-3" id={id}>
      <span className={`discover-section-icon bg-${tone}-subtle text-${tone}-emphasis`} aria-hidden="true">
        <Icon name={icon} />
      </span>
      <div className="flex-grow-1 min-w-0">
        <h2 className="h5 fw-bold text-body-emphasis mb-0 d-flex align-items-center gap-2">
          {title}
          {count != null && (
            <Badge pill bg="body-secondary" text="body-secondary" className="fw-medium border">
              {count}
            </Badge>
          )}
        </h2>
        {children && <p className="small text-body-secondary mb-0">{children}</p>}
      </div>
      {action && <div className="flex-shrink-0 align-self-start align-self-sm-center">{action}</div>}
    </div>
  );
}

// "See all 12 →": a button, since it changes the view rather than going anywhere
export function SeeAllButton({ onClick, children }) {
  return (
    <Button variant="link" className="icon-link icon-link-hover fw-medium text-decoration-none p-0" onClick={onClick}>
      {children}
      <Icon name="arrow-right" />
    </Button>
  );
}

// A topic as a chip in its colour: pressed when it's one of the filters, with how many tracks have it
// when that's known, and a cross to take it off again when it's picked
export function TopicChip({ topic, picked = false, onClick, className = "" }) {
  const tone = toneOf(topic.id);
  return (
    <button
      type="button"
      className={`discover-chip btn btn-sm rounded-pill ${className} ${picked ? `btn-${tone} picked` : `bg-${tone}-subtle text-${tone}-emphasis border-${tone}-subtle`}`}
      aria-pressed={picked}
      onClick={onClick}
    >
      {topic.kind === "category" && <Icon name="bookmarks" className="me-1" />}
      {topic.label}
      {topic.count != null && !picked && <span className="discover-chip-count">{topic.count}</span>}
      {picked && <Icon name="x-lg" className="ms-1" label={`Remove ${topic.label}`} />}
    </button>
  );
}

// Discover's grids start on the left, under its section titles, rather than centred as on the other
// pages, so one or two results sit where the eye already is
export const TRACKS = { ...TRACK_GRID, className: "g-4" };
export const BOOKS = { ...BOOK_GRID, className: "" };

// a row of track cards, each with an optional line above it saying why it's there
export function TrackRow({ tracks, why }) {
  return (
    <Loader fallback={<GridPlaceholder Item={TrackCardPlaceholder} count={tracks.length} {...TRACKS} />}>
      <Row {...TRACKS}>
        {tracks.map((t) => (
          <Col key={t.id} className="d-flex flex-column">
            {why && <p className="small text-body-secondary mb-2 text-truncate">{why(t)}</p>}
            <div className="flex-grow-1">
              <TrackCard track={t} />
            </div>
          </Col>
        ))}
      </Row>
    </Loader>
  );
}

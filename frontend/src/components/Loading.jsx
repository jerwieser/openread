// Loading: the data is all there once the site has opened (store.js), but each page's code is fetched
// only when it's first opened (lazyPage), and so are a few big parts of pages. Meanwhile they show
// what fits them:
// - a spinner where the shape of what's coming isn't known: a whole page, a dialog;
// - Bootstrap's placeholders, the size and shape of the cards to come, for lists of cards and rows,
//   so the page doesn't jump when they arrive.
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Button, Card, Col, Ratio, Row, Spinner } from "react-bootstrap";

// a page whose code is fetched when it's first opened
export const lazyPage = lazy;

// a spinner in the middle of the space a page or a dialog will fill
export function LoadingSpinner({ label = "Loading…", minHeight = "50vh" }) {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center gap-3 text-body-secondary" style={{ minHeight }}>
      <Spinner animation="border" variant="primary" role="status">
        <span className="visually-hidden">{label}</span>
      </Spinner>
    </div>
  );
}

// A section of a page: shows `fallback` while a part of it that's fetched when needed arrives
export function Loader({ fallback, children }) {
  return (
    <Suspense
      fallback={
        <div aria-busy="true" aria-label="Loading">
          {fallback}
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

// Bootstrap placeholder text: a grey bar of a given width (in columns of 12), glowing while it waits
const Bar = ({ cols, size = "", className = "" }) => <span className={`placeholder col-${cols} ${size && `placeholder-${size}`} ${className}`} />;

export function BookCardPlaceholder() {
  return (
    <div className="placeholder-glow">
      <Ratio aspectRatio={150} className="rounded bg-body-secondary">
        <div />
      </Ratio>
      <div className="pt-3">
        <Bar cols={10} className="d-block mb-2" />
        <Bar cols={7} size="sm" className="d-block mb-2" />
        <Bar cols={5} size="sm" className="d-block" />
      </div>
    </div>
  );
}

export function TrackCardPlaceholder() {
  return (
    <Card className="h-100 rounded-4 overflow-hidden placeholder-glow">
      <div className="placeholder w-100 bg-body-secondary" style={{ height: 144 }} />
      <Card.Body className="p-3">
        <Bar cols={4} size="sm" className="d-block mb-2" />
        <Bar cols={8} className="d-block mb-2" />
        <Bar cols={11} size="sm" className="d-block mb-3" />
        <Bar cols={3} size="sm" className="d-block" />
      </Card.Body>
    </Card>
  );
}

export function ItemCardPlaceholder() {
  return (
    <Card className="h-100 shadow-sm placeholder-glow">
      <Card.Body className="d-flex gap-3">
        <span className="placeholder rounded-3 flex-shrink-0" style={{ width: 64, height: 76 }} />
        <div className="flex-grow-1">
          <Bar cols={4} size="sm" className="d-block mb-2" />
          <Bar cols={9} className="d-block mb-2" />
          <Bar cols={7} size="sm" className="d-block mb-3" />
          <Bar cols={5} size="sm" className="d-block" />
        </div>
      </Card.Body>
    </Card>
  );
}

export function ReflectionCardPlaceholder() {
  return (
    <Card className="h-100 rounded-4 overflow-hidden shadow-sm placeholder-glow">
      <div className="placeholder w-100 bg-secondary" style={{ height: "9rem" }} />
      <Card.Body className="p-4">
        <Bar cols={12} className="d-block mb-2" />
        <Bar cols={11} className="d-block mb-2" />
        <Bar cols={8} className="d-block mb-4" />
        <Bar cols={5} size="sm" className="d-block" />
      </Card.Body>
    </Card>
  );
}

export function ReaderCardPlaceholder() {
  return (
    <Card className="h-100 shadow-sm placeholder-glow">
      <Card.Body>
        <div className="d-flex align-items-center gap-3 mb-3">
          <span className="placeholder rounded-circle flex-shrink-0" style={{ width: 56, height: 56 }} />
          <div className="flex-grow-1">
            <Bar cols={7} className="d-block mb-2" />
            <Bar cols={9} size="sm" className="d-block" />
          </div>
        </div>
        <Bar cols={12} size="sm" className="d-block mb-2" />
        <Bar cols={10} size="sm" className="d-block mb-3" />
        <Bar cols={4} size="sm" className="d-block" />
      </Card.Body>
    </Card>
  );
}

// the grey filter bar above a list, with its fields (their widths at lg), the difficulty buttons when
// there are any, and the count under it
export function FilterBarPlaceholder({ fields = [4, 3, 2, 3], buttons = true }) {
  return (
    <div className="placeholder-glow mb-4" aria-hidden="true">
      <Card body className="bg-body-tertiary mb-4">
        <Row className="g-3">
          {fields.map((lg, i) => (
            <Col key={i} lg={lg}>
              <Bar cols={4} size="sm" className="d-block mb-2" />
              <span className="placeholder w-100 rounded" style={{ height: 38 }} />
            </Col>
          ))}
        </Row>
        {buttons && <Bar cols={4} className="d-block mt-3" />}
      </Card>
      <Bar cols={2} className="d-block" />
    </div>
  );
}

// rows of a list group: someone's avatar and two lines each
export function ListPlaceholder({ rows = 3, avatar = 40 }) {
  return (
    <ul className="list-group shadow-sm placeholder-glow">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="list-group-item d-flex align-items-center gap-3 py-3">
          {avatar > 0 && <span className="placeholder rounded-circle flex-shrink-0" style={{ width: avatar, height: avatar }} />}
          <div className="flex-grow-1">
            <Bar cols={5} className="d-block mb-2" />
            <Bar cols={8} size="sm" className="d-block" />
          </div>
        </li>
      ))}
    </ul>
  );
}

// a grid of card placeholders, laid out like the grid that replaces it: pass the same Row props
export function GridPlaceholder({ Item, count, ...rowProps }) {
  return (
    <Row {...rowProps}>
      {Array.from({ length: count }, (_, i) => (
        <Col key={i}>
          <Item />
        </Col>
      ))}
    </Row>
  );
}

// A grid that shows its items a batch at a time, so a long list doesn't draw hundreds of cards at
// once, and shows the next batch as the reader scrolls near its end. The "Show more" button at the
// end is what's watched, and works by keyboard too. Give it a new key to start over (when the filters
// change, say). counted={false} leaves out how many there are. rowProps are the Row's, as for
// GridPlaceholder.
export function ScrollGrid({ items, batch = 24, render, label = "items", counted = true, ...rowProps }) {
  const [count, setCount] = useState(batch);
  const end = useRef(null);
  const more = items.length - count;

  function loadMore() {
    if (more > 0) setCount((c) => c + batch);
  }

  // watched afresh after every render, so a tall screen that still shows the end keeps going
  useEffect(() => {
    if (more <= 0 || !end.current || !("IntersectionObserver" in window)) return undefined;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && loadMore(), { rootMargin: "400px 0px" });
    observer.observe(end.current);
    return () => observer.disconnect();
  });

  return (
    <>
      <Row {...rowProps}>
        {items.slice(0, count).map((item) => (
          <Col key={item.key ?? item.slug ?? item.id}>{render(item)}</Col>
        ))}
      </Row>
      <div className="text-center mt-5" ref={end}>
        {counted && (
          <p className="small text-body-secondary mb-2" aria-live="polite">
            Showing {Math.min(count, items.length)} of {items.length} {label}
          </p>
        )}
        {more > 0 && (
          <Button variant="outline-primary" onClick={loadMore}>
            Show more
          </Button>
        )}
      </div>
    </>
  );
}

// ScrollGrid for a list too long to have at once: it asks for the next page (onMore) as the reader
// scrolls near its end, until there are no more (done)
export function PagedGrid({ items, done, onMore, render, ...rowProps }) {
  const end = useRef(null);

  // watched afresh after every render, so a tall screen that still shows the end keeps going
  useEffect(() => {
    if (done || !end.current || !("IntersectionObserver" in window)) return undefined;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && onMore(), { rootMargin: "400px 0px" });
    observer.observe(end.current);
    return () => observer.disconnect();
  });

  return (
    <>
      <Row {...rowProps}>
        {items.map((item) => (
          <Col key={item.key ?? item.slug ?? item.id}>{render(item)}</Col>
        ))}
      </Row>
      <div className="text-center mt-5" ref={end}>
        {!done && (
          <Button variant="outline-primary" onClick={onMore}>
            Show more
          </Button>
        )}
      </div>
    </>
  );
}

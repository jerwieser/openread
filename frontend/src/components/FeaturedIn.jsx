import { Col, Row } from "react-bootstrap";

import { SectionHeader } from "./PageHeader.jsx";

// "As featured in": a tile per place that has featured OpenRead, for a band on the home page. Only
// Product Hunt so far; add others here as they come. The logo is drawn in the style of Product
// Hunt's own, in its colours, not its official logo file.

// Product Hunt's orange circle with a white "P"
function ProductHuntMark() {
  return (
    <svg viewBox="0 0 40 40" width="1.45em" height="1.45em" aria-hidden="true" focusable="false">
      <circle cx="20" cy="20" r="20" fill="#DA552F" />
      <path d="M15 11h8.5a6.25 6.25 0 0 1 0 12.5H19V29h-4ZM19 15v4.5h4.5a2.25 2.25 0 0 0 0-4.5Z" fill="#fff" fillRule="evenodd" />
    </svg>
  );
}

// each logo, and its size as a share of its tile's width (cqw): about half the tile
const LOGOS = [
  {
    name: "Product Hunt",
    size: 6,
    logo: (
      <span className="d-inline-flex align-items-center" style={{ gap: "0.35em", fontWeight: 700, letterSpacing: "-0.02em", color: "#21293C" }}>
        <ProductHuntMark />
        Product Hunt
      </span>
    ),
  },
];

// The title and a tile per place; the home page puts them in one of its sections
export default function FeaturedIn() {
  return (
    <>
      <SectionHeader title="As featured in">Where OpenRead has been featured.</SectionHeader>
      <Row xs={1} sm={2} md={3} className="g-3 g-lg-4 justify-content-center">
        {LOGOS.map(({ name, size, logo }) => (
          <Col key={name}>
            {/* the tile is a size container, so each logo scales with the tile's width */}
            <div
              className="h-100 bg-body border rounded-4 shadow-sm d-flex align-items-center justify-content-center px-3"
              style={{ minHeight: 96, containerType: "inline-size" }}
            >
              <div role="img" aria-label={name} className="text-nowrap lh-1" style={{ fontSize: `${size}cqw` }}>
                {logo}
              </div>
            </div>
          </Col>
        ))}
      </Row>
    </>
  );
}

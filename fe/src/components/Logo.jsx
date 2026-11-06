import { useId } from "react";

// OpenRead's mark: a reading track, after the home page's picture. A blue line starts from a dot at the
// bottom right and winds up in three rows to a coral flag at the top left, with six books standing
// along it as in the full logo: three on the bottom row, two on the middle one and one past the flag.
// Drawn on a 32 × 32 grid; the same drawing is the browser-tab icon (public/favicon.svg).
function Mark() {
  return (
    <>
      <rect x="11" y="20.9" width="3.2" height="4.9" rx="0.8" fill="#e8705a" />
      <rect x="15.2" y="20.2" width="3.2" height="5.6" rx="0.8" fill="#2b3a67" />
      <rect x="19.4" y="21.3" width="3.2" height="4.5" rx="0.8" fill="#f2b84b" />
      <rect x="12.2" y="12.2" width="3.2" height="4.5" rx="0.8" fill="#2f9e7a" />
      <rect x="16.4" y="11.3" width="3.2" height="5.4" rx="0.8" fill="#e8705a" />
      <rect x="19.6" y="2.9" width="3.2" height="4.7" rx="0.8" fill="#2b3a67" />
      <path
        d="M28 27.3H8.5A4.55 4.55 0 0 1 8.5 18.2H23A4.55 4.55 0 0 0 23 9.1H10.5"
        fill="none"
        stroke="#0d6efd"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="28" cy="27.3" r="2.4" fill="#0d6efd" />
      <line x1="10.5" y1="9.1" x2="10.5" y2="2" stroke="#2b3a67" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M11.2 2.1L18 4.5L11.2 6.9Z" fill="#e8705a" />
    </>
  );
}

// The mark on its own. Decorative here: it always sits next to the name, or inside a link that says
// where it goes.
export default function Logo({ size = 32, className = "" }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      <Mark />
    </svg>
  );
}

// The full logo, for the navbar and the footer (the same drawing as public/openread-logo.svg): the
// mark (2.76 times its grid) with its top two rows a little longer, so their bend reaches into the
// "O", more books along it in its four colours, and its bottom row run out to the right under the
// name, underlining it, the start dot under the end of "Read". The line sits where a text underline
// would: its top 0.08em under the baseline, so it crosses the foot of the "p" like one. The name is
// a little smaller than the mark, so the track leads: its flag rises above the capitals. The name
// stands in front of the track, with a thin gap cut into the line around its letters (a mask, so
// the gap shows whatever is behind the logo) and its books: the track's top and middle rows run
// behind the "O"'s left side and turn inside it, so the bend shows in its open middle, and the
// underline crosses behind the foot of the "p". The other letters end above the line, gap and all.
// The name is in the page's own font (Bootstrap's), its two capitals, the "O" and the "R", bigger
// than the other letters (80 and 64); "Open" in the flagpole's navy and "Read" in the track's blue;
// it says "OpenRead" to screen readers. The canvas reaches down to the underline, so the name sits
// above its middle: in a row of text, alignName moves the whole logo down by that much, so the name
// lines up with the text and the underline hangs below it.
const NAME = { fontFamily: "var(--bs-body-font-family)", fontWeight: 700, letterSpacing: "-0.02em" };
const PARTS = [
  ["O", 80, "#2b3a67"],
  ["pen", 64, "#2b3a67"],
  ["R", 80, "#0d6efd"],
  ["ead", 64, "#0d6efd"],
];

// the name, for the name itself and for the gap cut around it, which must match it
const Name = ({ coloured }) =>
  PARTS.map(([part, size, colour]) => (
    <tspan key={part} fontSize={size} fill={coloured ? colour : undefined}>
      {part}
    </tspan>
  ));

const VIEW = { top: 40, height: 84, width: 388 };
// where the name starts: the track's bend inside the "O"
const NAME_X = 55;
const NAME_MIDDLE = 76.8; // halfway up the capitals, from their top (48.4) to the baseline (105.2)

export function FullLogo({ height = 24, className = "", alignName = false }) {
  const shift = ((VIEW.top + VIEW.height / 2 - NAME_MIDDLE) * height) / VIEW.height;
  // the gap's mask's id, unique on the page (the navbar and the footer both have the logo)
  const gap = `logo-gap-${useId().replace(/[^\w-]/g, "")}`;
  return (
    <svg
      viewBox={`0 ${VIEW.top} ${VIEW.width} ${VIEW.height}`}
      height={height}
      width={(height * VIEW.width) / VIEW.height}
      className={className}
      style={alignName ? { transform: `translateY(${shift.toFixed(1)}px)` } : undefined}
      role="img"
      aria-label="OpenRead"
      focusable="false"
    >
      <mask id={gap} maskUnits="userSpaceOnUse" x="0" y={VIEW.top} width={VIEW.width} height={VIEW.height}>
        <rect x="0" y={VIEW.top} width={VIEW.width} height={VIEW.height} fill="white" />
        <text x={NAME_X} y="105.2" style={NAME} fill="black" stroke="black" strokeWidth="7" strokeLinejoin="round">
          <Name />
        </text>
      </mask>
      {/* the books, standing on each row and past the flag, and the line, behind the name */}
      <g mask={`url(#${gap})`}>
        <rect x="24" y="97.2" width="8" height="13.5" rx="1.8" fill="#e8705a" />
        <rect x="34" y="95.2" width="7.5" height="15.5" rx="1.8" fill="#2b3a67" />
        <rect x="43.5" y="98.2" width="8.5" height="12.5" rx="1.8" fill="#f2b84b" />
        <rect x="29" y="73" width="8" height="12.5" rx="1.8" fill="#2f9e7a" />
        <rect x="39" y="70.5" width="8.5" height="15" rx="1.8" fill="#e8705a" />
        <rect x="49" y="47.4" width="7.5" height="13" rx="1.8" fill="#2b3a67" />
        <path
          d="M377 114.9H18.7A12.56 12.56 0 0 1 18.7 89.7H70.7A12.56 12.56 0 0 0 70.7 64.6H24.2"
          fill="none"
          stroke="#0d6efd"
          strokeWidth="8.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <circle cx="377" cy="114.9" r="6.6" fill="#0d6efd" />
      <line x1="24.2" y1="64.6" x2="24.2" y2="45" stroke="#2b3a67" strokeWidth="4.4" strokeLinecap="round" />
      <path d="M26.2 45.3L44.9 51.9L26.2 58.5Z" fill="#e8705a" />
      <text x={NAME_X} y="105.2" style={NAME} aria-hidden="true">
        <Name coloured />
      </text>
    </svg>
  );
}

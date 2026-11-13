// The mark's colours. plain: on a light page, a blue track and navy flagpole. tile: on the site's
// primary blue (the navbar's tile, and the browser-tab icon, public/favicon.svg), the track and
// the flagpole white, and the books in light tints of the plain ones (coral, a yellow for the navy,
// amber's yellow and a mint for the green), so each stands out on the blue as the plain ones do on white.
const COLOURS = {
  plain: { track: "#0d6efd", pole: "#2b3a67", coral: "#e8705a", navy: "#2b3a67", amber: "#f2b84b", green: "#2f9e7a" },
  tile: { track: "#fff", pole: "#fff", coral: "#ffa08c", navy: "#ffe28a", amber: "#ffc94d", green: "#8ee6c0" },
};

// OpenRead's mark: a reading track, after the home page's picture. A line starts from a dot at the
// bottom right and winds up in three rows to a coral flag at the top left, with six books standing
// along it: three on the bottom row, two on the middle one and one past the flag. Drawn on a 32 × 32
// grid; the browser-tab icon (public/favicon.svg) is the same drawing on its blue tile.
function Mark({ colours: c }) {
  return (
    <>
      <rect x="11" y="20.9" width="3.2" height="4.9" rx="0.8" fill={c.coral} />
      <rect x="15.2" y="20.2" width="3.2" height="5.6" rx="0.8" fill={c.navy} />
      <rect x="19.4" y="21.3" width="3.2" height="4.5" rx="0.8" fill={c.amber} />
      <rect x="12.2" y="12.2" width="3.2" height="4.5" rx="0.8" fill={c.green} />
      <rect x="16.4" y="11.3" width="3.2" height="5.4" rx="0.8" fill={c.coral} />
      <rect x="19.6" y="2.9" width="3.2" height="4.7" rx="0.8" fill={c.navy} />
      <path
        d="M28 27.3H8.5A4.55 4.55 0 0 1 8.5 18.2H23A4.55 4.55 0 0 0 23 9.1H10.5"
        fill="none"
        stroke={c.track}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="28" cy="27.3" r="2.4" fill={c.track} />
      <line x1="10.5" y1="9.1" x2="10.5" y2="2" stroke={c.pole} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M11.2 2.1L18 4.5L11.2 6.9Z" fill={c.coral} />
    </>
  );
}

// The mark on its own. Decorative here: it always sits next to the name, or inside a link that says
// where it goes. tile: drawn for the blue tile (.site-logo) rather than a light page.
export default function Logo({ size = 32, tile = false, className = "" }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      <Mark colours={COLOURS[tile ? "tile" : "plain"]} />
    </svg>
  );
}

// The site's name beside the mark, as in the navbar (daygame.pro's lockup): the mark on a rounded
// tile of the site's primary blue (layout.css, .site-logo), then "Open" in the text's colour and
// "Read" in the primary blue (layout.css, .brand-accent).
// size: the mark's, in px; the name takes the size of the text around it.
export function Brand({ size = 24, className = "" }) {
  return (
    <span className={`d-inline-flex align-items-center gap-2 ${className}`}>
      <Logo size={size} tile className="site-logo rounded-2" />
      <span>
        Open<span className="brand-accent">Read</span>
      </span>
    </span>
  );
}

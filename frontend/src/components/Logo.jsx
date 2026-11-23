// OpenRead's mark (public/logo.png): a script O and R, white on a dark tile with rounded
// corners, the same dark as the page and the buttons. The corners outside the tile are
// transparent, so it stays rounded on the white bar. It sits beside the name in the navbar,
// the footer and the account pages, and the same picture is the browser-tab icon.
// public/logo-light.png is the mark for a light ground: the script in that dark, no tile.
export default function Logo({ size = 32, className = "" }) {
  return (
    <img
      src="/logo.png"
      alt=""
      width={size}
      height={size}
      className={className}
      draggable="false"
    />
  );
}

// The site's name beside the mark, in the same dark as the mark's tile, and bold. size: the mark's,
// in px; the name takes the size of the text around it.
export function Brand({ size = 24, className = "" }) {
  return (
    <span className={`d-inline-flex align-items-center gap-2 ${className}`}>
      <Logo size={size} />
      <span className="fw-bold text-dark">OpenRead</span>
    </span>
  );
}

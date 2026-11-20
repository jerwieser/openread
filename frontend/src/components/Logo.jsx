// OpenRead's mark, the light logo (public/logo-new-light.jpg): a black O with three books in it,
// on a white rounded tile. The same file is the browser-tab icon (index.html).
export default function Logo({ size = 32, className = "" }) {
  return (
    <img
      src="/logo-new-light.jpg"
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: "contain" }}
      aria-hidden="true"
      draggable="false"
    />
  );
}

// The site's name beside the mark: the light logo, then "Open" in the text's colour and "Read" in
// the primary blue (layout.css, .brand-accent). size: the mark's, in px; the name takes the size
// of the text around it.
export function Brand({ size = 24, className = "" }) {
  return (
    <span className={`d-inline-flex align-items-center gap-2 ${className}`}>
      <Logo size={size} />
      <span>
        Open<span className="brand-accent">Read</span>
      </span>
    </span>
  );
}

<<<<<<< HEAD
// OpenRead's mark (public/logo.png): a script O and R, white on a black tile with rounded
// corners. The corners outside the tile are transparent, so it stays rounded on the white bar.
// It sits beside the name in the navbar, the footer and the account pages, and the same
// picture is the browser-tab icon.
export default function Logo({ size = 32, className = "" }) {
  return (
    <img
      src="/logo.png"
=======
// OpenRead's mark, the light logo (public/logo-new-light.jpg): a black O with three books in it,
// on a white rounded tile. The same file is the browser-tab icon (index.html).
export default function Logo({ size = 32, className = "" }) {
  return (
    <img
      src="/logo-new-light.jpg"
>>>>>>> befb2ef961bc3f19e85e039c4eae6ab0b14dde8a
      alt=""
      width={size}
      height={size}
      className={className}
<<<<<<< HEAD
=======
      style={{ width: size, height: size, objectFit: "contain" }}
      aria-hidden="true"
>>>>>>> befb2ef961bc3f19e85e039c4eae6ab0b14dde8a
      draggable="false"
    />
  );
}

<<<<<<< HEAD
// The site's name beside the mark, in black and bold. size: the mark's, in px; the name takes the
// size of the text around it.
=======
// The site's name beside the mark: the light logo, then "Open" in the text's colour and "Read" in
// the primary blue (layout.css, .brand-accent). size: the mark's, in px; the name takes the size
// of the text around it.
>>>>>>> befb2ef961bc3f19e85e039c4eae6ab0b14dde8a
export function Brand({ size = 24, className = "" }) {
  return (
    <span className={`d-inline-flex align-items-center gap-2 ${className}`}>
      <Logo size={size} />
      <span className="fw-bold text-black">OpenRead</span>
    </span>
  );
}

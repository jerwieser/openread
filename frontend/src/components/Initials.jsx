// A reader's round avatar: the photo they uploaded, or else a badge with their first and last
// initials ("Sanne de Vries" → SV) in the primary blue. On cards, messages and the menu.
export default function Initials({ name, photo, size = 32 }) {
  if (photo) {
    return (
      <img src={photo} alt="" width={size} height={size} className="rounded-circle object-fit-cover flex-shrink-0" aria-hidden="true" />
    );
  }
  const parts = name.trim().split(/\s+/);
  const initials = (parts[0][0] + (parts.length > 1 ? parts.at(-1)[0] : "")).toUpperCase();
  return (
    <span
      className={`rounded-circle d-inline-flex align-items-center justify-content-center flex-shrink-0 fw-semibold text-bg-primary`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

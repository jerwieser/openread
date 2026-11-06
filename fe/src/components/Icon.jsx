import {
  ArrowDown, ArrowLeft, ArrowRepeat, ArrowRight, ArrowUp, Bookmark, BookmarkFill, Bookmarks, BookmarksFill, CheckCircle,
  BookmarkHeart, BookmarkHeartFill, BoxArrowInDown, BoxArrowRight, CameraVideo, ChatQuote, ChevronContract, ChevronDown, ChevronExpand, ChevronUp, Compass, CompassFill, CheckCircleFill, Clock,
  Envelope, ExclamationTriangleFill, Eyeglasses, Flag, FlagFill, GeoAlt, HourglassSplit, InfoCircle, InfoCircleFill, Instagram, Key, PauseCircle, PauseCircleFill, StopCircle, StopCircleFill, JournalX, Linkedin, People, PeopleFill, PersonCheck, PersonCircle,
  Reception1, Reception3, Reception4, Search, SignpostSplit, SkipForwardCircle, SkipForwardCircleFill, SignpostSplitFill, Sliders, Star, StarFill, StarHalf,
  Translate, TwitterX, XCircle, XCircleFill, XLg,
} from "react-bootstrap-icons";

// The Bootstrap Icons the app uses, by their official names (https://icons.getbootstrap.com).
// Importing them one by one keeps only these few in the bundle.
const ICONS = {
  "arrow-down": ArrowDown, "arrow-left": ArrowLeft, "arrow-repeat": ArrowRepeat, "arrow-right": ArrowRight,
  "arrow-up": ArrowUp, bookmark: Bookmark,
  "bookmark-fill": BookmarkFill, bookmarks: Bookmarks, "bookmarks-fill": BookmarksFill, "bookmark-heart": BookmarkHeart, "bookmark-heart-fill": BookmarkHeartFill, "box-arrow-in-down": BoxArrowInDown, "box-arrow-right": BoxArrowRight,
  "camera-video": CameraVideo, "chevron-contract": ChevronContract, "chevron-down": ChevronDown, "chevron-expand": ChevronExpand, "chevron-up": ChevronUp, compass: Compass, "compass-fill": CompassFill, "geo-alt": GeoAlt,
  "chat-quote": ChatQuote, "check-circle": CheckCircle, "check-circle-fill": CheckCircleFill, clock: Clock,
  envelope: Envelope, "exclamation-triangle-fill": ExclamationTriangleFill, eyeglasses: Eyeglasses, "eyeglasses-fill": EyeglassesFill, flag: Flag, "flag-fill": FlagFill, "hourglass-split": HourglassSplit, "info-circle": InfoCircle,
  "info-circle-fill": InfoCircleFill, instagram: Instagram, key: Key, "x-circle-fill": XCircleFill,
  "journal-x": JournalX, linkedin: Linkedin, "pause-circle": PauseCircle, "pause-circle-fill": PauseCircleFill, people: People, "people-fill": PeopleFill, "person-check": PersonCheck,
  "person-circle": PersonCircle, "reception-1": Reception1, "reception-3": Reception3, "reception-4": Reception4,
  search: Search, "signpost-split": SignpostSplit, "skip-forward-circle": SkipForwardCircle,
  "skip-forward-circle-fill": SkipForwardCircleFill, "signpost-split-fill": SignpostSplitFill, sliders: Sliders,
  star: Star, "star-fill": StarFill, "star-half": StarHalf, "stop-circle": StopCircle, "stop-circle-fill": StopCircleFill,
  translate: Translate, "twitter-x": TwitterX, "x-circle": XCircle, "x-lg": XLg,
};

// Bootstrap Icons has no solid reading glasses, so this is its eyeglasses with the lenses filled in,
// to pair with the outline like the bookmark's
function EyeglassesFill({ size, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="currentColor" viewBox="0 0 16 16" {...props}>
      <path d="M4 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4m2.625.547a3 3 0 0 0-5.584.953H.5a.5.5 0 0 0 0 1h.541A3 3 0 0 0 7 8a1 1 0 0 1 2 0 3 3 0 0 0 5.959.5h.541a.5.5 0 0 0 0-1h-.541a3 3 0 0 0-5.584-.953A2 2 0 0 0 8 6c-.532 0-1.016.208-1.375.547M14 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0" />
      <circle cx="4" cy="8" r="2.2" />
      <circle cx="12" cy="8" r="2.2" />
    </svg>
  );
}

// A Bootstrap Icon, e.g. <Icon name="bookmarks" />. Sized to the text around it unless given a size, and
// decorative by default; pass a label when the icon is the only thing saying what something is.
export default function Icon({ name, label, size = "1em", className = "" }) {
  const Svg = ICONS[name];
  if (!Svg) {
    if (import.meta.env.DEV) console.warn(`Icon "${name}" isn't in the ICONS list`);
    return null;
  }
  return (
    <Svg
      size={size}
      className={className}
      style={{ verticalAlign: "-0.125em" }}
      aria-hidden={label ? undefined : "true"}
      role={label ? "img" : undefined}
      aria-label={label}
    />
  );
}

// An icon in a soft circle, for feature lists and empty states
export function IconCircle({ name, size = 48, tone = "primary" }) {
  return (
    <span
      className={`d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0 bg-${tone}-subtle text-${tone}-emphasis`}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      <Icon name={name} />
    </span>
  );
}

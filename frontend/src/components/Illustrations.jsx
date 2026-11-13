// Flat, static illustrations drawn for the site, one per idea it explains: a large picture beside
// the home headline, a wide banner for the call to make a track and small pictures for the steps. They share one palette, so they read as a set.
// All are decorative: the text beside them says the same thing.

// The blues are the site's own (Bootstrap's primary, #0d6efd), so the pictures match the buttons, the
// logo's tile and the band the desk scene continues: the line, the shirts and the books in the
// primary blue, a shade darker for lines on it, the sky and clouds in its palest tints.
const C = {
  sky: "#e7f1ff",
  skyDeep: "var(--bs-primary-bg-subtle)",
  cream: "#fdf3e1",
  paper: "#fffaf0",
  rule: "#dccfb6",
  sun: "#ffe3a3",
  ink: "#2b3a67",
  blue: "var(--bs-primary)",
  blueDark: "#0a58ca",
  coral: "#e8705a",
  coralLight: "#f0998a",
  mustard: "#f2b84b",
  mustardLight: "#f7d184",
  green: "#2f9e7a",
  greenLight: "#5fbb98",
  red: "#d9534a",
  plum: "#7b5ea7",
  wood: "#b9805a",
  woodLight: "#cf9a73",
  // every person's face, the neutral yellow of a phone's smileys
  skin: "#ffcc4d",
  hairGrey: "#a3aabb",
  hairBrown: "#5b3a29",
};

function Art({ viewBox, className = "", style, children }) {
  return (
    <svg viewBox={viewBox} className={`d-block w-100 h-auto ${className}`} style={style} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

// a four-pointed twinkle
function Sparkle({ x, y, r, fill = C.mustard }) {
  return (
    <path
      d={`M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`}
      fill={fill}
    />
  );
}

// a book lying flat, seen from the side: cover, two spine bands and the page edges at the end
function FlatBook({ x, y, w, h, fill }) {
  const pages = Math.min(34, w * 0.25);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} fill={fill} />
      <rect x={x + 12} y={y} width={6} height={h} fill="#fff" opacity={0.22} />
      <rect x={x + 23} y={y} width={3} height={h} fill="#fff" opacity={0.22} />
      <rect x={x + w - pages - 4} y={y + 5} width={pages} height={h - 10} rx={2} fill={C.paper} />
      {[0.3, 0.5, 0.7].map((f) => (
        <line key={f} x1={x + w - pages - 1} x2={x + w - 7} y1={y + h * f} y2={y + h * f} stroke={C.rule} strokeWidth={1.5} />
      ))}
    </g>
  );
}

// a book standing on a shelf, seen by its spine
function Spine({ x, base, w, h, fill }) {
  const top = base - h;
  return (
    <g>
      <rect x={x} y={top} width={w} height={h} rx={2.5} fill={fill} />
      <rect x={x} y={top + 9} width={w} height={3} fill="#fff" opacity={0.35} />
      <rect x={x} y={base - 14} width={w} height={3} fill="#fff" opacity={0.35} />
      <rect x={x + w / 2 - 2.5} y={top + h * 0.38} width={5} height={h * 0.24} rx={2} fill="#fff" opacity={0.3} />
    </g>
  );
}

// an open book seen from slightly above; cx is the spine, top/bottom the page edges at the spine
function OpenBook({ cx, top, bottom, half, tilt, cover = C.ink, lines = 0 }) {
  const l = cx - half;
  const r = cx + half;
  const step = (bottom - top - 16) / Math.max(lines, 1);
  return (
    <g>
      <path
        d={`M${cx} ${top + 4}L${l - 6} ${top - tilt + 2}L${l - 6} ${bottom - tilt + 8}L${cx} ${bottom + 8}L${r + 6} ${bottom - tilt + 8}L${r + 6} ${top - tilt + 2}Z`}
        fill={cover}
      />
      <path d={`M${cx} ${top}L${l} ${top - tilt}L${l} ${bottom - tilt}L${cx} ${bottom}Z`} fill={C.paper} />
      <path d={`M${cx} ${top}L${r} ${top - tilt}L${r} ${bottom - tilt}L${cx} ${bottom}Z`} fill={C.paper} />
      <line x1={cx} y1={top} x2={cx} y2={bottom} stroke={C.rule} strokeWidth={2} />
      {Array.from({ length: lines }, (_, i) => {
        const y = top + 10 + i * step;
        const k = tilt / half;
        return (
          <g key={i} stroke={C.rule} strokeWidth={2} strokeLinecap="round">
            <line x1={l + 10} y1={y - tilt + 10 * k} x2={cx - 8} y2={y - 8 * k} />
            <line x1={cx + 8} y1={y - 8 * k} x2={r - 10 - (i % 3 === 2 ? 20 : 0)} y2={y - tilt + (10 + (i % 3 === 2 ? 20 : 0)) * k} />
          </g>
        );
      })}
    </g>
  );
}

// a standing figure; (x, feet) is where they stand
function Figure({ x, feet, shirt, skin = C.skin, hair, glasses = false, ponytail = false }) {
  const head = feet - 76;
  return (
    <g>
      <rect x={x - 10} y={feet - 32} width={8} height={32} rx={4} fill={C.ink} />
      <rect x={x + 2} y={feet - 32} width={8} height={32} rx={4} fill={C.ink} />
      <rect x={x - 14} y={feet - 64} width={28} height={38} rx={12} fill={shirt} />
      <circle cx={x} cy={head} r={13} fill={skin} />
      <path d={`M${x - 13} ${head - 1}A13 13 0 0 1 ${x + 13} ${head - 1}Q${x} ${head - 7} ${x - 13} ${head - 1}Z`} fill={hair} />
      {ponytail && <circle cx={x + 14} cy={head - 4} r={6} fill={hair} />}
      {glasses && (
        <g stroke={C.ink} strokeWidth={1.6} fill="none">
          <circle cx={x - 5} cy={head + 1} r={3.6} />
          <circle cx={x + 5} cy={head + 1} r={3.6} />
          <line x1={x - 1.4} y1={head + 1} x2={x + 1.4} y2={head + 1} />
        </g>
      )}
    </g>
  );
}

// a figure from the chest up, as at a table
function Bust({ x, y, size = 1, shirt, skin = C.skin, hair, glasses = false, bun = false }) {
  const s = size;
  const head = y - 30 * s;
  return (
    <g>
      <path
        d={`M${x - 40 * s} ${y + 72 * s}C${x - 40 * s} ${y + 20 * s} ${x - 22 * s} ${y} ${x} ${y}C${x + 22 * s} ${y} ${x + 40 * s} ${y + 20 * s} ${x + 40 * s} ${y + 72 * s}Z`}
        fill={shirt}
      />
      <circle cx={x} cy={head} r={24 * s} fill={skin} />
      <path
        d={`M${x - 24 * s} ${head - 2 * s}A${24 * s} ${24 * s} 0 0 1 ${x + 24 * s} ${head - 2 * s}Q${x} ${head - 14 * s} ${x - 24 * s} ${head - 2 * s}Z`}
        fill={hair}
      />
      {bun && <circle cx={x + 18 * s} cy={head - 20 * s} r={9 * s} fill={hair} />}
      {glasses && (
        <g stroke={C.ink} strokeWidth={2 * s} fill="none">
          <circle cx={x - 9 * s} cy={head + 2 * s} r={6.5 * s} />
          <circle cx={x + 9 * s} cy={head + 2 * s} r={6.5 * s} />
          <line x1={x - 2.5 * s} y1={head + 2 * s} x2={x + 2.5 * s} y2={head + 2 * s} />
        </g>
      )}
    </g>
  );
}

// A full-width, low banner. The scene is drawn 2400 wide with its subject in the middle; on
// narrower screens the sides are cropped rather than the whole thing shrinking.
function Banner({ fill, children }) {
  return (
    <svg
      viewBox="0 0 2400 320"
      preserveAspectRatio="xMidYMax slice"
      className="d-block w-100"
      style={{ height: "clamp(120px, 16vw, 240px)" }}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="2400" height="320" fill={fill} />
      {children}
    </svg>
  );
}

function Plant({ x, base }) {
  return (
    <g>
      <path d={`M${x + 15} ${base - 34}C${x - 5} ${base - 60} ${x - 2} ${base - 80} ${x + 12} ${base - 86}C${x + 16} ${base - 70} ${x + 16} ${base - 50} ${x + 15} ${base - 34}Z`} fill={C.green} />
      <path d={`M${x + 15} ${base - 34}C${x + 38} ${base - 56} ${x + 38} ${base - 74} ${x + 26} ${base - 88}C${x + 18} ${base - 70} ${x + 16} ${base - 50} ${x + 15} ${base - 34}Z`} fill={C.greenLight} />
      <path d={`M${x} ${base}H${x + 30}L${x + 34} ${base - 30}H${x - 4}Z`} fill={C.coral} />
      <rect x={x - 6} y={base - 36} width={42} height={8} rx={3} fill={C.coralLight} />
    </g>
  );
}

function Mug({ x, base, fill = C.coral }) {
  return (
    <g>
      <path d={`M${x + 46} ${base - 42}a14 14 0 0 1 0 28`} stroke={fill} strokeWidth="7" fill="none" />
      <rect x={x} y={base - 54} width={48} height={54} rx={9} fill={fill} />
      <g stroke="#fff" strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round" fill="none">
        <path d={`M${x + 16} ${base - 64}c-7-8 7-12 0-21`} />
        <path d={`M${x + 32} ${base - 64}c-7-8 7-12 0-21`} />
      </g>
    </g>
  );
}

function Cloud({ x, y, s = 1, fill = "#fff" }) {
  return (
    <g fill={fill} transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="16" cy="12" r="16" />
      <circle cx="38" cy="2" r="22" />
      <circle cx="62" cy="12" r="15" />
      <rect y="12" width="78" height="15" rx="7.5" />
    </g>
  );
}

// Home: a reading track as a path. A blue line winds up the picture, like the track on a track's own
// page, with books standing along it in order; a reader walks it with a book under one arm, from a
// signpost of tags at the start to a flag at the end. The tags are the coral of the search demo above
// the picture. It stands under the headline with no background of its own, on the white page.
export function FollowTheTrack({ className, style }) {
  // the line's three rows, from the bottom up, joined by round turns; the bottom one runs much further
  // out than the two above, and a plant stands on the ground past the turn, so the drawing stands on a
  // broad base that reaches out on both sides
  const line = "M-90 440H300A55 55 0 0 0 300 330H120A55 55 0 0 1 120 220H282";
  return (
    // the view cropped to the drawing, centred on its base
    <Art viewBox="-124 52 544 406" className={className} style={style}>
      <circle cx="300" cy="118" r="56" fill={C.sun} />
      <Cloud x={52} y={96} fill={C.skyDeep} />
      <Sparkle x={42} y={250} r={9} />
      <Sparkle x={196} y={92} r={7} fill={C.skyDeep} />
      <Sparkle x={372} y={292} r={8} />
      <ellipse cx="148" cy="450" rx="268" ry="9" fill={C.skyDeep} />
      <Plant x={372} base={446} />

      {/* the books, in order along the line, each standing on it */}
      <Spine x={58} base={435} w={20} h={50} fill={C.greenLight} />
      <Spine x={140} base={435} w={22} h={58} fill={C.coral} />
      <Spine x={222} base={435} w={18} h={48} fill={C.ink} />
      <Spine x={252} base={325} w={20} h={54} fill={C.mustard} />
      <Spine x={134} base={325} w={18} h={46} fill={C.green} />
      <Spine x={184} base={215} w={20} h={52} fill={C.plum} />

      <path d={line} fill="none" stroke={C.blue} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="-90" cy="440" r="11" fill={C.blue} />

      {/* the flag where the track ends */}
      <line x1="282" y1="216" x2="282" y2="146" stroke={C.ink} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M284 148L324 162L284 176Z" fill={C.coral} />

      {/* a signpost of tags where the track starts */}
      <line x1="-106" y1="434" x2="-106" y2="360" stroke={C.wood} strokeWidth="5" strokeLinecap="round" />
      <rect x="-102" y="362" width="62" height="20" rx="10" fill={C.coral} />
      <rect x="-102" y="388" width="48" height="20" rx="10" fill={C.coralLight} />
      <g stroke="#fff" strokeWidth="3" strokeLinecap="round">
        <line x1="-92" y1="372" x2="-54" y2="372" />
        <line x1="-92" y1="398" x2="-68" y2="398" />
      </g>

      {/* the reader, halfway along, a book under one arm */}
      <rect x="164" y="282" width="16" height="20" rx="2.5" fill={C.mustard} transform="rotate(-12 172 292)" />
      <Figure x={192} feet={325} shirt={C.blue} hair={C.hairBrown} ponytail />
      <g strokeWidth="8" strokeLinecap="round">
        <line x1="182" y1="270" x2="174" y2="290" stroke={C.blueDark} />
        <line x1="202" y1="270" x2="212" y2="292" stroke={C.blueDark} />
      </g>
    </Art>
  );
}

// "Know a subject inside out?": a well-read copy on a desk, highlighted, annotated and full of
// tabs. The wall is the site's primary blue, so it continues the band above it.
export function DeskBanner() {
  return (
    <Banner fill="var(--bs-primary)">
      <Sparkle x={420} y={90} r={8} fill="#fff" />
      <Sparkle x={1000} y={60} r={6} fill="#fff" />
      <Sparkle x={1560} y={100} r={7} fill="#fff" />
      <Sparkle x={2050} y={70} r={8} fill="#fff" />

      {/* a desk lamp shining on the book */}
      <path d="M884 150L926 160L1080 250H900Z" fill="#fff1b8" opacity="0.22" />
      <rect x="790" y="240" width="64" height="12" rx="6" fill={C.ink} />
      <g stroke={C.ink} strokeWidth="8" strokeLinecap="round">
        <line x1="822" y1="242" x2="800" y2="170" />
        <line x1="800" y1="170" x2="860" y2="118" />
      </g>
      <path d="M846 108L900 126L888 164L830 146Z" fill={C.mustard} />

      <rect y="250" width="2400" height="70" fill={C.wood} />
      <rect y="250" width="2400" height="10" fill={C.woodLight} />

      <Plant x={300} base={256} />
      <FlatBook x={520} y={220} w={150} h={36} fill={C.coral} />
      <FlatBook x={534} y={184} w={124} h={36} fill={C.green} />
      <Mug x={1420} base={256} />
      <FlatBook x={1640} y={220} w={160} h={36} fill={C.plum} />
      <FlatBook x={1652} y={184} w={130} h={36} fill={C.mustard} />
      <FlatBook x={1646} y={148} w={140} h={36} fill={C.ink} />
      <Plant x={2050} base={256} />

      <g transform="translate(1040 -6)">
        {/* sticky tabs poking out above the pages */}
        <rect x="66" y="110" width="15" height="28" rx="2" fill={C.green} />
        <rect x="100" y="114" width="15" height="28" rx="2" fill={C.mustard} />
        <rect x="206" y="116" width="15" height="28" rx="2" fill={C.coral} />
        <rect x="242" y="112" width="15" height="28" rx="2" fill={C.blue} />

        <OpenBook cx={160} top={140} bottom={252} half={124} tilt={12} cover={C.ink} />
        {/* text, a highlighted passage, an underline, a circled word and notes in the margin */}
        <line x1="52" y1="152" x2="120" y2="158" stroke={C.mustard} strokeWidth="10" strokeLinecap="round" opacity="0.6" />
        <g stroke={C.rule} strokeWidth="2.5" strokeLinecap="round">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <g key={i}>
              <line x1="50" y1={133 + i * 13} x2={i === 7 ? 110 : 146} y2={(i === 7 ? 140 : 143) + i * 13} />
              <line x1="174" y1={143 + i * 13} x2={i === 4 ? 230 : 270} y2={(i === 4 ? 138 : 133) + i * 13} />
            </g>
          ))}
        </g>
        <line x1="176" y1="161" x2="240" y2="155" stroke={C.coral} strokeWidth="2.5" strokeLinecap="round" />
        <ellipse cx="216" cy="195" rx="20" ry="9" stroke={C.coral} strokeWidth="2.5" fill="none" transform="rotate(-5 216 195)" />
        <g stroke={C.coral} strokeWidth="2.5" fill="none" strokeLinecap="round">
          <path d="M236 197q8 6 14 14" />
          <path d="M232 218c6-6 10 4 16-2s10 4 16-2" />
          <path d="M232 230c6-6 10 4 16-2" />
        </g>

        <g transform="rotate(-4 160 278)">
          <rect x="88" y="272" width="120" height="12" rx="2" fill={C.mustard} />
          <rect x="88" y="272" width="120" height="4" fill={C.mustardLight} />
          <rect x="208" y="272" width="14" height="12" fill="#c9c2b4" />
          <rect x="222" y="272" width="14" height="12" rx="4" fill={C.coralLight} />
          <path d="M88 272L70 278L88 284Z" fill="#f1d9b5" />
          <path d="M76 276L70 278L76 280Z" fill={C.ink} />
        </g>
      </g>
    </Banner>
  );
}

// "How it works", step 1: picking one book off the shelf
export function PickABook({ className, style }) {
  return (
    <Art viewBox="0 0 120 100" className={className} style={style}>
      <circle cx="60" cy="52" r="46" fill={C.sky} />
      <Spine x={26} base={80} w={12} h={40} fill={C.ink} />
      <Spine x={40} base={80} w={10} h={34} fill={C.green} />
      <g transform="rotate(9 59 48)">
        <Spine x={53} base={66} w={13} h={44} fill={C.plum} />
      </g>
      <Spine x={70} base={80} w={10} h={36} fill={C.mustard} />
      <Spine x={82} base={80} w={12} h={42} fill={C.coral} />
      <rect x="20" y="80" width="80" height="6" rx="3" fill={C.wood} />
      <Sparkle x={84} y={22} r={8} />
      <Sparkle x={36} y={28} r={5} />
    </Art>
  );
}

// step 2: two readers talking a book through
export function TalkItThrough({ className, style }) {
  return (
    <Art viewBox="0 0 120 100" className={className} style={style}>
      <circle cx="60" cy="52" r="46" fill={C.sky} />
      <Bust x={43} y={62} size={0.42} shirt={C.coral} hair={C.hairBrown} bun />
      <Bust x={79} y={60} size={0.46} shirt={C.blue} hair={C.hairGrey} glasses />
      <path d="M61 20c-3-5-11-3-9 3c1 3 9 9 9 9s8-6 9-9c2-6-6-8-9-3Z" fill={C.coral} />
    </Art>
  );
}

// step 3: the book open, a conversation going
export function ReadItTogether({ className, style }) {
  return (
    <Art viewBox="0 0 120 100" className={className} style={style}>
      <circle cx="60" cy="52" r="46" fill={C.sky} />
      <path d="M50 82v14l5-4 5 4V82Z" fill={C.coral} />
      <OpenBook cx={52} top={56} bottom={82} half={34} tilt={6} cover={C.ink} lines={2} />
      <rect x="62" y="16" width="44" height="28" rx="11" fill="#fff" />
      <path d="M72 43L68 54L82 43Z" fill="#fff" />
      <circle cx="74" cy="30" r="3.5" fill={C.mustard} />
      <circle cx="84" cy="30" r="3.5" fill={C.green} />
      <circle cx="94" cy="30" r="3.5" fill={C.blue} />
    </Art>
  );
}

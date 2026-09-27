const BG_TOP = "#18233f";
const BG = "#0a0f1e";
const BORDER = "#1f2940";
const ACCENT = "#52d9a4";

/**
 * App mark: a rising line on a dark tile. Plain SVG with no hooks so it can be
 * rendered both in the UI and inside `ImageResponse` for the app icons.
 * `rounded={false}` gives a full-bleed tile for iOS, which applies its own mask.
 */
export function LogoMark({
  size = 32,
  rounded = true,
}: {
  size?: number;
  rounded?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="wt-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={BG_TOP} />
          <stop offset="100%" stopColor={BG} />
        </linearGradient>
        <linearGradient id="wt-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.45" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect
        x={rounded ? 1 : 0}
        y={rounded ? 1 : 0}
        width={rounded ? 62 : 64}
        height={rounded ? 62 : 64}
        rx={rounded ? 15 : 0}
        fill="url(#wt-bg)"
        stroke={rounded ? BORDER : "none"}
        strokeWidth="2"
      />
      <path d="M12 46 L24 34 L33 39 L50 21 L50 52 L12 52 Z" fill="url(#wt-area)" />
      <path
        d="M12 46 L24 34 L33 39 L50 21"
        fill="none"
        stroke={ACCENT}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="21" r="5" fill={ACCENT} />
    </svg>
  );
}

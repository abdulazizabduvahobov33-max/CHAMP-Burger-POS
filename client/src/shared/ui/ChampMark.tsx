import { useId } from "react";

type ChampMarkProps = {
  size?: number;
  className?: string;
};

/** The CHAMP brand glyph — a flame-topped burger, matching the generated favicon/PWA icons
 * (see client/public/icons, client/public/splash) pixel-for-pixel. Gradient ids are namespaced
 * per instance so multiple marks on one page (header + POS + splash preview) don't clash. */
export function ChampMark({ size = 32, className = "" }: ChampMarkProps) {
  const uid = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      role="img"
      aria-label="CHAMP"
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2E2E31" />
          <stop offset="100%" stopColor="#19191B" />
        </linearGradient>
        <linearGradient id={`${uid}-bun`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F0C168" />
          <stop offset="100%" stopColor="#C4922F" />
        </linearGradient>
        <linearGradient id={`${uid}-patty`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C4922F" />
          <stop offset="100%" stopColor="#9C7222" />
        </linearGradient>
        <linearGradient id={`${uid}-flame`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFC97A" />
          <stop offset="55%" stopColor="#F2762E" />
          <stop offset="100%" stopColor="#D14E1E" />
        </linearGradient>
      </defs>

      <rect x="2" y="2" width="96" height="96" rx="24" fill={`url(#${uid}-bg)`} />

      <path
        d="M50 14
           C 40 25, 33 35, 33 46
           C 33 58, 40.5 66, 50 66
           C 59.5 66, 67 58, 67 46
           C 67 38, 62.5 31, 55 22
           C 56.5 29, 53.5 33.5, 50 30
           C 47.5 26, 49 19, 50 14 Z"
        fill={`url(#${uid}-flame)`}
      />
      <rect x="21" y="70" width="58" height="12" rx="6" fill={`url(#${uid}-bun)`} />
      <rect x="19" y="56" width="62" height="11" rx="5.5" fill={`url(#${uid}-patty)`} />
    </svg>
  );
}

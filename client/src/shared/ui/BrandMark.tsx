import { useId } from "react";

type BrandMarkProps = {
  size?: number;
  className?: string;
};

/** The KRUNCH brand glyph — a layered flame mark (outer red-orange body, brighter inner core),
 * matching the generated favicon/PWA icons (see client/public/icons, client/public/splash)
 * pixel-for-pixel. Gradient ids are namespaced per instance so multiple marks on one page
 * (header + POS + AI chat avatar) don't clash. */
export function BrandMark({ size = 32, className = "" }: BrandMarkProps) {
  const uid = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      role="img"
      aria-label="KRUNCH"
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2A2926" />
          <stop offset="100%" stopColor="#171614" />
        </linearGradient>
        <linearGradient id={`${uid}-outer`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF6A3D" />
          <stop offset="100%" stopColor="#E8391C" />
        </linearGradient>
        <linearGradient id={`${uid}-inner`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFD08A" />
          <stop offset="100%" stopColor="#FF8A3D" />
        </linearGradient>
      </defs>

      <rect x="2" y="2" width="96" height="96" rx="24" fill={`url(#${uid}-bg)`} />

      <path
        d="M50 10
           C 36 26 26 40 26 56
           C 26 71 37 83 50 83
           C 63 83 74 71 74 56
           C 74 44 66 33 58 22
           C 60 32 55 40 50 34
           C 46 29 47 18 50 10 Z"
        fill={`url(#${uid}-outer)`}
      />
      <path
        d="M50 40
           C 43 48 39 55 39 62
           C 39 70 44 76 50 76
           C 56 76 61 70 61 62
           C 61 56 57 51 53 46
           C 54 51 51 55 48 52
           C 46 49 47 44 50 40 Z"
        fill={`url(#${uid}-inner)`}
      />
    </svg>
  );
}

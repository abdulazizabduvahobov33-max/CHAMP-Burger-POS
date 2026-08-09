import { BrandMark } from "./BrandMark";

type BrandLogoProps = {
  size?: "sm" | "md" | "lg";
  subtitle?: string;
  className?: string;
};

const MARK_SIZE = { sm: 28, md: 36, lg: 48 } as const;
const WORD_SIZE = { sm: "text-base", md: "text-xl", lg: "text-2xl" } as const;

/** Primary Sharof KFS wordmark — glyph + "Sharof KFS" set in tight, heavy type, used in every
 * page header, the login card, and the dashboard. Pass `subtitle` for the login screen's
 * tagline under the wordmark. */
export function BrandLogo({ size = "md", subtitle, className = "" }: BrandLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <BrandMark size={MARK_SIZE[size]} />
      <div className="leading-none">
        <span className={`font-extrabold tracking-tight text-white ${WORD_SIZE[size]}`}>
          Sharof KFS<span className="text-champ">.</span>
        </span>
        {subtitle && <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-white/40">{subtitle}</p>}
      </div>
    </div>
  );
}

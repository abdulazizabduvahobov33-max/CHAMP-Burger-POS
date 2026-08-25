import { useEffect, useState } from "react";
import { Sandwich } from "lucide-react";

import { resolveUploadUrl, toThumbnailUrl } from "@/shared/lib/uploads";

type ProductImageProps = {
  src: string | null | undefined;
  alt: string;
  className?: string;
};

type Attempt = "thumbnail" | "original" | "failed";

/**
 * Product photo with lazy loading, a smooth fade-in once decoded, and a branded placeholder —
 * shown both when there's no photo yet and if every URL tried fails to load, so a broken/moved
 * upload never renders as a native broken-image icon.
 *
 * Tries the optimized thumbnail first (see server/src/shared/utils/imageThumbnails.ts — same
 * filename as the original, always `.thumb.webp`, generated on every new upload and backfilled
 * for photos that predate this) and falls back to the original full-resolution file if the
 * thumbnail 404s for any reason — never generated, backfill hasn't reached it yet, a filename
 * this convention doesn't match. A card never ends up with no image just because a thumbnail is
 * missing; it just costs that one card the size saving, not correctness.
 */
export function ProductImage({ src, alt, className = "" }: ProductImageProps) {
  const resolvedOriginal = resolveUploadUrl(src);
  const resolvedThumbnail = src ? resolveUploadUrl(toThumbnailUrl(src)) : null;

  const [attempt, setAttempt] = useState<Attempt>(resolvedThumbnail ? "thumbnail" : "original");
  const [loaded, setLoaded] = useState(false);

  // A new src (different product, or a just-replaced photo) always starts over at the thumbnail
  // attempt — a stale "original"/"failed" state left over from the previous image must not
  // carry across.
  useEffect(() => {
    setAttempt(resolvedThumbnail ? "thumbnail" : "original");
    setLoaded(false);
  }, [src]);

  const currentSrc = attempt === "thumbnail" ? resolvedThumbnail : attempt === "original" ? resolvedOriginal : null;
  const showImage = Boolean(currentSrc);

  function handleError() {
    if (attempt === "thumbnail") {
      setAttempt(resolvedOriginal ? "original" : "failed");
      setLoaded(false);
    } else {
      setAttempt("failed");
    }
  }

  return (
    <div className={`relative overflow-hidden bg-ink ${className}`}>
      {showImage && (
        // key={currentSrc} forces a clean remount (not just a src swap) when falling back from
        // the thumbnail to the original, so onLoad/onError fire correctly for the new URL
        // instead of racing whatever the browser was mid-request on for the old one.
        <img
          key={currentSrc}
          src={currentSrc as string}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={handleError}
          className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
      {(!showImage || !loaded) && (
        <div
          className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br from-champ/15 to-champ/5 transition-opacity duration-300 ${
            showImage && loaded ? "opacity-0" : "opacity-100"
          }`}
        >
          <span className="flex h-1/3 w-1/3 min-h-8 min-w-8 max-h-14 max-w-14 items-center justify-center rounded-xl bg-champ/20">
            <Sandwich className="h-1/2 w-1/2 text-champ" />
          </span>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { Sandwich } from "lucide-react";

import { resolveUploadUrl } from "@/shared/lib/uploads";

type ProductImageProps = {
  src: string | null | undefined;
  alt: string;
  className?: string;
};

/** Product photo with lazy loading, a smooth fade-in once decoded, and a branded CHAMP
 * placeholder — shown both when there's no photo yet and if the URL fails to load, so a
 * broken/moved upload never renders as a native broken-image icon. */
export function ProductImage({ src, alt, className = "" }: ProductImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const resolvedSrc = resolveUploadUrl(src);
  const showImage = Boolean(resolvedSrc) && !errored;

  return (
    <div className={`relative overflow-hidden bg-ink ${className}`}>
      {showImage && (
        <img
          src={resolvedSrc as string}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
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

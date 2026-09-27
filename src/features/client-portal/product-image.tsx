"use client";

import { useState } from "react";

export interface ProductImageProps {
  imageUrl: string | null;
  alt: string;
}

/**
 * Poza unui card din catalog. Bucket-ul `item-images` e public (0021), deci URL-ul
 * se randeaza direct cu `<img>`. Fara poza (sau daca nu se incarca) -> placeholder.
 */
export function ProductImage({ imageUrl, alt }: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex h-32 items-center justify-center border-b bg-muted/40">
      {imageUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-full object-contain p-2"
        />
      ) : (
        <span className="rounded-md border bg-card px-2 py-1 font-mono text-[10px] text-muted-foreground">
          foto produs
        </span>
      )}
    </div>
  );
}

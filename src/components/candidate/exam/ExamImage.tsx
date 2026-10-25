"use client";

import { createContext, useContext, useState } from "react";
import type { CandidateImage } from "@/lib/exam/safe";
import { cn } from "@/lib/cn";

/**
 * Where exam pictures come from. ExamRunner provides the token and the
 * section position; an item adds its own sequence and the picture's slot. The
 * URL carries only those opaque numbers and slots, never a storage key.
 * The tutorial's demo stage has no token: it maps a slot to a static file.
 */
export type ImageSrc = { token: string; position: number } | { demo: (sequence: number, slot: string) => string };

export const ImageSrcContext = createContext<ImageSrc | null>(null);

export function imageUrl(src: ImageSrc, sequence: number, slot: string): string {
  if ("demo" in src) return src.demo(sequence, slot);
  return `/api/c/${encodeURIComponent(src.token)}/exam/image/${src.position}/${sequence}/${encodeURIComponent(slot)}`;
}

/** "Bild A" only repeats the letter the picture already wears; any other text is shown. */
export function pictureCaption(text: string): string | null {
  return /^Bild [A-Z]$/.test(text.trim()) ? null : text;
}

/**
 * One exam picture in a box of its own aspect ratio (nothing jumps while it
 * loads), on a neutral ground. If it cannot be loaded the alt text shows in
 * the box instead; the item is never broken by it.
 */
export function ExamImage({
  sequence,
  image,
  className,
  rounded = "rounded-[14px]",
}: {
  sequence: number;
  image: CandidateImage;
  className?: string;
  rounded?: string;
}) {
  const src = useContext(ImageSrcContext);
  const [failed, setFailed] = useState(false);
  const box = cn("relative block w-full overflow-hidden bg-cream", rounded, className);
  const style = { aspectRatio: `${image.w} / ${image.h}` };
  if (!src || failed) {
    return (
      <span lang="de" style={style} className={cn(box, "flex items-center justify-center p-3 text-center text-[13px] text-ink-2")}>
        {image.alt}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a private, authenticated route; next/image would proxy it
    <img
      src={imageUrl(src, sequence, image.slot)}
      alt={image.alt}
      lang="de"
      width={image.w}
      height={image.h}
      loading="eager"
      decoding="async"
      draggable={false}
      style={style}
      onError={() => setFailed(true)}
      className={cn(box, "h-auto object-cover")}
    />
  );
}

/**
 * Task pictures above a writing or speaking task card; two sit side by side,
 * at most ~300px tall and never more than a third of the window, so the task
 * text under the picture stays on the first screen. A picture that is taller
 * than that is fitted whole (a chart must not lose its edges).
 */
export function TaskImages({ sequence, images }: { sequence: number; images: CandidateImage[] | undefined }) {
  if (!images?.length) return null;
  return (
    <div className="mb-4 flex gap-3">
      {images.slice(0, 2).map((im) => (
        <div key={im.slot} className="min-w-0 flex-1">
          <ExamImage sequence={sequence} image={im} className="max-h-[min(300px,32dvh)] object-contain" />
        </div>
      ))}
    </div>
  );
}

/**
 * The tint of one advert card or its matching letter (owner exception
 * 2026-10-23: ad cards only). The same marker always gets the same tone, so the
 * card in the passage and the letter in the matching tray look alike.
 */
export const AD_TONES = ["sky", "mint", "peach", "lilac", "butter", "sand"] as const;
export type AdTone = (typeof AD_TONES)[number];

export function adTone(marker: string | null, index: number): AdTone {
  let position = index;
  if (marker && /^[A-Z]$/.test(marker)) position = marker.charCodeAt(0) - 65;
  else if (marker && /^[0-9]{1,2}$/.test(marker) && Number(marker) >= 1) position = Number(marker) - 1;
  const n = AD_TONES.length;
  return AD_TONES[((position % n) + n) % n];
}

/** Full class names per tone, written out so Tailwind sees every one. */
export const AD_TONE_CLASSES: Record<AdTone, { card: string; disc: string; chip: string }> = {
  sky: {
    card: "bg-ad-sky border-ad-sky-lip shadow-[0_4px_0_0_var(--color-ad-sky-lip)]",
    disc: "border-ad-sky-lip",
    chip: "bg-ad-sky border-ad-sky-lip",
  },
  mint: {
    card: "bg-ad-mint border-ad-mint-lip shadow-[0_4px_0_0_var(--color-ad-mint-lip)]",
    disc: "border-ad-mint-lip",
    chip: "bg-ad-mint border-ad-mint-lip",
  },
  peach: {
    card: "bg-ad-peach border-ad-peach-lip shadow-[0_4px_0_0_var(--color-ad-peach-lip)]",
    disc: "border-ad-peach-lip",
    chip: "bg-ad-peach border-ad-peach-lip",
  },
  lilac: {
    card: "bg-ad-lilac border-ad-lilac-lip shadow-[0_4px_0_0_var(--color-ad-lilac-lip)]",
    disc: "border-ad-lilac-lip",
    chip: "bg-ad-lilac border-ad-lilac-lip",
  },
  butter: {
    card: "bg-ad-butter border-ad-butter-lip shadow-[0_4px_0_0_var(--color-ad-butter-lip)]",
    disc: "border-ad-butter-lip",
    chip: "bg-ad-butter border-ad-butter-lip",
  },
  sand: {
    card: "bg-ad-sand border-ad-sand-lip shadow-[0_4px_0_0_var(--color-ad-sand-lip)]",
    disc: "border-ad-sand-lip",
    chip: "bg-ad-sand border-ad-sand-lip",
  },
};

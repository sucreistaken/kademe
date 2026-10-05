/**
 * HIRING-UX 6: the screen's one filled button, with its reason. On a phone it
 * sits in a bar fixed to the bottom (above the safe area); from `sm` up it is
 * part of the page.
 */
export function ActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-8 border-t border-line bg-paper/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur sm:static sm:mx-0 sm:mt-10 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
      {children}
    </div>
  );
}

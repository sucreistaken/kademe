"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useMT } from "@/i18n/manager-client";
import type { InviteOpening } from "./form-rules";
import { InviteForm } from "./invite-form";

/**
 * HIRING-UX 5.11: every "Aday davet et" on an opening's pages opens this Sheet
 * from the right with the opening preselected; /hiring/invite is the same
 * form as a page. The trigger is the page's one filled button and always
 * reads "Aday davet et" (no label prop, ruling C21). Closing the Sheet drops
 * what was typed and any link shown, so while a request runs or links are
 * shown, Escape and a click outside do nothing (sheetLocked); the close
 * buttons ("Kapat" and the corner one) still close it, next to the note that
 * the links are not shown again.
 */
export function InviteSheet({ opening, today, zone }: { opening: InviteOpening; today: string; zone: string }) {
  const t = useMT("hiringInvite");
  const [open, setOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const change = (next: boolean) => {
    setOpen(next);
    if (!next) setLocked(false);
  };
  const hold = (event: Event) => {
    if (locked) event.preventDefault();
  };
  return (
    <Sheet open={open} onOpenChange={change}>
      <SheetTrigger asChild>
        <Button id="invite-candidate" variant="primary">
          {t("title")}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" onEscapeKeyDown={hold} onInteractOutside={hold} className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-[480px]">
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle className="pr-8 text-[16px] leading-6 font-semibold text-ink">{t("title")}</SheetTitle>
          <SheetDescription className="text-[13px] leading-5 text-muted">{t("lead")}</SheetDescription>
        </SheetHeader>
        <div className="px-6 pb-8">
          <InviteForm key={open ? "open" : "closed"} openings={[opening]} initialOpeningId={opening.id} today={today} zone={zone} onDone={() => change(false)} onLockChange={setLocked} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

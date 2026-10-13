"use client";

import { CloudOff, Compass, Mail, RotateCcw } from "lucide-react";
import { CandidateIntl } from "@/components/candidate/Intl";
import { CandidateColumn, CandidateShell } from "@/components/candidate/Shell";
import { useCandidateFrame } from "@/components/candidate/frame-context";
import { buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/i18n/candidate-client";
import { cn } from "@/lib/cn";

/**
 * The candidate route's error, not-found and loading screens. Each renders in
 * place of a page, so it brings its own dictionary and frame (from the [token]
 * layout, see frame-context). Never a dead end: what happened in one sentence,
 * a way on, and the school's address when the link names a school.
 */
function Framed({ children }: { children: React.ReactNode }) {
  const frame = useCandidateFrame();
  return (
    <CandidateIntl locale={frame.locale} timeZone={frame.timeZone}>
      <CandidateShell locale={frame.locale} header={false}>
        {children}
      </CandidateShell>
    </CandidateIntl>
  );
}

function Contact() {
  const v = useT("visual");
  const { orgName, contactEmail } = useCandidateFrame();
  if (!contactEmail) return null;
  return (
    <p className="mt-6 flex flex-wrap items-center justify-center gap-1.5 text-center text-[13.5px] text-muted">
      <Mail aria-hidden className="size-4" strokeWidth={2} />
      {orgName ? v("errorContact", { org: orgName }) : v("errorContactPlain")}
      <a className="font-semibold text-ink underline decoration-underline underline-offset-2" href={`mailto:${contactEmail}`}>
        {contactEmail}
      </a>
    </p>
  );
}

function Card({ icon, title, body, children }: { icon: React.ReactNode; title: string; body: string; children?: React.ReactNode }) {
  return (
    <CandidateColumn width={520}>
      <div className="rounded-2xl border border-line bg-surface px-6 py-8 text-center shadow-card sm:px-8">
        {icon}
        <h1 className="mt-5 text-[24px] font-extrabold leading-[1.25] tracking-[-0.01em] text-ink">{title}</h1>
        <p className="mx-auto mt-3 max-w-[42ch] text-[15px] leading-[1.65] text-ink-2">{body}</p>
        {children}
        <Contact />
      </div>
    </CandidateColumn>
  );
}

function ErrorCard({ digest, onRetry }: { digest?: string; onRetry?: () => void }) {
  const v = useT("visual");
  const { token } = useCandidateFrame();
  return (
    <Card
      icon={
        <span aria-hidden className="mx-auto grid size-16 place-items-center rounded-2xl bg-coral-soft text-coral">
          <CloudOff className="size-8" strokeWidth={1.75} />
        </span>
      }
      title={v("errorTitle")}
      body={v("errorBody")}
    >
      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
        {onRetry ? (
          <button type="button" onClick={() => onRetry()} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "sm:min-w-[180px]")}>
            <RotateCcw aria-hidden className="size-4" strokeWidth={2.25} />
            {v("errorRetry")}
          </button>
        ) : null}
        {token ? (
          // A full load on purpose: whatever broke is left behind, and the server sends the student to their step.
          <a href={`/a/${encodeURIComponent(token)}`} className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "sm:min-w-[180px]")}>
            {v("errorHome")}
          </a>
        ) : null}
      </div>
      {digest ? <p className="tnum mt-4 text-[12.5px] text-muted">{v("errorReference", { digest })}</p> : null}
    </Card>
  );
}

function NotFoundCard() {
  const v = useT("visual");
  const { token } = useCandidateFrame();
  return (
    <Card
      icon={
        <span aria-hidden className="mx-auto grid size-16 place-items-center rounded-2xl bg-sky-soft text-sky">
          <Compass className="size-8" strokeWidth={1.75} />
        </span>
      }
      title={v("notFoundTitle")}
      body={v("notFoundBody")}
    >
      {token ? (
        <a href={`/a/${encodeURIComponent(token)}`} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "mt-6 w-full sm:w-auto sm:min-w-[200px]")}>
          {v("errorHome")}
        </a>
      ) : null}
    </Card>
  );
}

function LoadingCard() {
  const v = useT("visual");
  return (
    // Shown only when a step takes a moment: it fades in after 300ms, so a quick change never flashes it.
    <div role="status" className="flex min-h-[60dvh] items-center justify-center px-6 opacity-0 animate-[fade-in_240ms_ease-out_300ms_forwards] motion-reduce:animate-[fade-in_1ms_linear_300ms_forwards]">
      <div className="flex flex-col items-center gap-3 text-center">
        <span aria-hidden className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Spinner className="size-6 motion-reduce:animate-none" role={undefined} aria-label={undefined} />
        </span>
        <p className="text-[16px] font-extrabold text-ink">{v("loading")}</p>
        <p className="text-[13.5px] text-muted">{v("loadingHint")}</p>
      </div>
    </div>
  );
}

export function CandidateErrorScreen({ digest, onRetry }: { digest?: string; onRetry?: () => void }) {
  return (
    <Framed>
      <ErrorCard digest={digest} onRetry={onRetry} />
    </Framed>
  );
}

export function CandidateNotFoundScreen() {
  return (
    <Framed>
      <NotFoundCard />
    </Framed>
  );
}

export function CandidateLoadingScreen() {
  return (
    <Framed>
      <LoadingCard />
    </Framed>
  );
}

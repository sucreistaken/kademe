// kademe-owned
import type { ReactNode, Ref } from "react";
import { Illustration, type IllustrationName } from "./illustrations";

/** 3.11: a status or problem screen: a small drawing, a heading, one sentence, one way on (in the footer). */
export function StatusScreen({
  illustration,
  title,
  titleRef,
  body,
  children,
  footer,
}: {
  illustration?: IllustrationName;
  title: ReactNode;
  titleRef?: Ref<HTMLHeadingElement>;
  body?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-[560px] pt-14 pb-6 text-center">
      {illustration ? <Illustration name={illustration} size="spot" className="mx-auto" /> : null}
      <h1 ref={titleRef} tabIndex={-1} className="mt-6 text-[28px] leading-9 font-semibold text-ink outline-none lg:text-[32px] lg:leading-10">
        {title}
      </h1>
      {body ? <p className="mt-3 text-[16px] leading-[26px] text-ink-2">{body}</p> : null}
      {children ? <div className="mt-6 space-y-3 text-[16px] leading-[26px] text-ink-2">{children}</div> : null}
      {footer}
    </section>
  );
}

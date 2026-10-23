"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { ShieldCheck, UserCog, UserRoundCheck, type LucideIcon } from "lucide-react";
import { flowJourney } from "@/components/manager/flow-model";
import { GuidedFlow, useFlowStep, type FlowStep } from "@/components/manager/guided-flow";
import { Button } from "@/components/ui/button";
import { InlineLink } from "@/components/ui/inline-link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChoiceCardGroup } from "@/components/visual/choice-card";
import { StepScreen } from "@/components/visual/step-screen";
import { inviteUser, type InviteUserResult } from "@/app/(manager)/settings/actions";
import { useMT } from "@/i18n/manager-client";
import { intlTag } from "@/lib/format";

export type RoleOption = {
  value: string;
  label: string;
  help: string;
};

type Code = Extract<InviteUserResult, { status: "error" }>["code"];

/** The flow's two steps: who, then what they may do. */
const STEPS = ["person", "role"] as const;
type Step = (typeof STEPS)[number];
const ROLE_ICONS: Record<string, LucideIcon> = { OWNER: ShieldCheck, MANAGER: UserCog, REVIEWER: UserRoundCheck };
/** The server's own address check (settings/actions.ts), so the button never waits on a rule the server does not have. */
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** A refusal opens the step it is about. */
const CODE_STEP: Record<Code, Step> = { NAME_REQUIRED: "person", EMAIL_INVALID: "person", EMAIL_TAKEN: "person", ROLE_INVALID: "role" };

/**
 * Adding a team member as a guided flow, like the hiring and exam wizards:
 * who (name and address), then what they may do (one role card each, with
 * what it allows), then the one-time setup link. No role is chosen for the
 * manager: the first in the list is the owner's, which is too much to give
 * by not looking. The owner never types a password for anybody; they hand
 * over the link and the person sets their own. Nothing is e-mailed.
 */
export function InviteUserForm({ roleOptions }: { roleOptions: RoleOption[] }) {
  const t = useMT("userInvite");
  const errors = useMT("userInviteErrors");
  const flow = useMT("flow");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [refusal, setRefusal] = useState<Code | null>(null);
  const [created, setCreated] = useState<Extract<InviteUserResult, { status: "created" }> | null>(null);
  const [returned, setReturned] = useState(false);
  const [pending, start] = useTransition();
  const personReason = !name.trim() ? t("waitName") : !EMAIL_RE.test(email.trim().toLowerCase()) ? t("waitEmail") : null;
  const nav = useFlowStep({ steps: STEPS, firstInvalid: personReason ? "person" : null, mode: "hash" });
  const step = nav.step;
  const chosen = roleOptions.find((o) => o.value === role) ?? null;

  function create() {
    setRefusal(null);
    const data = new FormData();
    data.set("name", name);
    data.set("email", email);
    data.set("role", role);
    start(async () => {
      const r = await inviteUser({ status: "idle" }, data);
      if (r.status === "created") setCreated(r);
      else if (r.status === "error") {
        setRefusal(r.code);
        if (CODE_STEP[r.code] !== step) nav.go(CODE_STEP[r.code]);
      }
    });
  }

  function again() {
    setCreated(null);
    setName("");
    setEmail("");
    setRole("");
    setRefusal(null);
    setReturned(true);
    nav.go("person");
  }

  if (created) return <CreatedLink state={created} onAgain={again} />;

  const note =
    refusal && CODE_STEP[refusal] === step ? (
      <p role="alert" className="text-[14px] font-medium text-ink">
        {errors(refusal)}
      </p>
    ) : null;

  const screens: Record<Step, FlowStep> = {
    person: {
      id: "person",
      title: t("stepPersonTitle"),
      lead: <p>{t("subtitle")}</p>,
      layout: "single",
      primary: { kind: "button", id: "user-invite-next", label: flow("continue"), waitReason: personReason, onClick: () => nav.go("role") },
      note,
      body: (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="user-invite-name">{t("name")}</Label>
            <Input id="user-invite-name" autoComplete="off" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className="h-11 text-[16px]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-invite-email">{t("email")}</Label>
            <Input id="user-invite-email" type="email" autoComplete="off" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 text-[16px]" />
          </div>
          <p className="text-[13px] text-muted">{t("reinviteHint")}</p>
        </div>
      ),
    },
    role: {
      id: "role",
      title: t("stepRoleTitle", { name: name.trim() }),
      lead: <p>{t("noEmailSent")}</p>,
      layout: "single",
      primary: {
        kind: "button",
        id: "user-invite-create",
        label: t("create"),
        busy: pending,
        busyLabel: t("creating"),
        waitReason: chosen ? null : t("waitRole"),
        onClick: create,
      },
      note,
      body: (
        <>
          <p id="user-invite-role-label" className="sr-only">
            {t("role")}
          </p>
          <ChoiceCardGroup
            type="single"
            name="user-invite-role"
            labelledBy="user-invite-role-label"
            look="panel"
            value={role ? [role] : []}
            onChange={([v]) => {
              setRole(v ?? "");
              setRefusal(null);
            }}
            items={roleOptions.map((o) => ({ value: o.value, label: o.label, description: o.help, marker: ROLE_ICONS[o.value] }))}
          />
        </>
      ),
    },
  };

  return (
    <GuidedFlow
      kicker={t("title")}
      step={screens[step]}
      journey={flowJourney(STEPS, step)}
      back={step === "person" ? { label: t("back"), href: "/settings" } : { label: flow("back"), onClick: () => nav.back() }}
      exit={{ dirty: name !== "" || email !== "" || role !== "", href: "/settings" }}
      enter={nav.moved}
      arrive={returned}
    />
  );
}

/** The one success moment: the setup link once, with copy, its last day and the ways on. */
function CreatedLink({ state, onAgain }: { state: Extract<InviteUserResult, { status: "created" }>; onAgain: () => void }) {
  const t = useMT("userInvite");
  const locale = useLocale();
  const [copied, setCopied] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  // This view only renders after the action resolved, so it is client side by
  // definition. The guard is there for the type checker.
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/setup/${state.token}`;

  return (
    <StepScreen
      layout="single"
      width={640}
      illustration="inviteReady"
      illustrationSize="spot"
      title={state.reissued ? t("readyReissued", { name: state.name }) : t("ready", { name: state.name })}
      titleRef={heading}
      lead={<p>{t("readyHint")}</p>}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            aria-label={t("linkLabel")}
            onFocus={(event) => event.currentTarget.select()}
            className="h-11 flex-1 rounded-[10px] border border-line bg-paper px-3 font-mono text-[12.5px]"
          />
          <Button
            type="button"
            variant="primary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? t("copied") : t("copy")}
          </Button>
        </div>
        <p className="text-[13px] text-muted">{t("expiresOn", { date: new Date(state.expiresAt).toLocaleDateString(intlTag(locale)) })}</p>
        <span role="status" className="sr-only">
          {copied ? t("copied") : ""}
        </span>
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button variant="secondary" onClick={onAgain}>
            {t("inviteAnother")}
          </Button>
          <InlineLink href="/settings" className="text-[14px]">
            {t("goToSettings")}
          </InlineLink>
        </div>
      </div>
    </StepScreen>
  );
}

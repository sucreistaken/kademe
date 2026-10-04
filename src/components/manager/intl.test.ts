import { describe, expect, it } from "vitest";
import { CandidateIntl } from "@/components/candidate/Intl";
import { ManagerIntl } from "./Intl";

/**
 * next-intl warns ENVIRONMENT_FALLBACK (and server and browser may format
 * dates differently) when a provider has no time zone. Both trees get the
 * organisation's zone from the server (ORG_TIMEZONE), never the process zone.
 */
describe("intl providers", () => {
  it.each([
    ["manager", ManagerIntl],
    ["candidate", CandidateIntl],
  ] as const)("the %s provider passes the zone it is given", (_name, Provider) => {
    const element = Provider({ locale: "tr", timeZone: "America/New_York", children: null });
    expect(element.props.timeZone).toBe("America/New_York");
  });
});

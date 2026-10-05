/**
 * HIRING-VISUAL-FLOW 3.0 (user decisions K2 and K11): the hiring candidate
 * flow is done on a computer. This file decides which device opened the link,
 * the same code on the server (request headers only) and in the browser (all
 * signals). The rules, in order:
 *
 * 1. A definite phone signal (Sec-CH-UA-Mobile ?1, a phone UA) is a phone.
 *    No laptop sends either; DevTools phone emulation does, on purpose.
 * 2. A tablet UA (iPad, Android without "Mobile", or "Macintosh" with touch
 *    points, which is iPadOS asking for the desktop site) is a tablet, with or
 *    without a keyboard (K11). For an iPad or Android tablet UA the server says
 *    "unknown" and the browser decides. The server cannot see touch points, so
 *    every "Macintosh" UA is a desktop there; an iPad asking for the desktop
 *    site is caught by the browser, which decides before consent or any
 *    recording (the client verdict is the one that counts).
 * 3. In the browser, a coarse pointer AND no fine pointer AND no screen sharing,
 *    all three said outright, are a tablet (a touch device asking for the
 *    desktop site). A signal left out fails open, and one weak signal alone (a
 *    touch screen, a small window) never blocks anyone.
 * 4. Everything else is a desktop. Window width is never an input here: a
 *    narrow desktop window gets a strip, never a block.
 *
 * The language exam has its own `isMobileDevice` (components/candidate/
 * MobileBlock.tsx); it is not touched (K6).
 */
export type DeviceClass = "desktop" | "phone" | "tablet" | "unknown";

export type DeviceSignals = {
  ua: string;
  /** Sec-CH-UA-Mobile ("?1" true, "?0" false), or userAgentData.mobile; null when not sent. */
  chMobile?: boolean | null;
  /** The browser's own signals; undefined on the server. */
  coarse?: boolean;
  anyFine?: boolean;
  hasDisplayMedia?: boolean;
  maxTouchPoints?: number;
};

const PHONE_UA = /iPhone|iPod|Windows Phone|Android.*Mobile/i;
const TABLET_UA = /iPad|Android(?!.*Mobile)/i;

export function classifyDevice(s: DeviceSignals): DeviceClass {
  if (s.chMobile === true || PHONE_UA.test(s.ua)) return "phone";
  const inBrowser = s.coarse !== undefined;
  const tabletUa = TABLET_UA.test(s.ua) || (/Macintosh/.test(s.ua) && (s.maxTouchPoints ?? 0) > 1);
  if (tabletUa) return inBrowser ? "tablet" : "unknown";
  if (!inBrowser) return "desktop";
  if (s.coarse === true && s.anyFine === false && s.hasDisplayMedia === false) return "tablet";
  return "desktop";
}

/**
 * The server's reading of a request. `null` means there is no request (a
 * script calling the page renderer): treated as a desktop, because the rule
 * that matters is never to block a real desktop (plan decision 3).
 */
export function serverDeviceClass(h: { get(name: string): string | null } | null): DeviceClass {
  if (!h) return "desktop";
  const mobile = h.get("sec-ch-ua-mobile");
  return classifyDevice({ ua: h.get("user-agent") ?? "", chMobile: mobile === "?1" ? true : mobile === "?0" ? false : null });
}

/** Below this a desktop window gets the "Pencere dar" strip; the layout falls to one column. */
export const NARROW_LAYOUT_PX = 1024;
/** Below this a stage that has not started waits; a started one is never held (time runs). */
export const NARROW_START_PX = 640;

export const windowNotice = (width: number): "none" | "narrow" => (width < NARROW_LAYOUT_PX ? "narrow" : "none");
export const startWaitsForWidth = (width: number): boolean => width < NARROW_START_PX;

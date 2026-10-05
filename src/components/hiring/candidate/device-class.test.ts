import { describe, expect, it } from "vitest";
import { classifyDevice, NARROW_LAYOUT_PX, NARROW_START_PX, serverDeviceClass, startWaitsForWidth, windowNotice, type DeviceSignals } from "./device-class";

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  androidPhone: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
  androidPhoneReduced: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
  firefoxAndroidPhone: "Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0",
  androidTablet: "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  firefoxAndroidTablet: "Mozilla/5.0 (Android 14; Tablet; rv:131.0) Gecko/131.0 Firefox/131.0",
  ipadOld: "Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  windowsChrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  chromebook: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  linuxDesktopSite: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  windowsPhone: "Mozilla/5.0 (Windows Phone 10.0; Android 6.0.1; Microsoft; Lumia 950) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0 Mobile Safari/537.36 Edge/15.15063",
};

/** A desktop browser's own client signals: a fine pointer and screen sharing. */
const desk = { coarse: false, anyFine: true, hasDisplayMedia: true, maxTouchPoints: 0 };
/** A touch-only device: coarse pointer, no fine pointer, no screen sharing. */
const touch = { coarse: true, anyFine: false, hasDisplayMedia: false, maxTouchPoints: 5 };
const client = (ua: string, rest: Omit<DeviceSignals, "ua">) => classifyDevice({ ua, chMobile: null, ...rest });

describe("classifyDevice (HIRING-VISUAL-FLOW 3.0, K2, K11)", () => {
  it("knows a phone on the server from a phone UA or Sec-CH-UA-Mobile, whatever the client says", () => {
    for (const ua of [UA.iphone, UA.androidPhone, UA.androidPhoneReduced, UA.firefoxAndroidPhone, UA.windowsPhone]) {
      expect(classifyDevice({ ua }), ua).toBe("phone");
      expect(client(ua, desk), ua).toBe("phone");
    }
    expect(classifyDevice({ ua: UA.windowsChrome, chMobile: true })).toBe("phone");
  });

  it("blocks DevTools phone emulation on purpose: the browser sends a phone UA and ?1", () => {
    expect(classifyDevice({ ua: UA.iphone, chMobile: true, ...desk })).toBe("phone");
  });

  it("leaves a tablet UA undecided on the server and lets the client call it a tablet", () => {
    for (const ua of [UA.androidTablet, UA.firefoxAndroidTablet, UA.ipadOld]) {
      expect(classifyDevice({ ua, chMobile: false }), ua).toBe("unknown");
      expect(client(ua, touch), ua).toBe("tablet");
    }
  });

  it("blocks a keyboard tablet too (K11): a fine pointer next to a tablet UA is still a tablet", () => {
    expect(client(UA.androidTablet, { ...touch, anyFine: true })).toBe("tablet");
    // iPadOS in desktop mode says Macintosh; only its touch points tell it from a Mac.
    expect(classifyDevice({ ua: UA.macSafari })).toBe("desktop");
    expect(client(UA.macSafari, touch)).toBe("tablet");
    expect(client(UA.macSafari, { ...touch, anyFine: true })).toBe("tablet");
  });

  it("never blocks a real desktop or laptop (3.0 principle 1)", () => {
    expect(client(UA.macSafari, desk)).toBe("desktop");
    expect(client(UA.windowsChrome, desk)).toBe("desktop");
    expect(client(UA.chromebook, desk)).toBe("desktop");
    // A touch-screen laptop: touch alone is never a reason.
    expect(client(UA.windowsChrome, { coarse: true, anyFine: true, hasDisplayMedia: true, maxTouchPoints: 10 })).toBe("desktop");
    // A convertible folded into tablet mode still shares its screen.
    expect(client(UA.chromebook, { coarse: true, anyFine: false, hasDisplayMedia: true, maxTouchPoints: 10 })).toBe("desktop");
    // The server alone never blocks a desktop UA.
    expect(classifyDevice({ ua: UA.windowsChrome, chMobile: false })).toBe("desktop");
    expect(classifyDevice({ ua: "" })).toBe("desktop");
  });

  it("calls a touch-only device asking for the desktop site a tablet: both client signals agree", () => {
    expect(client(UA.linuxDesktopSite, touch)).toBe("tablet");
    expect(client(UA.linuxDesktopSite, { ...touch, hasDisplayMedia: true })).toBe("desktop");
  });

  it("fails open on a missing client signal and holds the Task 1 review's regression cases", () => {
    // Only all three client signals together make a desktop UA a tablet; one left out never blocks.
    expect(classifyDevice({ ua: UA.linuxDesktopSite, coarse: true })).toBe("desktop");
    expect(classifyDevice({ ua: UA.linuxDesktopSite, coarse: true, anyFine: false })).toBe("desktop");
    expect(classifyDevice({ ua: UA.linuxDesktopSite, coarse: true, hasDisplayMedia: false })).toBe("desktop");
    expect(classifyDevice({ ua: UA.linuxDesktopSite, coarse: true, anyFine: false, hasDisplayMedia: false })).toBe("tablet");
    // Samsung Internet: a phone by its UA, a tablet UA left to the browser.
    const samsungPhone = "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36";
    const samsungTablet = "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Safari/537.36";
    expect(classifyDevice({ ua: samsungPhone })).toBe("phone");
    expect(classifyDevice({ ua: samsungTablet, chMobile: false })).toBe("unknown");
    expect(client(samsungTablet, touch)).toBe("tablet");
    // A Surface-style device folded into tablet mode: coarse, no fine pointer, but it shares its screen.
    expect(client(UA.windowsChrome, { coarse: true, anyFine: false, hasDisplayMedia: true, maxTouchPoints: 10 })).toBe("desktop");
    // A phone UA is a phone even when the browser says chMobile false.
    expect(classifyDevice({ ua: UA.iphone, chMobile: false })).toBe("phone");
    expect(classifyDevice({ ua: UA.androidPhone, chMobile: false, ...desk })).toBe("phone");
    // A Mac with no touch points is a desktop, on the server and in the browser.
    expect(client(UA.macSafari, { ...desk, maxTouchPoints: 0 })).toBe("desktop");
    expect(classifyDevice({ ua: UA.macSafari, chMobile: false })).toBe("desktop");
  });

  it("reads the request headers, and treats no request (a script) as desktop (decision 3)", () => {
    const h = (pairs: Record<string, string>) => ({ get: (name: string) => pairs[name.toLowerCase()] ?? null });
    expect(serverDeviceClass(h({ "user-agent": UA.iphone }))).toBe("phone");
    expect(serverDeviceClass(h({ "user-agent": UA.windowsChrome, "sec-ch-ua-mobile": "?1" }))).toBe("phone");
    expect(serverDeviceClass(h({ "user-agent": UA.windowsChrome, "sec-ch-ua-mobile": "?0" }))).toBe("desktop");
    expect(serverDeviceClass(h({ "user-agent": UA.androidTablet, "sec-ch-ua-mobile": "?0" }))).toBe("unknown");
    expect(serverDeviceClass(h({}))).toBe("desktop");
    expect(serverDeviceClass(null)).toBe("desktop");
  });
});

describe("window width never decides the device, only what the screen says (3.0 principle 2)", () => {
  it("shows the narrow strip below 1024px and holds a stage start below 640px", () => {
    expect(NARROW_LAYOUT_PX).toBe(1024);
    expect(NARROW_START_PX).toBe(640);
    expect(windowNotice(1280)).toBe("none");
    expect(windowNotice(1024)).toBe("none");
    expect(windowNotice(1023)).toBe("narrow");
    expect(windowNotice(500)).toBe("narrow");
    expect(startWaitsForWidth(640)).toBe(false);
    expect(startWaitsForWidth(639)).toBe(true);
  });
});

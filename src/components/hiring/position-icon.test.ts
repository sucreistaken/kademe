import { Briefcase, Calculator, ChartLine, ClipboardList, Code, Handshake, Headset, PenTool, PhoneCall, Store, Truck } from "lucide-react";
import { describe, expect, it } from "vitest";
import { positionIcon } from "./position-icon";

describe("positionIcon (manager mockup 2, 3: a tile per role)", () => {
  it.each([
    ["Müşteri Destek Uzmanı", Headset],
    ["Destek Uzmanı · Ekim", Headset],
    ["Customer Support", Headset],
    ["Çağrı Merkezi Temsilcisi", PhoneCall],
    ["Mağaza Satış Danışmanı", Store],
    ["Saha Satış", Handshake],
    ["Ürün Tasarımcısı", PenTool],
    ["Veri Analisti", ChartLine],
    ["Data Analyst", ChartLine],
    ["Yazılım Geliştirici", Code],
    ["Muhasebe Uzmanı", Calculator],
    ["Yönetici Asistanı", ClipboardList],
    ["Depo ve Lojistik Sorumlusu", Truck],
    ["Kalite Sorumlusu", Briefcase],
    ["", Briefcase],
  ] as const)("%s", (name, icon) => {
    expect(positionIcon(name)).toBe(icon);
  });
});

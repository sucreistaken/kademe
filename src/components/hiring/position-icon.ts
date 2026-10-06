import { Briefcase, Calculator, ChartLine, ClipboardList, Code, Handshake, Headset, PenTool, PhoneCall, Store, Truck, type LucideIcon } from "lucide-react";

/**
 * Manager mockup 2 and 3: every opening and position row carries a tile with
 * an icon for its role. Positions have no icon field, so the icon is read from
 * the name (Turkish and English words); the order matters (a store's sales
 * role is a store, a call centre's support role is a phone). Anything else is
 * a briefcase. Presentation only: nothing is stored or decided from it.
 */
const RULES: ReadonlyArray<readonly [RegExp, LucideIcon]> = [
  [/çağrı|call cent/, PhoneCall],
  [/destek|support|müşteri hizmet|customer/, Headset],
  [/mağaza|store|retail/, Store],
  [/satış|sales/, Handshake],
  [/tasarım|design/, PenTool],
  [/veri|data|analist|analyst/, ChartLine],
  [/yazılım|geliştirici|developer|engineer|mühendis/, Code],
  [/muhasebe|accountant|accounting|finans|finance/, Calculator],
  [/asistan|assistant|sekreter/, ClipboardList],
  [/depo|lojistik|warehouse|logistic/, Truck],
];

export function positionIcon(name: string): LucideIcon {
  // Both lower-casings: Turkish for "İ" and "I", plain for English names.
  const text = `${name.toLocaleLowerCase("tr")} ${name.toLowerCase()}`;
  return RULES.find(([pattern]) => pattern.test(text))?.[1] ?? Briefcase;
}

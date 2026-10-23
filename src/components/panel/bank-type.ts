import { textGapKindOf, type ItemType } from "@/lib/exam/types";
import { pickedTextKind, type PickedTextKind } from "@/components/panel/result/review-cards";

/**
 * The label key of a bank row's kind. A multiple-choice cloze, a word bank and
 * an open cloze are all stored as gap fill, so the bare type would call them
 * "Gap fill"; they show their own kind name instead ("Seçmeli boşluk",
 * "Kelime havuzu", "Açık boşluk").
 */
export function bankTypeKey(item: { type: ItemType; skillTag: string }): `bank.textKind${PickedTextKind | "OPEN"}` | `bank.type${ItemType}` {
  const kind = pickedTextKind(item);
  if (kind) return `bank.textKind${kind}`;
  return textGapKindOf(item) === "OPEN" ? "bank.textKindOPEN" : `bank.type${item.type}`;
}

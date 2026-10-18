import type { ItemType } from "@/lib/exam/types";
import { pickedTextKind, type PickedTextKind } from "@/components/panel/result/review-cards";

/**
 * The label key of a bank row's kind. A multiple-choice cloze and a word bank
 * are both stored as gap fill, so the bare type would call them "Gap fill";
 * they show their own kind name instead ("Seçmeli boşluk", "Kelime havuzu").
 */
export function bankTypeKey(item: { type: ItemType; skillTag: string }): `bank.textKind${PickedTextKind}` | `bank.type${ItemType}` {
  const kind = pickedTextKind(item);
  return kind ? `bank.textKind${kind}` : `bank.type${item.type}`;
}

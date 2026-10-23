/**
 * A reading passage split into blocks for the exam screen: the parts of a
 * notice board or advert list ("Kurs 1: ...", "A", "B") become cards, the rest
 * stays prose. Pure text parsing, no markup in the stored body.
 */
export type PassageBlock =
  | { kind: "card"; heading: string; lines: string[]; marker: string | null; title: string | null }
  | { kind: "text"; lines: string[] };

const PART_KEYWORDS = "(?:Kurs|Anzeige|Text|Abschnitt|Angebot|Termin|Nachricht|Person)";
/** "Kurs 1:", "Anzeige B)", "Termin 2 -", or the bare label "Anzeige A" alone on its line. */
const PART_HEADING = new RegExp(`^${PART_KEYWORDS}\\s*(?:[0-9]{1,2}|[A-Z]{1,2})(?:\\s*[:.)-]|\\s*$)`);
/** A lone capital letter, "A", "B)" or "C.", heads one entry of an advert list. */
const LONE_LETTER = /^[A-Z][).]?$/;
/** A letter label with its title on the same line: "A  Computerkurs" (two spaces) or "A: Miriam Kessler". */
const LETTER_WITH_TITLE = /^[A-Z](?::\s|\s{2,})\S/;

/** "Kurs 1: Excel", "Anzeige B", "Termin 2 - Mittwoch": marker, then an optional title after the separator. */
const KEYWORD_HEADING = new RegExp(`^${PART_KEYWORDS}\\s*([0-9]{1,2}|[A-Z]{1,2})(?:\\s*[:.)-]\\s*(.*))?$`);
const LETTER_ONLY = /^([A-Z])[).]?$/;
const LETTER_TITLE = /^([A-Z])(?::\s+|\s{2,})(.+)$/;

/** The letter or number heading a card and its own title, when the heading has one. Never invented from prose. */
export function parseCardHeading(heading: string): { marker: string | null; title: string | null } {
  const clean = (t: string | undefined) => (t && t.trim() !== "" ? t.trim() : null);
  const kw = KEYWORD_HEADING.exec(heading);
  if (kw) return { marker: kw[1], title: clean(kw[2]) };
  const lone = LETTER_ONLY.exec(heading);
  if (lone) return { marker: lone[1], title: null };
  const lt = LETTER_TITLE.exec(heading);
  if (lt) return { marker: lt[1], title: clean(lt[2]) };
  return { marker: null, title: null };
}

const fold = (s: string) => s.replace(/\s+/g, " ").trim().toLocaleLowerCase("de");

const isCardHeading = (line: string) => PART_HEADING.test(line) || LONE_LETTER.test(line) || LETTER_WITH_TITLE.test(line);

/**
 * Remove a first line that only repeats the title. An exact repeat goes away.
 * A line that merely ends with the title ("Berger Logistik: Weiterbildung im
 * Herbst") also goes, unless it was the whole first block: then it carries
 * the company name, so it stays as a plain intro line.
 */
function dropTitleLine(blocks: string[][], title: string | undefined): string[][] {
  const wanted = title ? fold(title) : "";
  if (!wanted || blocks.length === 0) return blocks;
  const [first, ...rest] = blocks;
  const line = fold(first[0]);
  const exact = line === wanted;
  const suffix = !exact && line.endsWith(wanted) && /[\s:\-,.]/.test(line.charAt(line.length - wanted.length - 1));
  if (!exact && !(suffix && first.length > 1)) return blocks;
  const remaining = first.slice(1);
  return remaining.length > 0 ? [remaining, ...rest] : rest;
}

export function passageBlocks(body: string, title?: string): PassageBlock[] {
  const raw = body
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.split("\n").map((l) => l.trim()).filter((l) => l !== ""))
    .filter((lines) => lines.length > 0);

  const blocks = dropTitleLine(raw, title);
  const qualifying = blocks.filter((lines) => isCardHeading(lines[0])).length;
  const asCards = qualifying >= 2;

  return blocks.map((lines): PassageBlock =>
    asCards && isCardHeading(lines[0])
      ? { kind: "card", heading: lines[0], lines: lines.slice(1), ...parseCardHeading(lines[0]) }
      : { kind: "text", lines },
  );
}

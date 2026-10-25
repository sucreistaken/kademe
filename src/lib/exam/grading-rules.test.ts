import { describe, expect, it } from "vitest";
import { SEED_BANK, SEED_PARTS } from "@/db/seed-bank";
import { skillLevelFromCriteria } from "./grading";
import {
  COPIED_MIN_WORDS,
  copiedShare,
  isCopiedFromTask,
  isTooShort,
  looksNotGerman,
  otherLanguageShare,
  ruleProposal,
  ruleVerdict,
  wordTokens,
  type RuleInput,
  type RuleVerdict,
} from "./grading-rules";
import { CALIBRATION_FIXTURES } from "./grading-calibration/fixtures";
import { resolveTask } from "./grading-calibration/tasks";

const EM_DASH = "\u2014";
const TASK = "Ihr Freund Tim hat Ihnen diese Nachricht geschickt: „Hallo! Am Samstag mache ich eine Grillparty im Park. Hast du Zeit? Wann kannst du kommen?“ Schreiben Sie Tim eine Antwort.";

const input = (text: string, over: Partial<RuleInput> = {}): RuleInput => ({
  section: "WRITING",
  text,
  taskText: TASK,
  minWords: 20,
  register: "informell (du)",
  ...over,
});

describe("copy of the task", () => {
  it("tokenises like a reader: lower case words and numbers, punctuation gone", () => {
    expect(wordTokens("Hallo, Tim! 180 000 Gäste – gut.")).toEqual(["hallo", "tim", "180", "000", "gäste", "gut"]);
  });

  it("is 1 for the task text pasted back and low for an answer that picks up a phrase", () => {
    expect(copiedShare("Hallo! Am Samstag mache ich eine Grillparty im Park. Hast du Zeit? Wann kannst du kommen?", TASK)).toBe(1);
    expect(copiedShare("Hallo Tim, ich habe Zeit. Am Samstag mache ich auch etwas anderes.", TASK)).toBeLessThan(0.5);
    expect(copiedShare("", TASK)).toBe(0);
  });

  it("calls an answer a copy at 80 percent and at least six words", () => {
    expect(isCopiedFromTask("Hallo! Am Samstag mache ich eine Grillparty im Park. Hast du Zeit?", TASK)).toBe(true);
    // Pasted with a greeting of its own around it: still a copy.
    expect(isCopiedFromTask("Hallo Tim! Am Samstag mache ich eine Grillparty im Park. Hast du Zeit? Wann kannst du kommen?", TASK)).toBe(true);
    // Half copied, half own: not a copy, the model judges it.
    expect(isCopiedFromTask("Hallo Tim, ich komme gern, danke. Am Samstag mache ich eine Grillparty im Park. Ich bringe Salat mit und Kuchen.", TASK)).toBe(false);
    expect(wordTokens("Am Samstag mache ich").length).toBeLessThan(COPIED_MIN_WORDS);
    expect(isCopiedFromTask("Am Samstag mache ich", TASK)).toBe(false);
  });
});

describe("language", () => {
  const english = "Dear Mrs Wagner, I am sorry but I am sick and I cannot come to the course tomorrow. Could you please tell me what the homework is?";
  const turkish = "Merhaba Tim, davetin için çok teşekkür ederim. Cumartesi günü müsaitim ve parka gelebilirim. Görüşürüz, Elif";
  const spanish = "Hola Tim, muchas gracias por la invitación. El sábado tengo tiempo y puedo llegar a las cuatro. Un saludo, Elena";
  const arabic = "مرحبا تيم شكرا جزيلا على الدعوة. يوم السبت لدي وقت وأستطيع أن آتي في الساعة الرابعة";
  const german = "Hallo Tim, ich habe am Samstag Zeit. Ich komme um vier Uhr und bringe einen Salat mit. Viele Grüße, Elif";

  it("recognises English, Turkish, Spanish and Arabic script as not German", () => {
    for (const text of [english, turkish, spanish, arabic]) expect(looksNotGerman(text), text).toBe(true);
  });

  it("never takes German, names or form fields for another language", () => {
    expect(looksNotGerman(german)).toBe(false);
    expect(otherLanguageShare(german)).toBe(0);
    expect(looksNotGerman("1. Familienname: Costa 2. Straße und Hausnummer: Hafenstraße 9 3. Postleitzahl und Wohnort: 28195 Bremen")).toBe(false);
    expect(looksNotGerman("Hallo")).toBe(false); // too few words to say
  });

  it("holds for every German text of the starter bank", () => {
    const texts = SEED_BANK.stimuli.map((s) => s.body).concat(SEED_BANK.items.map((i) => i.prompt));
    expect(texts.length).toBeGreaterThan(200);
    for (const text of texts) expect(looksNotGerman(text), text.slice(0, 80)).toBe(false);
  });
});

describe("length", () => {
  it("is too short below half of the minimum", () => {
    expect(isTooShort("Hallo Tim ich komme", 20)).toBe(true);
    expect(isTooShort(Array(10).fill("Wort").join(" "), 20)).toBe(false);
    expect(isTooShort(Array(9).fill("Wort").join(" "), 20)).toBe(true);
  });
});

describe("ruleVerdict", () => {
  it("is EMPTY for nothing written or only punctuation", () => {
    expect(ruleVerdict(input(""))).toEqual({ reason: "EMPTY", flags: ["EMPTY"] });
    expect(ruleVerdict(input(" ... "))).toEqual({ reason: "EMPTY", flags: ["EMPTY"] });
  });

  it("is COPIED_TASK for the task text handed back, before any other check", () => {
    expect(ruleVerdict(input("Hallo! Am Samstag mache ich eine Grillparty im Park. Hast du Zeit? Wann kannst du kommen?"))?.reason).toBe("COPIED_TASK");
  });

  it("is NOT_GERMAN for an answer in another language without a German sentence", () => {
    expect(ruleVerdict(input("Dear Tim, thank you for the invitation. I will come on Saturday and bring a salad."))).toEqual({ reason: "NOT_GERMAN", flags: ["NOT_GERMAN"] });
  });

  it("leaves an answer with a German sentence to the model, even in another language otherwise", () => {
    expect(ruleVerdict(input("Dear Tim, thank you for the invitation. Ich komme am Samstag gern. I will bring a salad and a cake."))).toBeNull();
  });

  it("is FEW_WORDS for a few words without a sentence, EMPTY and TOO_SHORT for three or fewer", () => {
    expect(ruleVerdict(input("Hallo Tim. Danke. Samstag. Park. Salat. Tschüss. Elif"))).toEqual({ reason: "FEW_WORDS", flags: ["TOO_SHORT"] });
    expect(ruleVerdict(input("Hallo danke", { section: "SPEAKING" }))).toEqual({ reason: "FEW_WORDS", flags: ["EMPTY", "TOO_SHORT"] });
    expect(ruleVerdict({ section: "SPEAKING", text: "Ähm. Äh.", taskText: TASK })).toEqual({ reason: "FEW_WORDS", flags: ["EMPTY", "TOO_SHORT"] });
  });

  it("does not judge a few words as failed when they are a short sentence or a form", () => {
    expect(ruleVerdict(input("Ich komme gern. Danke."))).toBeNull();
    const form = "Costa, Hafenstraße 9, 28195 Bremen, Abend, Karte";
    expect(ruleVerdict(input(form, { minWords: 10, register: "Formular (Stichworte)" }))).toBeNull();
    // A message task asks for sentences; the same fragments there are a failed answer.
    expect(ruleVerdict(input(form, { minWords: 20, register: "informell (du)" }))?.reason).toBe("FEW_WORDS");
  });

  it("handles cases written after the rules: a German greeting around English, a word list, a mixed answer, a copy with a new greeting", () => {
    expect(ruleVerdict(input("Liebe Anna, I would like to come to your party on Saturday and I will bring a cake."))?.reason).toBe("NOT_GERMAN");
    expect(ruleVerdict(input("Brot Milch Käse Butter Eier"))?.reason).toBe("FEW_WORDS");
    // A telegraphic but real A1 answer (nine words, five points) is the model's to grade, not a rule's.
    expect(ruleVerdict({ section: "SPEAKING", text: "Ich Student. Wohne Berlin. Hobby Fußball. Name ist Ali.", taskText: TASK })).toBeNull();
    // Turkish with one German sentence of her own: the model grades it (at least A1), no rule.
    expect(ruleVerdict(input("Merhaba Tim, davetin için çok teşekkür ederim ve cumartesi günü gelebilirim. Ich komme um vier Uhr gern. Görüşürüz."))).toBeNull();
    expect(ruleVerdict(input("Hallo Tina! Am Samstag mache ich eine Grillparty im Park. Hast du Zeit? Wann kannst du kommen?"))?.reason).toBe("COPIED_TASK");
  });

  it("does not call a correct form a copy of the task, nor a few field values a failed answer", () => {
    for (const item of SEED_PARTS.writing.items.filter((i) => /formular/i.test(i.rubric?.register ?? ""))) {
      const answer = (item.rubric?.contentPoints ?? []).join(" ");
      const verdict = ruleVerdict({ section: "WRITING", text: answer, taskText: item.prompt, minWords: item.content.kind === "WRITING" ? item.content.minWords : undefined, register: item.rubric?.register });
      expect(verdict, item.prompt.slice(0, 40)).toBeNull();
    }
    // The same labels in a message task are a copy.
    expect(ruleVerdict(input(TASK))?.reason).toBe("COPIED_TASK");
    expect(ruleVerdict(input(TASK, { register: "Formular (Stichworte)", minWords: 10 }))).toBeNull();
  });

  it("never fires on a long German answer", () => {
    const text = "Hallo Tim, danke für die Einladung. Am Samstag habe ich leider erst ab 16 Uhr Zeit, weil ich vorher arbeiten muss. Dann komme ich gern und bringe einen Salat mit.";
    expect(ruleVerdict(input(text))).toBeNull();
  });
});

describe("ruleProposal", () => {
  const verdict: RuleVerdict = { reason: "COPIED_TASK", flags: ["COPIED_TASK"] };

  it("is A0 in every criterion, with the flags and a reason in the teacher's language", () => {
    const en = ruleProposal("WRITING", verdict, "en");
    expect(en.criteria.map((c) => [c.criterion, c.level, c.assessable])).toEqual([
      ["TASK_ACHIEVEMENT", "A0", true],
      ["COHERENCE", "A0", true],
      ["RANGE", "A0", true],
      ["ACCURACY", "A0", true],
    ]);
    expect(en.overallLevel).toBe("A0");
    expect(en.flags).toEqual(["COPIED_TASK"]);
    expect(en.summary).toContain("repeats the task text");
    expect(en.summary).toContain("fixed rule");
    expect(ruleProposal("WRITING", verdict, "tr").summary).toContain("görev metnini");
    expect(skillLevelFromCriteria(en)).toBe("A0");
  });

  it("keeps pronunciation not assessable for speaking", () => {
    const p = ruleProposal("SPEAKING", { reason: "EMPTY", flags: ["EMPTY"] }, "en");
    expect(p.criteria).toHaveLength(6);
    const pron = p.criteria.find((c) => c.criterion === "PRONUNCIATION")!;
    expect(pron.assessable).toBe(false);
    expect(skillLevelFromCriteria(p)).toBe("A0");
    expect(p.summary).toContain("No speech could be transcribed");
  });

  it("has no em dash in any text", () => {
    for (const reason of ["EMPTY", "COPIED_TASK", "NOT_GERMAN", "FEW_WORDS"] as const) {
      for (const section of ["WRITING", "SPEAKING"] as const) {
        for (const locale of ["en", "tr"] as const) {
          const p = ruleProposal(section, { reason, flags: [] }, locale);
          expect(JSON.stringify(p).includes(EM_DASH)).toBe(false);
        }
      }
    }
  });
});

describe("rules on the calibration fixtures", () => {
  it("decide every A0 fixture with the flags it asks for, and no other fixture", () => {
    for (const f of CALIBRATION_FIXTURES) {
      const task = resolveTask(f.task);
      const verdict = ruleVerdict({
        section: task.section,
        text: f.text,
        taskText: task.prompt,
        minWords: task.minWords,
        register: task.register,
      });
      if (f.target === "A0") {
        expect(verdict, f.id).not.toBeNull();
        for (const flag of f.flags.must) expect(verdict!.flags, f.id).toContain(flag);
      } else {
        expect(verdict, f.id).toBeNull();
      }
    }
  });
});

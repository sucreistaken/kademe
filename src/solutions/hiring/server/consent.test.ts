import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake, writesOf } from "./test-fake-db";

vi.mock("@/db", async () => ({ db: (await import("./test-fake-db")).fakeDb() }));

import { HIRING_CONSENT_EN, HIRING_CONSENT_PREVIOUS, HIRING_CONSENT_TR } from "../consent-default";
import { ensureHiringConsentText, loadConsentText } from "./consent";

const ORG = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  fake.ops = [];
});

describe("ensureHiringConsentText", () => {
  it("returns the organisation's newest hiring text without writing when it is the current built-in text", async () => {
    fake.respond = (op) => (op.table === "consent_texts" && op.kind === "select" ? [{ id: "ct-1", version: 2, body: { tr: HIRING_CONSENT_TR, en: HIRING_CONSENT_EN } }] : []);
    expect(await ensureHiringConsentText(ORG)).toBe("ct-1");
    const read = fake.ops.find((o) => o.table === "consent_texts")!;
    expect(read.where).toContain('"consent_texts"."org_id" = $');
    expect(read.where).toContain('"consent_texts"."solution" = $');
    expect(read.params).toEqual(expect.arrayContaining([ORG, "HIRING"]));
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("writes the built-in hiring text once when the organisation has none, under the organisation's lock", async () => {
    fake.respond = (op) => (op.kind === "insert" ? [{ id: "ct-new" }] : op.table === "organizations" ? [{ id: ORG }] : []);
    expect(await ensureHiringConsentText(ORG)).toBe("ct-new");
    const lock = fake.ops.find((o) => o.table === "organizations")!;
    // NO KEY UPDATE: ensure calls still run one at a time, while the FOR KEY SHARE every foreign key insert takes on the org row is not blocked.
    expect(lock.lock).toBe("no key update");
    expect(lock.params).toEqual([ORG]);
    const [insert] = writesOf(fake.ops);
    expect(insert.values).toEqual({ orgId: ORG, solution: "HIRING", version: 1, body: { tr: HIRING_CONSENT_TR, en: HIRING_CONSENT_EN } });
  });

  it("takes a text another invitation wrote while it waited for the lock, and writes none", async () => {
    let reads = 0;
    fake.respond = (op) => {
      if (op.table === "consent_texts" && op.kind === "select") return reads++ === 0 ? [] : [{ id: "ct-race", version: 1, body: { tr: HIRING_CONSENT_TR, en: HIRING_CONSENT_EN } }];
      return op.table === "organizations" ? [{ id: ORG }] : [];
    };
    expect(await ensureHiringConsentText(ORG)).toBe("ct-race");
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("writes the new built-in text as the next version when the newest one is an older built-in text (invitations already sent keep theirs)", async () => {
    const old = HIRING_CONSENT_PREVIOUS[0];
    fake.respond = (op) => {
      if (op.table === "consent_texts" && op.kind === "select") return [{ id: "ct-old", version: 1, body: { tr: old.tr, en: old.en } }];
      if (op.kind === "insert") return [{ id: "ct-v2" }];
      return op.table === "organizations" ? [{ id: ORG }] : [];
    };
    expect(await ensureHiringConsentText(ORG)).toBe("ct-v2");
    expect(fake.ops.find((o) => o.table === "organizations")?.lock).toBe("no key update");
    const writes = writesOf(fake.ops);
    // Only an insert: the old version stays as it is, for the invitations that froze it.
    expect(writes).toHaveLength(1);
    expect(writes[0].kind).toBe("insert");
    expect(writes[0].values).toEqual({ orgId: ORG, solution: "HIRING", version: 2, body: { tr: HIRING_CONSENT_TR, en: HIRING_CONSENT_EN } });
  });

  it("keeps a text the built-in never was (written by someone else), and writes none", async () => {
    fake.respond = (op) => (op.table === "consent_texts" && op.kind === "select" ? [{ id: "ct-own", version: 3, body: { tr: "Kendi metnimiz", en: "Our own text" } }] : []);
    expect(await ensureHiringConsentText(ORG)).toBe("ct-own");
    expect(writesOf(fake.ops)).toEqual([]);
  });

  it("discloses every technical record the flow stores, in both languages (C24 ruling)", () => {
    expect(HIRING_CONSENT_TR).toBe(
      "Bu değerlendirme, bu pozisyona yaptığın başvuruyu değerlendirmek için hazırlandı. Cevapların (yazdıkların, seçimlerin, yüklediğin dosyalar ve video ya da ses sorularında görüntün ve sesin) ve teknik kayıtlar (linki ilk açtığında ve onay verdiğinde IP adresin ve tarayıcı bilgin, aşamaları başlattığın ve bitirdiğin zamanlar, sürenin dolup dolmadığı, yüklemelerin tamamlanıp tamamlanmadığı, bağlantının son görüldüğü an) saklanır. Bu değerlendirmede ekranın, sekmelerin ya da pencere hareketlerin izlenmez. Cevaplarını yalnızca bu pozisyonun işe alım ekibi görür; ekipteki değerlendiriciler aynı sorular ve aynı ölçütlerle, birbirinden bağımsız puanlar. Yapay zekâ seni puanlamaz, sıralamaz ya da elemez; yalnızca video ve ses cevaplarını yazıya döker (bunun için kayıtlar ElevenLabs'e gönderilir). Duygu, kişilik ya da yüz tanıma yapılmaz. Hiçbir kayıt seni otomatik olarak elemez; kararı insanlar verir. Kayıtlar kurumun belirlediği süre boyunca saklanır, sonra silinir. Verilerinle ilgili taleplerini bu sayfadaki veri hakları bağlantısından iletebilirsin.",
    );
    expect(HIRING_CONSENT_EN).toBe(
      "This assessment was prepared to evaluate your application for this role. Your answers (what you write, your choices, the files you upload, and your picture and voice in video or audio questions) and technical records (your IP address and browser information when you first open the link and when you consent, when you start and finish each stage, whether time ran out, whether uploads completed, when the connection was last seen) are kept. Your screen, tabs and windows are not monitored in this assessment. Only this role's hiring team sees your answers; the evaluators on the team score them independently, with the same questions and the same criteria. AI does not score, rank or reject you; it only transcribes your video and audio answers (the recordings are sent to ElevenLabs for that). No emotion, personality or face recognition is used. Nothing here rejects you automatically; people make the decision. Records are kept for the period the organisation sets and then deleted. You can send requests about your data from the data rights link on this page.",
    );
  });

  it("promises no monitoring, no AI scoring, and says who sees the answers", () => {
    expect(HIRING_CONSENT_TR).toContain("izlenmez");
    expect(HIRING_CONSENT_TR).toContain("puanlamaz");
    expect(HIRING_CONSENT_EN).toContain("not monitored");
    expect(HIRING_CONSENT_EN).toContain("does not score");
    for (const text of [HIRING_CONSENT_TR, HIRING_CONSENT_EN]) expect(text).not.toContain("\u2014");
  });
});

describe("loadConsentText", () => {
  it("reads the frozen text by its id inside the invitation's organisation", async () => {
    fake.respond = (op) => (op.table === "consent_texts" ? [{ id: "ct-9", orgId: ORG, solution: "HIRING", version: 1, body: { tr: "a", en: "b" } }] : []);
    expect((await loadConsentText(ORG, "ct-9")).id).toBe("ct-9");
    expect(fake.ops[0].params).toEqual(expect.arrayContaining(["ct-9", ORG]));
  });

  it("refuses loudly when the frozen text is gone (consents keep it with RESTRICT)", async () => {
    fake.respond = () => [];
    await expect(loadConsentText(ORG, "ct-9")).rejects.toThrow(/consent text/);
  });
});

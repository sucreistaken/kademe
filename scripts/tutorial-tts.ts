/**
 * Narration for the "how it works" tutorials: one mp3 per step, per section,
 * per candidate language, spoken by one calm voice from the step's caption
 * (tutorial.<SECTION>.<stepId> in candidate.<locale>.json).
 *
 * Writes public/tutorial/<locale>/<SECTION>/<stepId>.mp3 (mono, 48 kbps) and
 * src/components/candidate/exam/tutorial/narration.json with each file's
 * length and the hash of what it says. A step whose hash is unchanged and
 * whose file exists is skipped, so a rerun after a quota error only makes
 * what is missing. A step that cannot be made keeps no entry: the player then
 * shows its caption and times it from the words.
 *
 * Run with: pnpm tutorial:tts            (all languages)
 *           pnpm tutorial:tts --lang de  (one language)
 */
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CANDIDATE_LOCALES } from "../src/i18n/locale";
import { SECTIONS } from "../src/lib/exam/types";
import { TUTORIAL_SCRIPTS } from "../src/components/candidate/exam/tutorial/scripts";
import { narrationHash } from "../src/components/candidate/exam/tutorial/narration-hash";
import type { NarrationFile } from "../src/components/candidate/exam/tutorial/narration";

const ROOT = process.cwd();
const NARRATION_JSON = path.join(ROOT, "src/components/candidate/exam/tutorial/narration.json");
/** One calm voice for every language (Kore, voice A of the seed format). */
const VOICE = "A" as const;
const BITRATE_KBPS = 48;
const RETRIES = 5;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const { synthesizeSpeech, ttsAvailable, VOICES, wavToMp3 } = await import("../src/lib/tts");
  if (!ttsAvailable()) {
    console.log("NOT VERIFIED: GOOGLE_AI_API_KEY is not set, no narration was made.");
    process.exit(2);
  }
  const only = arg("lang");
  const locales = CANDIDATE_LOCALES.filter((l) => !only || l === only);
  const data: NarrationFile = existsSync(NARRATION_JSON) ? JSON.parse(readFileSync(NARRATION_JSON, "utf8")) : {};
  const save = () => writeFileSync(NARRATION_JSON, `${JSON.stringify(data, null, 2)}\n`);
  let made = 0;
  let kept = 0;
  let failed = 0;
  for (const locale of locales) {
    const messages = JSON.parse(readFileSync(path.join(ROOT, `src/i18n/messages/candidate.${locale}.json`), "utf8")) as {
      tutorial: Record<string, Record<string, string>>;
    };
    data[locale] ??= {};
    for (const section of SECTIONS) {
      const steps = TUTORIAL_SCRIPTS[section].steps;
      const entries = (data[locale][section] ??= {});
      // Steps a script no longer has lose their entry and their file.
      for (const id of Object.keys(entries)) {
        if (!steps.some((s) => s.id === id)) {
          rmSync(path.join(ROOT, "public", entries[id].src), { force: true });
          delete entries[id];
        }
      }
      for (const step of steps) {
        const text = messages.tutorial?.[section]?.[step.id];
        if (!text) {
          console.log(`  MISSING caption ${locale} ${section}.${step.id}`);
          failed++;
          continue;
        }
        const hash = narrationHash(text, VOICES[VOICE]);
        const src = `/tutorial/${locale}/${section}/${step.id}.mp3`;
        const file = path.join(ROOT, "public", src);
        if (entries[step.id]?.hash === hash && existsSync(file)) {
          kept++;
          continue;
        }
        let done = false;
        for (let attempt = 1; attempt <= RETRIES && !done; attempt++) {
          try {
            const { wav, durationMs, model } = await synthesizeSpeech(text, { voice: VOICE, language: locale });
            const mp3 = wavToMp3(wav, { bitrateKbps: BITRATE_KBPS });
            if (!mp3) throw new Error("ffmpeg could not make the mp3");
            if (!durationMs) throw new Error("no length in the audio");
            mkdirSync(path.dirname(file), { recursive: true });
            writeFileSync(file, mp3);
            entries[step.id] = { src, ms: durationMs, hash };
            save();
            made++;
            done = true;
            console.log(`  ok   ${locale} ${section}.${step.id} ${(durationMs / 1000).toFixed(1)} s (${model})`);
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            const quota = /429|RESOURCE_EXHAUSTED|quota/i.test(reason);
            console.log(`  fail ${locale} ${section}.${step.id} (attempt ${attempt}): ${reason.slice(0, 160)}`);
            if (attempt < RETRIES) await sleep((quota ? 30_000 : 5_000) * attempt);
          }
        }
        if (!done) {
          delete entries[step.id];
          rmSync(file, { force: true });
          save();
          failed++;
        }
      }
    }
  }
  save();
  console.log(`\n${made} made, ${kept} unchanged, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

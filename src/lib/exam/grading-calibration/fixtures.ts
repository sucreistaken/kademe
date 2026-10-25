import { WRITING_A_FIXTURES } from "./fixtures-writing-a";
import { WRITING_B1_FIXTURES } from "./fixtures-writing-b1";
import { WRITING_B2_FIXTURES } from "./fixtures-writing-b2";
import { WRITING_C_FIXTURES } from "./fixtures-writing-c";
import { SPEAKING_FIXTURES } from "./fixtures-speaking";
import type { CalibrationFixture } from "./types";

/** Every calibration fixture, writing first. */
export const CALIBRATION_FIXTURES: CalibrationFixture[] = [
  ...WRITING_A_FIXTURES,
  ...WRITING_B1_FIXTURES,
  ...WRITING_B2_FIXTURES,
  ...WRITING_C_FIXTURES,
  ...SPEAKING_FIXTURES,
];

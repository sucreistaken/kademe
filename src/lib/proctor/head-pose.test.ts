import { describe, it, expect } from "vitest";
import { yawPitchFromMatrix } from "./head-pose";

type M3 = number[][];
const rad = (d: number) => (d * Math.PI) / 180;

const Rx = (d: number): M3 => {
  const c = Math.cos(rad(d));
  const s = Math.sin(rad(d));
  return [
    [1, 0, 0],
    [0, c, -s],
    [0, s, c],
  ];
};
const Ry = (d: number): M3 => {
  const c = Math.cos(rad(d));
  const s = Math.sin(rad(d));
  return [
    [c, 0, s],
    [0, 1, 0],
    [-s, 0, c],
  ];
};
const Rz = (d: number): M3 => {
  const c = Math.cos(rad(d));
  const s = Math.sin(rad(d));
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ];
};
const mul = (a: M3, b: M3): M3 =>
  a.map((row, i) => b[0].map((_, j) => row.reduce((acc, _v, k) => acc + a[i][k] * b[k][j], 0)));

/** Pack a 3x3 rotation plus scale and translation into a column-major 4x4. */
function toColumnMajor(r: M3, scale = 1, t: [number, number, number] = [0, 0, 0]): number[] {
  const out = new Array<number>(16).fill(0);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) out[col * 4 + row] = r[row][col] * scale;
  }
  out[12] = t[0];
  out[13] = t[1];
  out[14] = t[2];
  out[15] = 1;
  return out;
}

/** Face pose in our convention: pitch negative = down, i.e. Rx(-pitch). */
const pose = (yaw: number, pitch: number, roll: number) =>
  mul(mul(Ry(yaw), Rx(-pitch)), Rz(roll));

describe("yawPitchFromMatrix", () => {
  it("reads the identity as looking straight ahead", () => {
    const p = yawPitchFromMatrix(toColumnMajor(pose(0, 0, 0)));
    expect(p.yawDeg).toBeCloseTo(0, 6);
    expect(p.pitchDeg).toBeCloseTo(0, 6);
    expect(p.rollDeg).toBeCloseTo(0, 6);
  });

  it("recovers a pure yaw", () => {
    const p = yawPitchFromMatrix(toColumnMajor(Ry(30)));
    expect(Math.abs(p.yawDeg - 30)).toBeLessThan(0.5);
    expect(Math.abs(p.pitchDeg)).toBeLessThan(0.5);
  });

  it("reports Rx(+15), forward tipped down, as pitch -15", () => {
    const p = yawPitchFromMatrix(toColumnMajor(Rx(15)));
    expect(Math.abs(p.pitchDeg - -15)).toBeLessThan(0.5);
    expect(Math.abs(p.yawDeg)).toBeLessThan(0.5);
  });

  it("reports Ry(30) * Rx(-15) as yaw 30, pitch +15", () => {
    const p = yawPitchFromMatrix(toColumnMajor(mul(Ry(30), Rx(-15))));
    expect(Math.abs(p.yawDeg - 30)).toBeLessThan(0.5);
    expect(Math.abs(p.pitchDeg - 15)).toBeLessThan(0.5);
  });

  it("recovers combined yaw, pitch and roll across a grid", () => {
    for (const yaw of [-60, -30, 0, 25, 70]) {
      for (const pitch of [-40, -20, 0, 15, 35]) {
        for (const roll of [-20, 0, 10]) {
          const p = yawPitchFromMatrix(toColumnMajor(pose(yaw, pitch, roll)));
          expect(Math.abs(p.yawDeg - yaw)).toBeLessThan(0.5);
          expect(Math.abs(p.pitchDeg - pitch)).toBeLessThan(0.5);
          expect(Math.abs(p.rollDeg - roll)).toBeLessThan(0.5);
        }
      }
    }
  });

  it("ignores scale and translation", () => {
    const m = toColumnMajor(pose(-35, -25, 5), 7.5, [3, -2, -40]);
    const p = yawPitchFromMatrix(m);
    expect(Math.abs(p.yawDeg - -35)).toBeLessThan(0.5);
    expect(Math.abs(p.pitchDeg - -25)).toBeLessThan(0.5);
    expect(Math.abs(p.rollDeg - 5)).toBeLessThan(0.5);
  });

  it("accepts a Float32Array", () => {
    const p = yawPitchFromMatrix(new Float32Array(toColumnMajor(pose(20, -10, 0))));
    expect(Math.abs(p.yawDeg - 20)).toBeLessThan(0.5);
    expect(Math.abs(p.pitchDeg - -10)).toBeLessThan(0.5);
  });

  it("would misread a row-major matrix, which is why the layout matters", () => {
    const colMajor = toColumnMajor(pose(30, -20, 10));
    const rowMajor = [0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].map((c) => colMajor[c * 4 + r]));
    const p = yawPitchFromMatrix(rowMajor);
    expect(Math.abs(p.pitchDeg - -20)).toBeGreaterThan(0.5);
  });

  it("rejects a matrix of the wrong size", () => {
    expect(() => yawPitchFromMatrix([1, 0, 0, 1])).toThrow(RangeError);
  });
});

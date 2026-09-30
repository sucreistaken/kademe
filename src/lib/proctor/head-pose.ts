/**
 * Head pose from a face transformation matrix. Pure maths, no model code.
 *
 * Input is the 4x4 matrix MediaPipe Face Landmarker returns in
 * `facialTransformationMatrixes[i].data`: 16 numbers, assumed COLUMN-MAJOR
 * (m[col * 4 + row]), the usual OpenGL layout, with the translation in
 * m[12..14]. Only the upper-left 3x3 rotation part is used; its columns are
 * normalised first because the matrix may carry the face's scale.
 *
 * Decomposition: R = Ry(yaw) * Rx(x) * Rz(roll), in a right-handed frame with
 * y up and the face looking along +z towards the camera. In that frame a
 * positive rotation about x tips the face's forward vector down, so we report
 * pitchDeg = -x: negative pitch means looking down, which is what the gaze
 * rule in signals.ts expects. The sign of yaw (left versus right) does not
 * matter to any caller; only |yaw| is used.
 *
 * NOT YET VERIFIED against real MediaPipe output. Before trusting pitch, log
 * the matrix while deliberately looking down at the keyboard and confirm the
 * value goes negative. If the layout turns out row-major, or the canonical face
 * looks along -z, fix it here and nowhere else.
 */

export type HeadPose = { yawDeg: number; pitchDeg: number; rollDeg: number };

const DEG = 180 / Math.PI;

export function yawPitchFromMatrix(m: ArrayLike<number>): HeadPose {
  if (m.length !== 16) {
    throw new RangeError(`expected a 4x4 matrix (16 values), got ${m.length}`);
  }
  // Column-major: element (row, col) lives at m[col * 4 + row].
  const col = (c: number) => {
    const x = m[c * 4];
    const y = m[c * 4 + 1];
    const z = m[c * 4 + 2];
    const len = Math.hypot(x, y, z) || 1;
    return [x / len, y / len, z / len];
  };
  const [c0, c1, c2] = [col(0), col(1), col(2)];
  // R[row][col] = c{col}[row]
  const r02 = c2[0];
  const r12 = c2[1];
  const r22 = c2[2];
  const r10 = c0[1];
  const r11 = c1[1];

  // Clamp: rounding can push |r12| a hair past 1 at straight up or down.
  const x = Math.asin(Math.max(-1, Math.min(1, -r12)));
  return {
    yawDeg: Math.atan2(r02, r22) * DEG,
    pitchDeg: -x * DEG,
    rollDeg: Math.atan2(r10, r11) * DEG,
  };
}

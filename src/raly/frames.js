import { Quaternion, Vector3 } from 'three';
import { SPINE_SAMPLES } from './anatomy.js';

// World-space frames of the bent mantle at each spine sample: position,
// face normal (the patterned back), side (across the sheet), half-width and
// fan. Ribbons use them to stay out of the mantle; effects use them to find
// its edges.
export function createBodyFrames(specimen, scale) {
  const K = SPINE_SAMPLES;
  const sheet = specimen.spine.sheet;
  const points = Array.from({ length: K }, () => new Vector3());
  const faces = Array.from({ length: K }, () => new Vector3());
  const sides = Array.from({ length: K }, () => new Vector3());
  const widths = new Float32Array(K), fans = sheet.map(s => s.fan);
  const q = new Quaternion(), local = new Quaternion();
  return {
    points, faces, sides, widths, fans,
    update(body, breadth = 1) {
      for (let k = 0; k < K; k++) {
        local.fromArray(body.spineQuat, k * 4);
        q.copy(body.quaternion).multiply(local);
        points[k].fromArray(body.spinePos, k * 3).multiplyScalar(scale).applyQuaternion(body.quaternion).add(body.position);
        faces[k].copy(sheet[k].face).applyQuaternion(q);
        sides[k].copy(sheet[k].side).applyQuaternion(q);
        widths[k] = sheet[k].width * scale * breadth;
      }
    },
    /** A world point on the mantle at spine fraction t and across s in [-1, 1]. */
    pointOn(t, s, out) {
      const k = Math.min(K - 1, Math.max(0, Math.round(t * (K - 1))));
      const w = widths[k], fan = fans[k];
      const across = w * Math.sin(s * fan) / fan, depth = -w * (1 - Math.cos(s * fan)) / fan;
      return out.copy(points[k]).addScaledVector(sides[k], across).addScaledVector(faces[k], depth);
    },
    /** Interpolated frame at spine fraction t: fills point, face, side; returns width. */
    frameAt(t, point, face, side) {
      const x = Math.min(1, Math.max(0, t)) * (K - 1), k = Math.min(K - 2, Math.floor(x)), f = x - k;
      point.copy(points[k]).lerp(points[k + 1], f);
      face.copy(faces[k]).lerp(faces[k + 1], f).normalize();
      side.copy(sides[k]).lerp(sides[k + 1], f).normalize();
      return widths[k] + (widths[k + 1] - widths[k]) * f;
    },
    nearest(point) {
      let best = Infinity, index = 0;
      for (let k = 0; k < K; k++) {
        const d = points[k].distanceToSquared(point);
        if (d < best) { best = d; index = k; }
      }
      return index;
    },
  };
}

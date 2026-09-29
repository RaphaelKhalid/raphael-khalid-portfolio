import { Matrix4, Quaternion, Vector3 } from 'three';
import { SPINE_SAMPLES } from './anatomy.js';

// The swimmer steers only the leading edge. The spine then replays the path
// the head actually took (like a body following its own wake), so turns
// curl the whole organism instead of rotating it as a rigid object.
//
// Behaviors, in priority order:
//   startle  a fast flick near the body: flinch away, blanch, then flash
//   feed     plankton in the water (a click): swim through it
//   follow   the cursor is moving: lead toward it at a capped turn rate
//   circle   the cursor has paused: orbit it lazily, like a whale shark
//   wander   nobody around: irregular waypoints with glide strokes
//
// Everything is critically damped or rate-limited; nothing snaps.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const Z = new Vector3(0, 0, 1);

// `faithful`: follow the cursor closely (head straight to it, body trailing),
// and never startle from cursor speed alone; only a click startles.
export function createSwimmer(specimen, { scale, random = Math.random, faithful = false }) {
  const K = SPINE_SAMPLES;
  const rest = specimen.spine.samples.map(p => p.clone());
  const restLength = specimen.spine.length;
  const bodyWorld = restLength * scale;
  const restMid = rest[Math.floor(K / 2)].clone();

  // Local basis: forward (out of the head), dorsal (the patterned back) and
  // side. The world basis is built from heading and a transported dorsal.
  const forwardLocal = specimen.spine.headForward.clone();
  const dorsalLocal = Z.clone().addScaledVector(forwardLocal, -Z.dot(forwardLocal)).normalize();
  const sideLocal = new Vector3().crossVectors(forwardLocal, dorsalLocal);
  const localBasisT = new Matrix4().makeBasis(forwardLocal, dorsalLocal, sideLocal).transpose();

  const head = new Vector3(), heading = new Vector3(), dorsal = new Vector3(), omega = new Vector3();
  const trail = [];
  const TRAIL_STEP = 0.035, TRAIL_MAX = Math.ceil((bodyWorld + 1.5) / TRAIL_STEP);
  let speed = 0, bank = 0, bankVelocity = 0, elapsed = 0, stroke = 0;

  const target = new Vector3(), waypoint = new Vector3();
  let nextWaypoint = 0, mode = 'wander', inspecting = false;
  const pointer = new Vector3(), pointerVelocity = new Vector3();
  let pointerPresent = false, pointerTime = -Infinity, pointerSeen = -Infinity, pointerSpeed = 0, pointerSample = -Infinity;
  let startleUntil = -Infinity, startleCooldown = -Infinity, orbitSign = 1;
  const flee = new Vector3();

  const output = {
    position: new Vector3(), quaternion: new Quaternion(), scale,
    spinePos: new Float32Array(K * 3), spineQuat: new Float32Array(K * 4),
    head, center: new Vector3(), speed: 0, effort: 0, mode: 'wander',
    mood: { curious: 0, startle: 0, feed: 0, turn: 0 },
  };

  // Scratch
  const worldBasis = new Matrix4(), G = new Quaternion(), Ginv = new Quaternion();
  const qa = new Quaternion(), qb = new Quaternion(), identity = new Quaternion();
  const dir = new Vector3(), axis = new Vector3(), va = new Vector3(), vb = new Vector3();
  const segment = new Vector3(), spinePoint = new Vector3(), sideW = new Vector3(), up = new Vector3();
  const probe = new Vector3(), tail = new Vector3(), headDir = new Vector3(), along = new Vector3();
  const quats = Array.from({ length: K }, () => new Quaternion());
  const points = Array.from({ length: K }, () => new Vector3());

  function pointAt(distance, out) {
    let remaining = distance, from = head;
    for (let i = 0; i < trail.length; i++) {
      const step = from.distanceTo(trail[i]);
      if (remaining <= step && step > 1e-6) return out.copy(from).lerp(trail[i], remaining / step);
      remaining -= step; from = trail[i];
    }
    // Past the recorded wake: continue straight out behind.
    if (trail.length > 1) tail.subVectors(trail[trail.length - 1], trail[trail.length - 2]).normalize();
    else tail.copy(heading).negate();
    return out.copy(from).addScaledVector(tail, remaining);
  }
  function directionAt(distance, out) {
    const d = Math.max(distance, 0.12);
    pointAt(d - 0.12, probe);
    pointAt(d + 0.12, out);
    return out.subVectors(probe, out).normalize();
  }
  function layStraightTrail() {
    trail.length = 0;
    for (let i = 1; i <= TRAIL_MAX; i++) trail.push(head.clone().addScaledVector(heading, -i * TRAIL_STEP));
  }

  function restPose(bounds) {
    // Rest orientation (G = identity) centered in view, like study 05's pose.
    heading.copy(forwardLocal); dorsal.copy(dorsalLocal); omega.set(0, 0, 0); speed = 0; bank = 0; bankVelocity = 0;
    const center = bounds?.center ?? new Vector3();
    head.copy(rest[0]).sub(restMid).multiplyScalar(scale).add(center);
    layStraightTrail();
  }

  function pickWaypoint(b) {
    waypoint.set(
      (random() * 2 - 1) * b.xRange + b.center.x,
      b.yMin + random() * (b.yMax - b.yMin),
      b.zMin + random() * (b.zMax - b.zMin),
    );
    // With wrapping edges, it sometimes just keeps going, out one side and
    // back in the other.
    if (b.wrap && random() < 0.35) waypoint.x = Math.sign(heading.x || 1) * (b.halfWidth + 6);
    nextWaypoint = elapsed + 6 + random() * 5;
  }

  function steer(dt, desiredSpeed, turnGain) {
    dir.subVectors(target, head);
    dir.z *= 0.7;
    if (dir.lengthSq() < 1e-6) dir.copy(heading);
    dir.normalize();
    const angle = Math.acos(clamp(heading.dot(dir), -1, 1));
    axis.crossVectors(heading, dir);
    // Turning straight around: loop through the screen plane.
    if (axis.lengthSq() < 1e-6) axis.copy(Z).multiplyScalar(orbitSign);
    axis.normalize();
    const maxTurn = (0.34 + 0.24 * Math.min(speed, 3)) * turnGain;
    va.copy(axis).multiplyScalar(Math.min(angle * 1.4, maxTurn));
    omega.lerp(va, 1 - Math.exp(-dt * 2.2));
    const rate = omega.length();
    if (rate > 1e-6) {
      qa.setFromAxisAngle(vb.copy(omega).divideScalar(rate), rate * dt);
      heading.applyQuaternion(qa).normalize();
      dorsal.applyQuaternion(qa);
    }
    // Keep the patterned back mostly toward the viewer, a little upward.
    up.set(0, 0.35, 1).addScaledVector(heading, -heading.dot(up.set(0, 0.35, 1)));
    if (up.lengthSq() > 0.02) dorsal.lerp(up.normalize(), 1 - Math.exp(-dt * 0.9));
    dorsal.addScaledVector(heading, -dorsal.dot(heading)).normalize();

    // Glide strokes: a slow surge rather than a constant cruise.
    stroke += dt * (0.34 + 0.12 * Math.min(speed, 2));
    const surge = 1 + 0.2 * Math.sin(stroke * Math.PI * 2);
    const accel = desiredSpeed > speed ? (mode === 'startle' ? 3.5 : 1.1) : 0.9;
    speed += (desiredSpeed * surge - speed) * (1 - Math.exp(-dt * accel));
    head.addScaledVector(heading, speed * dt);

    // Roll into the turn, flashing the pale underside.
    const bankTarget = clamp(-omega.dot(dorsal) * 0.75, -0.75, 0.75);
    const damping = Math.exp(-3 * dt), impulse = bankVelocity + 3 * (bank - bankTarget);
    bank = bankTarget + (bank - bankTarget + impulse * dt) * damping;
    bankVelocity = (bankVelocity - 3 * impulse * dt) * damping;
  }

  function decide(dt, env) {
    const b = env.bounds;
    const sinceMove = elapsed - pointerTime;
    if (elapsed < startleUntil) {
      mode = 'startle';
      target.copy(flee);
      return 4.2;
    }
    if (env.food) {
      mode = 'feed';
      target.copy(env.food);
      return 1.25 + Math.min(1.5, head.distanceTo(env.food) * 0.3);
    }
    if (pointerPresent && elapsed - pointerSeen < 14) {
      const distance = Math.hypot(head.x - pointer.x, head.y - pointer.y);
      if (faithful && sinceMove < 2.5 && distance > 0.45) {
        mode = 'follow';
        target.copy(pointer);
        return clamp(distance * 1.2, 0.6, 5.5);
      }
      if (!faithful && sinceMove < 0.9 && distance > 1.8) {
        mode = 'follow';
        target.copy(pointer);
        return clamp(distance * 0.5, 0.7, 3.0);
      }
      // Orbit: aim a little ahead around the cursor so the path curves.
      mode = 'circle';
      const radius = 2.35;
      const angle = Math.atan2(head.y - pointer.y, head.x - pointer.x) + orbitSign * 0.95;
      target.set(pointer.x + Math.cos(angle) * radius, pointer.y + Math.sin(angle) * radius * 0.8, pointer.z + 0.9 * Math.sin(elapsed * 0.37));
      return 1.35;
    }
    mode = 'wander';
    if (elapsed > nextWaypoint || head.distanceTo(waypoint) < 1.4) pickWaypoint(b);
    target.copy(waypoint);
    return 1.0;
  }

  function keepInside(env) {
    const b = env.bounds;
    if (!b.wrap) target.x = clamp(target.x, b.center.x - b.xRange, b.center.x + b.xRange);
    target.y = clamp(target.y, b.yMin, b.yMax);
    target.z = clamp(target.z, b.zMin, b.zMax);
    // If the head has drifted out, aim well back inside.
    if (!b.wrap && Math.abs(head.x - b.center.x) > b.xRange + 0.6) target.x = b.center.x - Math.sign(head.x - b.center.x) * b.xRange * 0.4;
    if (head.y < b.yMin - 0.4) target.y = b.yMin + 1.2;
    if (head.y > b.yMax + 0.6) target.y = b.yMax - 1.2;
  }

  function buildBody() {
    // World orientation from heading, dorsal and bank.
    qa.setFromAxisAngle(heading, bank);
    up.copy(dorsal).applyQuaternion(qa);
    sideW.crossVectors(heading, up);
    worldBasis.makeBasis(heading, up, sideW).multiply(localBasisT);
    G.setFromRotationMatrix(worldBasis);
    Ginv.copy(G).invert();

    // Record the wake.
    if (!trail.length || head.distanceTo(trail[0]) >= TRAIL_STEP) {
      trail.unshift(head.clone());
      if (trail.length > TRAIL_MAX) trail.length = TRAIL_MAX;
    }

    // Each spine sample is rotated by how much the path has turned between
    // where the head is now and where it was when it passed that point.
    directionAt(0, headDir);
    const swim = Math.min(1, 0.25 + speed * 0.5) * (inspecting ? 0.35 : 1);
    for (let k = 0; k < K; k++) {
      const a = k / (K - 1);
      directionAt(a * bodyWorld, along);
      qb.setFromUnitVectors(headDir, along);
      quats[k].copy(Ginv).multiply(qb).multiply(G);
      quats[k].slerp(identity, 0.28);
      // A lateral body wave that grows toward the tail: the stroke that
      // drives it forward.
      const sway = 0.11 * swim * Math.pow(a, 1.2) * Math.sin(a * 5.2 - elapsed * 2.1);
      quats[k].multiply(qa.setFromAxisAngle(dorsalLocal, sway));
    }
    points[0].copy(rest[0]);
    for (let k = 1; k < K; k++) {
      qb.copy(quats[k - 1]).slerp(quats[k], 0.5);
      segment.subVectors(rest[k], rest[k - 1]).applyQuaternion(qb);
      points[k].copy(points[k - 1]).add(segment);
    }
    for (let k = 0; k < K; k++) {
      points[k].toArray(output.spinePos, k * 3);
      output.spineQuat.set([quats[k].x, quats[k].y, quats[k].z, quats[k].w], k * 4);
    }
    // Place the group so the head sits exactly on the steered point.
    output.quaternion.copy(G);
    output.position.copy(head).sub(spinePoint.copy(rest[0]).multiplyScalar(scale).applyQuaternion(G));
    bodyPoint(Math.floor(K / 2), output.center);
  }

  function bodyPoint(k, out) {
    out.set(output.spinePos[k * 3], output.spinePos[k * 3 + 1], output.spinePos[k * 3 + 2]);
    return out.multiplyScalar(scale).applyQuaternion(output.quaternion).add(output.position);
  }

  function update(dt, env) {
    elapsed += dt;
    if (inspecting) {
      speed *= Math.exp(-dt * 3);
      buildBody();
    } else {
      let remaining = Math.min(dt, 0.1);
      while (remaining > 1e-6) {
        const step = Math.min(remaining, 1 / 90);
        remaining -= step;
        const desiredSpeed = decide(step, env);
        keepInside(env);
        steer(step, desiredSpeed * (env.energy ?? 1), mode === 'startle' ? 1.6 : faithful && mode === 'follow' ? 2.3 : 1);
      }
      buildBody();
    }
    const m = output.mood, r = 1 - Math.exp(-dt * 2);
    m.curious += (((mode === 'follow' || mode === 'circle') ? 1 : 0) - m.curious) * r;
    m.startle += ((elapsed < startleUntil ? 1 : 0) - m.startle) * (1 - Math.exp(-dt * (elapsed < startleUntil ? 9 : 1.2)));
    m.feed += ((env.feeding ? 1 : 0) - m.feed) * r;
    m.turn += (clamp(omega.z * 1.2, -1, 1) - m.turn) * r;
    output.speed = speed;
    output.effort = clamp(speed * 0.3 + omega.length() * 0.5, 0, 1);
    output.mode = inspecting ? 'inspecting' : mode;
    return output;
  }

  return {
    update,
    bodyPoint,
    /** Distance from a world point to the body, and the spine fraction there. */
    nearest(point) {
      let best = Infinity, bestK = 0;
      for (let k = 0; k < K; k += 2) {
        const d = bodyPoint(k, spinePoint).distanceTo(point);
        if (d < best) { best = d; bestK = k; }
      }
      return { distance: best, fraction: bestK / (K - 1) };
    },
    setPointer(point) {
      if (!point) { pointerPresent = false; return; }
      const now = elapsed;
      if (pointerPresent) {
        // Speed over the time since the previous sample, not the last move.
        pointerVelocity.subVectors(point, pointer).divideScalar(Math.max(now - pointerSample, 1 / 120));
        pointerSpeed = pointerSpeed * 0.6 + pointerVelocity.length() * 0.4;
      } else pointerVelocity.set(0, 0, 0);
      pointer.copy(point); pointerPresent = true; pointerSeen = now; pointerSample = now;
      if (pointerVelocity.lengthSq() > 0.01) pointerTime = now;
      // A fast flick close to the body is a threat.
      if (!faithful && !inspecting && pointerSpeed > 11 && now > startleCooldown && this.nearest(point).distance < 2.1) {
        startleUntil = now + 1.7; startleCooldown = now + 4;
        flee.copy(head).sub(point).setZ(0);
        if (flee.lengthSq() < 1e-4) flee.set(-heading.y, heading.x, 0);
        flee.normalize().multiplyScalar(6).add(head);
        pointerSpeed = 0;
      }
      // Circle in whichever direction it is already turning.
      if (mode !== 'circle') orbitSign = omega.z >= 0 ? 1 : -1;
    },
    /**
     * Contact with a wall or the floor: shifts the whole body (head and wake)
     * by `shift` and turns the heading along the wall instead of into it, so
     * it slides and glances off rather than stopping dead.
     */
    collide(shift, normal) {
      head.add(shift);
      trail.forEach(point => point.add(shift));
      const into = heading.dot(normal);
      if (into < 0) {
        heading.addScaledVector(normal, -into * 1.15).normalize();
        dorsal.addScaledVector(heading, -dorsal.dot(heading)).normalize();
        const spin = omega.dot(normal);
        omega.addScaledVector(normal, -spin * 0.5);
      }
    },
    /** Moves the whole body (head and wake) by `shift`, unchanged otherwise. */
    teleport(shift, bounds) {
      head.add(shift);
      trail.forEach(point => point.add(shift));
      // Carry on in the same direction, back into view.
      if (bounds) {
        waypoint.set(bounds.center.x + Math.sign(heading.x || 1) * bounds.xRange * 0.3, head.y, head.z);
        nextWaypoint = elapsed + 5 + random() * 3;
      }
    },
    /** Re-enters at `point`, swimming along `direction`. */
    enterFrom(point, direction) {
      head.copy(point);
      heading.copy(direction).normalize();
      dorsal.set(0, 0.35, 1).addScaledVector(heading, -heading.dot(dorsal.set(0, 0.35, 1))).normalize();
      omega.set(0, 0, 0); bank = 0; bankVelocity = 0;
      layStraightTrail();
      waypoint.set(point.x - Math.sign(point.x) * (Math.abs(point.x) + 2), point.y, 0);
      nextWaypoint = elapsed + 6;
    },
    /** A deliberate touch: it flinches away from `point`, blanching. */
    poke(point) {
      if (inspecting) return;
      startleUntil = elapsed + 1.7; startleCooldown = elapsed + 1;
      flee.copy(head).sub(point).setZ(0);
      if (flee.lengthSq() < 1e-4) flee.set(-heading.y, heading.x, 0);
      flee.normalize().multiplyScalar(6).add(head);
    },
    setInspect(value, bounds) {
      inspecting = value;
      if (value) restPose(bounds);
    },
    reset(bounds) {
      elapsed = 0; nextWaypoint = 0; mode = 'wander'; startleUntil = -Infinity; pointerPresent = false;
      restPose(bounds);
      // Glide in along the organism's own axis, toward the first waypoint.
      speed = 0.9;
      Object.assign(output.mood, { curious: 0, startle: 0, feed: 0, turn: 0 });
    },
    get mode() { return mode; },
    get heading() { return heading; },
  };
}

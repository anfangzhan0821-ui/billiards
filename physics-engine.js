/*
 * GPL prototype physics module.
 *
 * This file is intentionally isolated. The model follows billiards physics
 * concepts used by GPL-3.0 projects such as tailuge/billiards: cue strike
 * offset -> angular velocity, sliding friction, rolling/spin-down friction,
 * ball collision and cushion energy loss. It is not a full port yet, but it is
 * the seam for replacing the lightweight path model with a professional engine.
 */
(function () {
  const EPS = 1e-6;

  function v(a, b) {
    return { x: b.x - a.x, y: b.y - a.y };
  }

  function add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y };
  }

  function mul(a, n) {
    return { x: a.x * n, y: a.y * n };
  }

  function dot(a, b) {
    return a.x * b.x + a.y * b.y;
  }

  function len(a) {
    return Math.hypot(a.x, a.y);
  }

  function norm(a) {
    const l = len(a) || 1;
    return { x: a.x / l, y: a.y / l };
  }

  function perp(a) {
    return { x: -a.y, y: a.x };
  }

  function railBox(table, radius) {
    return {
      left: table.railLeft ?? table.x + radius,
      right: table.railRight ?? table.x + table.w - radius,
      top: table.railTop ?? table.y + radius,
      bottom: table.railBottom ?? table.y + table.h - radius,
      midX: table.midX ?? table.x + table.w / 2,
      midY: table.midY ?? table.y + table.h / 2,
      cornerOpen: radius * 3.85,
      sideOpen: radius * 2.65,
    };
  }

  function tableCenter(table) {
    return {
      x: table.midX ?? table.x + table.w / 2,
      y: table.midY ?? table.y + table.h / 2,
    };
  }

  function boundarySegments(table) {
    return table.boundarySegments || [];
  }

  function isRailPocketOpening(p, pockets, table, radius, axis) {
    if (!Array.isArray(pockets)) return false;
    const box = railBox(table, radius);
    return pockets.some((pocket) => {
      const isMiddlePocket = Math.abs(pocket.x - box.midX) < table.w * 0.12;
      const onLeft = pocket.x < box.midX;
      const onTop = pocket.y < box.midY;
      if (axis === "y") {
        const onSameHorizontalRail = (p.y < box.top && onTop) || (p.y > box.bottom && !onTop);
        if (!onSameHorizontalRail) return false;
        if (isMiddlePocket) return Math.abs(p.x - pocket.x) <= box.sideOpen;
        return onLeft ? p.x <= box.left + box.cornerOpen : p.x >= box.right - box.cornerOpen;
      }
      const onSameVerticalRail = (p.x < box.left && onLeft) || (p.x > box.right && !onLeft);
      if (!onSameVerticalRail || isMiddlePocket) return false;
      return onTop ? p.y <= box.top + box.cornerOpen : p.y >= box.bottom - box.cornerOpen;
    });
  }

  function clampTable(p, vel, rollVel, table, radius, pockets) {
    let bounced = false;
    const center = tableCenter(table);
    boundarySegments(table).forEach((segment) => {
      const closest = closestPointOnSegment(p, segment.a, segment.b);
      const toBall = v(closest, p);
      const dist = len(toBall);
      if (dist >= radius || inPocketMouth(p, nearestPocket(closest, pockets), table, radius, vel)) return;
      const inward = norm(v(closest, center));
      const correction = radius - dist + 0.15;
      p.x += inward.x * correction;
      p.y += inward.y * correction;
      const approach = dot(vel, inward);
      if (approach < 0) {
        vel.x -= (1.72 * approach) * inward.x;
        vel.y -= (1.72 * approach) * inward.y;
        rollVel.x -= (0.55 * approach) * inward.x;
        rollVel.y -= (0.55 * approach) * inward.y;
        bounced = true;
      }
    });
    if (bounced) return true;

    const box = railBox(table, radius);
    if ((p.x < box.left || p.x > box.right) && !isRailPocketOpening(p, pockets, table, radius, "x")) {
      p.x = Math.max(box.left, Math.min(box.right, p.x));
      vel.x *= -0.74;
      vel.y *= 0.86;
      rollVel.x *= -0.58;
      bounced = true;
    }
    if ((p.y < box.top || p.y > box.bottom) && !isRailPocketOpening(p, pockets, table, radius, "y")) {
      p.y = Math.max(box.top, Math.min(box.bottom, p.y));
      vel.y *= -0.74;
      vel.x *= 0.86;
      rollVel.y *= -0.58;
      bounced = true;
    }
    return bounced;
  }

  function distanceToSegment(p, a, b) {
    return len(v(closestPointOnSegment(p, a, b), p));
  }

  function closestPointOnSegment(p, a, b) {
    const ab = v(a, b);
    const abLen2 = dot(ab, ab);
    if (abLen2 < EPS) return { ...a };
    const t = Math.max(0, Math.min(1, dot(v(a, p), ab) / abLen2));
    return add(a, mul(ab, t));
  }

  function nearestPocket(p, pockets) {
    if (!Array.isArray(pockets) || !pockets.length) return null;
    return pockets.reduce((closest, pocket) => (
      len(v(p, pocket)) < len(v(p, closest)) ? pocket : closest
    ), pockets[0]);
  }

  function inPocketMouth(p, pocket, table, radius, velocity) {
    if (!pocket) return false;
    const box = railBox(table, radius);
    const isMiddlePocket = Math.abs(pocket.x - box.midX) < table.w * 0.12;
    const onLeft = pocket.x < box.midX;
    const onTop = pocket.y < box.midY;
    const toPocket = norm(v(p, pocket));
    const speed = len(velocity);
    const movingIntoPocket = speed < EPS || dot(norm(velocity), toPocket) > 0.2;
    const dist = len(v(p, pocket));

    if (isMiddlePocket) {
      const alongRail = Math.abs(p.x - pocket.x) <= box.sideOpen * 0.9;
      const depthFromRail = onTop ? box.top - p.y : p.y - box.bottom;
      const inMouth = depthFromRail >= -radius * 1.25 && depthFromRail <= radius * 2.2;
      return movingIntoPocket && alongRail && inMouth && dist <= radius * 2.25;
    }

    const hDepth = onLeft ? box.left - p.x : p.x - box.right;
    const vDepth = onTop ? box.top - p.y : p.y - box.bottom;
    return movingIntoPocket
      && hDepth >= -radius * 1.8
      && hDepth <= radius * 2.8
      && vDepth >= -radius * 1.8
      && vDepth <= radius * 2.8
      && dist <= radius * 2.2;
  }

  function pocketHit(prev, p, pockets, radius, table, velocity) {
    if (!Array.isArray(pockets)) return null;
    const threshold = radius * 1.18;
    for (let i = 0; i < pockets.length; i++) {
      if (distanceToSegment(pockets[i], prev, p) <= threshold || inPocketMouth(p, pockets[i], table, radius, velocity)) {
        return { index: i, point: pockets[i] };
      }
    }
    return null;
  }

  function cutInfo(cutAngle) {
    const bands = [
      { max: 15, grade: "厚球", from: 100, to: 82, start: 0 },
      { max: 32, grade: "3/4 球", from: 82, to: 64, start: 15 },
      { max: 52, grade: "半球", from: 64, to: 38, start: 32 },
      { max: 72, grade: "1/4 球", from: 38, to: 12, start: 52 },
      { max: 90, grade: "薄球", from: 12, to: 0, start: 72 },
    ];
    const band = bands.find((item) => cutAngle < item.max) || bands[bands.length - 1];
    const t = Math.max(0, Math.min(1, (cutAngle - band.start) / (band.max - band.start)));
    return { grade: band.grade, overlap: Math.round(band.from + (band.to - band.from) * t) };
  }

  function aimData(cue, target, pocket, radius) {
    const objectToPocket = norm(v(target, pocket));
    const ghost = add(target, mul(objectToPocket, -radius * 2));
    const cueToGhost = norm(v(cue, ghost));
    const tangent = perp(objectToPocket);
    const sideSign = dot(cueToGhost, tangent) >= 0 ? 1 : -1;
    const aPoint = add(target, mul(objectToPocket, -radius));
    const bPoint = add(target, mul(tangent, radius * sideSign));
    const cPoint = add(aPoint, v(bPoint, aPoint));
    const cutCos = Math.max(-1, Math.min(1, dot(objectToPocket, cueToGhost)));
    const cutAngle = Math.acos(cutCos) * 180 / Math.PI;
    return { target, pocket, ghost, objectToPocket, cueToGhost, tangent, sideSign, aPoint, bPoint, cPoint, cutAngle };
  }

  function simulateCuePath(data, table, options) {
    const radius = options.radius;
    const cloth = options.cloth || "medium";
    const power = options.power || 6;
    const side = options.side || 0;
    const spin = options.spin || "stun";
    const pockets = options.pockets || [];
    const normal = data.objectToPocket;
    const tangent = perp(normal);
    const tangentComponent = dot(data.cueToGhost, tangent);
    const normalComponent = Math.max(0, dot(data.cueToGhost, normal));
    const start = { ...data.ghost };
    const clothScale = cloth === "fast" ? 1.18 : cloth === "slow" ? 0.82 : 1;
    const powerSpeed = (250 + power * 48) * clothScale;
    const spinResidual = spin === "follow"
      ? normalComponent * powerSpeed * 0.24
      : spin === "draw"
        ? -normalComponent * powerSpeed * 0.2
        : normalComponent * powerSpeed * 0.035;
    let velocity = add(
      mul(tangent, tangentComponent * powerSpeed * 0.98),
      mul(normal, spinResidual),
    );

    // Roll velocity represents R * omega at the cloth contact patch.
    const spinRatio = spin === "follow" ? 1.25 : spin === "draw" ? -1.35 : 0.02;
    let rollVelocity = mul(data.cueToGhost, powerSpeed * spinRatio);
    let sideSpin = side * 0.075 * powerSpeed;
    let p = { ...start };
    let rollAngle = options.rollAngle || 0;
    let t = 0;
    const points = [{ ...p, t, speed: len(velocity), rollAngle }];
    const dt = 1 / 60;
    const slideAccel = cloth === "fast" ? 125 : cloth === "slow" ? 205 : 165;
    const rollAccel = cloth === "fast" ? 22 : cloth === "slow" ? 42 : 31;
    const maxSeconds = 13;

    for (let i = 0; i < maxSeconds / dt; i++) {
      const slip = v(velocity, rollVelocity);
      const slipMag = len(slip);
      const speed = len(velocity);
      if (speed < 4 && len(rollVelocity) < 4) break;

      if (slipMag > 6) {
        const slipDir = norm(slip);
        const dv = Math.min(slideAccel * dt, slipMag * 0.18);
        velocity = add(velocity, mul(slipDir, dv));
        rollVelocity = add(rollVelocity, mul(slipDir, -dv * 1.25));
      } else if (speed > EPS) {
        rollVelocity = { ...velocity };
        const dv = Math.min(rollAccel * dt, speed);
        velocity = add(velocity, mul(norm(velocity), -dv));
        rollVelocity = { ...velocity };
      }

      if (Math.abs(sideSpin) > 0.01 && speed > 18) {
        const curveDir = perp(norm(velocity));
        const swerve = Math.min(Math.abs(sideSpin) * 0.00008 * speed * dt, 0.42) * Math.sign(sideSpin);
        velocity = add(velocity, mul(curveDir, swerve * 60));
        sideSpin *= 0.992;
      }

      const previous = { ...p };
      const step = mul(velocity, dt);
      p = add(p, step);
      rollAngle += len(step) / radius;
      const hit = pocketHit(previous, p, pockets, radius, table, velocity);
      if (hit) {
        t += dt;
        const entry = { ...p };
        const entrySpeed = len(velocity);
        const pocketDistance = len(v(entry, hit.point));
        const pocketTravelTime = Math.max(0.16, Math.min(0.34, pocketDistance / Math.max(entrySpeed * 0.45, 130)));
        points.push({ ...entry, t, speed: entrySpeed * 0.45, rollAngle, pocketEntry: true, pocketIndex: hit.index });
        t += pocketTravelTime;
        rollAngle += pocketDistance / radius;
        points.push({ ...hit.point, t, speed: 0, rollAngle, pocketed: true, pocketIndex: hit.index });
        break;
      }
      if (clampTable(p, velocity, rollVelocity, table, radius, pockets)) sideSpin *= 0.55;
      t += dt;
      points.push({ ...p, t, speed: len(velocity), rollAngle });
    }

    return points;
  }

  window.ProBilliardsPhysics = {
    aimData,
    cutInfo,
    simulateCuePath,
  };
})();

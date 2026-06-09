const canvas = document.querySelector("#tableCanvas");
const ctx = canvas.getContext("2d");
const aimDiagramCanvas = document.querySelector("#aimDiagramCanvas");
const aimCtx = aimDiagramCanvas.getContext("2d");
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const panels = [...document.querySelectorAll("[data-panel]")];
const tableNote = document.querySelector("#tableNote");
const aimModal = document.querySelector("#aimModal");
const overlapSlider = document.querySelector("#overlapSlider");
const cutLabel = document.querySelector("#cutLabel");
const aimHint = document.querySelector("#aimHint");
const separationLabel = document.querySelector("#separationLabel");
const drillSelect = document.querySelector("#drillSelect");
const gameTypeSelect = document.querySelector("#gameType");
const powerSlider = document.querySelector("#powerSlider");
const sideSlider = document.querySelector("#sideSlider");
const railCountSelect = document.querySelector("#railCount");
const showBlockersInput = document.querySelector("#showBlockers");
const gameToggleBtn = document.querySelector("#gameToggleBtn");
const spinCycleBtn = document.querySelector("#spinCycleBtn");
const powerCycleBtn = document.querySelector("#powerCycleBtn");
const sideCycleBtn = document.querySelector("#sideCycleBtn");
const railCycleBtn = document.querySelector("#railCycleBtn");
const blockersBtn = document.querySelector("#blockersBtn");
const previewCueBall = document.querySelector("#previewCueBall");
const previewObjectBall = document.querySelector("#overlapPreview .object-ball");
const powerFill = document.querySelector("#powerFill");
const hitDot = document.querySelector("#hitDot");
const bigCueBall = document.querySelector("#bigCueBall");
const confirmCueBtn = document.querySelector("#confirmCueBtn");
const menuBtn = document.querySelector("#menuBtn");
const gameMenu = document.querySelector("#gameMenu");
const menuModeButtons = [...document.querySelectorAll("[data-menu-mode]")];
const menuDrillButtons = [...document.querySelectorAll("[data-drill-shortcut]")];
const menuGameButtons = [...document.querySelectorAll("[data-game-shortcut]")];
const menuClothButtons = [...document.querySelectorAll("[data-cloth-shortcut]")];
const menuRailBtn = document.querySelector("#menuRailBtn");
const menuBlockersBtn = document.querySelector("#menuBlockersBtn");
const menuPhotoBtn = document.querySelector("#menuPhotoBtn");
let pendingCue = { spin: "follow", side: 0, x: 0, y: 0 };

const art = {
  table: loadImage("assets/cocos2d/eightBall/eightBall_DeskImage.png"),
  atlas: loadImage("assets/cocos2d/eightBall/EightBall.png"),
};

const ballFrames = {
  cue: { x: 608, y: 464, w: 50, h: 50 },
  target: { x: 660, y: 464, w: 50, h: 50 },
  eight: { x: 608, y: 704, w: 50, h: 50 },
};
const BALL_DRAW_SCALE = 1.96;
const IMPACT_HOLD_SECONDS = 0.08;
const POCKET_DROP_SECONDS = 0.72;

const state = {
  mode: "aim",
  selectedPocket: 5,
  dragBall: null,
  spin: "follow",
  power: 6,
  side: 0,
  cloth: "medium",
  railCount: 1,
  showBlockers: true,
  potted: false,
  cueScratched: false,
  overlap: 50,
  aimGrade: "半球",
  aimAngle: 0,
  animation: null,
  balls: {
    cue: { x: 245, y: 250, color: "#f4f5ee", label: "", rollAngle: 0 },
    target: { x: 560, y: 210, color: "#f0c247", label: "1", rollAngle: 0 },
    blocker1: { x: 420, y: 250, color: "#d53f3f", label: "障" },
    blocker2: { x: 510, y: 320, color: "#3359d6", label: "障" },
  },
};

const table = {
  x: 56,
  y: 54,
  w: 788,
  h: 388,
  ballR: 15,
};

const pockets = [
  { x: table.x, y: table.y },
  { x: table.x + table.w / 2, y: table.y },
  { x: table.x + table.w, y: table.y },
  { x: table.x, y: table.y + table.h },
  { x: table.x + table.w / 2, y: table.y + table.h },
  { x: table.x + table.w, y: table.y + table.h },
];

const drills = {
  thin: { cue: [235, 300], target: [568, 206], pocket: 2 },
  half: { cue: [270, 250], target: [580, 250], pocket: 2 },
  thick: { cue: [280, 206], target: [590, 230], pocket: 2 },
  long: { cue: [205, 360], target: [650, 150], pocket: 2 },
};
const drillOrder = ["thin", "half", "thick", "long"];
const spinOrder = ["follow", "stun", "draw"];
const spinIcon = { follow: "↟", stun: "•", draw: "↡" };
const spinName = { follow: "高杆", stun: "中杆", draw: "低杆" };
const sideOrder = [-4, 0, 4];
let drillIndex = -1;
let menuOpen = false;

function loadImage(src) {
  const image = new Image();
  image.src = src;
  image.addEventListener("load", drawTable);
  return image;
}

function v(a, b) {
  return { x: b.x - a.x, y: b.y - a.y };
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

function mul(a, n) {
  return { x: a.x * n, y: a.y * n };
}

function len(a) {
  return Math.hypot(a.x, a.y);
}

function norm(a) {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
}

function clampBall(ball) {
  ball.x = Math.max(table.x + table.ballR, Math.min(table.x + table.w - table.ballR, ball.x));
  ball.y = Math.max(table.y + table.ballR, Math.min(table.y + table.h - table.ballR, ball.y));
  return ball;
}

function aimData() {
  return window.ProBilliardsPhysics.aimData(state.balls.cue, state.balls.target, pockets[state.selectedPocket], table.ballR);
}

function cutInfo(cutAngle) {
  return window.ProBilliardsPhysics.cutInfo(cutAngle);
}

function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += len(v(points[i - 1], points[i]));
  return total;
}

function pointOnPath(points, progress) {
  if (points.length <= 1) return points[0] || { x: 0, y: 0 };
  const total = pathLength(points);
  if (!total) return points[points.length - 1];
  let remaining = total * Math.max(0, Math.min(1, progress));
  for (let i = 1; i < points.length; i++) {
    const segment = len(v(points[i - 1], points[i]));
    if (remaining <= segment) {
      const t = segment ? remaining / segment : 0;
      return add(points[i - 1], mul(v(points[i - 1], points[i]), t));
    }
    remaining -= segment;
  }
  return points[points.length - 1];
}

function pointOnTimedPath(points, seconds) {
  if (points.length <= 1) return points[0] || { x: 0, y: 0 };
  if (typeof points[0].t !== "number") return pointOnPath(points, seconds);
  if (seconds <= points[0].t) return points[0];
  for (let i = 1; i < points.length; i++) {
    if (seconds <= points[i].t) {
      const span = points[i].t - points[i - 1].t || 1;
      const t = (seconds - points[i - 1].t) / span;
      const p = add(points[i - 1], mul(v(points[i - 1], points[i]), t));
      if (typeof points[i - 1].rollAngle === "number" && typeof points[i].rollAngle === "number") {
        p.rollAngle = points[i - 1].rollAngle + (points[i].rollAngle - points[i - 1].rollAngle) * t;
      }
      return p;
    }
  }
  return points[points.length - 1];
}

function simulateCueAfterCollision() {
  const data = aimData();
  return window.ProBilliardsPhysics.simulateCuePath(data, table, {
    radius: table.ballR,
    pockets,
    power: state.power,
    spin: state.spin,
    side: state.side,
    cloth: state.cloth,
    rollAngle: state.balls.cue.rollAngle || 0,
  });
}

function createObjectBallPath(data) {
  const startRoll = state.balls.target.rollAngle || 0;
  const points = [{ ...state.balls.target, t: 0, speed: 0, rollAngle: startRoll }];
  const start = { ...state.balls.target };
  const distance = len(v(start, data.pocket));
  const powerSpeed = 230 + state.power * 43;
  const initialSpeed = Math.max(190, Math.min(650, powerSpeed * Math.max(0.34, Math.cos(data.cutAngle * Math.PI / 180))));
  const rollAccel = state.cloth === "fast" ? 20 : state.cloth === "slow" ? 40 : 30;
  let traveled = 0;
  let speed = initialSpeed;
  let t = 0;
  const dt = 1 / 60;
  while (traveled < distance && speed > 8 && t < 8) {
    traveled = Math.min(distance, traveled + speed * dt);
    speed = Math.max(0, speed - rollAccel * dt);
    t += dt;
    const p = add(start, mul(data.objectToPocket, traveled));
    points.push({ ...p, t, speed, rollAngle: startRoll + traveled / table.ballR });
  }
  const last = points[points.length - 1];
  if (len(v(last, data.pocket)) > 0.5) {
    points.push({ ...data.pocket, t: t + 0.12, speed: 0, rollAngle: last.rollAngle });
  }
  return points;
}

function createShotAnimation() {
  const data = aimData();
  const impactPoint = { ...data.ghost };
  const cuePreDistance = len(v(state.balls.cue, impactPoint));
  const cuePreSpeed = 320 + state.power * 58;
  const cuePreDuration = Math.max(0.18, Math.min(0.75, cuePreDistance / cuePreSpeed));
  const startRoll = state.balls.cue.rollAngle || 0;
  const impactRoll = startRoll + cuePreDistance / table.ballR;
  const cuePreImpact = [
    { ...state.balls.cue, t: 0, rollAngle: startRoll },
    { ...impactPoint, t: cuePreDuration, rollAngle: impactRoll },
  ];
  const cueAfter = simulateCueAfterCollision();
  const cueAfterTimed = cueAfter.map((point) => ({ ...point, t: point.t + cuePreDuration, rollAngle: point.rollAngle + cuePreDistance / table.ballR }));
  const targetPath = createObjectBallPath(data).map((point) => ({ ...point, t: point.t + cuePreDuration }));
  const cuePocket = cueAfterTimed.find((point) => point.pocketed);
  const cuePocketIndex = cueAfterTimed.findIndex((point) => point.pocketed);
  const cuePocketEntry = cuePocketIndex > 0 ? norm(v(cueAfterTimed[cuePocketIndex - 1], cuePocket)) : data.cueToGhost;
  const cueScratched = Boolean(cuePocket);
  const cuePocketTime = cuePocket ? cuePocket.t : Infinity;
  const cueEnd = cueAfterTimed[cueAfterTimed.length - 1];
  const targetEnd = targetPath[targetPath.length - 1];
  const targetPocketTime = targetEnd.t;
  const durationSeconds = Math.max(
    cueEnd.t + (cueScratched ? POCKET_DROP_SECONDS : 0),
    targetPocketTime + POCKET_DROP_SECONDS,
  ) + 0.05;
  return {
    cuePreImpact,
    cueAfter: cueAfterTimed,
    targetPath,
    targetStart: { ...state.balls.target },
    targetEnd,
    targetPocket: {
      ...data.pocket,
      rollAngle: targetEnd.rollAngle,
      pocketAngle: Math.atan2(-data.objectToPocket.y, -data.objectToPocket.x),
    },
    targetPocketTime,
    cueEnd,
    cuePocket: cuePocket
      ? { ...cuePocket, pocketAngle: Math.atan2(-cuePocketEntry.y, -cuePocketEntry.x) }
      : cuePocket,
    cuePocketTime,
    cueScratched,
    startedAt: performance.now(),
    duration: (durationSeconds + IMPACT_HOLD_SECONDS) * 1000,
    cuePreDuration,
  };
}

function separationInfo(points, data) {
  if (!points || points.length < 8) return { angle: 0, direction: data.tangent };
  const start = points[0];
  const next = points[Math.min(points.length - 1, 8)];
  const direction = norm(v(start, next));
  const dot = Math.max(-1, Math.min(1, direction.x * data.objectToPocket.x + direction.y * data.objectToPocket.y));
  const angle = Math.round(Math.acos(dot) * 180 / Math.PI);
  return { angle, direction };
}

function escapePath() {
  const cue = state.balls.cue;
  const target = state.balls.target;
  const rails = Number(state.railCount);
  let mirrored = { ...target };
  if (rails >= 1) mirrored = { x: mirrored.x, y: 2 * table.y - mirrored.y };
  if (rails >= 2) mirrored = { x: 2 * (table.x + table.w) - mirrored.x, y: mirrored.y };
  if (rails >= 3) mirrored = { x: mirrored.x, y: 2 * (table.y + table.h) - mirrored.y };

  const dir = norm(v(cue, mirrored));
  const points = [cue];
  let current = { ...cue };
  let d = { ...dir };

  for (let i = 0; i < rails; i++) {
    const tx = d.x > 0 ? (table.x + table.w - current.x) / d.x : (table.x - current.x) / d.x;
    const ty = d.y > 0 ? (table.y + table.h - current.y) / d.y : (table.y - current.y) / d.y;
    const t = Math.min(tx > 0 ? tx : Infinity, ty > 0 ? ty : Infinity);
    current = add(current, mul(d, t));
    points.push(current);
    if (Math.abs(current.x - table.x) < 0.5 || Math.abs(current.x - table.x - table.w) < 0.5) d.x *= -1;
    if (Math.abs(current.y - table.y) < 0.5 || Math.abs(current.y - table.y - table.h) < 0.5) d.y *= -1;
  }
  points.push(target);
  return points;
}

function drawTable() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bg = ctx.createRadialGradient(450, 230, 70, 450, 250, 520);
  bg.addColorStop(0, "#26345c");
  bg.addColorStop(0.48, "#141a36");
  bg.addColorStop(1, "#080b18");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (art.table.complete && art.table.naturalWidth) {
    drawCoverImage(art.table, 8, 4, 884, 492);
  }

  if (!state.potted) drawSightLines();
  drawBalls();
  if (state.animation) {
    drawShotAnimation();
  }
  updateAimView();
}

function drawCoverImage(image, x, y, w, h) {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (image.naturalWidth - sw) / 2;
  const sy = (image.naturalHeight - sh) / 2;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function drawPockets() {
  pockets.forEach((p, i) => {
    const middle = i === 1 || i === 4;
    const r = middle ? 20 : 24;
    ctx.save();
    const pocketGlow = ctx.createRadialGradient(p.x - 5, p.y - 5, 2, p.x, p.y, r + 12);
    pocketGlow.addColorStop(0, "#1c1c1a");
    pocketGlow.addColorStop(0.62, "#020202");
    pocketGlow.addColorStop(1, "rgba(0,0,0,.72)");
    ctx.beginPath();
    ctx.fillStyle = pocketGlow;
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 5;
    ctx.strokeStyle = "#3a1b10";
    ctx.beginPath();
    if (middle) {
      ctx.ellipse(p.x, p.y, 28, 18, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
    }
    ctx.stroke();

    ctx.strokeStyle = i === state.selectedPocket ? "#ffd66a" : "rgba(255,255,255,.18)";
    ctx.lineWidth = i === state.selectedPocket ? 4 : 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  drawPocketJaw(table.x, table.y, 1, 1);
  drawPocketJaw(table.x + table.w, table.y, -1, 1);
  drawPocketJaw(table.x, table.y + table.h, 1, -1);
  drawPocketJaw(table.x + table.w, table.y + table.h, -1, -1);
  drawSidePocketJaw(table.x + table.w / 2, table.y, -1);
  drawSidePocketJaw(table.x + table.w / 2, table.y + table.h, 1);
}

function drawPocketJaw(x, y, sx, sy) {
  ctx.save();
  ctx.strokeStyle = "#271209";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + sx * 12, y + sy * 34);
  ctx.lineTo(x + sx * 34, y + sy * 12);
  ctx.stroke();
  ctx.restore();
}

function drawSidePocketJaw(x, y, sy) {
  ctx.save();
  ctx.strokeStyle = "#271209";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - 36, y + sy * 10);
  ctx.lineTo(x - 18, y + sy * 24);
  ctx.moveTo(x + 36, y + sy * 10);
  ctx.lineTo(x + 18, y + sy * 24);
  ctx.stroke();
  ctx.restore();
}

function drawTableSpot(x, y) {
  ctx.beginPath();
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.arc(x, y, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawSightLines() {
  const data = aimData();
  const cuePath = simulateCueAfterCollision();
  const sep = separationInfo(cuePath, data);
  drawLine(data.target, data.pocket, "#f0c247", 3, []);
  drawLine(state.balls.cue, data.ghost, "#f4f5ee", 2, [8, 8]);
  drawCircle(data.ghost, table.ballR, "rgba(255,255,255,.12)", "rgba(255,255,255,.78)", [5, 5]);
  drawPolyline(cuePath, "#7fc7ff", 3, [10, 7]);
  drawSeparationAngle(data, sep);
  drawAimPoints(data);

  if (state.mode === "angle") {
    const targetEnd = add(data.target, mul(data.objectToPocket, 270));
    drawLine(data.target, targetEnd, "#f0c247", 2, []);
  }

  if (state.mode === "escape") {
    const points = escapePath();
    for (let i = 0; i < points.length - 1; i++) {
      drawLine(points[i], points[i + 1], "#7fc7ff", 3, i === points.length - 2 ? [10, 6] : []);
      if (i > 0) drawCircle(points[i], 7, "#f0c247", "transparent");
    }
  }
}

function drawSeparationAngle(data, sep) {
  const center = { ...data.ghost };
  const radius = 42;
  const a0 = Math.atan2(data.objectToPocket.y, data.objectToPocket.x);
  const a1 = Math.atan2(sep.direction.y, sep.direction.x);
  ctx.save();
  ctx.strokeStyle = "rgba(155, 214, 255, .92)";
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, a0, a1, Math.abs(a1 - a0) > Math.PI);
  ctx.stroke();
  const mid = (a0 + a1) / 2;
  ctx.fillStyle = "#9bd6ff";
  ctx.font = "700 14px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${sep.angle}°`, center.x + Math.cos(mid) * (radius + 18), center.y + Math.sin(mid) * (radius + 18));
  ctx.restore();
}

function drawAimPoints(data) {
  drawPointLabel(data.aPoint, "A", "#ff2b22", 5, 14, -10);
  drawPointLabel(data.bPoint, "B", "#1fbb37", 5, 12, 2);
  drawPointLabel(data.cPoint, "C", "#195cff", 5, -18, -4);
}

function drawBalls() {
  Object.entries(state.balls).forEach(([key, ball]) => {
    if (state.animation && (key === "cue" || key === "target")) return;
    if (state.potted && key === "target") return;
    if (state.cueScratched && key === "cue") return;
    if (!state.showBlockers && key.startsWith("blocker")) return;
    if (state.mode !== "escape" && key.startsWith("blocker")) return;
    drawBall(ball, table.ballR, ball.color, key === "cue");
    if (key !== "cue" && key !== "target") {
      ctx.fillStyle = "#fff";
      ctx.font = "700 12px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ball.label, ball.x, ball.y);
    }
  });
}

function drawShotAnimation() {
  if (!state.animation) return;
  const elapsed = performance.now() - state.animation.startedAt;
  const rawSeconds = elapsed / 1000;
  const seconds = rawSeconds < state.animation.cuePreDuration
    ? rawSeconds
    : Math.max(state.animation.cuePreDuration, rawSeconds - IMPACT_HOLD_SECONDS);
  const cue = seconds < state.animation.cuePreDuration
    ? pointOnTimedPath(state.animation.cuePreImpact, seconds)
    : pointOnTimedPath(state.animation.cueAfter, seconds);
  const target = pointOnTimedPath(state.animation.targetPath, seconds);
  const hasTargetLeftImpact = seconds >= state.animation.cuePreDuration - 0.001;
  const cueDropProgress = (seconds - state.animation.cuePocketTime) / POCKET_DROP_SECONDS;
  const targetDropProgress = (seconds - state.animation.targetPocketTime) / POCKET_DROP_SECONDS;

  if (!state.animation.cueScratched || seconds < state.animation.cuePocketTime) {
    drawBall(cue, table.ballR, "#f4f5ee", true, "rgba(127,199,255,.9)");
  } else if (cueDropProgress < 1) {
    drawPocketDropBall(state.animation.cuePocket, table.ballR, "#f4f5ee", true, Math.max(0, cueDropProgress), "rgba(127,199,255,.9)");
  }
  if (seconds < state.animation.cuePreDuration || (hasTargetLeftImpact && seconds < state.animation.targetPocketTime)) {
    drawBall(target, table.ballR, state.balls.target.color, false, "rgba(240,194,71,.9)");
  } else if (targetDropProgress < 1) {
    drawPocketDropBall(state.animation.targetPocket, table.ballR, state.balls.target.color, false, Math.max(0, targetDropProgress), "rgba(240,194,71,.9)");
  }

  if (elapsed < state.animation.duration) {
    requestAnimationFrame(drawTable);
  } else {
    Object.assign(state.balls.cue, state.animation.cueEnd);
    Object.assign(state.balls.target, state.animation.targetEnd);
    state.potted = true;
    state.cueScratched = state.animation.cueScratched;
    state.animation = null;
    tableNote.textContent = state.cueScratched
      ? "目标球入袋，但白球也摔袋。点击重置或关卡继续。"
      : "目标球入袋，白球已按分离角停位。点击重置或关卡继续。";
    drawTable();
  }
}

function drawPolyline(points, color, width, dash = []) {
  if (points.length < 2) return;
  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.restore();
}

function drawLine(a, b, color, width, dash) {
  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  drawArrow(a, b, color);
  ctx.restore();
}

function drawArrow(a, b, color) {
  const d = norm(v(a, b));
  const p = add(b, mul(d, -18));
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(p.x + -d.y * 6, p.y + d.x * 6);
  ctx.lineTo(p.x + d.y * 6, p.y + -d.x * 6);
  ctx.closePath();
  ctx.fill();
}

function drawCircle(p, r, fill, stroke, dash = []) {
  ctx.save();
  ctx.beginPath();
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.setLineDash(dash);
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  if (stroke !== "transparent") ctx.stroke();
  ctx.restore();
}

function drawBall(p, r, fill, cue = false, stroke = "rgba(0,0,0,.42)") {
  const frame = cue ? ballFrames.cue : fill === state.balls.target.color ? ballFrames.target : null;
  const visualR = r * BALL_DRAW_SCALE / 2;
  drawBallContactShadow(p, visualR);
  if (frame && art.atlas.complete && art.atlas.naturalWidth) {
    const size = r * BALL_DRAW_SCALE;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rollAngle || 0);
    ctx.drawImage(art.atlas, frame.x, frame.y, frame.w, frame.h, -size / 2, -size / 2, size, size);
    ctx.restore();
    if (cue) drawCueBallSpots(p, visualR);
    return;
  }

  ctx.save();
  ctx.beginPath();
  const shadow = ctx.createRadialGradient(p.x + r * 0.4, p.y + r * 0.52, 1, p.x, p.y, r * 1.1);
  shadow.addColorStop(0, "rgba(0,0,0,.08)");
  shadow.addColorStop(1, "rgba(0,0,0,.35)");
  ctx.fillStyle = "rgba(0,0,0,.26)";
  ctx.ellipse(p.x + 2, p.y + 3, r * 0.92, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();

  const grad = ctx.createRadialGradient(p.x - r * 0.34, p.y - r * 0.38, r * 0.12, p.x, p.y, r);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(cue ? 0.58 : 0.2, cue ? "#f5f1df" : fill);
  grad.addColorStop(1, cue ? "#b8b09b" : shadeColor(fill, -34));
  ctx.beginPath();
  ctx.fillStyle = grad;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.6;
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = "rgba(255,255,255,.78)";
  ctx.arc(p.x - r * 0.34, p.y - r * 0.38, r * 0.18, 0, Math.PI * 2);
  ctx.fill();

  if (cue) drawCueBallSpots(p, r);
  ctx.restore();
}

function drawPocketDropBall(p, r, fill, cue, progress, stroke) {
  const t = Math.max(0, Math.min(1, progress));
  const orbitPhase = Math.min(1, t / 0.72);
  const fadePhase = Math.max(0, (t - 0.48) / 0.52);
  const orbitEase = 1 - Math.pow(1 - orbitPhase, 2);
  const fadeEase = fadePhase * fadePhase * (3 - 2 * fadePhase);
  const side = pocketSpinDirection(p);
  const angle = (p.pocketAngle || 0) + side * orbitEase * Math.PI * 1.34;
  const orbitRadius = r * (0.48 - 0.28 * orbitEase);
  const sink = r * (0.15 + fadeEase * 0.72);
  const scale = 1 - fadeEase * 0.78;
  const alpha = 1 - fadeEase * 0.92;
  const ball = {
    x: p.x + Math.cos(angle) * orbitRadius,
    y: p.y + Math.sin(angle) * orbitRadius + sink,
    rollAngle: (p.rollAngle || 0) + side * orbitEase * Math.PI * 2.4,
  };

  ctx.save();
  ctx.globalAlpha = 0.22 + fadeEase * 0.5;
  ctx.fillStyle = "#010101";
  ctx.beginPath();
  ctx.arc(p.x, p.y, r * (1.08 + fadeEase * 0.22), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(ball.x, ball.y);
  ctx.scale(scale, scale);
  drawBall({ x: 0, y: 0, rollAngle: ball.rollAngle }, r, fill, cue, stroke);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.34 + fadeEase * 0.38;
  const lip = ctx.createRadialGradient(p.x, p.y, r * 0.42, p.x, p.y, r * 1.28);
  lip.addColorStop(0, "rgba(0,0,0,0)");
  lip.addColorStop(0.56, "rgba(0,0,0,.28)");
  lip.addColorStop(1, "rgba(0,0,0,.78)");
  ctx.fillStyle = lip;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r * 1.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function pocketSpinDirection(p) {
  const isRight = p.x > table.x + table.w / 2;
  const isBottom = p.y > table.y + table.h / 2;
  return isRight === isBottom ? 1 : -1;
}

function drawBallContactShadow(p, r) {
  ctx.save();
  const grad = ctx.createRadialGradient(p.x + r * 0.2, p.y + r * 0.78, r * 0.06, p.x + r * 0.1, p.y + r * 0.82, r * 1.42);
  grad.addColorStop(0, "rgba(0, 0, 0, .58)");
  grad.addColorStop(0.34, "rgba(0, 0, 0, .32)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(p.x + r * 0.18, p.y + r * 0.76, r * 1.13, r * 0.48, -0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(0, 0, 0, .34)";
  ctx.beginPath();
  ctx.ellipse(p.x + r * 0.1, p.y + r * 0.86, r * 0.58, r * 0.18, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCueBallSpots(p, r) {
  const roll = p.rollAngle || 0;
  const faces = [
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 },
  ];
  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y, r - 0.8, 0, Math.PI * 2);
  ctx.clip();

  faces.forEach((face) => {
    const aroundY = rotateY(face, roll);
    const rotated = rotateX(aroundY, roll * 0.38);
    if (rotated.z <= 0.04) return;

    const screenX = p.x + rotated.x * r * 0.72;
    const screenY = p.y + rotated.y * r * 0.72;
    const edge = Math.min(1, Math.hypot(rotated.x, rotated.y));
    const visible = Math.max(0.18, Math.min(1, rotated.z));
    const spotW = r * 0.28 * (0.58 + visible * 0.42);
    const spotH = r * 0.16 * Math.max(0.2, visible) * (1 - edge * 0.24);
    const tilt = Math.atan2(rotated.y, rotated.x) + Math.PI / 2;

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(tilt);
    ctx.beginPath();
    const grad = ctx.createRadialGradient(-spotW * 0.2, -spotH * 0.3, 1, 0, 0, Math.max(spotW, spotH));
    grad.addColorStop(0, `rgba(255, 72, 64, ${0.96 * visible})`);
    grad.addColorStop(0.6, `rgba(213, 8, 2, ${0.96 * visible})`);
    grad.addColorStop(1, `rgba(126, 0, 0, ${0.88 * visible})`);
    ctx.fillStyle = grad;
    ctx.ellipse(0, 0, spotW, spotH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(92, 0, 0, ${0.22 * visible})`;
    ctx.lineWidth = Math.max(0.7, r * 0.035);
    ctx.stroke();
    ctx.restore();
  });
  ctx.restore();
}

function rotateX(point, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: point.x,
    y: point.y * c - point.z * s,
    z: point.y * s + point.z * c,
  };
}

function rotateY(point, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: point.x * c + point.z * s,
    y: point.y,
    z: point.z * c - point.x * s,
  };
}

function shadeColor(hex, percent) {
  const raw = hex.replace("#", "");
  const num = parseInt(raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw, 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.max(0, Math.min(255, (num >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amt));
  return `rgb(${r}, ${g}, ${b})`;
}

function drawPointLabel(p, label, color, r, dx, dy) {
  ctx.save();
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "700 18px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, p.x + dx, p.y + dy);
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function updateAimView() {
  if (state.potted) {
    cutLabel.textContent = state.cueScratched ? "白球摔袋" : "目标球入袋";
    aimHint.textContent = state.cueScratched
      ? "目标球入袋，但白球也摔袋"
      : "点击重置或切换关卡继续练习";
    if (separationLabel) separationLabel.textContent = state.cueScratched ? "白球摔袋" : "分离角已完成";
    updateToolLabels();
    return;
  }
  const { cutAngle } = aimData();
  const data = aimData();
  const sep = separationInfo(simulateCueAfterCollision(), data);
  const { grade, overlap } = cutInfo(cutAngle);
  state.aimAngle = Math.round(cutAngle);
  state.aimGrade = grade;
  state.overlap = overlap;
  overlapSlider.value = String(overlap);
  updateOverlapPreview(overlap);
  cutLabel.textContent = `${grade} · ${Math.round(cutAngle)}°`;
  aimHint.textContent = state.mode === "escape"
    ? "解球模式显示库边反射点，目标是先解到目标球。"
    : "白球中心对准虚线假想球中心，目标球沿黄色线入袋。";
  if (separationLabel) separationLabel.textContent = `分离角约 ${sep.angle}° · ${spinName[state.spin]}`;
  drawAimDiagram();
  updateToolLabels();
}

function updateOverlapPreview(overlap) {
  if (!previewCueBall || !previewObjectBall || !overlapPreview) return;
  const ballSize = parseFloat(getComputedStyle(previewCueBall).width) || 66;
  const baseLeft = (overlapPreview.clientWidth - ballSize) / 2;
  const side = state.balls.cue.x >= state.balls.target.x ? 1 : -1;
  const gap = (1 - overlap / 100) * ballSize * 0.92;
  previewObjectBall.style.left = `${baseLeft}px`;
  previewCueBall.style.left = `${baseLeft + side * gap}px`;
  previewCueBall.style.zIndex = side > 0 ? "3" : "1";
  previewObjectBall.style.zIndex = "2";
}

function updatePowerMeter() {
  if (!powerFill) return;
  const pct = ((state.power - 1) / 9) * 100;
  powerFill.style.height = `${Math.max(7, pct)}%`;
}

function updateToolLabels() {
  if (gameToggleBtn) {
    gameToggleBtn.textContent = gameTypeSelect.value === "nineball" ? "⑨" : "⑧";
    gameToggleBtn.title = gameTypeSelect.value === "nineball" ? "九球" : "中式八球";
  }
  if (spinCycleBtn) {
    spinCycleBtn.title = spinName[state.spin];
  }
  if (powerCycleBtn) {
    powerCycleBtn.textContent = String(state.power);
    powerCycleBtn.title = `力度 ${state.power}`;
  }
  if (sideCycleBtn) {
    sideCycleBtn.textContent = state.side < 0 ? "←" : state.side > 0 ? "→" : "↔";
    sideCycleBtn.title = state.side < 0 ? "左塞" : state.side > 0 ? "右塞" : "无塞";
  }
  if (railCycleBtn) {
    railCycleBtn.textContent = `${state.railCount}库`;
    railCycleBtn.title = `${state.railCount}库解球`;
  }
  if (blockersBtn) {
    blockersBtn.classList.toggle("active", state.showBlockers);
    blockersBtn.title = state.showBlockers ? "隐藏障碍球" : "显示障碍球";
  }
  updateMenuLabels();
  updatePowerMeter();
  updateCueDot();
}

function updateMenuLabels() {
  menuModeButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.menuMode === state.mode));
  menuGameButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.gameShortcut === gameTypeSelect.value));
  menuClothButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.clothShortcut === state.cloth));
  if (menuRailBtn) {
    menuRailBtn.textContent = `${state.railCount}库`;
    menuRailBtn.classList.toggle("active", state.mode === "escape");
  }
  if (menuBlockersBtn) menuBlockersBtn.classList.toggle("active", state.showBlockers);
}

function setMenuOpen(open) {
  menuOpen = open;
  gameMenu.classList.toggle("open", menuOpen);
  gameMenu.setAttribute("aria-hidden", String(!menuOpen));
  menuBtn.classList.toggle("active", menuOpen);
  menuBtn.setAttribute("aria-expanded", String(menuOpen));
}

function applyDrill(value) {
  drillSelect.value = value;
  document.querySelector("#newDrillBtn").click();
}

function updateCueDot() {
  if (!hitDot) return;
  const x = (state.side / 5) * 38;
  const y = state.spin === "follow" ? -42 : state.spin === "draw" ? 42 : 0;
  hitDot.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  pendingCue = { spin: state.spin, side: state.side, x, y };
}

function drawAimDiagram() {
  const w = aimDiagramCanvas.width;
  const h = aimDiagramCanvas.height;
  const r = 82;
  const target = { x: 300, y: 205 };
  const gap = (1 - state.overlap / 100) * r * 2;
  const ghost = { x: target.x + gap, y: target.y };
  const b = { x: target.x + r, y: target.y };
  const c = { x: ghost.x - r, y: target.y };
  const a = { x: (b.x + c.x) / 2, y: target.y };

  aimCtx.clearRect(0, 0, w, h);
  const felt = aimCtx.createLinearGradient(0, 0, 0, h);
  felt.addColorStop(0, "#3d7e88");
  felt.addColorStop(0.5, "#2a6570");
  felt.addColorStop(1, "#1f4d56");
  aimCtx.fillStyle = felt;
  aimCtx.fillRect(0, 0, w, h);
  aimCtx.strokeStyle = "rgba(255,255,255,.11)";
  aimCtx.lineWidth = 1;
  aimCtx.beginPath();
  aimCtx.moveTo(w / 2, 20);
  aimCtx.lineTo(w / 2, h - 52);
  aimCtx.stroke();

  aimCtx.fillStyle = "rgba(255,255,255,.92)";
  aimCtx.font = "700 22px system-ui";
  aimCtx.textAlign = "center";
  aimCtx.fillText("正视图", w / 2, h - 28);

  drawDiagramLine({ x: target.x - 112, y: target.y }, { x: ghost.x + 112, y: ghost.y }, "#111", 2, []);
  drawDiagramBall(target, r, "#f0c247", "目标球", false);
  drawDiagramBall(ghost, r, "#f4f5ee", "假想球", true);
  drawDiagramPoint(a, "A", "#ff2b22", 0, 28);
  drawDiagramPoint(b, "B", "#11a326", -4, 28);
  drawDiagramPoint(c, "C", "#084dff", 0, 28);

  aimCtx.fillStyle = "rgba(255,255,255,.94)";
  aimCtx.font = "18px system-ui";
  aimCtx.textAlign = "left";
  aimCtx.fillText(`${state.aimAngle}° · ${state.aimGrade}`, 22, 36);
  aimCtx.font = "15px system-ui";
  aimCtx.fillText(`连续重合厚度：${Math.round(state.overlap)}%`, 22, 60);
  aimCtx.fillStyle = "#ff2b22";
  aimCtx.font = "18px system-ui";
  aimCtx.fillText("A", 22, 92);
  aimCtx.fillStyle = "rgba(255,255,255,.94)";
  aimCtx.fillText("：进袋线接触点", 44, 92);
  aimCtx.fillStyle = "#11a326";
  aimCtx.fillText("B", 22, 122);
  aimCtx.fillStyle = "rgba(255,255,255,.94)";
  aimCtx.fillText("：目标球最边点", 44, 122);
  aimCtx.fillStyle = "#084dff";
  aimCtx.fillText("C", 22, 152);
  aimCtx.fillStyle = "rgba(255,255,255,.94)";
  aimCtx.fillText("：假想球最边点", 44, 152);
}

function drawDiagramBall(p, r, color, label, ghost = false) {
  aimCtx.save();
  aimCtx.beginPath();
  aimCtx.fillStyle = "rgba(0,0,0,.24)";
  aimCtx.ellipse(p.x + 8, p.y + 10, r * 0.9, r * 0.72, 0, 0, Math.PI * 2);
  aimCtx.fill();

  const grad = aimCtx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.38, r * 0.12, p.x, p.y, r);
  grad.addColorStop(0, "#fff");
  grad.addColorStop(0.22, ghost ? "rgba(255,255,255,.78)" : color);
  grad.addColorStop(1, ghost ? "rgba(220,226,222,.38)" : shadeColor(color, -34));
  aimCtx.beginPath();
  aimCtx.fillStyle = grad;
  aimCtx.arc(p.x, p.y, r, 0, Math.PI * 2);
  aimCtx.fill();
  aimCtx.strokeStyle = ghost ? "rgba(255,255,255,.92)" : "rgba(0,0,0,.42)";
  aimCtx.lineWidth = ghost ? 4 : 2.5;
  aimCtx.setLineDash(ghost ? [6, 7] : []);
  aimCtx.stroke();
  aimCtx.setLineDash([]);

  aimCtx.beginPath();
  aimCtx.fillStyle = "rgba(255,255,255,.75)";
  aimCtx.arc(p.x - r * 0.34, p.y - r * 0.38, r * 0.17, 0, Math.PI * 2);
  aimCtx.fill();

  aimCtx.fillStyle = "rgba(255,255,255,.95)";
  aimCtx.font = "18px system-ui";
  aimCtx.textAlign = "center";
  aimCtx.fillText(label, p.x, p.y + r + 30);
  aimCtx.restore();
}

function drawDiagramLine(a, b, color, width, dash) {
  aimCtx.save();
  aimCtx.beginPath();
  aimCtx.strokeStyle = color;
  aimCtx.lineWidth = width;
  aimCtx.setLineDash(dash);
  aimCtx.moveTo(a.x, a.y);
  aimCtx.lineTo(b.x, b.y);
  aimCtx.stroke();
  aimCtx.restore();
}

function drawDiagramPoint(p, label, color, dx, dy) {
  aimCtx.save();
  aimCtx.beginPath();
  aimCtx.fillStyle = color;
  aimCtx.arc(p.x, p.y, 7, 0, Math.PI * 2);
  aimCtx.fill();
  aimCtx.font = "700 24px system-ui";
  aimCtx.textAlign = "center";
  aimCtx.textBaseline = "middle";
  aimCtx.fillText(label, p.x + dx, p.y + dy);
  aimCtx.restore();
}

function setMode(mode) {
  state.mode = mode;
  modeButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.mode === mode));
  panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === mode));
  tableNote.textContent = mode === "aim"
    ? "拖动白球或目标球，点击袋口切换目标袋。"
    : mode === "angle"
      ? "选择杆法、力度和左右塞，点击击打回放。"
      : "拖动球位，选择一库、两库或三库查看解球线路。";
  drawTable();
}

function pointerPos(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height,
  };
}

function nearestBall(p) {
  return Object.entries(state.balls).find(([key, ball]) => {
    if (state.potted && key === "target") return false;
    if (state.cueScratched && key === "cue") return false;
    if (state.mode !== "escape" && key.startsWith("blocker")) return false;
    return len(v(p, ball)) < table.ballR * 1.8;
  });
}

canvas.addEventListener("pointerdown", (event) => {
  const p = pointerPos(event);
  const ball = nearestBall(p);
  if (ball) {
    state.dragBall = ball[0];
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  const pocketIndex = pockets.findIndex((pocket) => len(v(p, pocket)) < 30);
  if (pocketIndex >= 0) {
    state.selectedPocket = pocketIndex;
    drawTable();
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (!state.dragBall) return;
  const p = pointerPos(event);
  const ball = state.balls[state.dragBall];
  ball.x = p.x;
  ball.y = p.y;
  clampBall(ball);
  drawTable();
});

canvas.addEventListener("pointerup", () => {
  state.dragBall = null;
});

modeButtons.forEach((btn) => btn.addEventListener("click", () => setMode(btn.dataset.mode)));

document.querySelector("#resetBtn").addEventListener("click", () => {
  Object.assign(state.balls.cue, { x: 245, y: 250, rollAngle: 0 });
  Object.assign(state.balls.target, { x: 560, y: 210, rollAngle: 0 });
  Object.assign(state.balls.blocker1, { x: 420, y: 250 });
  Object.assign(state.balls.blocker2, { x: 510, y: 320 });
  state.selectedPocket = 5;
  state.potted = false;
  state.cueScratched = false;
  state.animation = null;
  tableNote.textContent = "拖动白球或目标球，点击袋口切换目标袋。";
  drawTable();
});

document.querySelector("#newDrillBtn").addEventListener("click", () => {
  if (drillSelect.value === "free") {
    drillIndex = (drillIndex + 1) % drillOrder.length;
    drillSelect.value = drillOrder[drillIndex];
  }
  const value = drillSelect.value;
  if (value === "free") return;
  const drill = drills[value];
  Object.assign(state.balls.cue, { x: drill.cue[0], y: drill.cue[1], rollAngle: 0 });
  Object.assign(state.balls.target, { x: drill.target[0], y: drill.target[1], rollAngle: 0 });
  state.selectedPocket = drill.pocket;
  state.potted = false;
  state.cueScratched = false;
  state.animation = null;
  drillIndex = drillOrder.indexOf(value);
  tableNote.textContent = `已切换关卡：${drillSelect.options[drillSelect.selectedIndex].text}`;
  drillSelect.value = "free";
  drawTable();
});

gameTypeSelect.addEventListener("change", (event) => {
  const label = event.target.value === "nineball" ? "九球 9 尺比例" : "中式八球比例";
  tableNote.textContent = `${label}：当前原型保持同一训练台面比例，后续可接入不同袋口与球径参数。`;
  updateToolLabels();
});

document.querySelector("#spinButtons").addEventListener("click", (event) => {
  if (!event.target.matches("button")) return;
  state.spin = event.target.dataset.spin;
  [...event.currentTarget.children].forEach((btn) => btn.classList.toggle("active", btn === event.target));
  drawTable();
});

powerSlider.addEventListener("input", (event) => {
  state.power = Number(event.target.value);
  updatePowerMeter();
  drawTable();
});

sideSlider.addEventListener("input", (event) => {
  state.side = Number(event.target.value);
  drawTable();
});

document.querySelector("#clothSpeed").addEventListener("change", (event) => {
  state.cloth = event.target.value;
  drawTable();
});

railCountSelect.addEventListener("change", (event) => {
  state.railCount = Number(event.target.value);
  drawTable();
});

showBlockersInput.addEventListener("change", (event) => {
  state.showBlockers = event.target.checked;
  drawTable();
});

document.querySelector("#playBtn").addEventListener("click", () => {
  if (state.potted) {
    tableNote.textContent = state.cueScratched
      ? "白球已经摔袋，请先重置或切换关卡。"
      : "目标球已经入袋，请先重置或切换关卡。";
    return;
  }
  state.animation = createShotAnimation();
  tableNote.textContent = "击打中：目标球进袋，白球按碰撞、旋转和摩擦模拟运动。";
  requestAnimationFrame(drawTable);
});

document.querySelector("#photoBtn").addEventListener("click", () => {
  tableNote.textContent = "照片识别会作为第二阶段：拍照后先校准球台四角，再确认白球、目标球和障碍球。";
});

gameToggleBtn.addEventListener("click", () => {
  gameTypeSelect.value = gameTypeSelect.value === "nineball" ? "chinese8" : "nineball";
  gameTypeSelect.dispatchEvent(new Event("change"));
});

spinCycleBtn.addEventListener("click", () => {
  pendingCue = { spin: state.spin, side: state.side, x: (state.side / 5) * 38, y: state.spin === "follow" ? -42 : state.spin === "draw" ? 42 : 0 };
  updateCueDot();
  aimModal.classList.add("open");
  aimModal.setAttribute("aria-hidden", "false");
});

powerCycleBtn.addEventListener("click", () => {
  state.power = state.power >= 9 ? 3 : state.power + 3;
  powerSlider.value = String(state.power);
  tableNote.textContent = `力度：${state.power}`;
  drawTable();
});

sideCycleBtn.addEventListener("click", () => {
  const nextIndex = (sideOrder.indexOf(state.side) + 1) % sideOrder.length;
  state.side = sideOrder[nextIndex];
  sideSlider.value = String(state.side);
  tableNote.textContent = state.side < 0 ? "左塞" : state.side > 0 ? "右塞" : "无塞";
  drawTable();
});

railCycleBtn.addEventListener("click", () => {
  state.railCount = state.railCount >= 3 ? 1 : state.railCount + 1;
  railCountSelect.value = String(state.railCount);
  tableNote.textContent = `${state.railCount}库解球`;
  drawTable();
});

blockersBtn.addEventListener("click", () => {
  state.showBlockers = !state.showBlockers;
  showBlockersInput.checked = state.showBlockers;
  tableNote.textContent = state.showBlockers ? "已显示障碍球" : "已隐藏障碍球";
  drawTable();
});

menuModeButtons.forEach((btn) => {
  btn.addEventListener("click", () => setMode(btn.dataset.menuMode));
});

menuDrillButtons.forEach((btn) => {
  btn.addEventListener("click", () => applyDrill(btn.dataset.drillShortcut));
});

menuGameButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    gameTypeSelect.value = btn.dataset.gameShortcut;
    gameTypeSelect.dispatchEvent(new Event("change"));
    updateMenuLabels();
  });
});

menuClothButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    state.cloth = btn.dataset.clothShortcut;
    document.querySelector("#clothSpeed").value = state.cloth;
    tableNote.textContent = `台速：${btn.textContent}`;
    drawTable();
  });
});

menuRailBtn.addEventListener("click", () => {
  railCycleBtn.click();
  setMode("escape");
});

menuBlockersBtn.addEventListener("click", () => {
  blockersBtn.click();
});

menuPhotoBtn.addEventListener("click", () => {
  document.querySelector("#photoBtn").click();
});

document.querySelector("#openAimViewBtn").addEventListener("click", () => {
  aimModal.classList.add("open");
  aimModal.setAttribute("aria-hidden", "false");
  updateCueDot();
});

document.querySelector("#closeAimViewBtn").addEventListener("click", () => {
  aimModal.classList.remove("open");
  aimModal.setAttribute("aria-hidden", "true");
});

aimModal.addEventListener("click", (event) => {
  if (event.target === aimModal) {
    aimModal.classList.remove("open");
    aimModal.setAttribute("aria-hidden", "true");
  }
});

overlapSlider.addEventListener("input", (event) => {
  event.target.value = String(state.overlap);
  drawAimDiagram();
});

function setPendingCueFromPoint(clientX, clientY) {
  const rect = bigCueBall.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const radius = rect.width / 2;
  const dx = Math.max(-0.82, Math.min(0.82, (clientX - cx) / radius));
  const dy = Math.max(-0.82, Math.min(0.82, (clientY - cy) / radius));
  pendingCue.side = Math.round(dx * 5);
  pendingCue.spin = dy < -0.24 ? "follow" : dy > 0.24 ? "draw" : "stun";
  pendingCue.x = dx * 50;
  pendingCue.y = dy * 50;
  hitDot.style.transform = `translate(calc(-50% + ${pendingCue.x}px), calc(-50% + ${pendingCue.y}px))`;
}

bigCueBall.addEventListener("pointerdown", (event) => {
  bigCueBall.setPointerCapture(event.pointerId);
  setPendingCueFromPoint(event.clientX, event.clientY);
});

bigCueBall.addEventListener("pointermove", (event) => {
  if (event.buttons) setPendingCueFromPoint(event.clientX, event.clientY);
});

confirmCueBtn.addEventListener("click", () => {
  state.spin = pendingCue.spin;
  state.side = pendingCue.side;
  sideSlider.value = String(state.side);
  [...document.querySelector("#spinButtons").children].forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.spin === state.spin);
  });
  tableNote.textContent = `杆法：${spinName[state.spin]}${state.side ? `，${state.side < 0 ? "左塞" : "右塞"}` : ""}`;
  aimModal.classList.remove("open");
  aimModal.setAttribute("aria-hidden", "true");
  drawTable();
});

menuBtn.addEventListener("click", () => setMenuOpen(!menuOpen));

document.addEventListener("pointerdown", (event) => {
  if (!menuOpen) return;
  if (gameMenu.contains(event.target) || menuBtn.contains(event.target)) return;
  setMenuOpen(false);
});

updateToolLabels();
drawTable();

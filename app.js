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
  overlap: 50,
  aimGrade: "半球",
  aimAngle: 0,
  animation: null,
  balls: {
    cue: { x: 245, y: 250, color: "#f4f5ee", label: "白" },
    target: { x: 560, y: 210, color: "#f0c247", label: "1" },
    blocker1: { x: 420, y: 250, color: "#d53f3f", label: "障" },
    blocker2: { x: 510, y: 320, color: "#3359d6", label: "障" },
  },
};

const table = {
  x: 56,
  y: 50,
  w: 788,
  h: 400,
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
  const target = state.balls.target;
  const pocket = pockets[state.selectedPocket];
  const objectToPocket = norm(v(target, pocket));
  const ghost = add(target, mul(objectToPocket, -table.ballR * 2));
  const cueToGhost = norm(v(state.balls.cue, ghost));
  const tangent = norm({ x: -objectToPocket.y, y: objectToPocket.x });
  const sideSign = cueToGhost.x * tangent.x + cueToGhost.y * tangent.y >= 0 ? 1 : -1;
  const aPoint = add(target, mul(objectToPocket, -table.ballR));
  const bPoint = add(target, mul(tangent, table.ballR * sideSign));
  const cPoint = add(aPoint, v(bPoint, aPoint));
  const cutCos = Math.max(-1, Math.min(1, objectToPocket.x * cueToGhost.x + objectToPocket.y * cueToGhost.y));
  const cutAngle = Math.acos(cutCos) * 180 / Math.PI;
  return { target, pocket, ghost, objectToPocket, cueToGhost, tangent, sideSign, aPoint, bPoint, cPoint, cutAngle };
}

function cutInfo(cutAngle) {
  if (cutAngle < 15) return { grade: "厚球", overlap: 90 };
  if (cutAngle < 32) return { grade: "3/4 球", overlap: 75 };
  if (cutAngle < 52) return { grade: "半球", overlap: 50 };
  if (cutAngle < 72) return { grade: "1/4 球", overlap: 25 };
  return { grade: "薄球", overlap: 8 };
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

function clampWithBounce(position, velocity) {
  const minX = table.x + table.ballR;
  const maxX = table.x + table.w - table.ballR;
  const minY = table.y + table.ballR;
  const maxY = table.y + table.h - table.ballR;
  if (position.x < minX || position.x > maxX) {
    position.x = Math.max(minX, Math.min(maxX, position.x));
    velocity.x *= -0.55;
    velocity.y *= 0.82;
  }
  if (position.y < minY || position.y > maxY) {
    position.y = Math.max(minY, Math.min(maxY, position.y));
    velocity.y *= -0.55;
    velocity.x *= 0.82;
  }
}

function simulateCueAfterCollision() {
  const data = aimData();
  const cueSpeed = 2.15 + state.power * 0.33;
  const incoming = mul(data.cueToGhost, cueSpeed);
  const normal = data.objectToPocket;
  const tangent = norm({ x: -normal.y, y: normal.x });
  const normalSpeed = incoming.x * normal.x + incoming.y * normal.y;
  const tangentSpeed = incoming.x * tangent.x + incoming.y * tangent.y;

  let velocity = add(mul(tangent, tangentSpeed * 0.92), mul(normal, normalSpeed * 0.08));
  let spin = state.spin === "follow" ? 0.12 : state.spin === "draw" ? -0.16 : 0;
  let sideSpin = state.side * 0.012;
  let p = add(data.target, mul(data.cueToGhost, -table.ballR * 1.9));
  const points = [{ ...p }];
  const dt = 1;
  const friction = state.cloth === "fast" ? 0.988 : state.cloth === "slow" ? 0.966 : 0.978;

  for (let i = 0; i < 190; i++) {
    const currentSpeed = len(velocity);
    if (currentSpeed < 0.08 && Math.abs(spin) < 0.01 && Math.abs(sideSpin) < 0.006) break;

    const curveForce = add(mul(normal, spin * currentSpeed), mul(tangent, sideSpin * currentSpeed));
    velocity = add(velocity, curveForce);
    p = add(p, mul(velocity, dt));
    clampWithBounce(p, velocity);
    points.push({ ...p });

    velocity = mul(velocity, friction);
    spin *= 0.955;
    sideSpin *= 0.965;
  }

  return points;
}

function createShotAnimation() {
  const data = aimData();
  const cuePreImpact = [{ ...state.balls.cue }, add(data.target, mul(data.cueToGhost, -table.ballR * 1.9))];
  const cueAfter = simulateCueAfterCollision();
  return {
    cuePreImpact,
    cueAfter,
    targetPath: [{ ...state.balls.target }, { ...data.pocket }],
    targetStart: { ...state.balls.target },
    targetEnd: { ...data.pocket },
    cueEnd: cueAfter[cueAfter.length - 1],
    startedAt: performance.now(),
    duration: 1700 + state.power * 90,
  };
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

  const outerWood = ctx.createLinearGradient(22, 16, 878, 484);
  outerWood.addColorStop(0, "#3b1d12");
  outerWood.addColorStop(0.45, "#b86f28");
  outerWood.addColorStop(0.56, "#3a1a10");
  outerWood.addColorStop(1, "#140b08");
  ctx.fillStyle = outerWood;
  roundRect(22, 16, 856, 468, 30);
  ctx.fill();

  const railWood = ctx.createLinearGradient(36, 30, 864, 470);
  railWood.addColorStop(0, "#d18a38");
  railWood.addColorStop(0.18, "#8e4d20");
  railWood.addColorStop(0.5, "#e1a04f");
  railWood.addColorStop(0.82, "#7b3c1a");
  railWood.addColorStop(1, "#2b140c");
  ctx.fillStyle = railWood;
  roundRect(36, 30, 828, 440, 22);
  ctx.fill();

  ctx.save();
  ctx.strokeStyle = "rgba(38, 16, 7, .55)";
  ctx.lineWidth = 2;
  for (let y = 50; y < 464; y += 38) {
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.bezierCurveTo(210, y - 12, 420, y + 12, 860, y - 4);
    ctx.stroke();
  }
  ctx.restore();

  const felt = ctx.createLinearGradient(0, table.y, 0, table.y + table.h);
  felt.addColorStop(0, "#3d7e88");
  felt.addColorStop(0.48, "#2b6670");
  felt.addColorStop(1, "#204d56");
  ctx.fillStyle = felt;
  roundRect(table.x, table.y, table.w, table.h, 12);
  ctx.fill();

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(table.x + table.w * 0.25, table.y + 18);
  ctx.lineTo(table.x + table.w * 0.25, table.y + table.h - 18);
  ctx.stroke();
  drawTableSpot(table.x + table.w * 0.25, table.y + table.h / 2);
  drawTableSpot(table.x + table.w / 2, table.y + table.h / 2);
  drawTableSpot(table.x + table.w * 0.75, table.y + table.h / 2);
  ctx.restore();

  drawPockets();

  if (!state.potted) drawSightLines();
  drawBalls();
  drawShotAnimation();
  updateAimView();
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
  drawLine(data.target, data.pocket, "#f0c247", 3, []);
  drawLine(state.balls.cue, data.ghost, "#f4f5ee", 2, [8, 8]);
  drawCircle(data.ghost, table.ballR, "rgba(255,255,255,.12)", "rgba(255,255,255,.78)", [5, 5]);
  drawAimPoints(data);

  if (state.mode === "angle") {
    const targetEnd = add(data.target, mul(data.objectToPocket, 270));
    drawLine(data.target, targetEnd, "#f0c247", 2, []);
    drawPolyline(simulateCueAfterCollision(), "#7fc7ff", 3, [10, 7]);
  }

  if (state.mode === "escape") {
    const points = escapePath();
    for (let i = 0; i < points.length - 1; i++) {
      drawLine(points[i], points[i + 1], "#7fc7ff", 3, i === points.length - 2 ? [10, 6] : []);
      if (i > 0) drawCircle(points[i], 7, "#f0c247", "transparent");
    }
  }
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
    if (!state.showBlockers && key.startsWith("blocker")) return;
    if (state.mode !== "escape" && key.startsWith("blocker")) return;
    drawBall(ball, table.ballR, ball.color, key === "cue");
    ctx.fillStyle = key === "cue" ? "#1d211d" : "#fff";
    ctx.font = "700 12px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ball.label, ball.x, ball.y);
  });
}

function drawShotAnimation() {
  if (!state.animation) return;
  const elapsed = performance.now() - state.animation.startedAt;
  const t = Math.min(1, elapsed / state.animation.duration);
  const impactT = Math.min(1, t / 0.24);
  const rollT = Math.max(0, (t - 0.2) / 0.8);
  const cue = t < 0.24
    ? pointOnPath(state.animation.cuePreImpact, 1 - Math.pow(1 - impactT, 2))
    : pointOnPath(state.animation.cueAfter, 1 - Math.pow(1 - rollT, 2.4));
  const targetT = Math.min(1, rollT / 0.72);
  const target = pointOnPath(state.animation.targetPath, 1 - Math.pow(1 - targetT, 2));

  drawBall(cue, table.ballR, "#f4f5ee", true, "rgba(127,199,255,.9)");
  if (targetT < 0.98) {
    drawBall(target, table.ballR, state.balls.target.color, false, "rgba(240,194,71,.9)");
  }

  if (t < 1) {
    requestAnimationFrame(drawTable);
  } else {
    Object.assign(state.balls.cue, state.animation.cueEnd);
    Object.assign(state.balls.target, state.animation.targetEnd);
    state.potted = true;
    state.animation = null;
    tableNote.textContent = "目标球入袋，白球已按分离角停位。点击重置或关卡继续。";
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
  ctx.restore();
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
    cutLabel.textContent = "目标球入袋";
    aimHint.textContent = "点击重置或切换关卡继续练习";
    updateToolLabels();
    return;
  }
  const { cutAngle } = aimData();
  const { grade, overlap } = cutInfo(cutAngle);
  state.aimAngle = Math.round(cutAngle);
  state.aimGrade = grade;
  state.overlap = overlap;
  overlapSlider.value = String(overlap);
  cutLabel.textContent = `${grade} · ${Math.round(cutAngle)}°`;
  aimHint.textContent = state.mode === "escape"
    ? "解球模式显示库边反射点，目标是先解到目标球。"
    : "白球中心对准虚线假想球中心，目标球沿黄色线入袋。";
  drawAimDiagram();
  updateToolLabels();
}

function updateToolLabels() {
  if (gameToggleBtn) {
    gameToggleBtn.textContent = gameTypeSelect.value === "nineball" ? "⑨" : "⑧";
    gameToggleBtn.title = gameTypeSelect.value === "nineball" ? "九球" : "中式八球";
  }
  if (spinCycleBtn) {
    spinCycleBtn.textContent = spinIcon[state.spin];
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
  aimCtx.fillText(`正视图同步俯视图厚薄：${Math.round(state.overlap)}%`, 22, 60);
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
  Object.assign(state.balls.cue, { x: 245, y: 250 });
  Object.assign(state.balls.target, { x: 560, y: 210 });
  Object.assign(state.balls.blocker1, { x: 420, y: 250 });
  Object.assign(state.balls.blocker2, { x: 510, y: 320 });
  state.selectedPocket = 5;
  state.potted = false;
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
  Object.assign(state.balls.cue, { x: drill.cue[0], y: drill.cue[1] });
  Object.assign(state.balls.target, { x: drill.target[0], y: drill.target[1] });
  state.selectedPocket = drill.pocket;
  state.potted = false;
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
    tableNote.textContent = "目标球已经入袋，请先重置或切换关卡。";
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
  const nextIndex = (spinOrder.indexOf(state.spin) + 1) % spinOrder.length;
  state.spin = spinOrder[nextIndex];
  [...document.querySelector("#spinButtons").children].forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.spin === state.spin);
  });
  tableNote.textContent = `杆法：${spinName[state.spin]}`;
  drawTable();
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

document.querySelector("#openAimViewBtn").addEventListener("click", () => {
  aimModal.classList.add("open");
  aimModal.setAttribute("aria-hidden", "false");
  updateAimView();
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

updateToolLabels();
drawTable();

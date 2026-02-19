// ====== 基本設定 ======
const COLS = 10;
const ROWS = 20;

const COLORS = [
  { fill: "#f7c948", stroke: "rgba(255,255,255,0.25)" }, // honey
  { fill: "#55a6ff", stroke: "rgba(255,255,255,0.25)" }, // sky
];

const MODE = "honeybee";
const MODE_SECONDS = 180;

// ★目標：列消しを何回できたらクリア？
const GOAL_LINES = 3;

// CLEAR時の蜂演出時間（ms）
const CLEAR_ANIM_MS = 650;

const LEVEL_EVERY_SECONDS = 30;
const FALL_START_MS = 850;
const FALL_MIN_MS = 130;

// ====== Canvas準備 ======
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let cell;
function resizeCanvas() {
  const w = canvas.width, h = canvas.height;
  cell = Math.floor(Math.min(w / COLS, h / ROWS));
}
resizeCanvas();

// ★iPhone Safari対策：スワイプでページが動かないようにする
canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
}, { passive: false });

// ====== UI ======
const timeLabel = document.getElementById("timeLabel");
const levelLabel = document.getElementById("levelLabel");
const modeLabel  = document.getElementById("modeLabel");
const goalLabel  = document.getElementById("goalLabel");
const overlay = document.getElementById("overlay");
const retryBtn = document.getElementById("retryBtn");
const overlayTitle = document.getElementById("overlayTitle");
const overlaySub = document.getElementById("overlaySub");
const beeFly = document.getElementById("beeFly");

modeLabel.textContent = (MODE === "honeybee") ? "蜜蜂モード" : "スズメバチモード";

// ====== ゲーム状態 ======
let grid;
let piece;
let running = true;

let elapsedMs = 0;
let remainSeconds = MODE_SECONDS;

let level = 1;
let fallIntervalMs = FALL_START_MS;
let fallAccMs = 0;

let linesCleared = 0;

// CLEAR/END制御
let ending = false;
let endTimerId = null;

function updateGoalUI() {
  goalLabel.textContent = `DONE ${linesCleared} / GOAL ${GOAL_LINES}`;
}

// ====== CLEAR演出 ======
function playClearBee() {
  if (!beeFly) return;
  beeFly.classList.remove("hidden");
  beeFly.classList.remove("play"); // 連続再生対策
  // reflow
  void beeFly.offsetWidth;
  beeFly.classList.add("play");
  // 終了後に隠す（念のため）
  setTimeout(() => {
    beeFly.classList.remove("play");
    beeFly.classList.add("hidden");
  }, CLEAR_ANIM_MS);
}

// ====== グリッド ======
function newGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

// ====== ピース ======
function spawnPiece() {
  const x = Math.floor(COLS / 2);
  return {
    x, y: 0,
    blocks: [
      { dx: 0, dy: 0, c: randColor() },
      { dx: 0, dy: 1, c: randColor() },
    ]
  };
}

function randColor() {
  return Math.floor(Math.random() * COLORS.length);
}

function cellsOfPiece(p) {
  return p.blocks.map(b => ({ x: p.x + b.dx, y: p.y + b.dy, c: b.c }));
}

function collides(p, nx = p.x, ny = p.y) {
  for (const b of p.blocks) {
    const x = nx + b.dx;
    const y = ny + b.dy;
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
    if (grid[y][x] !== null) return true;
  }
  return false;
}

// ====== 固定＆消去 ======
function lockPiece() {
  if (ending) return;

  for (const cell of cellsOfPiece(piece)) {
    if (cell.y < 0 || cell.y >= ROWS) continue;
    grid[cell.y][cell.x] = cell.c;
  }
  clearLinesSameColor();
  if (ending) return;

  piece = spawnPiece();
  if (collides(piece)) endGame("DOWN…", "置けなくなりました");
}

function clearLinesSameColor() {
  let clearedThisLock = 0;

  for (let y = ROWS - 1; y >= 0; y--) {
    const row = grid[y];
    if (row.some(v => v === null)) continue;

    const first = row[0];
    if (row.every(v => v === first)) {
      grid.splice(y, 1);
      grid.unshift(Array(COLS).fill(null));
      y++;
      clearedThisLock++;
    }
  }

  if (clearedThisLock > 0) {
    linesCleared += clearedThisLock;
    updateGoalUI();

    if (linesCleared >= GOAL_LINES) {
      endGame("CLEAR!", `目標 ${GOAL_LINES} 段達成！`, true);
    }
  }
}

// ====== 移動 ======
function move(dx, dy) {
  if (ending) return false;
  const nx = piece.x + dx;
  const ny = piece.y + dy;
  if (!collides(piece, nx, ny)) {
    piece.x = nx; piece.y = ny;
    return true;
  }
  return false;
}

function softDrop() { if (!move(0, 1)) lockPiece(); }
function hardDrop() { while (move(0, 1)) {} lockPiece(); }

// ====== 色チェンジ ======
function swapColors() {
  if (ending) return;
  const a = piece.blocks[0].c;
  piece.blocks[0].c = piece.blocks[1].c;
  piece.blocks[1].c = a;
}

// ====== 回転（縦↔横） ======
function rotatePiece() {
  if (ending) return;

  const b0 = piece.blocks[0];
  const b1 = piece.blocks[1];

  b0.dx = 0; b0.dy = 0;

  const wasVertical = (b1.dx === 0 && b1.dy === 1);
  if (wasVertical) { b1.dx = 1; b1.dy = 0; }
  else { b1.dx = 0; b1.dy = 1; }

  if (!collides(piece)) return;

  piece.x -= 1;
  if (!collides(piece)) return;

  piece.x += 2;
  if (!collides(piece)) return;

  piece.x -= 1;
  if (wasVertical) { b1.dx = 0; b1.dy = 1; }
  else { b1.dx = 1; b1.dy = 0; }
}

// ====== 描画 ======
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = "#ffffff";
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * cell + 0.5, 0);
    ctx.lineTo(x * cell + 0.5, ROWS * cell);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * cell + 0.5);
    ctx.lineTo(COLS * cell, y * cell + 0.5);
    ctx.stroke();
  }
  ctx.restore();

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = grid[y][x];
      if (c !== null) drawBlock(x, y, c);
    }
  }

  // ending中はピースを描かない（演出をキレイに）
  if (!ending) {
    for (const c of cellsOfPiece(piece)) {
      if (c.y >= 0) drawBlock(c.x, c.y, c.c);
    }
  }
}

function drawBlock(x, y, colorIndex) {
  const { fill, stroke } = COLORS[colorIndex];
  const px = x * cell;
  const py = y * cell;
  const r = Math.floor(cell * 0.18);
  roundRect(px + 1, py + 1, cell - 2, cell - 2, r, fill, stroke);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(px + cell * 0.32, py + cell * 0.30, cell * 0.18, cell * 0.12, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function roundRect(x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

// ====== 時間・レベル ======
function tickTime(dtMs) {
  if (ending) return;

  elapsedMs += dtMs;

  const remain = Math.max(0, MODE_SECONDS - Math.floor(elapsedMs / 1000));
  remainSeconds = remain;
  timeLabel.textContent = formatMMSS(remainSeconds);

  const newLevel = 1 + Math.floor((MODE_SECONDS - remainSeconds) / LEVEL_EVERY_SECONDS);
  if (newLevel !== level) {
    level = newLevel;
    levelLabel.textContent = `Lv ${level}`;
    fallIntervalMs = Math.max(FALL_MIN_MS, Math.floor(FALL_START_MS * Math.pow(0.90, level - 1)));
  }

  if (remainSeconds <= 0) {
    if (linesCleared >= GOAL_LINES) {
      endGame("CLEAR!", `目標 ${GOAL_LINES} 段達成！`, true);
    } else {
      endGame("DOWN…", `時間切れ（${linesCleared}/${GOAL_LINES}）`);
    }
  }
}

function formatMMSS(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

// ====== 入力（PC） ======
window.addEventListener("keydown", (e) => {
  if (!running || ending) return;

  if (e.key === "ArrowLeft")  { e.preventDefault(); move(-1, 0); }
  if (e.key === "ArrowRight") { e.preventDefault(); move( 1, 0); }
  if (e.key === "ArrowDown")  { e.preventDefault(); softDrop(); }
  if (e.key === "ArrowUp")    { e.preventDefault(); rotatePiece(); }
  if (e.code === "Space")     { e.preventDefault(); hardDrop(); }
  if (e.key === "Enter")      { e.preventDefault(); swapColors(); }
});

// ====== 入力（スマホ） ======
let touchStart = null;

canvas.addEventListener("pointerdown", (e) => {
  if (!running || ending) return;
  touchStart = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener("pointerup", (e) => {
  if (!running || ending) return;
  if (!touchStart) return;

  const dx = e.clientX - touchStart.x;
  const dy = e.clientY - touchStart.y;
  const dist = Math.hypot(dx, dy);

  if (dist > 40 && dy > 30) { hardDrop(); touchStart = null; return; }
  if (dist > 40 && dy < -30){ rotatePiece(); touchStart = null; return; }

  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const w = rect.width;

  if (px < w * 0.33) move(-1, 0);
  else if (px > w * 0.66) move(1, 0);
  else swapColors();

  touchStart = null;
});

// ====== 終了・リトライ ======
function endGame(title, sub, withBee = false) {
  if (ending) return;

  ending = true;
  running = false;

  if (endTimerId) {
    clearTimeout(endTimerId);
    endTimerId = null;
  }

  const showOverlay = () => {
    overlayTitle.textContent = title;
    overlaySub.textContent = sub;
    overlay.classList.remove("hidden");
  };

  if (withBee) {
    playClearBee();
    endTimerId = setTimeout(showOverlay, CLEAR_ANIM_MS);
  } else {
    showOverlay();
  }
}

retryBtn.addEventListener("click", () => start());

// ====== ループ ======
let last = performance.now();

function loop(now) {
  let dt = now - last;
  last = now;

  // タブ復帰などで暴走しない保険
  if (dt > 100) dt = 100;

  if (running && !ending) {
    tickTime(dt);

    fallAccMs += dt;
    while (fallAccMs >= fallIntervalMs) {
      fallAccMs -= fallIntervalMs;
      softDrop();
      if (!running) break;
    }

    draw();
  } else {
    draw();
  }

  requestAnimationFrame(loop);
}

// ====== 開始 ======
function start() {
  overlay.classList.add("hidden");
  if (beeFly) {
    beeFly.classList.remove("play");
    beeFly.classList.add("hidden");
  }
  if (endTimerId) {
    clearTimeout(endTimerId);
    endTimerId = null;
  }

  grid = newGrid();
  piece = spawnPiece();

  running = true;
  ending = false;

  elapsedMs = 0;
  level = 1;
  fallIntervalMs = FALL_START_MS;
  fallAccMs = 0;

  linesCleared = 0;
  updateGoalUI();

  timeLabel.textContent = "03:00";
  levelLabel.textContent = "Lv 1";

  last = performance.now();
}

start();
requestAnimationFrame(loop);

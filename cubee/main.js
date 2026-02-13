// ====== 基本設定 ======
const COLS = 10;
const ROWS = 20;

// 2色（あとで増やせる）
const COLORS = [
  { fill: "#f7c948", stroke: "rgba(255,255,255,0.25)" }, // honey
  { fill: "#55a6ff", stroke: "rgba(255,255,255,0.25)" }, // sky
];

const MODE = "honeybee";      // honeybee(3分) / hornet(5分) を後で増やせる
const MODE_SECONDS = 180;     // 蜜蜂モード 3分

// レベルアップ：30秒ごと（あなたの希望の「2」）
const LEVEL_EVERY_SECONDS = 30;
const FALL_START_MS = 850;
const FALL_MIN_MS = 130;

// ====== Canvas準備 ======
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let cell; // 1マスのピクセルサイズ（canvasサイズに合わせて調整）

function resizeCanvas() {
  // 10x20が気持ちよく見える縦長
  // canvasの実解像度は固定だが、表示はCSSで100%にしているのでここは内部計算用
  const w = canvas.width, h = canvas.height;
  cell = Math.floor(Math.min(w / COLS, h / ROWS));
}
resizeCanvas();

// ====== UI ======
const timeLabel = document.getElementById("timeLabel");
const levelLabel = document.getElementById("levelLabel");
const modeLabel  = document.getElementById("modeLabel");
const overlay = document.getElementById("overlay");
const retryBtn = document.getElementById("retryBtn");
const overlayTitle = document.getElementById("overlayTitle");
const overlaySub = document.getElementById("overlaySub");

modeLabel.textContent = (MODE === "honeybee") ? "蜜蜂モード" : "スズメバチモード";

// ====== ゲーム状態 ======
let grid;
let piece;
let running = true;

let elapsedMs = 0;
let remainSeconds = MODE_SECONDS;

let level = 1;
let fallIntervalMs = FALL_START_MS;
let fallAccMs = 0; // 落下タイマー積算

function newGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null)); // null or colorIndex
}

// 2連（縦）ピース
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
  return p.blocks.map(b => ({
    x: p.x + b.dx,
    y: p.y + b.dy,
    c: b.c
  }));
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

function lockPiece() {
  for (const cell of cellsOfPiece(piece)) {
    if (cell.y < 0 || cell.y >= ROWS) continue;
    grid[cell.y][cell.x] = cell.c;
  }
  clearLinesSameColor();
  piece = spawnPiece();
  // 出た瞬間にぶつかるならゲームオーバー（今回は「動作確認」なので停止）
  if (collides(piece)) {
    endGame("GAME OVER", "これ以上置けませんでした");
  }
}

// 「横一列が全部埋まっていて、かつ全て同色」なら消す
function clearLinesSameColor() {
  for (let y = ROWS - 1; y >= 0; y--) {
    const row = grid[y];
    // 全部埋まってる？
    if (row.some(v => v === null)) continue;

    // 全部同色？
    const first = row[0];
    if (row.every(v => v === first)) {
      // 消して上を落とす
      grid.splice(y, 1);
      grid.unshift(Array(COLS).fill(null));
      y++; // 同じyを再チェック（連続消しに対応）
    }
  }
}

function move(dx, dy) {
  const nx = piece.x + dx;
  const ny = piece.y + dy;
  if (!collides(piece, nx, ny)) {
    piece.x = nx; piece.y = ny;
    return true;
  }
  return false;
}

function softDrop() {
  if (!move(0, 1)) lockPiece();
}

function hardDrop() {
  while (move(0, 1)) {}
  lockPiece();
}

// 色チェンジ：上下入れ替え（2連の基本）
function swapColors() {
  const a = piece.blocks[0].c;
  piece.blocks[0].c = piece.blocks[1].c;
  piece.blocks[1].c = a;
}

// ====== 描画 ======
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 背景グリッド
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

  // 盤面
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = grid[y][x];
      if (c === null) continue;
      drawBlock(x, y, c);
    }
  }

  // 落下中ピース
  for (const c of cellsOfPiece(piece)) {
    if (c.y >= 0) drawBlock(c.x, c.y, c.c);
  }
}

function drawBlock(x, y, colorIndex) {
  const { fill, stroke } = COLORS[colorIndex];
  const px = x * cell;
  const py = y * cell;
  const r = Math.floor(cell * 0.18); // 角丸
  // 角丸四角
  roundRect(px + 1, py + 1, cell - 2, cell - 2, r, fill, stroke);
  // 小さいハイライト（グミ感）
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
  elapsedMs += dtMs;

  // 残り時間（3分）
  const remain = Math.max(0, MODE_SECONDS - Math.floor(elapsedMs / 1000));
  remainSeconds = remain;
  timeLabel.textContent = formatMMSS(remainSeconds);

  // 30秒ごとレベルアップ
  const newLevel = 1 + Math.floor((MODE_SECONDS - remainSeconds) / LEVEL_EVERY_SECONDS);
  if (newLevel !== level) {
    level = newLevel;
    levelLabel.textContent = `Lv ${level}`;
    fallIntervalMs = Math.max(FALL_MIN_MS, Math.floor(FALL_START_MS * Math.pow(0.90, level - 1)));
  }

  // クリア判定（時間切れ＝クリア）
  if (remainSeconds <= 0) {
    endGame("CLEAR!", "3分生き残りました");
  }
}

function formatMMSS(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

// ====== 入力（PC） ======
window.addEventListener("keydown", (e) => {
  if (!running) return;

  if (e.key === "ArrowLeft") { e.preventDefault(); move(-1, 0); }
  if (e.key === "ArrowRight"){ e.preventDefault(); move( 1, 0); }
  if (e.key === "ArrowDown") { e.preventDefault(); softDrop(); }
  if (e.code === "Space")    { e.preventDefault(); hardDrop(); }
  if (e.key === "Enter")     { e.preventDefault(); swapColors(); }
});

// ====== 入力（スマホ） ======
// 左1/3タップ＝左、右1/3タップ＝右、中央タップ＝色チェンジ
// 下スワイプ＝ハードドロップ
let touchStart = null;

canvas.addEventListener("pointerdown", (e) => {
  if (!running) return;
  touchStart = { x: e.clientX, y: e.clientY, t: performance.now() };
});

canvas.addEventListener("pointerup", (e) => {
  if (!running) return;
  if (!touchStart) return;

  const dx = e.clientX - touchStart.x;
  const dy = e.clientY - touchStart.y;
  const dist = Math.hypot(dx, dy);

  // スワイプ判定
  if (dist > 40 && dy > 30) {
    hardDrop();
    touchStart = null;
    return;
  }

  // タップ判定
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const w = rect.width;

  if (px < w * 0.33) move(-1, 0);
  else if (px > w * 0.66) move(1, 0);
  else swapColors();

  touchStart = null;
});

// ====== 終了・リトライ ======
function endGame(title, sub) {
  running = false;
  overlayTitle.textContent = title;
  overlaySub.textContent = sub;
  overlay.classList.remove("hidden");
}

retryBtn.addEventListener("click", () => {
  start();
});

// ====== ループ ======
let last = performance.now();

function loop(now) {
  const dt = now - last;
  last = now;

  if (running) {
    tickTime(dt);

    fallAccMs += dt;
    while (fallAccMs >= fallIntervalMs) {
      fallAccMs -= fallIntervalMs;
      softDrop();
      if (!running) break;
    }

    draw();
  }

  requestAnimationFrame(loop);
}

// ====== 開始 ======
function start() {
  grid = newGrid();
  piece = spawnPiece();
  running = true;
  elapsedMs = 0;
  level = 1;
  fallIntervalMs = FALL_START_MS;
  fallAccMs = 0;
  timeLabel.textContent = "03:00";
  levelLabel.textContent = "Lv 1";
  overlay.classList.add("hidden");
}

start();
requestAnimationFrame(loop);

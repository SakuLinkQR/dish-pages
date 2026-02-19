// CuBee v1.2
// ====== 基本設定 ======
const COLS = 10;
const ROWS = 20;

// 基本は2色。虹キューブ用に「特別な3色目」も用意（通常は出ません）
const COLORS = [
  { fill: "#f7c948", stroke: "rgba(255,255,255,0.25)" }, // honey
  { fill: "#55a6ff", stroke: "rgba(255,255,255,0.25)" }, // sky
  { fill: "#ff6bd6", stroke: "rgba(255,255,255,0.25)" }, // rose (虹用)
];

const MODE = "honeybee";
const MODE_SECONDS = 180;

// ★クリア条件：連続で3段（COMBO 3）列消しできたらクリア
const GOAL_COMBO = 3;

// CLEAR演出時間（ms）
const CLEAR_ANIM_MS = 650;

// 進捗トースト
const TOAST_MS = 560;

const LEVEL_EVERY_SECONDS = 30;
const FALL_START_MS = 850;
const FALL_MIN_MS = 130;

// ====== 虹3連（裏仕様） ======
// ・1ゲーム（1画面）に最大1回
// ・盤面が高く積まれた時だけ出現候補（初心者向けに低い段では出ない）
// ・出る直前に「⚠️ BUZZ…」で予告（次の次のピースで出す）
const RAINBOW_MAX_ONCE = true;
const RAINBOW_TRIGGER_MIN_TOP_Y = 7;   // 0=最上段。最上段から7段目より上に到達したら候補（＝かなり高い）
const RAINBOW_CHANCE_PER_SPAWN = 0.22; // 条件を満たすスポーンのうち何割で予告が立つか

// ====== Canvas準備 ======
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let cell;
function resizeCanvas() {
  const w = canvas.width, h = canvas.height;
  cell = Math.floor(Math.min(w / COLS, h / ROWS));
}
resizeCanvas();

// iPhone Safari対策：スワイプでページが動かないようにする
canvas.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

// ====== UI ======
const timeLabel = document.getElementById("timeLabel");
const levelLabel = document.getElementById("levelLabel");
const modeLabel  = document.getElementById("modeLabel");
const comboLabel = document.getElementById("comboLabel");

const overlay = document.getElementById("overlay");
const retryBtn = document.getElementById("retryBtn");
const overlayTitle = document.getElementById("overlayTitle");
const overlaySub = document.getElementById("overlaySub");

const beeFly = document.getElementById("beeFly");
const toast = document.getElementById("toast");

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

// 連続カウント（列消しが途切れたら0へ）
let combo = 0;

// 終了制御
let ending = false;
let endTimerId = null;
let toastTimerId = null;

// 虹イベント
let rainbowUsed = false;
let rainbowPending = false; // 次の次に出すための「予告」フラグ

function updateComboUI() {
  comboLabel.textContent = `COMBO ${combo} / ${GOAL_COMBO}`;
}

function showToast(text) {
  if (!toast) return;
  toast.textContent = text;
  toast.classList.remove("hidden");
  toast.classList.remove("play");
  void toast.offsetWidth;
  toast.classList.add("play");
  if (toastTimerId) clearTimeout(toastTimerId);
  toastTimerId = setTimeout(() => {
    toast.classList.remove("play");
    toast.classList.add("hidden");
  }, TOAST_MS);
}

// ====== CLEAR演出 ======
function playClearBee() {
  if (!beeFly) return;
  beeFly.classList.remove("hidden");
  beeFly.classList.remove("play");
  void beeFly.offsetWidth;
  beeFly.classList.add("play");
  setTimeout(() => {
    beeFly.classList.remove("play");
    beeFly.classList.add("hidden");
  }, CLEAR_ANIM_MS);
}

// ====== グリッド ======
function newGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randBasicColor() {
  // 通常ピースは「2色だけ」
  return Math.floor(Math.random() * 2);
}

// 盤面の一番上にあるブロックのY（なければROWS）
function topMostFilledY() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] !== null) return y;
    }
  }
  return ROWS;
}

function canTriggerRainbow() {
  if (RAINBOW_MAX_ONCE && rainbowUsed) return false;
  // 高く積まれていないと出ない（初心者向け）
  const topY = topMostFilledY();
  if (topY > RAINBOW_TRIGGER_MIN_TOP_Y) return false;
  return true;
}

// ====== ピース ======
function spawnPiece() {
  const x = Math.floor(COLS / 2);

  // 予告が立っていたら、次のスポーンで虹3連
  if (rainbowPending) {
    rainbowPending = false;
    rainbowUsed = true;
    showToast("⚠️ RAINBOW!");
    return {
      x, y: 0,
      kind: "rainbow3",
      blocks: [
        { dx: 0, dy: 0, c: 0 },
        { dx: 0, dy: 1, c: 1 },
        { dx: 0, dy: 2, c: 2 },
      ]
    };
  }

  // 虹の条件を満たしたら、一定確率で「次の次」に虹が来る（予告）
  if (canTriggerRainbow() && Math.random() < RAINBOW_CHANCE_PER_SPAWN) {
    rainbowPending = true;
    showToast("⚠️ BUZZ…");
  }

  // 通常の2連
  return {
    x, y: 0,
    kind: "pair2",
    blocks: [
      { dx: 0, dy: 0, c: randBasicColor() },
      { dx: 0, dy: 1, c: randBasicColor() },
    ]
  };
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

  const cleared = clearLinesSameColor(); // 0..n

  // COMBOルール：消せなかったらリセット
  if (cleared === 0) {
    if (combo !== 0) showToast("COMBO RESET");
    combo = 0;
    updateComboUI();
  } else {
    combo += cleared; // 2段同時消しなら +2（気持ちよさ優先）
    updateComboUI();

    if (cleared >= 2) showToast(`NICE! +${cleared}`);
    else showToast("🐝 +1");

    if (combo === GOAL_COMBO - 1) showToast("あと1！🔥");

    if (combo >= GOAL_COMBO) {
      endGame("CLEAR!", `COMBO ${combo}/${GOAL_COMBO} 達成！`, true);
      return;
    }
  }

  piece = spawnPiece();
  if (collides(piece)) endGame("DOWN…", "置けなくなりました");
}

function clearLinesSameColor() {
  let clearedCount = 0;

  for (let y = ROWS - 1; y >= 0; y--) {
    const row = grid[y];
    if (row.some(v => v === null)) continue;

    const first = row[0];
    if (row.every(v => v === first)) {
      grid.splice(y, 1);
      grid.unshift(Array(COLS).fill(null));
      y++;
      clearedCount++;
    }
  }
  return clearedCount;
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
  // 虹3連は色チェンジ不可（混乱防止・イベント感）
  if (piece.kind === "rainbow3") return;

  const a = piece.blocks[0].c;
  piece.blocks[0].c = piece.blocks[1].c;
  piece.blocks[1].c = a;
}

// ====== 回転（縦↔横） ======
function rotatePiece() {
  if (ending) return;

  // 2連：縦↔横
  if (piece.kind === "pair2") {
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
    return;
  }

  // 虹3連：縦↔横（3マス棒）
  if (piece.kind === "rainbow3") {
    // 現在縦なら横へ、横なら縦へ
    const isVertical = piece.blocks.every((b,i)=> b.dx===0 && b.dy===i);
    if (isVertical) {
      // 横 (0,0)(1,0)(2,0)
      piece.blocks[0].dx=0; piece.blocks[0].dy=0;
      piece.blocks[1].dx=1; piece.blocks[1].dy=0;
      piece.blocks[2].dx=2; piece.blocks[2].dy=0;
    } else {
      piece.blocks[0].dx=0; piece.blocks[0].dy=0;
      piece.blocks[1].dx=0; piece.blocks[1].dy=1;
      piece.blocks[2].dx=0; piece.blocks[2].dy=2;
    }

    if (!collides(piece)) return;

    // 壁蹴り（左→右）
    piece.x -= 1;
    if (!collides(piece)) return;

    piece.x += 2;
    if (!collides(piece)) return;

    piece.x -= 1;
    // 失敗したら戻す
    if (isVertical) {
      piece.blocks[0].dx=0; piece.blocks[0].dy=0;
      piece.blocks[1].dx=0; piece.blocks[1].dy=1;
      piece.blocks[2].dx=0; piece.blocks[2].dy=2;
    } else {
      piece.blocks[0].dx=0; piece.blocks[0].dy=0;
      piece.blocks[1].dx=1; piece.blocks[1].dy=0;
      piece.blocks[2].dx=2; piece.blocks[2].dy=0;
    }
  }
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
      if (c !== null) drawBlock(x, y, c);
    }
  }

  // 落下中
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
    endGame("DOWN…", `時間切れ（COMBO ${combo}/${GOAL_COMBO}）`);
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
  if (toast) {
    toast.classList.remove("play");
    toast.classList.add("hidden");
  }
  if (endTimerId) {
    clearTimeout(endTimerId);
    endTimerId = null;
  }
  if (toastTimerId) {
    clearTimeout(toastTimerId);
    toastTimerId = null;
  }

  grid = newGrid();
  rainbowUsed = false;
  rainbowPending = false;

  piece = spawnPiece();

  running = true;
  ending = false;

  elapsedMs = 0;
  level = 1;
  fallIntervalMs = FALL_START_MS;
  fallAccMs = 0;

  combo = 0;
  updateComboUI();

  timeLabel.textContent = "03:00";
  levelLabel.textContent = "Lv 1";

  last = performance.now();
}

start();
requestAnimationFrame(loop);

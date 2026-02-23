let beeMark = null; // {x,y,until}

let beeHelpedThisTurn = false;

let clearingRows = null; // array of y
let clearingUntil = 0;

// Last cascade info (for combo toast)
let lastCascadePasses = 0;

// ====== Bee Assist (v1.4.4) ======
// When there is a row with exactly 1 hole (and all other cells are same color),
// the worker bee may fill it and clear the row.
const ASSIST_BASE_CHANCE = 0.08; // Stage1
const ASSIST_STAGE_BONUS = 0.01; // + per stage
const ASSIST_MAX_PER_GAME = 1;
let assistUsed = 0;

function findOneHoleRow(){
  // Returns {y, xHole, color} or null
  for(let y=ROWS-1;y>=0;y--){
    const row = grid[y];
    let holes = 0, xHole = -1;
    let color = null;
    for(let x=0;x<COLS;x++){
      const v = row[x];
      if(v===null){
        holes++; xHole=x;
        if(holes>1) break;
      } else {
        if(color===null) color=v;
        else if(v!==color){ color="mixed"; break; }
      }
    }
    if(holes===1 && color!==null && color!=="mixed"){
      return {y, xHole, color};
    }
  }
  return null;
}

// (removed duplicate maybeBeeAssist)


// CuBee Drop v1.6.60
// v1.2.1：クリア判定を「連続COMBO」から「累積CLEAR」に変更
const COLS=10, ROWS=16;


/* ===== Bee Assist Stable (v1.6.7) =====
   - No freeze / no path animation
   - Only fills exactly-1-hole row when that row already has one color
*/
const STB_ENABLE_BEE_ASSIST = true;
const STB_ASSIST_BASE_CHANCE = 0.18;  // Stage1
const STB_ASSIST_STAGE_BONUS = 0.03;
const STB_ASSIST_MAX_PER_GAME = 3;
let stbAssistUsed = 0;

function stbFindOneHoleRow(){
  for(let y=ROWS-1;y>=0;y--){
    const row = grid[y];
    let holes=0, xHole=-1;
    let color=null;
    for(let x=0;x<COLS;x++){
      const v=row[x];
      if(v===null){ holes++; xHole=x; if(holes>1) break; }
      else{
        if(color===null) color=v;
        else if(v!==color){ color="mixed"; break; }
      }
    }
    if(holes===1 && color!==null && color!=="mixed") return {y, xHole, color};
  }
  return null;
}


function getBeeAssistParams(){
  // First Stage tuning (v1.6.42)
  // Bee is a theme: early stages use bees as "reward" rather than rescue.
  if(stage===1) return { enabled:false, base:0, bonus:0, max:0 };
  if(stage===2) return { enabled:false, base:0, bonus:0, max:0 };
  if(stage===3) return { enabled:true, base:0.10, bonus:0.00, max:2 };
  if(stage===4) return { enabled:true, base:0.08, bonus:0.00, max:2 };
  if(stage===5) return { enabled:true, base:0.05, bonus:0.00, max:1 };
  return { enabled:true, base:0.08, bonus:0.00, max:2 };
}
function maybeBeeAssist(){
  const cfg = getBeeAssistParams();
  if(!cfg.enabled) return false;

  if(!STB_ENABLE_BEE_ASSIST) return false;
  if(stbAssistUsed >= cfg.max) return false;

  const cand = stbFindOneHoleRow();
  if(!cand) return false;

  const p = Math.min(0.45, cfg.base + (stage-1)*cfg.bonus);
  if(Math.random() > p) return false;

  grid[cand.y][cand.xHole] = cand.color;
  stbAssistUsed++;

  showToast("🐝 BEE HELP!");
  playClearBee();
  return true;
}
const COLORS = [
  { name:"Red",   fill:"#ff5a52", stroke:"#c51f18" },
  { name:"Blue",  fill:"#3aa3ff", stroke:"#0a5fa8" },
  { name:"Green", fill:"#4eea7e", stroke:"#1f8a3f" },
  { name:"Amber", fill:"#ffd60a", stroke:"#b58e00" },
];

const MODE_SECONDS=180;
let GOAL_CLEAR = 3; // stage-dependent

// ====== Stage System (First Stage + Normal) ======
// First Stage: Stage 1..5 with clear goals 3..7
// Normal: separate mode (more mechanics) - currently Stage 1 only
const STAGE_GOALS_FIRST = [3,4,5,6,7];
const STAGE_GOALS_NORMAL = [5,6]; // Normal Stage 1..2 goals (Stage2 enables Othello Flip)
let mode = "first"; // "first" | "normal"
let stage = 1;

// Honey Gauge (Normal mode)
// Fill by clearing lines; when full, the bee can perform a special "Bee Carry".
const HONEY_MAX = 3;
let honey = 0;
let beeCarryUsedThisStage = 0;
let beeReady = false;
let beeReadyUntil = 0;
let beeReadyCandidate = null; // {y, fromX, toX}
let beeManualUsed = false; // if player pressed during READY window
let beeCooldownTurns = 0; // prevent back-to-back

// Green Larva (Normal mode) - sometimes appears, transforms when sandwiched left/right.
const LARVA_COLOR = 2; // uses COLORS[2] (Green)
const LARVA_CHANCE_PER_PIECE = 0.12;

function readStageFromURL(){
  const sp = new URLSearchParams(location.search);
  const m = (sp.get("mode") || "first").toLowerCase();
  mode = (m === "normal") ? "normal" : "first";

  const n = Number(sp.get("stage") || "1");
  stage = (Number.isFinite(n) && n>=1) ? Math.floor(n) : 1;

  if (typeof level !== "undefined") level = stage;

  const goals = (mode === "normal") ? STAGE_GOALS_NORMAL : STAGE_GOALS_FIRST;
  GOAL_CLEAR = goals[Math.min(stage, goals.length)-1] ?? goals[0] ?? 3;
}


function hasNextStage(){
  const goals = (mode === "normal") ? STAGE_GOALS_NORMAL : STAGE_GOALS_FIRST;
  return stage < goals.length;
}


const CLEAR_ANIM_MS=650, TOAST_MS=560;
const LEVEL_EVERY_SECONDS=30, FALL_START_MS=850, FALL_MIN_MS=130;

// Rainbow（1ゲーム1回まで）
const RAINBOW_MAX_ONCE=true;
const RAINBOW_TRIGGER_MIN_TOP_Y=7;
const RAINBOW_CHANCE_PER_SPAWN=0.22;

const canvas=document.getElementById("game");
// v1.6.29: prevent iOS selection/scroll on canvas
canvas.addEventListener('touchstart',(e)=>e.preventDefault(),{passive:false});
canvas.addEventListener('touchmove',(e)=>e.preventDefault(),{passive:false});

// v1.6.53: prevent iOS rubber-band (screen 'shake') while playing
(function(){
  const prevent = (e)=>{ e.preventDefault(); };
  // prevent page scroll / bounce on mobile
  document.addEventListener('touchmove', prevent, {passive:false});
})();

const ctx=canvas.getContext("2d");
const cell=Math.floor(Math.min(canvas.width/COLS, canvas.height/ROWS));

const timeLabel=document.getElementById("timeLabel");
const levelLabel=document.getElementById("levelLabel");
const debugClear=document.getElementById("debugClear");
const comboLabel=document.getElementById("comboLabel");
const honeyGauge=document.getElementById("honeyGauge");
const beeBtn=document.getElementById("beeBtn");
const overlay=document.getElementById("overlay");
const retryBtn=document.getElementById("retryBtn");
const nextBtn=document.getElementById("nextBtn");
const overlayTitle=document.getElementById("overlayTitle");
const overlaySub=document.getElementById("overlaySub");
const beeFly=document.getElementById("beeFly");
const toast=document.getElementById("toast");

// Toast failsafe: hide on animation end (iOS can sometimes keep it visible)
toast.addEventListener("animationend", ()=>{ toast.classList.add("hidden"); toast.style.display="none"; });


let grid, piece, running=true, ending=false;
let elapsedMs=0, level=1, fallIntervalMs=FALL_START_MS, fallAccMs=0;
let progress=0;
let clearStreak=0; // consecutive turns with >=1 line cleared
let stageBeeBonusUsed=0; // per-stage bonus indicator
let endTimerId=null, toastTimerId=null;
let rainbowUsed=false, rainbowPending=false;

function updateUI(){
  comboLabel.textContent=`${mode === "normal" ? "NORMAL" : "STAGE"} ${stage}  CLEAR ${Math.min(progress,GOAL_CLEAR)} / ${GOAL_CLEAR}`;
  // Honey gauge (Normal mode only)
  if (honeyGauge) {
    if (mode === "normal") {
      honeyGauge.style.display = "inline-block";
      const full = "🍯".repeat(honey);
      const empty = "·".repeat(Math.max(0, HONEY_MAX - honey));
      honeyGauge.textContent = full + empty;
      honeyGauge.title = `Honey ${honey}/${HONEY_MAX}`;
    } else {
      honeyGauge.style.display = "none";
    }
  }
  if (beeBtn) {
    const canPress = (mode === "normal" && honey >= HONEY_MAX && beeReadyCandidate && Date.now() < beeReadyUntil);
    beeBtn.disabled = !canPress;
    if (canPress) beeBtn.classList.add("ready"); else beeBtn.classList.remove("ready");
    beeBtn.title = (mode === "normal") ? (honey>=HONEY_MAX ? "BEE READY" : "Need more honey") : "";
  }
}

function showToast(t){
  // Use a sequence token so older timers can't keep the toast visible
  toastSeq = (toastSeq || 0) + 1;
  const seq = toastSeq;
  toast.textContent = t;
  toast.style.display = "block";
  toast.classList.remove("hidden","play");
  void toast.offsetWidth;
  toast.classList.add("play");
  if (toastTimerId) clearTimeout(toastTimerId);
  toastTimerId = setTimeout(()=>{
    if (seq !== toastSeq) return;
    toast.classList.add("hidden");
    toast.style.display = "none";
  }, TOAST_MS);
  // Extra failsafe hide
  setTimeout(()=>{
    if (seq !== toastSeq) return;
    toast.classList.add("hidden");
    toast.style.display = "none";
  }, TOAST_MS + 1200);
}

// ===== Honey Gauge & Bee Carry =====
function clampHoney(){
  honey = Math.max(0, Math.min(HONEY_MAX, honey));
}
function addHoney(amount){
  if (mode !== "normal") return;
  if (amount <= 0) return;
  honey += amount;
  clampHoney();
}
function resetHoney(){
  honey = 0;
  beeReady = false;
  beeReadyUntil = 0;
  beeReadyCandidate = null;
  beeManualUsed = false;
  if (beeBtn) { beeBtn.disabled = true; beeBtn.classList.remove("ready"); }
}

function findBeeCarryCandidate(){
  if (mode !== "normal") return null;
  if (honey < HONEY_MAX) return null;
  if (beeCarryUsedThisStage >= 1) return null;
  if (beeCooldownTurns > 0) return null;
  // Scan rows for an edge larva with opposite edge empty.
  for (let y=ROWS-1; y>=0; y--){
    const left = grid[y][0];
    const right = grid[y][COLS-1];
    if (left === LARVA_COLOR && grid[y][COLS-1] === null) {
      return {y, fromX:0, toX:COLS-1};
    }
    if (right === LARVA_COLOR && grid[y][0] === null) {
      return {y, fromX:COLS-1, toX:0};
    }
  }
  return null;
}

function triggerBeeCarry(c){
  if (!c) return false;
  if (mode !== "normal") return false;
  if (honey < HONEY_MAX) return false;
  // Move the larva
  const y=c.y, fromX=c.fromX, toX=c.toX;
  if (grid[y][fromX] !== LARVA_COLOR) return false;
  if (grid[y][toX] !== null) return false;

  grid[y][fromX] = null;
  grid[y][toX] = LARVA_COLOR;

  // Optional: pollen-paint into adjacent color at destination (helps but not guaranteed)
  const adjX = (toX===0) ? 1 : COLS-2;
  const adj = grid[y][adjX];
  if (adj === 0 || adj === 1) {
    grid[y][toX] = adj;
  }

  beeCarryUsedThisStage += 1;
  honey = 0;
  beeCooldownTurns = 5;
  beeReady = false;
  beeReadyUntil = 0;
  beeReadyCandidate = null;
  showToast("🐝 BEE CARRY!");
  updateUI();
  // After carry, run clear check once
  const gained = clearCascade();
  if (gained > 0){
    progress += gained;
    // Honey gain from the carried clear (small bonus)
    addHoney(gained >= 3 ? 2 : 1);
    updateUI();
  }
  draw();
  return true;
}

function tickBeeCarry(){
  if (mode !== "normal") return;
  const now = Date.now();
  const cand = findBeeCarryCandidate();
  if (!cand){
    beeReady = false;
    beeReadyUntil = 0;
    beeReadyCandidate = null;
    updateUI();
    return;
  }
  // If candidate changed, restart window.
  const changed = !beeReadyCandidate || beeReadyCandidate.y!==cand.y || beeReadyCandidate.fromX!==cand.fromX || beeReadyCandidate.toX!==cand.toX;
  if (!beeReady || changed){
    beeReady = true;
    beeManualUsed = false;
    beeReadyCandidate = cand;
    beeReadyUntil = now + 3000; // 3 sec window to press
    showToast("🍯 BEE READY! (3s)");
    updateUI();
    return;
  }
  // Auto trigger if window expired and not manually used
  if (now >= beeReadyUntil && beeReadyCandidate){
    triggerBeeCarry(beeReadyCandidate);
  }
}

function playClearBee(){
  beeFly.classList.remove("hidden","play");
  void beeFly.offsetWidth;
  beeFly.classList.add("play");
  setTimeout(()=>beeFly.classList.add("hidden"),CLEAR_ANIM_MS);
}

function newGrid(){ return Array.from({length:ROWS},()=>Array(COLS).fill(null)); }
function randBasicColor(){ return Math.floor(Math.random()*2); }
function topMostFilledY(){
  for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++) if(grid[y][x]!==null) return y;
  return ROWS;
}
function canTriggerRainbow(){
  if(RAINBOW_MAX_ONCE && rainbowUsed) return false;
  return topMostFilledY()<=RAINBOW_TRIGGER_MIN_TOP_Y;
}

function spawnPiece(){
  const x=Math.floor(COLS/2);
  if(rainbowPending){
    rainbowPending=false; rainbowUsed=true;
    showToast("⚠️ RAINBOW!");
    return {x,y:0,kind:"rainbow3",blocks:[{dx:0,dy:0,c:0},{dx:0,dy:1,c:1},{dx:0,dy:2,c:2}]};
  }
  if(canTriggerRainbow() && Math.random()<RAINBOW_CHANCE_PER_SPAWN){
    rainbowPending=true;
    showToast("⚠️ BUZZ…");
  }
  {
    // base 2-color pair
    let c0 = randBasicColor();
    let c1 = randBasicColor();
    // Normal mode: sometimes mix a Green Larva
    if(mode === "normal" && Math.random() < LARVA_CHANCE_PER_PIECE){
      if(Math.random() < 0.5) c0 = LARVA_COLOR; else c1 = LARVA_COLOR;
    }
    return {x,y:0,kind:"pair2",blocks:[{dx:0,dy:0,c:c0},{dx:0,dy:1,c:c1}]};
  }
}
function cellsOfPiece(p){ return p.blocks.map(b=>({x:p.x+b.dx,y:p.y+b.dy,c:b.c})); }
function collides(p,nx=p.x,ny=p.y){
  for(const b of p.blocks){
    const x=nx+b.dx,y=ny+b.dy;
    if(x<0||x>=COLS||y<0||y>=ROWS) return true;
    if(grid[y][x]!==null) return true;
  }
  return false;
}

// ====== Green Larva transform (Normal mode) ======
// Normal Stage 1: single larva transforms when directly sandwiched left/right by same color.
// Normal Stage 2+: "Othello Flip" — when you place Red/Blue and sandwich one-or-more Larva between
// the placed color and an existing same color, ALL Larva in-between flips to that color.
function applyLarvaTransforms(placedCells){
  if(mode !== "normal") return 0;
  let changed = 0;

  // --- Stage 2+: Othello-style multi-larva flip (only flips Larva, never flips Red/Blue) ---
  if(stage >= 2){
    for(const pc of placedCells){
      if(pc.y < 0 || pc.y >= ROWS) continue;
      const color = grid[pc.y][pc.x];
      if(color !== 0 && color !== 1) continue; // only Red/Blue triggers flipping

      // LEFT: [sameColor][Larva...][placedColor]
      let x = pc.x - 1;
      const toFlipL = [];
      while(x >= 0 && grid[pc.y][x] === LARVA_COLOR){
        toFlipL.push(x);
        x--;
      }
      if(toFlipL.length > 0 && x >= 0 && grid[pc.y][x] === color){
        for(const fx of toFlipL){ grid[pc.y][fx] = color; }
        changed += toFlipL.length;
        beeMark = {x: pc.x, y: pc.y, until: performance.now() + 420};
      }

      // RIGHT: [placedColor][Larva...][sameColor]
      x = pc.x + 1;
      const toFlipR = [];
      while(x < COLS && grid[pc.y][x] === LARVA_COLOR){
        toFlipR.push(x);
        x++;
      }
      if(toFlipR.length > 0 && x < COLS && grid[pc.y][x] === color){
        for(const fx of toFlipR){ grid[pc.y][fx] = color; }
        changed += toFlipR.length;
        beeMark = {x: pc.x, y: pc.y, until: performance.now() + 420};
      }
    }
  }

  // --- Stage 1+: single-larva direct sandwich (also works in Stage2+) ---
  for(const c of placedCells){
    if(c.y < 0 || c.y >= ROWS) continue;
    if(grid[c.y][c.x] !== LARVA_COLOR) continue;

    const lx = c.x - 1, rx = c.x + 1;
    if(lx < 0 || rx >= COLS) continue;
    const left = grid[c.y][lx];
    const right = grid[c.y][rx];
    if(left === null || right === null) continue;
    if(left === "rainbow" || right === "rainbow") continue;
    if(left === LARVA_COLOR || right === LARVA_COLOR) continue;
    if(left === right){
      grid[c.y][c.x] = left;
      changed++;
      beeMark = {x:c.x, y:c.y, until: performance.now() + 420};
    }
  }

  return changed;
}

function getClearableRows(){
  // v1.6.34: STRICT rule - row clears only if ALL cells are filled AND same color.
  const rows = [];
  for(let y=0; y<ROWS; y++){
    const first = grid[y][0];
    if(first === null || first === "rainbow" || first === LARVA_COLOR) continue;
    let ok = true;
    for(let x=1; x<COLS; x++){
      const v = grid[y][x];
      if(v === null || v === "rainbow" || v === LARVA_COLOR || v !== first){
        ok = false;
        break;
      }
    }
    if(ok) rows.push(y);
  }
  // Unique + sort bottom-up (helps stable clearing)
  return Array.from(new Set(rows)).sort((a,b)=>b-a);
}

function applyClearRows(rows){
  // v1.6.34 safety: unique row indices
  rows = Array.from(new Set(rows)).sort((a,b)=>b-a);

  rows.sort((a,b)=>b-a);
  for(const y of rows){
    grid.splice(y,1);
    grid.unshift(Array(COLS).fill(null));
  }
  return rows.length;
}
// v1.6.17: clear repeatedly until no more full same-color rows appear (after rows drop).
function clearCascade(){
  // v1.6.48: multi-pass cascade clear (count all clears in this lock)
  // This fixes the case where clearing one row makes the row above drop into a clearable full row.
  let total = 0;
  let passes = 0;
  while(true){
    const rows = getClearableRows();
    if(!rows || rows.length===0) break;
    applyClearRows(rows);
    total += rows.length;
    passes += 1;
    if(passes >= 10) break; // safety
  }
  lastCascadePasses = passes;
  return total;
}


function endGame(title,sub,withBee=false){
  if(ending) return;
  ending=true; running=false;

  // Stage clearの場合：NEXTの出し分け
  if (title === "CLEAR!" || String(title).startsWith("CLEAR")) {
    if (hasNextStage()) {
      nextBtn.style.display = "";
      nextBtn.textContent = "NEXT";
    } else {
      nextBtn.style.display = "";
      nextBtn.textContent = "PLAY AGAIN";
      try{ if(mode==="first") localStorage.setItem("firstStageCleared","1"); }catch(e){}
    }
  } else {
    nextBtn.style.display = "none";
  }

  const show=()=>{
    overlayTitle.textContent=title;
    overlaySub.textContent=sub;
    overlay.classList.remove("hidden");
  };
  if(withBee){
    try{ playClearBee(); }catch(e){ console.warn("playClearBee failed",e); }
    const ms = (typeof CLEAR_ANIM_MS==="number" && isFinite(CLEAR_ANIM_MS)) ? CLEAR_ANIM_MS : 0;
    endTimerId=setTimeout(show, ms);
    // watchdog: ensure overlay shows even if timers/anim glitch
    setTimeout(()=>{ try{ if(overlay.classList.contains("hidden")) show(); }catch(e){} }, ms+150);
  } else show();
}

function lockPiece() {
  if (ending) return;
  if (mode === "normal" && beeCooldownTurns > 0) beeCooldownTurns--;

  // ピースを盤面に固定
  const placed = cellsOfPiece(piece);
  for (const c of placed) {
    if (c.y >= 0 && c.y < ROWS) grid[c.y][c.x] = c.c;
  }

  // Normal mode: Green Larva may transform if sandwiched left/right on placement
  applyLarvaTransforms(placed);

  // 1. 通常の消去判定
  let rows = getClearableRows();
  let cleared = rows.length;

  // 2. 消去がなかった場合、蜂の加勢をチェック
  beeHelpedThisTurn = false;
if (cleared === 0) {
  if (typeof maybeBeeAssist === 'function') {
    const helped = maybeBeeAssist();
    if (helped) {
      // v1.6.10: Bee helped -> clear immediately and safely, then continue with next piece.
      const rowsBee = getClearableRows();
      const beeCleared = rowsBee.length;
      if (beeCleared > 0) {
        const actually = clearCascade();
        progress += actually;
        if (mode === "normal" && actually > 0) {
          const gain = (actually >= 3 || lastCascadePasses > 1) ? 2 : 1;
          addHoney(gain);
        }
        // Streak counts even when bee assists (feels consistent)
        if (actually > 0) clearStreak++; else clearStreak = 0;
      const shownLines = (mode === "first" && stage === 1) ? Math.min(actually, initialCleared) : actually;
        updateUI();

        if (progress >= GOAL_CLEAR) {
          showToast(`CLEAR! (/)`);
          // Ensure the cleared board is rendered once before showing the CLEAR modal
          clearingRows = null; clearingUntil = 0;
          draw();
          // Call endGame immediately (avoid rare rAF scheduling issues on iOS)
          endGame("CLEAR!", `Stage ${stage} CLEAR ${Math.min(progress,GOAL_CLEAR)}/${GOAL_CLEAR} 達成！`, !(mode==="first" && stage===1));
          return;
        } else if (shownLines === 1 && progress === GOAL_CLEAR - 1) {
          showToast(`🐝 +${actually}（あと1！🔥）`);
        } else {
          showToast(actually >= 2 ? `🐝 +${actually} NICE!` : "🐝 +1");
        }
      } else {
        showToast("🐝 …");
      }

      // Next piece
      piece = spawnPiece();
      if (collides(piece)) {
        endGame("DOWN…", "置けなくなりました");
        return;
      }
      running = true;
      return;
    }
  }
}

  // 3. 消去演出と処理
  if (cleared > 0) {
    const initialCleared = cleared;
    clearingRows = rows.slice();
    clearingUntil = Date.now() + 240;
    if (debugClear) debugClear.textContent = `+${cleared}`;
    running = false;

    setTimeout(() => {
      const actually = clearCascade();
      // Stage1 (First) safety: don't let cascade add extra lines beyond the initial clear
      const addLines = (mode === "first" && stage === 1) ? Math.min(actually, initialCleared) : actually;
      progress += addLines;
      const shownLines = addLines;
      // --- First Stage bee "reward" tuning (v1.6.42) ---
      // Track consecutive clear streaks (combo feeling)
      if (actually > 0) clearStreak++; else clearStreak = 0;

      // Stage2: reward big clear (2+ lines) with a bee mark (no gameplay impact)
      if (mode === "first" && stage === 2 && actually >= 2 && stageBeeBonusUsed === 0) {
        beeHelpedThisTurn = true;
        stageBeeBonusUsed = 1;
      }
      // Stage4: reward "streak" (clearing on consecutive turns) with a bee mark
      if (mode === "first" && stage === 4 && clearStreak >= 2 && stageBeeBonusUsed === 0) {
        beeHelpedThisTurn = true;
        stageBeeBonusUsed = 1;
      }

      updateUI();

      if (progress >= GOAL_CLEAR) {
        showToast(`CLEAR! ${Math.min(progress,GOAL_CLEAR)}/${GOAL_CLEAR}`);
        // Ensure the cleared board is rendered once before showing the CLEAR modal
        clearingRows = null; clearingUntil = 0;
        draw();
        // Stage1 should not play bee clear anim; others can
        const withBee = !(mode === "first" && stage === 1);
        endGame("CLEAR!", `Stage ${stage} CLEAR ${Math.min(progress,GOAL_CLEAR)}/${GOAL_CLEAR} 達成！`, withBee);
        return;
      } else {
        const honeyPrefix = beeHelpedThisTurn ? "🐝 " : "";
        if (shownLines === 1 && progress === GOAL_CLEAR - 1) {
          showToast(`${honeyPrefix}+${shownLines}（あと1！🔥）`);
        } else {
          const combo = lastCascadePasses > 1;
      if (combo && shownLines >= 2) {
        showToast(`${honeyPrefix}+${shownLines} COMBO!`);
      } else {
        showToast(shownLines >= 2 ? `${honeyPrefix}+${shownLines} NICE!` : `${honeyPrefix}+1`);
      }
        }
      }

      piece = spawnPiece();
      if (collides(piece)) {
        endGame("DOWN…", "置けなくなりました");
        return;
      }
      running = true;
    }, 240);
  } else {
    // No clear -> reset streak
    clearStreak = 0;
    // 消去が全くなかった場合：次のピースへ
    piece = spawnPiece();
    if (collides(piece)) {
      endGame("DOWN…", "置けなくなりました");
      return;
    }
    updateUI();
  }
}



function move(dx,dy){
  if(ending) return false;
  const nx=piece.x+dx, ny=piece.y+dy;
  if(!collides(piece,nx,ny)){ piece.x=nx; piece.y=ny; return true; }
  return false;
}
function softDrop(){ if(!move(0,1)) lockPiece(); }
function hardDrop(){ while(move(0,1)){} lockPiece(); }

function swapColors(){
  if(ending) return;
  if(piece.kind==="rainbow3") return;
  const a=piece.blocks[0].c; piece.blocks[0].c=piece.blocks[1].c; piece.blocks[1].c=a;
}

function rotatePiece(){
  if(ending) return;
  if(piece.kind==="pair2"){
    const b1=piece.blocks[1];
    const wasV=(b1.dx===0&&b1.dy===1);
    if(wasV){ b1.dx=1; b1.dy=0; } else { b1.dx=0; b1.dy=1; }
    if(!collides(piece)) return;
    piece.x-=1; if(!collides(piece)) return;
    piece.x+=2; if(!collides(piece)) return;
    piece.x-=1;
    if(wasV){ b1.dx=0; b1.dy=1; } else { b1.dx=1; b1.dy=0; }
    return;
  }
  if(piece.kind==="rainbow3"){
    const isV=piece.blocks.every((b,i)=>b.dx===0&&b.dy===i);
    if(isV){
      piece.blocks[0].dx=0;piece.blocks[0].dy=0;
      piece.blocks[1].dx=1;piece.blocks[1].dy=0;
      piece.blocks[2].dx=2;piece.blocks[2].dy=0;
    } else {
      piece.blocks[0].dx=0;piece.blocks[0].dy=0;
      piece.blocks[1].dx=0;piece.blocks[1].dy=1;
      piece.blocks[2].dx=0;piece.blocks[2].dy=2;
    }
    if(!collides(piece)) return;
    piece.x-=1; if(!collides(piece)) return;
    piece.x+=2; if(!collides(piece)) return;
    piece.x-=1;
    // revert
    if(isV){
      piece.blocks[0].dx=0;piece.blocks[0].dy=0;
      piece.blocks[1].dx=0;piece.blocks[1].dy=1;
      piece.blocks[2].dx=0;piece.blocks[2].dy=2;
    } else {
      piece.blocks[0].dx=0;piece.blocks[0].dy=0;
      piece.blocks[1].dx=1;piece.blocks[1].dy=0;
      piece.blocks[2].dx=2;piece.blocks[2].dy=0;
    }
  }
}

function roundRect(x,y,w,h,r,fill,stroke){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
  ctx.fillStyle=fill; ctx.fill();
  ctx.strokeStyle=stroke; ctx.stroke();
}
function drawBlock(x,y,ci){
  const {fill,stroke}=COLORS[ci];
  const px=x*cell, py=y*cell;
  const r=Math.floor(cell*0.22);
  roundRect(px+1,py+1,cell-2,cell-2,r,fill,stroke);
  // gloss highlight (v1.6.12)
  ctx.save();
  const g = ctx.createLinearGradient(x, y, x, y + cell);
  g.addColorStop(0, "rgba(255,255,255,0.70)");
  g.addColorStop(0.38, "rgba(255,255,255,0.18)");
  g.addColorStop(1, "rgba(255,255,255,0.00)");
  ctx.fillStyle = g;
  roundRect(x+cell*0.06, y+cell*0.06, cell*0.88, cell*0.42, Math.floor(cell*0.22), g, "rgba(0,0,0,0)");
  ctx.restore();

  ctx.save();
  ctx.globalAlpha=0.18; ctx.fillStyle="#fff";
  ctx.beginPath();
  ctx.ellipse(px+cell*0.32,py+cell*0.30,cell*0.18,cell*0.12,-0.4,0,Math.PI*2);
  ctx.fill(); ctx.restore();
}
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save(); ctx.globalAlpha=1.0; ctx.strokeStyle="rgba(27,34,58,0.10)";
  for(let x=0;x<=COLS;x++){ ctx.beginPath(); ctx.moveTo(x*cell+0.5,0); ctx.lineTo(x*cell+0.5,ROWS*cell); ctx.stroke(); }
  for(let y=0;y<=ROWS;y++){ ctx.beginPath(); ctx.moveTo(0,y*cell+0.5); ctx.lineTo(COLS*cell,y*cell+0.5); ctx.stroke(); }
  ctx.restore();

  for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++) if(grid[y][x]!==null) drawBlock(x,y,grid[y][x]);
  if(!ending) for(const c of cellsOfPiece(piece)) if(c.y>=0) drawBlock(c.x,c.y,c.c);
}

function formatMMSS(sec){
  const m=String(Math.floor(sec/60)).padStart(2,"0");
  const s=String(sec%60).padStart(2,"0");
  return `${m}:${s}`;
}
function tickTime(dt){
  if(ending) return;
  elapsedMs+=dt;
  const remain=Math.max(0, MODE_SECONDS - Math.floor(elapsedMs/1000));
  timeLabel.textContent=formatMMSS(remain);
  const newLevel=1+Math.floor((MODE_SECONDS-remain)/LEVEL_EVERY_SECONDS);
  if(newLevel!==level){
    level=newLevel;
    levelLabel.textContent=`Lv ${level}`;
    fallIntervalMs=Math.max(FALL_MIN_MS, Math.floor(FALL_START_MS*Math.pow(0.90,level-1)));
  }
  if(remain<=0) endGame("DOWN…",`時間切れ（Stage ${stage}  CLEAR ${progress}/${GOAL_CLEAR}）`);
}

// Keyboard
window.addEventListener("keydown",(e)=>{
  if(!running||ending) return;
  if(e.key==="ArrowLeft"){e.preventDefault();move(-1,0);}
  if(e.key==="ArrowRight"){e.preventDefault();move(1,0);}
  if(e.key==="ArrowDown"){e.preventDefault();softDrop();}
  if(e.key==="ArrowUp"){e.preventDefault();rotatePiece();}
  if(e.code==="Space"){e.preventDefault();hardDrop();}
  if(e.key==="Enter"){e.preventDefault();swapColors();}
});

// Touch
let touchStart=null;
canvas.addEventListener("pointerdown",(e)=>{ if(!running||ending) return; touchStart={x:e.clientX,y:e.clientY}; });
canvas.addEventListener("pointerup",(e)=>{
  if(!running||ending||!touchStart) return;
  const dx=e.clientX-touchStart.x, dy=e.clientY-touchStart.y;
  const dist=Math.hypot(dx,dy);
  if(dist>40 && dy>30){ hardDrop(); touchStart=null; return; }
  if(dist>40 && dy<-30){ rotatePiece(); touchStart=null; return; }
  const rect=canvas.getBoundingClientRect();
  const px=e.clientX-rect.left, w=rect.width;
  if(px<w*0.33) move(-1,0);
  else if(px>w*0.66) move(1,0);
  else swapColors();
  touchStart=null;
});

retryBtn.addEventListener("click",()=>start());

if (beeBtn){
  beeBtn.addEventListener("click",()=>{
    if (mode !== "normal") return;
    if (Date.now() >= beeReadyUntil) return;
    if (!beeReadyCandidate) return;
    // Manual override during READY window
    triggerBeeCarry(beeReadyCandidate);
  });
}

nextBtn.addEventListener("click",()=>{
  const base = `./game.html?mode=${mode}&stage=`;
  if (hasNextStage()) {
    const next = stage + 1;
    location.href = `${base}${next}`;
  } else {
    // Final clear: loop back to stage 1 (arcade loop)
    location.href = `${base}1`;
  }
});

let last=performance.now();
function loop(now){
  let dt=now-last; last=now; if(dt>100) dt=100;
  if(running && !ending){
    tickTime(dt);
    tickBeeCarry();
    fallAccMs+=dt;
    while(fallAccMs>=fallIntervalMs){ fallAccMs-=fallIntervalMs; softDrop(); if(!running) break; }
  }
  draw();
  requestAnimationFrame(loop);
}

function start(){
  readStageFromURL();
  overlay.classList.add("hidden");
  if (nextBtn) nextBtn.style.display = "none";
  if(endTimerId){ clearTimeout(endTimerId); endTimerId=null; }
  if(toastTimerId){ clearTimeout(toastTimerId); toastTimerId=null; }
  toast.classList.add("hidden"); beeFly.classList.add("hidden");
  grid=newGrid();
  rainbowUsed=false; rainbowPending=false;
  assistUsed = 0;
  piece=spawnPiece();
  running=true; ending=false;
  elapsedMs=0; level=1; fallIntervalMs=FALL_START_MS; fallAccMs=0;
  progress=0; clearStreak=0; stageBeeBonusUsed=0; stbAssistUsed=0; updateUI();
  if(debugClear) debugClear.textContent = "+0";
  beeMark = null;
  clearingRows = null;
  clearingUntil = 0;
  beeHelpedThisTurn = false;
  timeLabel.textContent="03:00"; levelLabel.textContent = `${mode === "normal" ? "N" : "Lv"} ${stage}`;
  last=performance.now();
}

start();
requestAnimationFrame(loop);
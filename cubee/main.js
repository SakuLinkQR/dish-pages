let beeMark = null; // {x,y,until}

let beeHelpedThisTurn = false;

let clearingRows = null; // array of y
let clearingUntil = 0;

// ====== Bee Assist (v1.4.4) ======
// When there is a row with exactly 1 hole (and all other cells are same color),
// the worker bee may fill it and clear the row.
const ASSIST_BASE_CHANCE = 0.16; // Stage1
const ASSIST_STAGE_BONUS = 0.03; // + per stage
const ASSIST_MAX_PER_GAME = 3;
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


// CuBee v1.6.16
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

function maybeBeeAssist(){
  if(!STB_ENABLE_BEE_ASSIST) return false;
  if(stbAssistUsed >= STB_ASSIST_MAX_PER_GAME) return false;

  const cand = stbFindOneHoleRow();
  if(!cand) return false;

  const p = Math.min(0.45, STB_ASSIST_BASE_CHANCE + (stage-1)*STB_ASSIST_STAGE_BONUS);
  if(Math.random() > p) return false;

  grid[cand.y][cand.xHole] = cand.color;
  stbAssistUsed++;

  showToast("🐝 BEE HELP!");
  playClearBee();
  return true;
}
const COLORS = [
  { name:"Red",   fill:"#ff5a52", stroke:"#c51f18" },  // brighter glossy red
  { name:"Blue",  fill:"#3aa3ff", stroke:"#0a5fa8" },  // brighter glossy blue
  { name:"Green", fill:"#4eea7e", stroke:"#1f8a3f" },  // brighter glossy green
  { name:"Amber", fill:"#ffd60a", stroke:"#b58e00" },
];

const MODE_SECONDS=180;
let GOAL_CLEAR = 3; // stage-dependent

// ====== Stage System (v1.3) ======
// Stage 1: CLEAR 3, Stage 2: CLEAR 4
const STAGE_MAX = 30;
  const STAGE_GOALS = Array.from({length: STAGE_MAX}, (_, i) => 3 + i); // Stage1..30 // Stage1..5 // extend later: [3,4,5,6,...]
let stage = 1;

function readStageFromURL(){
  try{
    const sp = new URLSearchParams(location.search);
    const s = parseInt(sp.get("stage") || "1", 10);
    stage = (Number.isFinite(s) && s >= 1) ? s : 1;
  }catch(e){
    stage = 1;
  }
  const idx = Math.min(stage, STAGE_GOALS.length) - 1;
  GOAL_CLEAR = STAGE_GOALS[idx];
}

function hasNextStage(){
  return stage < STAGE_GOALS.length;
}


const CLEAR_ANIM_MS=650, TOAST_MS=560;
const LEVEL_EVERY_SECONDS=30, FALL_START_MS=850, FALL_MIN_MS=130;

// Rainbow（1ゲーム1回まで）
const RAINBOW_MAX_ONCE=true;
const RAINBOW_TRIGGER_MIN_TOP_Y=7;
const RAINBOW_CHANCE_PER_SPAWN=0.22;

const canvas=document.getElementById("game");
const ctx=canvas.getContext("2d");
const cell=Math.floor(Math.min(canvas.width/COLS, canvas.height/ROWS));
canvas.addEventListener("touchmove",(e)=>e.preventDefault(),{passive:false});

const timeLabel=document.getElementById("timeLabel");
const levelLabel=document.getElementById("levelLabel");
const debugClear=document.getElementById("debugClear");
const comboLabel=document.getElementById("comboLabel");
const overlay=document.getElementById("overlay");
const retryBtn=document.getElementById("retryBtn");
const nextBtn=document.getElementById("nextBtn");
const overlayTitle=document.getElementById("overlayTitle");
const overlaySub=document.getElementById("overlaySub");
const beeFly=document.getElementById("beeFly");
const toast=document.getElementById("toast");

let grid, piece, running=true, ending=false;
let elapsedMs=0, level=1, fallIntervalMs=FALL_START_MS, fallAccMs=0;
let progress=0;
let endTimerId=null, toastTimerId=null;
let rainbowUsed=false, rainbowPending=false;

function updateUI(){
  comboLabel.textContent=`STAGE ${stage}  CLEAR ${progress} / ${GOAL_CLEAR}`;
}
function showToast(t){
  toast.textContent=t;
  toast.classList.remove("hidden","play");
  void toast.offsetWidth;
  toast.classList.add("play");
  if(toastTimerId) clearTimeout(toastTimerId);
  toastTimerId=setTimeout(()=>toast.classList.add("hidden"),TOAST_MS);
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
  return {x,y:0,kind:"pair2",blocks:[{dx:0,dy:0,c:randBasicColor()},{dx:0,dy:1,c:randBasicColor()}]};
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

function getClearableRows(){
  const rows=[];
  for(let y=0;y<ROWS;y++){
    let c=null;
    let ok=true;
    for(let x=0;x<COLS;x++){
      const v=grid[y][x];
      if(v===null){ ok=false; break; }
      if(v==="rainbow"){ ok=false; break; }
      if(c===null) c=v;
      else if(v!==c){ ok=false; break; }
    }
    if(ok) rows.push(y);
  }
  return rows;
}

function applyClearRows(rows){
  rows.sort((a,b)=>b-a);
  for(const y of rows){
    grid.splice(y,1);
    grid.unshift(Array(COLS).fill(null));
  }
  return rows.length;
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
      nextBtn.textContent = "MENU";
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
    playClearBee();
    endTimerId=setTimeout(show,CLEAR_ANIM_MS);
  } else show();
}

function lockPiece() {
  if (ending) return;

  // ピースを盤面に固定
  for (const c of cellsOfPiece(piece)) {
    if (c.y >= 0 && c.y < ROWS) grid[c.y][c.x] = c.c;
  }

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
        const actually = applyClearRows(rowsBee);
        progress += actually;
        updateUI();

        if (progress >= GOAL_CLEAR) {
          showToast(`CLEAR! (${progress}/${GOAL_CLEAR})`);
          endGame("CLEAR!", `Stage ${stage} CLEAR ${progress}/${GOAL_CLEAR} 達成！`, true);
          return;
        } else if (progress === GOAL_CLEAR - 1) {
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
      requestAnimationFrame(loop);
      return;
    }
  }
  // 加勢後の再判定（蜂が発動しなかった場合）
  rows = getClearableRows();
  cleared = rows.length;
}

  // 3. 消去演出と処理
  if (cleared > 0) {
    clearingRows = rows.slice();
    clearingUntil = Date.now() + 240;
    if (debugClear) debugClear.textContent = `+${cleared}`;
    running = false;

    setTimeout(() => {
      const actually = applyClearRows(rows);
      progress += actually;
      updateUI();

      if (progress >= GOAL_CLEAR) {
        showToast(`CLEAR! (${progress}/${GOAL_CLEAR})`);
        endGame("CLEAR!", `Stage ${stage} CLEAR ${progress}/${GOAL_CLEAR} 達成！`, true);
        return;
      } else {
        const honeyPrefix = beeHelpedThisTurn ? "🐝 " : "";
        if (progress === GOAL_CLEAR - 1) {
          showToast(`${honeyPrefix}+${actually}（あと1！🔥）`);
        } else {
          showToast(actually >= 2 ? `${honeyPrefix}+${actually} NICE!` : `${honeyPrefix}+1`);
        }
      }

      piece = spawnPiece();
      if (collides(piece)) {
        endGame("DOWN…", "置けなくなりました");
        return;
      }
      running = true;
      requestAnimationFrame(loop);
    }, 240);
  } else {
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
  roundRect(x+cell*0.06, y+cell*0.06, cell*0.88, cell*0.42, Math.floor(cell*0.18), g, "rgba(0,0,0,0)");
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

nextBtn.addEventListener("click",()=>{
  if (hasNextStage()) {
    const next = stage + 1;
    location.href = `./game.html?stage=${next}`;
  } else {
    location.href = `./index.html`;
  }
});

let last=performance.now();
function loop(now){
  let dt=now-last; last=now; if(dt>100) dt=100;
  if(running && !ending){
    tickTime(dt);
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
  progress=0; stbAssistUsed=0; updateUI();
  if(debugClear) debugClear.textContent = "+0";
  beeMark = null;
  clearingRows = null;
  clearingUntil = 0;
  beeHelpedThisTurn = false;
  timeLabel.textContent="03:00"; levelLabel.textContent="Lv 1";
  last=performance.now();
}

start();
requestAnimationFrame(loop);

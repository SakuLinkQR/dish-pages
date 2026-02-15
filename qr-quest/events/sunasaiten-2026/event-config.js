// QRQUEST_CANONICAL_HOST
(function(){
  try{
    var canonical = "www.sakulink.com";
    if(location.hostname === "sakulink.com"){
      location.replace(location.protocol + "//" + canonical + location.pathname + location.search + location.hash);
    }
  }catch(e){}
})();

// events/sunasaiten-2026/event-config.js
// このイベント固有の設定（イベントごとにここだけ変更すればOK）
window.QRQUEST_EVENT = {
  id: "SUNASAITEN_2026",
  prefix: "sun26__",
  name: "砂の祭典 2026",
  // 抽選会応募フォーム（Googleフォーム等）URL：ここを後で差し替え
  formUrl: "https://docs.google.com/forms/d/e/1FAIpQLSetPLYoIMFeyzEy3LPUMQesEOYbh8LmkYuuJIbEjer-vyUiaA/viewform",
    // 回遊ログ（Apps Script WebアプリURL）
  logUrl: "https://script.google.com/macros/s/AKfycbx_pTaWFfSQWscupiyuAVBn1EpHTV5WSMFQsT08p4hl9DFSFdiqx4a17fDyNemsJFE3/exec",
  // 回遊ログ用トークン（Apps Scriptと一致させる）
  logToken: "SUNA2026_LOG_TOKEN",
// 9/9完成後の最終クイズ（後で差し替え可能）
    finalQuiz: {
    question: "最後のクイズじゃ。写真は南さつま市笠沙町の野間池みなと広場にある、南薩地域特産のタカエビのモニュメントじゃ。さて、これをデザインしたのは？\nヒント：最近双子ちゃんを出産しました",
    choices: ["中川翔子さん（タレント：愛称しょこたん）","通りすがりのおじさん","市役所の人"],
    answerIndex: 0
  }
  };


// ==============================
// 回遊ログ送信（個人情報なし）
// - CORSで詰まりにくいように sendBeacon 優先
// - 失敗時は端末内キューに貯めて、次回まとめて再送
// ==============================
(() => {
  const ev = window.QRQUEST_EVENT || {};
  const LS_QUEUE = "log_queue_v1";

  function getQueue(){
    try { return JSON.parse(localStorage.getItem(LS_QUEUE) || "[]"); } catch(e){ return []; }
  }
  function setQueue(q){
    try { localStorage.setItem(LS_QUEUE, JSON.stringify(q.slice(-200))); } catch(e){}
  }

  function build(payload){
    const ua = (navigator && navigator.userAgent) ? navigator.userAgent : "";
    return Object.assign({
      token: ev.logToken || "",
      event: ev.id || "",
      page: location.pathname.split("/").pop() || "",
      ua
    }, payload || {});
  }

  function sendOnce(obj){
    const url = ev.logUrl;
    if(!url) return false;

    const body = JSON.stringify(obj);

    // 1) sendBeacon（最優先：iPhoneでも安定）
    try{
      if(navigator && typeof navigator.sendBeacon === "function"){
        const ok = navigator.sendBeacon(url, new Blob([body], {type:"text/plain"}));
        if(ok) return true;
      }
    }catch(e){}

    // 2) fetch no-cors（次善：レスポンスは読めないが送れる）
    try{
      fetch(url, {method:"POST", mode:"no-cors", headers:{"Content-Type":"text/plain"}, body});
      return true;
    }catch(e){}

    return false;
  }

  function flush(){
    const q = getQueue();
    if(!q.length) return;
    const remain = [];
    for(const item of q){
      const ok = sendOnce(item);
      if(!ok) remain.push(item);
    }
    setQueue(remain);
  }

  function log(payload){
    const obj = build(payload);
    if(!obj.token || !ev.logUrl){
      return;
    }
    // 先に貯めてから送る（落ちても残る）
    const q = getQueue();
    q.push(obj);
    setQueue(q);
    flush();
  }

  window.QRQUEST_LOG = { log, flush };
  // 画面表示のたびに未送信分を再送
  window.addEventListener("pageshow", flush);
})();

// localStorageのキーをイベント別に分ける（別イベントと進捗が混ざらないように）
(() => {
  const prefix = (window.QRQUEST_EVENT && window.QRQUEST_EVENT.prefix)
    ? window.QRQUEST_EVENT.prefix
    : "";

  // ✅ このイベントで使うキー（追加したら必ず追記）
  const keys = new Set([
    // 共通
    "mode",
    "app_registered",
    "app_registered_at",
    "show_rescan_tip",
    "pending_qr",

    // ✅ アプリ付属スキャナー経由判定（QR詐欺対策）
    "scanner_token",
    "scanner_token_at",

    // ファミリー（4ピース）
    "visitedIntro_family",
    "questTitle_family",
    "piece1","piece2","piece3","piece4",
    "family_unlocked","family_unlocked_at",
    "reward_unlocked_family",
    "confirmed_family",

    // チャレンジ（9ピース）
    "visitedIntro_challenge",
    "questTitle_challenge",
    "c_piece1","c_piece2","c_piece3","c_piece4","c_piece5","c_piece6","c_piece7","c_piece8","c_piece9",
    "reward_unlocked_challenge",
    "confirmed_challenge",

    // QRクエスト（9分割・受付スタート・参加賞）
    "started",
    "start_area",
    "seeded_1_5",
    "seeded_1_9",
    "q_piece1",
    "q_piece2",
    "q_piece3",
    "q_piece4",
    "q_piece5",
    "q_piece6",
    "q_piece7",
    "q_piece8",
    "q_piece9",
    "q_piece6",
    "q_piece7",
    "q_piece8",
    "q_piece9",
    "area_shiyakusho",
    "area_honmachi",
    "area_fumoto",
    "reward_claimed",
    "reward_claimed_at",
    "final_quiz_passed",
    "final_quiz_passed_at",
    "setup_done",
    "visitedIntro_qrquest",
    "test_mode"
  ]);

  const ls = window.localStorage;
  const _get = ls.getItem.bind(ls);
  const _set = ls.setItem.bind(ls);
  const _rem = ls.removeItem.bind(ls);

  ls.getItem = (k) => _get(keys.has(k) ? prefix + k : k);
  ls.setItem = (k, v) => _set(keys.has(k) ? prefix + k : k, v);
  ls.removeItem = (k) => _rem(keys.has(k) ? prefix + k : k);
})();

// ==============================
// アプリ付属スキャナー経由の判定
// ==============================
// 目的：
// - アプリ内スキャナーで読んだ「公式QR」だけ、クエスト進行（結果反映など）を許可する
// - 標準カメラ等でURLを直接開いた場合は「閲覧のみ」（砂像詳細は見られるが進行は不可）にする
(() => {
  const TOKEN_KEY = "scanner_token";
  const AT_KEY = "scanner_token_at";
  const TTL_MS = 2 * 60 * 1000; // 2分（短時間のみ有効）

  function base64url(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function issue() {
    const a = new Uint8Array(16);
    (crypto || window.crypto).getRandomValues(a);
    const t = base64url(a);
    try {
      localStorage.setItem(TOKEN_KEY, t);
      localStorage.setItem(AT_KEY, String(Date.now()));
    } catch (_) {}
    return t;
  }

  function check(st, consume = false) {
    if (!st) return false;
    const t = localStorage.getItem(TOKEN_KEY) || "";
    const at = parseInt(localStorage.getItem(AT_KEY) || "0", 10) || 0;
    if (!t || !at) return false;
    if (st !== t) return false;
    if (Date.now() - at > TTL_MS) return false;
    if (consume) {
      try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(AT_KEY);
      } catch (_) {}
    }
    return true;
  }

  window.QRQUEST_SCANNER_AUTH = {
    issue,
    check,
    checkAndConsume: (st) => check(st, true),
    ttlMs: TTL_MS,
  };
})();

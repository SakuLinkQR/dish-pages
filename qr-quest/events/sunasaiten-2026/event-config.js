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
  formUrl: "",
  // 9/9完成後の最終クイズ（後で差し替え可能）
    finalQuiz: {
    question: "最後のクイズじゃ。写真は南さつま市笠沙町の野間池みなと広場にある、南薩地域特産のタカエビのモニュメントじゃ。さて、これをデザインしたのは？\nヒント：最近双子ちゃんを出産しました",
    choices: ["中川翔子さん（タレント：愛称しょこたん）","通りすがりのおじさん","市役所の人"],
    answerIndex: 0
  },
  // 回遊ログ（Googleスプレッドシートへ匿名ログ）
  logUrl: "https://script.google.com/macros/s/AKfycbx_pTaWFfSQWscupiyuAVBn1EpHTV5WSMFQsT08p4hl9DFSFdiqx4a17fDyNemsJFE3/exec",
  logToken: "SUNA2026_LOG_TOKEN"

  };

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


// ===== 回遊ログ送信ユーティリティ（iPhoneでも動きやすいGETビーコン方式）=====
(function(){
  try{
    if(!window.QRQUEST_EVENT) return;

    const LOG_URL = window.QRQUEST_EVENT.logUrl || "";
    const TOKEN   = window.QRQUEST_EVENT.logToken || "";
    const KEY_Q   = "qrquest_log_queue_v1";

    function nowIso(){ try{ return new Date().toISOString(); }catch(e){ return ""; } }

    function loadQueue(){
      try{ return JSON.parse(localStorage.getItem(KEY_Q) || "[]") || []; }catch(e){ return []; }
    }
    function saveQueue(q){
      try{ localStorage.setItem(KEY_Q, JSON.stringify(q.slice(-300))); }catch(e){}
    }

    function buildUrl(payload){
      const p = payload || {};
      const qs = new URLSearchParams();
      qs.set("write","1");
      qs.set("token", TOKEN);
      qs.set("event", window.QRQUEST_EVENT.id || "");
      qs.set("area",  p.area  || "");
      qs.set("qr_id", p.qr_id || "");
      qs.set("result",p.result|| "");
      qs.set("piece", p.piece || "");
      qs.set("page",  p.page  || "");
      qs.set("ua",    p.ua    || "");
      qs.set("ts",    String(Date.now())); // cache-bust
      return LOG_URL + (LOG_URL.includes("?") ? "&" : "?") + qs.toString();
    }

    function sendOnce(payload){
      try{
        if(!LOG_URL || !TOKEN) return false;
        const url = buildUrl(payload);
        // 画像ビーコン（CORS制限を受けにくい）
        const img = new Image();
        img.src = url;
        return true;
      }catch(e){
        return false;
      }
    }

    function flush(){
      const q = loadQueue();
      if(!q.length) return;
      // まとめて送る（最大50件）
      const sendList = q.slice(0, 50);
      sendList.forEach(sendOnce);
      // 送信したものは消す（ACKが取れないので「送れた前提」）
      saveQueue(q.slice(sendList.length));
    }

    function send(payload){
      try{
        const p = payload || {};
        // 個人情報は入れない（端末識別もしない）
        p.ua = p.ua || (navigator && navigator.userAgent ? navigator.userAgent.slice(0, 160) : "");
        p._t = nowIso();
        const q = loadQueue();
        q.push(p);
        saveQueue(q);
        flush();
      }catch(e){}
    }

    window.QRQUEST_LOG = { send, flush };
  }catch(e){}
})();


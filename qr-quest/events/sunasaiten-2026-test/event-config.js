// events/sunasaiten-2026/event-config.js
// このイベント固有の設定（イベントごとにここだけ変更すればOK）
window.QRQUEST_EVENT = {
  id: "SUNASAITEN_2026_TEST",
  prefix: "sun26t__",
  name: "砂の祭典 2026（TEST)",
  // 抽選会応募フォーム（Googleフォーム等）URL：ここを後で差し替え
  formUrl: "",
  // 9/9完成後の最終クイズ（後で差し替え可能）
  finalQuiz: {
    question: "最終クイズじゃ！　『砂の祭典』が開催される市はどこ？",
    choices: ["南さつま市","鹿児島市","指宿市"],
    answerIndex: 0
  }
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

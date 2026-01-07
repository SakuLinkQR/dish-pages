// events/sunasaiten-2026/event-config.js
// このイベント固有の設定（イベントごとにここだけ変更すればOK）
window.QRQUEST_EVENT = {
  id: "SUNASAITEN_2026",
  prefix: "sun26__",
  name: "砂の祭典 2026"
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

    // ファミリー（4ピース）
    "visitedIntro_family",
    "questTitle_family",
    "piece1","piece2","piece3","piece4",
    "reward_unlocked_family",
    "confirmed_family",

    // チャレンジ（9ピース）
    "visitedIntro_challenge",
    "questTitle_challenge",
    "c_piece1","c_piece2","c_piece3","c_piece4","c_piece5","c_piece6","c_piece7","c_piece8","c_piece9",
    "reward_unlocked_challenge",
    "confirmed_challenge"
  ]);

  const ls = window.localStorage;
  const _get = ls.getItem.bind(ls);
  const _set = ls.setItem.bind(ls);
  const _rem = ls.removeItem.bind(ls);

  ls.getItem = (k) => _get(keys.has(k) ? prefix + k : k);
  ls.setItem = (k, v) => _set(keys.has(k) ? prefix + k : k, v);
  ls.removeItem = (k) => _rem(keys.has(k) ? prefix + k : k);
})();

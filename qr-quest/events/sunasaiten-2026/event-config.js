// events/sunasaiten-2026/event-config.js
// このイベント固有の設定（イベントごとにここだけ変更すればOK）
window.QRQUEST_EVENT = {
  id: "SUNASAITEN_2026",
  prefix: "sun26__",
  name: "砂の祭典 2026"
};

// localStorageのキーをイベント別に分ける（別イベントと進捗が混ざらないように）
(() => {
  const prefix = (window.QRQUEST_EVENT && window.QRQUEST_EVENT.prefix) ? window.QRQUEST_EVENT.prefix : "";
  const keys = new Set([
    "visitedIntro","questTitle","piece1","piece2","piece3","piece4","reward_unlocked","confirmed"
  ]);

  const ls = window.localStorage;
  const _get = ls.getItem.bind(ls);
  const _set = ls.setItem.bind(ls);
  const _rem = ls.removeItem.bind(ls);

  ls.getItem = (k) => _get(keys.has(k) ? prefix + k : k);
  ls.setItem = (k, v) => _set(keys.has(k) ? prefix + k : k, v);
  ls.removeItem = (k) => _rem(keys.has(k) ? prefix + k : k);
})();

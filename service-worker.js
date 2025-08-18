// service-worker.js  (SakuLink 完全版 v1)
// - Navigation: network-first（オフ時はキャッシュ）
// - Static assets: cache-first（なければ取得→キャッシュ保存）
// - 旧キャッシュ破棄 / 即時反映

const CACHE_NAME = "sakulink-v1";
const ORIGIN = self.location.origin;

// 事前キャッシュ（“最低限ここだけは出てほしい”画面＆資産）
const PRECACHE_URLS = [
  "./",
  "./home.html",
  "./login.html",
  "./dish_detail.html",
  "./invalid_qr.html",
  "./reading_list.html",
  "./start_here.html",
  "./about.html",
  "./terms.html",
  "./privacy.html",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  // 必要に応じて画像/CSS/JSを追加
];

self.addEventListener("install", (event) => {
  // 新バージョンを即時適用しやすく
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 古いキャッシュを削除
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
      // 既存タブにも即適用
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 非GET（POST/PUT…）は触らない（Apps Script や Xano 等のAPI呼び出しを邪魔しない）
  if (req.method !== "GET") return;

  // クロスオリジンは触らない（CDN, API, 画像CDNなど）
  if (url.origin !== ORIGIN) return;

  // HTMLナビゲーションは network-first（オフ時はキャッシュ）
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
    return;
  }

  // 静的資産（CSS/JS/画像/フォントなど）は cache-first
  // （明確なパスでなくてもOK：オリジン内の GET なら広く対応）
  event.respondWith(cacheFirst(req));
});

// -------- 戦略実装 --------
async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(req);
    // 成功したらキャッシュを最新化
    cache.put(req, fresh.clone());
    return fresh;
  } catch (_) {
    // オフライン/タイムアウト時はキャッシュ
    const cached = await cache.match(req);
    // 無ければトップ（または home.html）を返す
    return cached || cache.match("./home.html") || Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(req);
  if (hit) return hit;

  try {
    const fresh = await fetch(req);
    // Opaque（cross-originなど）もここには来ない前提だが、念のためチェック
    if (fresh && fresh.status === 200 && fresh.type === "basic") {
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch (_) {
    // 取得失敗時：キャッシュに無ければエラーでOK（ナビゲーションは networkFirst 側でフォールバック済み）
    const fallback = await cache.match(req);
    return fallback || Response.error();
  }
}

// ----（任意機能）クライアントからの更新指示に対応したい場合のハンドラ例 ----
// ページ側で navigator.serviceWorker.controller.postMessage({type:'SKIP_WAITING'})
// などを送って、強制更新をかけたい時に使う:
// self.addEventListener("message", (event) => {
//   if (event.data && event.data.type === "SKIP_WAITING") {
//     self.skipWaiting();
//   }
// });

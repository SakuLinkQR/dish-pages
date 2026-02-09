// qr-quest/service-worker.js
// v2: ナビゲーションは network-first、静的資産は cache-first、旧キャッシュの削除 & 即時適用

const CACHE_PREFIX = "qr-quest-";
const CACHE_NAME = `${CACHE_PREFIX}sunasaiten-2026-test-v15`; // ←バージョンを上げると旧キャッシュが確実に破棄されます
const ORIGIN = self.location.origin;

// できるだけ“よく使う画面・資産”を事前キャッシュ
const urlsToCache = [
  "./",
  "./language.html",
  "./mode_select.html",
  "./register.html",
  "./index.html",
  "./howto.html",
  "./qr.html",
  "./monument.html",
  "./monuments_list.html",
  "./intro.html",
  "./start.html",
  "./family_notice.html",
  "./family_unlock.html",
  "./family_need_hq.html",
  "./progress.html",
  "./result.html",
  "./reward_intro.html",
  "./reward.html",
  "./confirm.html",
  "./warning.html",
  "./admin/verify.html",
  "./scanner/qr-scanner.html",
  "./scanner/lib/html5-qrcode.min.js",
  "./test-camera.html",

  // PWAメタ
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",

  // 画像・音
  "./images/piece1.png",
  "./images/piece2.png",
  "./images/piece3.png",
  "./images/piece4.png",
  "./images/goal.png",
  "./images/background_grandcanyon.png",
  "./images/map_background_b.png",
  "./sounds/fanfare.mp3",

  // JS
  "./js/check_referrer.js"
  // ※ CDNの html5-qrcode はクロスオリジンのためここでは事前キャッシュしません
];

self.addEventListener("install", (event) => {
  // 新SWをすぐ待機解除できるように
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 古いキャッシュを削除
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) return caches.delete(key);
})
      );
      // 既存ページにも即時適用
      await self.clients.claim();
    })()
  );
});

// -------- フェッチ戦略 --------
// ・ナビゲーション（ページ遷移）は network-first（オフライン時はキャッシュ）
// ・同一オリジンの静的資産は cache-first（なければネット取得→キャッシュ保存）
// ・クロスオリジンやPOST等は素通し
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // GET以外は触らない（Apps Script などのPOSTはそのまま）
  if (req.method !== "GET") return;

  // クロスオリジンは触らない
  if (url.origin !== ORIGIN) return;

  if (req.mode === "navigate") {
    // ページ遷移はネット優先
    event.respondWith(networkFirst(req));
  } else {
    // 静的資産はキャッシュ優先
    event.respondWith(cacheFirst(req));
  }
});

async function networkFirst(req) {
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(CACHE_NAME);
    cache.put(req, fresh.clone());
    return fresh;
  } catch (err) {
    // オフライン等：キャッシュがあればそれ、なければトップを返す
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    return (
      cached ||
      (await caches.match("./index.html")) // 最低限アプリを開けるようフォールバック
    );
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;

  const fresh = await fetch(req);
  cache.put(req, fresh.clone());
  return fresh;
}

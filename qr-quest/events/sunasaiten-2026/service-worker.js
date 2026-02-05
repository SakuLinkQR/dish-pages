// qr-quest/service-worker.js
// v2: ナビゲーションは network-first、静的資産は cache-first、旧キャッシュの削除 & 即時適用

const CACHE_PREFIX = "qr-quest-";
const CACHE_NAME = `${CACHE_PREFIX}sunasaiten-2026-v3`; // v3: cache更新 & 旧キャッシュ確実削除
const ORIGIN = self.location.origin;

// できるだけ“よく使う画面・資産”を事前キャッシュ
const urlsToCache = [
  "./",
  "./index.html",
  "./howto.html",
  "./quest_go.html",
  "./intro.html",
  "./start.html",
  "./progress.html",
  "./reward_intro.html",
  "./reward.html",
  "./need_start.html",
  "./add_to_home.html",
  "./start_shiyakusho.html",
  "./start_honmachi.html",
  "./start_fumoto.html",
  "./scanner/qr-scanner.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./images/background_grandcanyon.png",
  "./images/map_background_b.png",
  "./sounds/fanfare.mp3",
  "./event-config.js"
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

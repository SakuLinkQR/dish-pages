const CACHE_NAME = "sun2026-cache-v2";

const urlsToCache = [
  "./",
  "./index.html",
  "./howto.html",
  "./intro.html",
  "./start.html",
  "./start_challenge.html",
  "./scanner/qr-scanner.html",
  "./progress.html",
  "./result.html",
  "./reward_intro.html",
  "./reward.html",
  "./admin/verify.html",
  "./confirm.html",
  "./monuments_list.html",
  "./monument.html",
  "./test-camera.html",
  "./manifest.json",
  "./event-config.js",
  "./js/check_referrer.js",

  // アイコン
  "./icons/icon-192.png",
  "./icons/icon-512.png",

  // 背景
  "./images/map_background.png",
  "./images/map_background_b.png",

  // 進捗（ファミリー）
  "./images/goal.png",
  "./images/piece1.png",
  "./images/piece2.png",
  "./images/piece3.png",
  "./images/piece4.png",

  // 共通プレースホルダー
  "./images/blank.png",
  "./images/placeholder.png",
  "./images/door.png",
  "./images/vines.png",
  "./images/light.png",

  // チャレンジ（9ピース）
  "./images/challenge/goal.png",
  "./images/challenge/piece1.png",
  "./images/challenge/piece2.png",
  "./images/challenge/piece3.png",
  "./images/challenge/piece4.png",
  "./images/challenge/piece5.png",
  "./images/challenge/piece6.png",
  "./images/challenge/piece7.png",
  "./images/challenge/piece8.png",
  "./images/challenge/piece9.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});

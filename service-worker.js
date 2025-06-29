// service-worker.js
self.addEventListener('install', (e) => {
  console.log('Service Worker: Installed');
});

self.addEventListener('activate', (e) => {
  console.log('Service Worker: Activated');
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  console.log('Service Worker: Fetching', e.request.url);
});

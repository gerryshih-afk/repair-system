/* 修改靜態檔案時同步遞增版本；新版本在舊頁面全部關閉後啟用。 */
const CACHE_PREFIX = 'repair-system-shell-';
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const SHELL = ['./', './index.html', './style.css', './app.js', './config.js', './pwa.js', './manifest.webmanifest', './vendor/supabase.js', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];
const shellURLs = new Set(SHELL.map((path) => new URL(path, self.registration.scope).href));

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL);
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // 僅快取明列的靜態資源；Supabase 讀寫及其他站點一律走網路。
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const isEntry = request.mode === 'navigate' &&
    (url.pathname === new URL('./', self.registration.scope).pathname || url.pathname === new URL('./index.html', self.registration.scope).pathname);
  if (!isEntry && !shellURLs.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(isEntry ? new URL('./index.html', self.registration.scope).href : request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});

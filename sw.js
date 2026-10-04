// Служебный файл страницы учёта перемещений. Хранит копию страницы, чтобы она открывалась без связи
// (при наличии связи всегда берётся свежая версия), и копию сканера QR. Данные склада он не хранит и не трогает.
const VER = 'wt-shell-v40';
const JSQR = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
const PAGE_WAIT_MS = 4000;   // сеть не ответила за это время — открываем сохранённую копию (а свежая подгрузится в фоне)

function keyFor_(url) {
  const u = new URL(url);
  u.search = ''; u.hash = '';
  u.pathname = u.pathname.replace(/index\.html$/i, '');
  return u.href;
}

self.addEventListener('install', e => {
  self.skipWaiting();
  // копия самой страницы (адрес папки) и сканера QR — чтобы не зависеть от второго захода
  e.waitUntil(caches.open(VER).then(c => Promise.all([
    c.add(new Request(self.registration.scope, { cache: 'reload' })).catch(() => {}),
    c.add(new Request(JSQR, { mode: 'cors' })).catch(() => {})
  ])));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate' && url.origin === self.location.origin) { e.respondWith(page_(req)); return; }
  if (url.href === JSQR || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') e.respondWith(lib_(req));
});

async function page_(req) {
  const cache = await caches.open(VER), key = keyFor_(req.url);
  const cached = await cache.match(key);
  const net = fetch(req).then(r => { if (r && r.ok && r.type === 'basic') cache.put(key, r.clone()); return r; });
  if (!cached) return net;
  const first = await Promise.race([net.catch(() => null), new Promise(res => setTimeout(() => res(null), PAGE_WAIT_MS))]);
  return first || cached;
}

async function lib_(req) {
  const cache = await caches.open(VER);
  const hit = await cache.match(req.url);
  if (hit) return hit;
  try {
    const r = await fetch(new Request(req.url, { mode: 'cors' }));
    if (r && r.ok) cache.put(req.url, r.clone());
    return r;
  } catch (e) { return fetch(req); }
}

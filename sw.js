/* ── ZAKI ERP Service Worker ── */
const CACHE_VER = 'zaki-v6';
const SHELL = ['/', '/index.html', '/manifest.json'];

/* ── Install: pre-cache app shell ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VER)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: purge old caches ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VER).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch ── */
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  /* 1. Navigate → network-first (always fresh HTML), cache fallback offline */
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).then(res => {
        caches.open(CACHE_VER).then(cache => cache.put('/index.html', res.clone()));
        return res;
      }).catch(() =>
        caches.open(CACHE_VER).then(cache =>
          cache.match('/index.html').then(c => c || new Response('Offline', { status: 503 }))
        )
      )
    );
    return;
  }

  /* 2. Supabase REST GET → network-first, cache fallback */
  if (
    url.hostname.includes('supabase.co') &&
    url.pathname.includes('/rest/v1/') &&
    request.method === 'GET'
  ) {
    e.respondWith(
      fetch(request.clone())
        .then(res => {
          if (res.ok) {
            caches.open(CACHE_VER).then(c => c.put(request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(request).then(r => r || new Response('[]', {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })))
    );
    return;
  }

  /* 3. Static assets (fonts, CDN scripts) → cache-first */
  if (
    url.hostname !== self.location.hostname &&
    (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.hostname.includes('fonts'))
  ) {
    e.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(res => {
        caches.open(CACHE_VER).then(c => c.put(request, res.clone()));
        return res;
      }))
    );
    return;
  }

  /* 4. Everything else → network only */
  e.respondWith(fetch(request).catch(() => caches.match(request)));
});

/* ── Background Sync: process offline queue ── */
self.addEventListener('sync', e => {
  if (e.tag === 'zaki-sync') {
    e.waitUntil(
      self.clients.matchAll().then(clients =>
        clients.forEach(c => c.postMessage({ type: 'SYNC_NOW' }))
      )
    );
  }
});

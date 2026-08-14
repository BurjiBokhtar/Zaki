/* ── ZAKI ERP Service Worker ── */
const CACHE_VER = 'zaki-v36';
const SHELL = ['/', '/index.html', '/manifest.json'];

/* Библиотеки с CDN лежат отдельно от оболочки. Раньше они попадали в кэш
   версии, а тот при каждом обновлении приложения удаляется целиком — и
   supabase-js со всем остальным приходилось качать заново. Их содержимое
   привязано к версии в URL, поэтому устареть оно не может. */
const STATIC_CACHE = 'zaki-static-v1';

/* Данные Supabase держим отдельно от оболочки: у них своя политика вытеснения,
   и чистить их нужно, не трогая закэшированный index.html.
   Раньше всё лежало в одном кэше и не вытеснялось вообще — каждый уникальный
   URL (а их сотни: период × фильтр × offset) оседал там навсегда. */
const DATA_CACHE = 'zaki-data-v1';
/* Ответ на постраничную выборку — это сотни килобайт JSON. Смысл офлайн-копии
   в том, чтобы показать последние данные, а не всю историю: крупные ответы
   не кэшируем, иначе на каждый запрос идёт многомегабайтная запись на диск. */
const DATA_MAX_BYTES = 256 * 1024;
const DATA_MAX_ENTRIES = 40;

/* cache.keys() возвращает записи в порядке добавления, поэтому вытесняем с головы. */
async function trimDataCache() {
  const cache = await caches.open(DATA_CACHE);
  const keys = await cache.keys();
  if (keys.length <= DATA_MAX_ENTRIES) return;
  await Promise.all(
    keys.slice(0, keys.length - DATA_MAX_ENTRIES).map(k => cache.delete(k))
  );
}

async function putDataCached(request, response) {
  try {
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > DATA_MAX_BYTES) return;
    let toStore = response;
    // Content-Length часто отсутствует (сжатие/chunked) — тогда меряем тело.
    if (!declared) {
      const body = await response.blob();
      if (body.size > DATA_MAX_BYTES) return;
      toStore = new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    }
    const cache = await caches.open(DATA_CACHE);
    await cache.put(request, toStore);
    await trimDataCache();
  } catch (e) { /* кэш — вспомогательный путь, ошибка здесь не должна ломать запрос */ }
}

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
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VER && k !== DATA_CACHE && k !== STATIC_CACHE)
            .map(k => caches.delete(k))
      ))
      // Удаление zaki-v34 выше заодно выносит весь накопленный там JSON
      // Supabase — в прежней схеме он лежал в кэше оболочки и не вытеснялся.
      .then(() => trimDataCache())
      .then(() => self.clients.claim())
  );
});

/* ── Fetch ── */
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  /* 1. Navigate → отдаём из кэша сразу, обновляем в фоне.
        Было «сначала сеть»: каждый запуск установленного приложения ждал
        загрузки index.html (386 КБ) прежде чем показать хоть что-то, а на
        плохой связи — ждал до самого таймаута, потому что откат на кэш
        случался только после отказа. Вкладка в браузере так не тормозит,
        потому что берёт документ из обычного HTTP-кэша.
        Теперь оболочка появляется мгновенно, а свежая версия скачивается
        параллельно и применяется при следующем запуске. */
  if (request.mode === 'navigate') {
    e.respondWith(
      caches.open(CACHE_VER).then(cache =>
        cache.match('/index.html').then(cached => {
          const fromNetwork = fetch(request)
            .then(res => {
              if (res && res.ok) cache.put('/index.html', res.clone());
              return res;
            })
            .catch(() => cached || new Response('Offline', { status: 503 }));
          // Есть копия — показываем её немедленно, сеть догоняет в фоне.
          if (cached) { e.waitUntil(fromNetwork.catch(() => {})); return cached; }
          return fromNetwork;
        })
      )
    );
    return;
  }

  /* 2. Supabase REST GET → network-first, cache fallback.
        Кэш ограничен по размеру ответа и числу записей (см. putDataCached):
        он нужен для офлайна, а не как копия всей базы. */
  if (
    url.hostname.includes('supabase.co') &&
    url.pathname.includes('/rest/v1/') &&
    request.method === 'GET'
  ) {
    e.respondWith(
      fetch(request.clone())
        .then(res => {
          // Запись в кэш идёт мимо ответа — ждать её незачем, но воркер
          // должен дожить до её конца. waitUntil здесь ещё разрешён: промис
          // respondWith пока не разрешился.
          if (res.ok) {
            try { e.waitUntil(putDataCached(request, res.clone())); }
            catch (_) { putDataCached(request, res.clone()); }
          }
          return res;
        })
        .catch(() => caches.open(DATA_CACHE)
          .then(c => c.match(request))
          .then(r => r || new Response('[]', {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })))
    );
    return;
  }

  /* 3. Static assets (fonts, CDN scripts) → cache-first, в своём кэше,
        который переживает обновления приложения. */
  if (
    url.hostname !== self.location.hostname &&
    (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.hostname.includes('fonts'))
  ) {
    e.respondWith(
      caches.open(STATIC_CACHE).then(cache =>
        cache.match(request).then(cached => cached || fetch(request).then(res => {
          if (res && res.ok) cache.put(request, res.clone());
          return res;
        }))
      )
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

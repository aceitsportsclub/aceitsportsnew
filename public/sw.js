// ACEIT Sports PWA Service Worker
// Version: 1.0.0
// Strict Safe-Caching Policy: ONLY static assets are cached.
// NEVER cache APIs, Supabase Auth, Supabase DB/Storage, or dynamic user/club data.

const CACHE_NAME = 'aceit-sports-static-v1';

const PRECACHE_ASSETS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-192x192.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon.png',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache failed non-critically:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 1. Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 2. NEVER intercept or cache APIs, Supabase, Auth, DB queries, or uploads
  const isApi = url.pathname.startsWith('/api/');
  const isSupabase = url.hostname.includes('supabase') || url.pathname.includes('/auth/v1') || url.pathname.includes('/rest/v1');
  const isNextData = url.searchParams.has('_rsc') || url.pathname.startsWith('/_next/data/');

  if (isApi || isSupabase || isNextData) {
    // Direct network passthrough without SW caching
    return;
  }

  // 3. HTML Navigation requests (pages)
  // Always Network-First to guarantee real-time data and zero cross-club state pollution
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedOffline = await cache.match('/offline.html');
        return cachedOffline || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      })
    );
    return;
  }

  // 4. Safe Static Assets (Fonts, Icons, Landing assets, Next.js static hashes)
  const isStaticAsset =
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/landing/assets/') ||
    url.pathname.startsWith('/_next/static/') ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com';

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        }).catch(() => {
          // If offline and asset not in cache, fallback safely
          return caches.match(request);
        });
      })
    );
    return;
  }

  // 5. Default fallback to network
  event.respondWith(fetch(request));
});

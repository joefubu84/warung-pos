// Warung J&J Service Worker - High-Reliability Live POS & QR Ordering (v7)
const CACHE_NAME = 'warung-jnj-v7-live';

self.addEventListener('install', (event) => {
  // Activate new worker immediately without waiting for old tabs to close
  self.skipWaiting();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      // Purge ALL previous caches immediately to prevent stale UI bugs and dynamic import hash mismatches
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('🧹 Purging outdated service worker cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);

  // Critical routes & dynamic module chunks that MUST ALWAYS fetch fresh from network (zero caching)
  const isBypassRoute = 
    event.request.mode === 'navigate' ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/t/') ||
    url.pathname.startsWith('/kitchen') ||
    url.pathname.startsWith('/counter') ||
    url.pathname.startsWith('/orders') ||
    url.pathname.startsWith('/tables') ||
    url.pathname.startsWith('/delivery') ||
    url.pathname.startsWith('/rider') ||
    url.pathname.startsWith('/settings') ||
    url.hostname.includes('supabase.co');

  if (isBypassRoute) {
    event.respondWith(
      fetch(event.request).catch((err) => {
        // Only if completely offline, fallback to cache if available
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          throw err;
        });
      })
    );
    return;
  }

  // Network-first for static assets
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

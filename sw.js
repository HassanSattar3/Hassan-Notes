const CACHE_NAME = 'notes-app-v1';
const ASSETS_TO_CACHE = [
    '/Hassan-Notes/',
    '/Hassan-Notes/index.html',
    '/Hassan-Notes/css/style.css',
    '/Hassan-Notes/js/app.js',
    '/Hassan-Notes/manifest.json',
    '/Hassan-Notes/images/icon-192x192.png',
    '/Hassan-Notes/images/icon-512x512.png'
];

// Install event - cache assets
self.addEventListener('install', event => {
    console.log('[Service Worker] Install');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching all assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activate');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch event - serve cached assets if offline
self.addEventListener('fetch', event => {
    console.log('[Service Worker] Fetch', event.request.url);
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                return cachedResponse || fetch(event.request).then(networkResponse => {
                    // Cache new requests dynamically
                    return caches.open(CACHE_NAME).then(cache => {
                        if (event.request.url.startsWith('http')) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                });
            }).catch(() => {
                // Fallback for offline - can add a custom offline page here
                if (event.request.mode === 'navigate') {
                    return caches.match('/Hassan-Notes/index.html');
                }
            })
    );
});
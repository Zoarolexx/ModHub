const CACHE_NAME = 'modhub-v1';
const STATIC_ASSETS = [
    '/',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/404.html',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css'
];

// Install SW
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate SW
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch with stale-while-revalidate
self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);
    
    // Skip API calls
    if (url.pathname.startsWith('/api/')) {
        return;
    }
    
    // Skip external resources
    if (!url.origin.startsWith(self.location.origin)) {
        if (url.hostname.includes('cdnjs.cloudflare.com')) {
            e.respondWith(
                caches.match(e.request).then(cached => {
                    return cached || fetch(e.request).then(res => {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                        return res;
                    });
                })
            );
            return;
        }
        return;
    }
    
    e.respondWith(
        caches.match(e.request).then(cached => {
            const fetchP = fetch(e.request).then(res => {
                const clone = res.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                return res;
            }).catch(() => {
                if (cached) return cached;
                return caches.match('/404.html') || new Response('Offline - ModHub tidak tersedia', { status: 503 });
            });
            
            return cached || fetchP;
        })
    );
});
const CACHE_NAME = '90mil-radio-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/styles/main.css',
    '/styles/nav.css',
    '/styles/header.css',
    '/styles/content.css',
    '/scripts/main.js',
    '/scripts/nav.js',
    '/assets/fonts/GlacialIndifference-Regular.otf',
    // Add other assets
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS_TO_CACHE))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
}); 
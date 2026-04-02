// Minimal service worker for n8n PWA installability
// This SW enables Chrome's "Install as app" prompt for n8n

const CACHE_NAME = 'n8n-pwa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Fetch handler required for Chrome PWA install criteria
self.addEventListener('fetch', (event) => {
  // Pass all requests through to the network
  // n8n handles its own caching and state management
  event.respondWith(fetch(event.request));
});

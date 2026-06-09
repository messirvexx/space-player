const CACHE_NAME = 'space-player-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://unpkg.com/dexie@latest/dist/dexie.js'
];

// Instalar el Service Worker y guardar la estructura en caché
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activar y limpiar cachés viejas si hacemos actualizaciones
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// Servir la app desde la memoria local cuando no haya internet
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    })
  );
});
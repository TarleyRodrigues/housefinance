// ─── SERVICE WORKER — HouseFinance ───────────────────────────────────────────
// • Páginas (navegação): rede primeiro → cópia em cache se estiver offline
// • JS/CSS/fontes/ícones do próprio app: cache primeiro (arquivos têm hash no nome)
// • Supabase, TMDB, Gemini e qualquer outra origem: NÃO passam pelo cache
//   (dados financeiros sempre vêm frescos do servidor)

const VERSION     = 'v1';
const PAGE_CACHE  = `hf-pages-${VERSION}`;
const ASSET_CACHE = `hf-assets-${VERSION}`;
const MAX_ASSETS  = 80;

const SCOPE = new URL(self.registration.scope).pathname; // '/housefinance/'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PAGE_CACHE)
      .then((cache) => cache.addAll([SCOPE, `${SCOPE}manifest.json`, `${SCOPE}icon.svg`]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('hf-') && k !== PAGE_CACHE && k !== ASSET_CACHE)
            .map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

// Mantém o cache de assets enxuto (remove os mais antigos — de deploys anteriores)
async function trimAssets() {
  const cache = await caches.open(ASSET_CACHE);
  const keys  = await cache.keys();
  for (let i = 0; i < keys.length - MAX_ASSETS; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE)) return;

  // Navegação: rede primeiro, cache como reserva offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGE_CACHE).then((c) => c.put(SCOPE, copy));
          }
          return res;
        })
        .catch(() => caches.match(SCOPE).then((r) => r || Response.error())),
    );
    return;
  }

  // Assets estáticos com hash: cache primeiro
  if (/\.(?:js|css|woff2?|svg|png|jpe?g|webp|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(ASSET_CACHE)
              .then((c) => c.put(request, copy))
              .then(trimAssets);
          }
          return res;
        });
      }),
    );
  }
});

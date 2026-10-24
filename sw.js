// Service worker do app: guarda as telas e scripts para abrir rápido e funcionar sem internet.
// Estratégia "rede primeiro": com internet sempre pega a versão nova (e atualiza o cache);
// sem internet usa a cópia guardada. As rotas /api nunca passam pelo cache (login, perfil, admin).
const CACHE = 'calculadora-v1';
const ESSENCIAIS = [
  '/', '/calculadora', '/style.css', '/auth.js', '/calc.js', '/beds.js', '/planner.js', '/contrato.js',
  '/profile.js', '/pwa.js', '/impressoras.js', '/energia-estados.js', '/marketplaces.js',
  '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ESSENCIAIS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  e.respondWith((async () => {
    try {
      const resp = await fetch(req);
      if (resp.ok) {
        const copia = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copia));
      }
      return resp;
    } catch {
      const guardada = await caches.match(req, { ignoreSearch: true });
      if (guardada) return guardada;
      if (req.mode === 'navigate') return (await caches.match('/calculadora')) || Response.error();
      return Response.error();
    }
  })());
});

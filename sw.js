// Offline support for JEZ Chord Book.
// Bump V when you change this file so phones pick up the new version.
const V = 'jez-chordbook-v1';
const SHELL = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(V)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.hostname.endsWith('.supabase.co')) return; // never touch live data or realtime

  if (u.origin === location.origin) {
    // Your own files: use the network when it answers quickly, else the saved copy.
    const net = fetch(r).then(res => {
      if (res.ok) { const c = res.clone(); caches.open(V).then(ca => ca.put(r, c)); }
      return res;
    });
    const wait = new Promise((_, rej) => setTimeout(rej, 3500));
    e.respondWith(
      Promise.race([net, wait]).catch(() =>
        caches.match(r, { ignoreSearch: true }).then(m =>
          m || (r.mode === 'navigate' ? caches.match('index.html') : null) || Response.error()
        )
      )
    );
  } else if (u.hostname === 'cdn.jsdelivr.net' || u.hostname === 'unpkg.com') {
    // The Supabase library: keep one copy so cloud sync can start offline-to-online.
    e.respondWith(
      caches.match(r).then(m => m || fetch(r).then(res => {
        if (res.ok || res.type === 'opaque') { const c = res.clone(); caches.open(V).then(ca => ca.put(r, c)); }
        return res;
      }))
    );
  }
});

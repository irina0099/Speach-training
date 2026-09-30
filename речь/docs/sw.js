const PREFIX='rech-'+self.registration.scope;
const CACHE=PREFIX+'v1.0.0';
const FILES=['./','./index.html','./style.css','./manifest.webmanifest','./js/app.js','./js/core.js','./js/store.js','./js/api.js','./js/exercises.js','./js/recorder.js','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||!e.request.url.startsWith(self.registration.scope)||e.request.headers.has('Authorization'))return;
  if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match(new URL('./index.html',self.registration.scope))));return;}
  e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request)));
});

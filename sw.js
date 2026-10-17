const CACHE='collect-v11';
const SHELL=['./','index.html','manifest.json','css/base.css','css/components.css','css/collector.css','js/core/config.js','js/core/compress.js','js/core/crypto.js','js/core/db.js','js/core/normalize.js','js/core/utils.js','js/collector/app.js','js/collector/unlock.js','js/collector/fileLoader.js','js/collector/browse.js','js/collector/payment.js','js/collector/ledger.js','js/collector/lock.js','pages/print.html','pages/reading.html','js/collector/search.js','js/collector/personal.js','js/collector/export.js','js/collector/reconcile.js','js/collector/updateCheck.js','js/collector/buttons.js','js/collector/details.js','js/collector/names.js','icons/icon-192.png','icons/icon-512.png'];

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
    .then(()=>self.clients.matchAll({type:'window'}).then(cs=>cs.forEach(c=>c.postMessage({type:'RELOAD'}))))
  );
});

self.addEventListener('message',e=>{
  if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting();
});

self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  if(u.pathname.includes('/data/')||u.pathname.endsWith('version.json')){e.respondWith(fetch(e.request,{cache:'no-store'}));return;}
  e.respondWith(
    caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{
      const c=n.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return n;
    }).catch(()=>caches.match('index.html')))
  );
});